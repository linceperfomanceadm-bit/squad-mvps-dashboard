import { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, query, orderBy, where, arrayUnion } from 'firebase/firestore';
// Gravações passam pela trava contra loop (lib/gravacoes.js).
import { updateDoc, deleteDoc, writeBatch } from '../lib/gravacoes';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';

/*
 * useRequests — coleção `requests` (Reporte da CS).
 *
 * Uma solicitação NÃO é task de produção: não tem prazo, não entra no
 * Kanban, não conta em métrica de entrega. É um pedido pontual que a CS
 * faz a um colaborador específico ("o cliente reclamou do post de
 * ontem, consegue olhar?").
 *
 * Fluxo:
 *   CS abre (status 'open')
 *     → colaborador abre a aba e o app marca `seenAt` (a CS enxerga
 *       que ele viu, mesmo sem resposta)
 *     → colaborador responde com a ação tomada e diz se resolveu do
 *       lado dele (status 'answered', flag `collaboratorDone`)
 *     → só a CS encerra (status 'closed'). Encerrada, some da lista
 *       do colaborador e fica no arquivo da CS.
 *
 * Documento:
 *   subject, clientId, clientName, urgency, description,
 *   toName, toSector, createdBy, createdBySector, createdAt,
 *   status, seenAt, seenBy, collaboratorDone,
 *   replies[{ id, author, sector, role, text, done, at }],
 *   closedAt, closedBy,
 *   groupId, groupSize (quando a mesma solicitação foi para várias pessoas)
 *
 * VÁRIOS COLABORADORES: a CS pode endereçar a mesma solicitação a mais
 * de uma pessoa (inclusive de setores diferentes). Cada destinatário
 * ganha o PRÓPRIO documento, ligado aos outros por `groupId`. Foi
 * escolhido assim, e não um array `toNames`, porque visualizado,
 * resposta, "resolvi do meu lado" e encerramento são individuais — um
 * array obrigaria a reescrever inbox, badges, notificações e filtros,
 * e ainda assim misturaria o estado de pessoas diferentes num card só.
 */
// Status que o colaborador ainda enxerga. Encerrada só interessa à CS.
const STATUS_EM_ABERTO = ['open', 'answered'];

// createdAt é string ISO; doc antigo pode ter Timestamp.
const criadoMs = (r) => {
  const c = r.createdAt;
  const d = c?.toDate ? c.toDate() : new Date(c || 0);
  return d.getTime() || 0;
};

export function useRequests() {
  const { user } = useAuth();
  // LEITURA POR PAPEL (26/out/2026, cota do Firestore). O hook roda para
  // todo mundo logado (sino de notificações), e antes cada um lia a
  // coleção inteira, com todo o arquivo de encerradas. Fora da CS,
  // nenhuma tela mostra encerrada (caixa de entrada, contador e
  // notificação olham só open/answered), então só a CS ouve tudo.
  const veArquivo = user?.sector === 'cs';
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Sem orderBy junto do where para não exigir índice composto: a
    // ordem (mais recente primeiro) é feita aqui.
    const q = veArquivo
      ? query(collection(db, 'requests'), orderBy('createdAt', 'desc'))
      : query(collection(db, 'requests'), where('status', 'in', STATUS_EM_ABERTO));
    return onSnapshot(q, snap => {
      const lista = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setRequests(veArquivo ? lista : lista.sort((a, b) => criadoMs(b) - criadoMs(a)));
      setLoading(false);
    }, err => {
      console.error('[useRequests] listener de solicitações falhou:', err);
      setLoading(false);
    });
  }, [veArquivo]);

  const createRequest = async (data, byName, bySector) => {
    try {
      const { subject, clientId, clientName, urgency, description, toName, toSector, recipients } = data || {};
      // `recipients` é o formato novo; `toName`/`toSector` continua
      // aceito para quem ainda chama com um destinatário só.
      const lista = (Array.isArray(recipients) && recipients.length
        ? recipients
        : (toName ? [{ name: toName, sector: toSector }] : []))
        .filter(p => p && p.name)
        .filter((p, i, arr) => arr.findIndex(x => x.name === p.name) === i);

      if (!subject?.trim())     return { success: false, error: 'Escreva o assunto da solicitação.' };
      if (!lista.length)        return { success: false, error: 'Escolha ao menos um colaborador.' };
      if (!description?.trim()) return { success: false, error: 'Descreva o que você precisa.' };

      const agora = new Date().toISOString();
      const groupId = lista.length > 1 ? `grp_${Date.now()}_${Math.random().toString(36).substr(2, 5)}` : null;

      // Lote: ou vai para todos, ou não vai para ninguém.
      const batch = writeBatch(db);
      lista.forEach(p => {
        batch.set(doc(collection(db, 'requests')), {
          subject: subject.trim(),
          clientId: clientId || null,
          clientName: clientName || 'Sem cliente',
          urgency: urgency || 'medium',
          description: description.trim(),
          toName: p.name,
          toSector: p.sector || '',
          createdBy: byName || 'CS',
          createdBySector: bySector || 'cs',
          createdAt: agora,
          status: 'open',
          seenAt: null,
          seenBy: null,
          collaboratorDone: false,
          replies: [],
          closedAt: null,
          closedBy: null,
          groupId,
          groupSize: lista.length,
        });
      });
      await batch.commit();
      return { success: true, count: lista.length };
    } catch (err) { return { success: false, error: err.message }; }
  };

  // Marca o "visualizado" uma única vez — depois disso o carimbo não
  // muda mais, senão a CS perderia a informação de quando ele viu.
  const markSeen = async (request, byName) => {
    try {
      if (!request || request.seenAt) return { success: true };
      await updateDoc(doc(db, 'requests', request.id), {
        seenAt: new Date().toISOString(),
        seenBy: byName || null,
      });
      return { success: true };
    } catch (err) { return { success: false, error: err.message }; }
  };

  // role: 'collab' (colaborador) ou 'cs'.
  const addReply = async (requestId, { author, sector, text, done, role }) => {
    try {
      if (!text?.trim()) return { success: false, error: 'Escreva a resposta.' };
      const reply = {
        id: `rep_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        author: author || 'Desconhecido',
        sector: sector || '',
        role: role || 'collab',
        text: text.trim(),
        done: done === true,
        at: new Date().toISOString(),
      };
      const patch = { replies: arrayUnion(reply) };
      if (role === 'collab') {
        patch.status = 'answered';
        patch.collaboratorDone = done === true;
      }
      await updateDoc(doc(db, 'requests', requestId), patch);
      return { success: true };
    } catch (err) { return { success: false, error: err.message }; }
  };

  const closeRequest = async (requestId, byName) => {
    try {
      await updateDoc(doc(db, 'requests', requestId), {
        status: 'closed',
        closedAt: new Date().toISOString(),
        closedBy: byName || null,
      });
      return { success: true };
    } catch (err) { return { success: false, error: err.message }; }
  };

  const deleteRequest = async (requestId) => {
    try { await deleteDoc(doc(db, 'requests', requestId)); return { success: true }; }
    catch (err) { return { success: false, error: err.message }; }
  };

  return { requests, loading, createRequest, markSeen, addReply, closeRequest, deleteRequest };
}
