import { useState, useEffect, useRef } from 'react';
import {
  collection, onSnapshot, addDoc, updateDoc,
  deleteDoc, doc, serverTimestamp, query, orderBy,
  writeBatch, FieldPath,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { businessMsBetween, isDeliveryOnTime, taskTimeStats } from '../lib/taskTime';

// ─── Ordem pessoal do Kanban ──────────────────────────────────
// Cada pessoa organiza as colunas do jeito dela, arrastando o card
// dentro da coluna. A ordem é PESSOAL: a mesma task aparece no board
// de quem pediu e de quem executa, e um não pode bagunçar o outro.
// Por isso ela fica num mapa dentro da própria task, por nome:
//
//   sortOrder: { 'Fulano': 0, 'Ciclana': 3000 }
//
// Recebe a coluna inteira já na ordem nova e grava só o que mudou,
// numa escrita atômica. FieldPath em vez de 'sortOrder.Nome' porque
// nome de pessoa pode ter ponto, e o ponto quebraria o caminho.
//
// Fica fora do hook de propósito: o Kanban é montado por vários
// painéis e nenhum precisa repassar mais um handler para isso.
export async function saveTaskOrder(userName, orderedIds, allTasks) {
  if (!userName || !Array.isArray(orderedIds) || !orderedIds.length) return { success: true };
  try {
    const batch = writeBatch(db);
    let mudou = 0;
    orderedIds.forEach((id, i) => {
      const valor = i * 1000;
      const task = (allTasks || []).find(t => t.id === id);
      if (task?.sortOrder?.[userName] === valor) return;
      batch.update(doc(db, 'tasks', id), new FieldPath('sortOrder', userName), valor);
      mudou += 1;
    });
    if (mudou) await batch.commit();
    return { success: true };
  } catch (err) { return { success: false, error: err.message }; }
}

// ─── Auto-reparo de tasks presas em aprovação ──────────────────
// Bug histórico: ao enviar para aprovação sem escolher aprovador, a
// task gravava o próprio executor como aprovador (deliveredBy ===
// responsibleName) e ficava presa. Esta função detecta essas tasks e
// as devolve para "Em Produção" com o responsável original, uma única
// vez. É idempotente: se não há nada corrompido, não faz nada.
function isStuckApproval(t) {
  if (t.status !== 'approval') return false;
  const tl = Array.isArray(t.timeline) ? t.timeline : [];
  const lastApproval = [...tl].reverse().find(e => e && e.action === 'sent_for_approval');
  const selfDeliver = t.deliveredBy && t.deliveredBy === t.responsibleName;
  const selfHandoff = lastApproval && lastApproval.by && lastApproval.to && lastApproval.by === lastApproval.to;
  const noApprover  = !t.responsibleName;
  return selfDeliver || selfHandoff || noApprover;
}

// Detecta o desalinhamento singular/plural: responsibleName foi
// atualizado (ex.: aprovador), mas responsibleNames ficou com o valor
// antigo. Isso faz a task sumir do kanban de quem deveria vê-la.
function hasNameMismatch(t) {
  if (!t.responsibleName) return false;
  const names = Array.isArray(t.responsibleNames) ? t.responsibleNames : [];
  // Se o array não contém o responsável singular, está dessincronizado.
  return !names.includes(t.responsibleName);
}

// ─── Crédito de entrega ───────────────────────────────────────
// REGRA: uma task entregue vale UMA entrega no total da agência,
// mas conta para TODOS que a executaram. O total por setor, o
// recorde do dia e o contador do mês seguem contando TASKS; só os
// rankings por pessoa é que expandem a equipe.
//
// `deliveredByNames` guarda quem estava responsável no momento de
// cada entrega. Existe porque `responsibleNames` é sobrescrito com o
// aprovador logo em seguida (moveToApproval), o que apagava a equipe.
// É acumulativo: se a task voltou para ajuste com outra pessoa, todo
// mundo que entregou em alguma rodada continua creditado.
//
// Task antiga, sem o campo, cai no responsável principal — exatamente
// o comportamento anterior, então nenhum número histórico muda.
export function entregadoresDe(task) {
  if (!task) return [];
  const equipe = Array.isArray(task.deliveredByNames)
    ? task.deliveredByNames.filter(Boolean)
    : [];
  if (equipe.length) return [...new Set(equipe)];
  const principal = task.deliveredBy || task.responsibleName;
  return principal ? [principal] : [];
}

// ─── Responsáveis (depois da task já criada) ──────────────────
// Só o CRIADOR da task (requestedBy) e o admin chamam esta função, e
// só com a task em "Não Iniciada" ou "Em Produção" — a permissão é
// validada na UI (TaskModal). Em aprovação o responsável é o aprovador
// e mexer ali trocaria quem revisa, não quem produz.
//
// `people` é a lista COMPLETA e ordenada: o primeiro é o responsável
// principal (responsibleName — quem entrega e vira deliveredBy). Antes
// o principal era intocável e só os extras mudavam; na prática, quando
// a task passava para outra pessoa, o principal antigo não tinha como
// sair e seguia creditado — inclusive nas refações (set/2026).
//
// REGRA: quem SAI da task sai também de `deliveredByNames`, o crédito
// usado nas métricas por pessoa (entregas, ajustes, aprovação de
// primeira — ver entregadoresDe). Tirar alguém da task é dizer que ele
// não fez parte dela. Quem saiu por uma refação (rejectTask troca o
// responsável) não passa por aqui e mantém o crédito da rodada que
// entregou. Tudo fica registrado na timeline e no chat da task.
//
// É uma função solta (não faz parte do hook) para que o TaskModal possa
// usá-la direto, sem precisar passar prop nova por TaskKanban, pelos 5
// dashboards e pelo AdminFeed.
export async function updateTaskResponsibles(task, people, byName, bySector) {
  try {
    if (!task || !task.id) return { success: false, error: 'Task não encontrada.' };
    if (task.status === 'approval' || task.status === 'done') {
      return { success: false, error: 'Os responsáveis só mudam com a task não iniciada ou em produção.' };
    }

    // Normaliza: sem vazios e sem duplicados, mantendo a ordem.
    const seen = new Set();
    const lista = [];
    (people || []).forEach(p => {
      const name = String(p?.name || '').trim();
      if (!name || seen.has(name)) return;
      seen.add(name);
      lista.push({ name, sector: p?.sector || null });
    });
    if (!lista.length) return { success: false, error: 'A task precisa de ao menos um responsável.' };

    const principal = lista[0];
    const names = lista.map(p => p.name);
    const uniqueSectors = Array.from(new Set(lista.map(p => p.sector).filter(Boolean)));

    const before = (Array.isArray(task.responsibleNames) && task.responsibleNames.length)
      ? task.responsibleNames
      : (task.responsibleName ? [task.responsibleName] : []);
    const principalAntes = task.responsibleName || before[0] || null;

    // Nada mudou — não escreve nem polui o chat com comentário repetido.
    const unchanged = before.length === names.length && before.every((n, i) => n === names[i]);
    if (unchanged) return { success: true, unchanged: true };

    const now = new Date().toISOString();
    const added   = names.filter(n => !before.includes(n));
    const removed = before.filter(n => !names.includes(n));
    const trocouPrincipal = principal.name !== principalAntes;

    const parts = [];
    if (added.length)   parts.push(`entrou: ${added.join(', ')}`);
    if (removed.length) parts.push(`saiu: ${removed.join(', ')}`);
    if (trocouPrincipal) parts.push(`principal: ${principal.name}`);

    const timeline = [...(task.timeline || []), {
      action: 'responsibles_changed',
      by: byName,
      sector: bySector,
      at: now,
      added,
      removed,
      principal: principal.name,
      to: names,
    }];

    const comments = [...(task.comments || []), {
      id: `c_${Date.now()}`,
      author: byName,
      sector: bySector,
      text: `👥 Responsáveis atualizados (${parts.join(' · ')}). Agora: ${names.join(', ')}.`,
      createdAt: now,
      isSystem: true,
    }];

    const patch = {
      responsibleName: principal.name,
      // Setor do principal: o que veio da tela; se não veio (pessoa
      // desativada), mantém o atual quando o principal não mudou.
      responsibleSector: principal.sector || (trocouPrincipal ? null : task.responsibleSector) || null,
      responsibleNames: names,
      responsibleSectors: uniqueSectors,
      timeline,
      comments,
    };

    // Quem saiu deixa de contar nas métricas desta task. Task antiga
    // sem o campo não tem o que limpar.
    if (removed.length && Array.isArray(task.deliveredByNames)) {
      patch.deliveredByNames = task.deliveredByNames.filter(n => n && !removed.includes(n));
    }

    await updateDoc(doc(db, 'tasks', task.id), patch);
    return { success: true, removed };
  } catch (err) { return { success: false, error: err.message }; }
}

export function useTasks() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  // Garante que o auto-reparo rode só uma vez por sessão do hook.
  const repairedRef = useRef(false);

  useEffect(() => {
    const q = query(collection(db, 'tasks'), orderBy('createdAt', 'desc'));
    return onSnapshot(q, snap => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setTasks(list);
      setLoading(false);

      // Auto-reparo (uma vez). Corrige no Firestore; o snapshot propaga
      // o resultado para todos os usuários automaticamente.
      if (!repairedRef.current) {
        repairedRef.current = true;

        // (a) Tasks presas em aprovação com executor = aprovador.
        const stuck = list.filter(isStuckApproval);
        stuck.forEach(t => {
          const tl = Array.isArray(t.timeline) ? t.timeline : [];
          const lastApproval = [...tl].reverse().find(e => e && e.action === 'sent_for_approval');
          const restoreName   = t.deliveredBy || (lastApproval && lastApproval.by) || t.responsibleName || null;
          const restoreSector = t.deliveredBySector || (lastApproval && lastApproval.sector) || t.responsibleSector || null;
          updateDoc(doc(db, 'tasks', t.id), {
            status: 'doing',
            responsibleName: restoreName,
            responsibleSector: restoreSector,
            responsibleNames: restoreName ? [restoreName] : [],
            deliveredBy: null,
            deliveredBySector: null,
            approvalAt: null,
            // Sai do congelamento junto — senão a task volta para
            // produção com o relógio de prazo ainda parado.
            approvalStartedAt: null,
          }).catch(() => {});
        });

        // (b) Tasks com responsibleNames dessincronizado do singular
        //     (causa da task sumir do kanban do responsável correto).
        //     Só corrige o que NÃO caiu no reparo (a) acima.
        const stuckIds = new Set(stuck.map(t => t.id));
        list.filter(t => !stuckIds.has(t.id) && hasNameMismatch(t)).forEach(t => {
          updateDoc(doc(db, 'tasks', t.id), {
            responsibleNames: [t.responsibleName],
          }).catch(() => {});
        });
      }
    });
  }, []);

  // ── Create task ──────────────────────────────────────────────
  const createTask = async ({ name, clientId, clientName, deadline, priority, responsibleSector, responsibleName, responsibleNames, requestedBy, requestedBySector, comment, links }) => {
    try {
      const now = new Date().toISOString();
      // responsibleNames: lista de todos os responsáveis. responsibleName
      // (singular) = principal, mantido para a lógica de entrega/métricas.
      const names = (responsibleNames && responsibleNames.length) ? responsibleNames : (responsibleName ? [responsibleName] : []);
      await addDoc(collection(db, 'tasks'), {
        name,
        clientId,
        clientName,
        deadline,
        priority,
        responsibleSector,
        responsibleName: names[0] || responsibleName,
        responsibleNames: names,
        // deliveredBy tracks who actually did the work (set when moved to approval)
        deliveredBy: null,
        deliveredBySector: null,
        requestedBy,
        requestedBySector,
        status: 'todo',
        isRework: false,
        reworkCount: 0,
        links: links || [],
        comments: comment ? [{
          id: `c_${Date.now()}`,
          author: requestedBy,
          sector: requestedBySector,
          text: comment,
          createdAt: now,
        }] : [],
        timeline: [{
          action: 'created',
          by: requestedBy,
          sector: requestedBySector,
          at: now,
          // Equipe inicial. É o que permite ao motor de tempo saber
          // quem acumula desde o primeiro minuto, mesmo depois de
          // responsibleNames ser sobrescrito pelo aprovador.
          equipe: names,
        }],
        startedAt: null,
        approvalAt: null,
        completedAt: null,
        // ── Controle de prazo ──────────────────────────────────
        // pausedMs: tempo ÚTIL que a task passou congelada em
        // aprovação. É devolvido ao prazo se ela voltar para ajuste.
        pausedMs: 0,
        approvalStartedAt: null,
        deliveredAt: null,
        deliveredOnTime: null,
        firstDeliveredAt: null,
        firstDeliveredOnTime: null,
        timeStats: null,
        createdAt: serverTimestamp(),
      });
      return { success: true };
    } catch (err) { return { success: false, error: err.message }; }
  };

  // ── Move to Em Produção ──────────────────────────────────────
  const moveToProduction = async (taskId, updatedLinks) => {
    try {
      const task = tasks.find(t => t.id === taskId);
      if (!task) throw new Error('Task não encontrada');
      const now = new Date().toISOString();
      const timeline = [...(task.timeline || []), {
        action: 'started',
        by: task.responsibleName,
        sector: task.responsibleSector,
        at: now,
      }];
      await updateDoc(doc(db, 'tasks', taskId), {
        status: 'doing',
        startedAt: task.startedAt || now,
        links: updatedLinks || task.links,
        timeline,
      });
      return { success: true };
    } catch (err) { return { success: false, error: err.message }; }
  };

  // ── Move to Em Aprovação ─────────────────────────────────────
  // deliveredBy = quem realmente fez o trabalho (responsável atual
  // antes do handoff).
  //
  // É AQUI que o prazo congela. O que define se o colaborador entregou
  // no prazo é ESTE instante — não a data em que o aprovador resolveu
  // clicar. Enquanto a task estiver em aprovação ela não acumula
  // atraso; se voltar para ajuste, o tempo parado volta para o prazo.
  const moveToApproval = async (taskId, approverName, approverSector, updatedLinks) => {
    try {
      const task = tasks.find(t => t.id === taskId);
      if (!task) throw new Error('Task não encontrada');
      // Guarda: sem aprovador explícito, não envia (evita gravar o
      // próprio executor como aprovador — origem do bug).
      if (!approverName || !approverSector) {
        return { success: false, error: 'Selecione quem vai aprovar antes de enviar.' };
      }
      const at = new Date();
      const now = at.toISOString();
      const onTime = isDeliveryOnTime(task, at);

      // Quem estava responsável ANTES do handoff para o aprovador.
      // Somado ao que já havia sido creditado em entregas anteriores
      // (a task pode ter voltado para ajuste com outra pessoa).
      const executores = (Array.isArray(task.responsibleNames) && task.responsibleNames.length)
        ? task.responsibleNames.filter(Boolean)
        : (task.responsibleName ? [task.responsibleName] : []);
      const jaCreditados = Array.isArray(task.deliveredByNames)
        ? task.deliveredByNames.filter(Boolean)
        : [];
      const equipeDaEntrega = [...new Set([...jaCreditados, ...executores])];

      const timeline = [...(task.timeline || []), {
        action: 'sent_for_approval',
        by: task.responsibleName,
        sector: task.responsibleSector,
        to: approverName,
        at: now,
        onTime,
      }];

      const patch = {
        status: 'approval',
        approvalAt: now,
        // Marca o início do congelamento do prazo.
        approvalStartedAt: now,
        deliveredAt: now,
        deliveredOnTime: onTime,
        // Save who delivered before changing responsible to approver
        deliveredBy: task.responsibleName,
        deliveredBySector: task.responsibleSector,
        // Equipe da entrega: TODOS os responsáveis deste ciclo, não só
        // o principal. Precisa ser gravado aqui porque a linha abaixo
        // sobrescreve responsibleNames com o aprovador. Acumula entre
        // rodadas de ajuste — ver entregadoresDe().
        deliveredByNames: equipeDaEntrega,
        responsibleName: approverName,
        responsibleSector: approverSector,
        // Sincroniza o array plural — a UI (card, filtros do kanban,
        // isResponsible) lê responsibleNames; sem isto a task some do
        // kanban do aprovador e continua no de quem entregou.
        responsibleNames: [approverName],
        responsibleSectors: [approverSector],
        links: updatedLinks || task.links,
        timeline,
      };

      // A primeira entrega é o que conta no KPI do colaborador —
      // gravada uma única vez, imune a rodadas de ajuste posteriores.
      if (!task.firstDeliveredAt) {
        patch.firstDeliveredAt = now;
        patch.firstDeliveredOnTime = onTime;
      }

      await updateDoc(doc(db, 'tasks', taskId), patch);
      return { success: true };
    } catch (err) { return { success: false, error: err.message }; }
  };

  // ── Approve (complete) task ──────────────────────────────────
  // Fecha o congelamento e grava o retrato do tempo no próprio doc,
  // para o Extrato e os Relatórios não precisarem recalcular a
  // timeline inteira a cada render.
  const approveTask = async (taskId) => {
    try {
      const task = tasks.find(t => t.id === taskId);
      if (!task) throw new Error('Task não encontrada');
      const at = new Date();
      const now = at.toISOString();
      const timeline = [...(task.timeline || []), {
        action: 'completed',
        by: task.responsibleName,
        sector: task.responsibleSector,
        at: now,
      }];

      const pausedMs = (Number(task.pausedMs) || 0) + (
        task.approvalStartedAt ? businessMsBetween(task.approvalStartedAt, at) : 0
      );

      // Calcula em cima do estado FINAL da task (com o evento de
      // conclusão já incluído), senão o último trecho fica de fora.
      const stats = taskTimeStats(
        { ...task, timeline, status: 'done', completedAt: now },
        at
      );

      await updateDoc(doc(db, 'tasks', taskId), {
        status: 'done',
        completedAt: now,
        isRework: false,
        approvalStartedAt: null,
        pausedMs,
        timeline,
        timeStats: {
          totalMs: stats.totalMs,
          queueMs: stats.queueMs,
          workMs: stats.workMs,
          reworkMs: stats.reworkMs,
          approvalMs: stats.approvalMs,
          byPerson: stats.byPerson,
          computedAt: now,
        },
      });
      return { success: true };
    } catch (err) { return { success: false, error: err.message }; }
  };

  // ── Reject (send back for rework) ───────────────────────────
  // Encerra o congelamento e devolve ao prazo o tempo útil que a task
  // passou esperando aprovação. Quem vai ajustar não herda o atraso de
  // quem demorou para revisar.
  const rejectTask = async (taskId, reworkNote, newResponsibleName, newResponsibleSector) => {
    try {
      const task = tasks.find(t => t.id === taskId);
      if (!task) throw new Error('Task não encontrada');
      const at = new Date();
      const now = at.toISOString();
      const reworkCount = (task.reworkCount || 0) + 1;
      const reworkComment = {
        id: `c_${Date.now()}`,
        author: task.responsibleName,
        sector: task.responsibleSector,
        text: `🔄 Ajuste necessário: ${reworkNote}`,
        createdAt: now,
        isRework: true,
      };
      const timeline = [...(task.timeline || []), {
        action: 'rejected',
        by: task.responsibleName,
        sector: task.responsibleSector,
        note: reworkNote,
        newResponsible: newResponsibleName,
        newResponsibleSector: newResponsibleSector,
        at: now,
      }];

      const pausedMs = (Number(task.pausedMs) || 0) + (
        task.approvalStartedAt ? businessMsBetween(task.approvalStartedAt, at) : 0
      );

      await updateDoc(doc(db, 'tasks', taskId), {
        status: 'doing',
        isRework: true,
        reworkCount,
        responsibleName: newResponsibleName,
        responsibleSector: newResponsibleSector,
        // Mantém o array plural em sincronia com o singular.
        responsibleNames: [newResponsibleName],
        responsibleSectors: [newResponsibleSector],
        // Reset deliveredBy so next approval cycle tracks correctly
        deliveredBy: null,
        deliveredBySector: null,
        // Sai do congelamento: o relógio do prazo volta a correr, já
        // descontado o tempo que ficou parado.
        approvalAt: null,
        approvalStartedAt: null,
        pausedMs,
        comments: [...(task.comments || []), reworkComment],
        timeline,
      });
      return { success: true };
    } catch (err) { return { success: false, error: err.message }; }
  };

  // ── Add comment ──────────────────────────────────────────────
  const addComment = async (taskId, author, sector, text) => {
    try {
      const task = tasks.find(t => t.id === taskId);
      if (!task) throw new Error('Task não encontrada');
      const newComment = {
        id: `c_${Date.now()}`,
        author, sector, text,
        createdAt: new Date().toISOString(),
        isRework: false,
      };
      await updateDoc(doc(db, 'tasks', taskId), {
        comments: [...(task.comments || []), newComment],
      });
      return { success: true };
    } catch (err) { return { success: false, error: err.message }; }
  };

  // ── Update links ─────────────────────────────────────────────
  const updateLinks = async (taskId, links) => {
    try {
      await updateDoc(doc(db, 'tasks', taskId), { links });
      return { success: true };
    } catch (err) { return { success: false, error: err.message }; }
  };

  // ── Alterar data de entrega (com justificativa) ─────────────
  // Registra na timeline E como comentário no chat da task.
  const changeDeadline = async (taskId, newDeadline, reason, byName, bySector) => {
    try {
      const task = tasks.find(t => t.id === taskId);
      if (!task) return { success: false, error: 'Task não encontrada.' };
      if (!reason || !reason.trim()) return { success: false, error: 'Justifique a mudança de data.' };
      const now = new Date().toISOString();
      const oldDeadline = task.deadline || '—';
      const timeline = [...(task.timeline || []), {
        action: 'deadline_changed',
        by: byName,
        sector: bySector,
        at: now,
        from: oldDeadline,
        to: newDeadline,
        reason: reason.trim(),
      }];
      const comments = [...(task.comments || []), {
        id: `c_${Date.now()}`,
        author: byName,
        sector: bySector,
        text: `📅 Data de entrega alterada de ${oldDeadline} para ${newDeadline}. Motivo: ${reason.trim()}`,
        createdAt: now,
        isSystem: true,
      }];
      await updateDoc(doc(db, 'tasks', taskId), { deadline: newDeadline, timeline, comments });
      return { success: true };
    } catch (err) { return { success: false, error: err.message }; }
  };

  // ── Delete task ──────────────────────────────────────────────
  const deleteTask = async (taskId) => {
    try {
      await deleteDoc(doc(db, 'tasks', taskId));
      return { success: true };
    } catch (err) { return { success: false, error: err.message }; }
  };

  // ── Helper: tasks visible to a user ─────────────────────────
  const getMyTasks = (userName) => {
    return tasks.filter(t =>
      t.responsibleName === userName ||
      (Array.isArray(t.responsibleNames) && t.responsibleNames.includes(userName)) ||
      t.requestedBy === userName ||
      t.deliveredBy === userName
    );
  };

  return {
    tasks, loading,
    createTask, moveToProduction, moveToApproval,
    approveTask, rejectTask, addComment, updateLinks, deleteTask,
    changeDeadline, getMyTasks,
  };
}
