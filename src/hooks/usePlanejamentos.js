import { useState, useEffect } from 'react';
import {
  collection, onSnapshot, doc, setDoc, deleteDoc, runTransaction, serverTimestamp,
} from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import { db, storage, POST_FORMATOS, MIDIA_MAX_MB } from '../lib/firebase';
import { gerarToken, postVazio, statusDoPost, podeEditar, tipoDaMidia } from '../lib/planejamento';

// ─────────────────────────────────────────────────────────────
// Planejamento de conteúdo — persistência (lado da equipe)
//
// Coleção `planejamentos`, um documento por cliente e mês. O id do
// documento é o token do link público (ver lib/planejamento.js), por
// isso a criação usa setDoc com id gerado no crypto em vez de addDoc.
//
// Os posts vivem num array dentro do documento: o cliente lê tudo com
// um único `get` e a página pública não precisa de `list`. Toda
// escrita no array passa por transação para duas abas abertas não
// sobrescreverem uma à outra.
//
// Artes no Storage em `planejamentos/{planoId}/{postId}/...`. A página
// do cliente usa a URL com token do getDownloadURL, então o anônimo
// não precisa de permissão de leitura no Storage.
// ─────────────────────────────────────────────────────────────

const COL = 'planejamentos';
const agoraISO = () => new Date().toISOString();

// Campos que a gaveta de edição salva. Mídia, rodada, etapa e vídeo
// têm funções próprias para não correrem contra o salvamento do texto.
const CAMPOS_TEXTO = ['fmt', 'data', 'hora', 'titulo', 'legenda', 'ideia'];

const apagarArquivo = async (path) => {
  if (!path) return;
  try { await deleteObject(ref(storage, path)); } catch (_) { /* já não existe */ }
};

const nomeSeguro = (nome) => String(nome || 'arquivo').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9._-]+/g, '-').slice(-60);

// Lê o plano, aplica `fn(plano)` e grava o patch devolvido.
async function mexerNoPlano(planoId, fn) {
  return runTransaction(db, async (tx) => {
    const r = doc(db, COL, planoId);
    const snap = await tx.get(r);
    if (!snap.exists()) throw new Error('Planejamento não encontrado.');
    const plano = { id: snap.id, ...snap.data() };
    const { patch, retorno } = fn(plano) || {};
    if (patch) tx.update(r, { ...patch, updatedAt: serverTimestamp() });
    return retorno;
  });
}

// Erro do Storage em linguagem de gente. Em out/2026 o bucket do projeto
// exige o plano Blaze; no Spark todo upload volta com erro.
const erroDeUpload = (err) => {
  const code = String(err?.code || '');
  if (code === 'storage/unauthorized') return 'Sem permissão para subir arquivos. Avise o admin (regras do Storage).';
  if (code === 'storage/canceled') return 'Envio cancelado.';
  if (code.startsWith('storage/')) return 'O armazenamento de arquivos do Firebase recusou o envio. Avise o admin.';
  return err?.message || 'Não foi possível subir a arte.';
};

const trocaPost = (plano, postId, fn) => (plano.posts || []).map((p) => (p.id === postId ? fn(p) : p));

// `ativo: false` não abre o listener (painel que não usa, como o Design,
// mas compartilha o dashboard com quem usa).
export function usePlanejamentos({ ativo = true } = {}) {
  const [planejamentos, setPlanejamentos] = useState([]);
  const [loading, setLoading] = useState(ativo);

  useEffect(() => {
    if (!ativo) { setLoading(false); return undefined; }
    return onSnapshot(collection(db, COL), (snap) => {
      setPlanejamentos(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, () => setLoading(false));
  }, [ativo]);

  // Já nasce com um post em branco: a social cai direto na grade com
  // algo para preencher, como no protótipo validado.
  const criarPlano = async ({ clientId, clientName, mes }, byName) => {
    try {
      if (!clientId) return { success: false, error: 'Escolha o cliente.' };
      if (!mes) return { success: false, error: 'Escolha o mês.' };
      const id = gerarToken();
      const base = { mes, posts: [] };
      const primeiro = postVazio(base);
      await setDoc(doc(db, COL, id), {
        clientId,
        clientName: clientName || '',
        mes,
        rodada: 0,
        enviadoEm: null,
        ultimoEnvioEm: null,
        posts: [primeiro],
        respostas: {},
        respondidoEm: null,
        criadoPor: byName || null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      return { success: true, id, postId: primeiro.id };
    } catch (err) { return { success: false, error: err.message }; }
  };

  const adicionarPost = async (planoId, fmt) => {
    try {
      const postId = await mexerNoPlano(planoId, (plano) => {
        const novo = postVazio(plano, fmt);
        return { patch: { posts: [...(plano.posts || []), novo] }, retorno: novo.id };
      });
      return { success: true, postId };
    } catch (err) { return { success: false, error: err.message }; }
  };

  // Salvamento da gaveta (com debounce em quem chama). Post que já está
  // com o cliente ou aprovado não muda: o cliente aprovou aquele texto.
  const salvarCampos = async (planoId, postId, campos) => {
    try {
      const sobras = [];
      await mexerNoPlano(planoId, (plano) => {
        const atual = (plano.posts || []).find((p) => p.id === postId);
        if (!atual) throw new Error('Post não encontrado.');
        if (!podeEditar(statusDoPost(atual, plano))) throw new Error('Este post está com o cliente e não pode mudar agora.');
        const limpo = {};
        CAMPOS_TEXTO.forEach((k) => { if (campos[k] !== undefined) limpo[k] = campos[k]; });
        // Carrossel virou post único: fica só a primeira arte.
        const max = POST_FORMATOS[limpo.fmt || atual.fmt]?.maxMidias || 1;
        const midias = atual.midias || [];
        if (midias.length > max) sobras.push(...midias.slice(max));
        return { patch: { posts: trocaPost(plano, postId, (p) => ({ ...p, ...limpo, midias: midias.slice(0, max) })) } };
      });
      sobras.forEach((m) => apagarArquivo(m.path));
      return { success: true };
    } catch (err) { return { success: false, error: err.message }; }
  };

  const removerPost = async (planoId, postId) => {
    try {
      const midias = await mexerNoPlano(planoId, (plano) => {
        const alvo = (plano.posts || []).find((p) => p.id === postId);
        const respostas = { ...(plano.respostas || {}) };
        delete respostas[postId];
        return { patch: { posts: (plano.posts || []).filter((p) => p.id !== postId), respostas }, retorno: alvo?.midias || [] };
      });
      (midias || []).forEach((m) => apagarArquivo(m.path));
      return { success: true };
    } catch (err) { return { success: false, error: err.message }; }
  };

  // Sobe as artes uma a uma e anexa ao post. `onProgresso(0..1)`.
  const adicionarMidias = async (planoId, postId, files, onProgresso) => {
    try {
      const lista = Array.from(files || []);
      if (!lista.length) return { success: false, error: 'Selecione um arquivo.' };
      const invalido = lista.find((f) => !/^image\/|^video\//.test(f.type));
      if (invalido) return { success: false, error: `"${invalido.name}" não é imagem nem vídeo.` };
      const grande = lista.find((f) => f.size > MIDIA_MAX_MB * 1024 * 1024);
      if (grande) return { success: false, error: `"${grande.name}" passa de ${MIDIA_MAX_MB} MB.` };

      const total = lista.reduce((s, f) => s + f.size, 0) || 1;
      let enviado = 0;
      const novas = [];
      for (const f of lista) {
        const path = `${COL}/${planoId}/${postId}/${Date.now()}_${nomeSeguro(f.name)}`;
        const tarefa = uploadBytesResumable(ref(storage, path), f, { contentType: f.type });
        const antes = enviado;
        await new Promise((resolve, reject) => {
          tarefa.on('state_changed',
            (s) => onProgresso && onProgresso((antes + s.bytesTransferred) / total),
            reject, resolve);
        });
        enviado += f.size;
        const url = await getDownloadURL(ref(storage, path));
        novas.push({ url, path, tipo: tipoDaMidia(f), nome: f.name });
      }

      const sobras = await mexerNoPlano(planoId, (plano) => {
        const atual = (plano.posts || []).find((p) => p.id === postId);
        if (!atual) throw new Error('Post não encontrado.');
        const max = POST_FORMATOS[atual.fmt]?.maxMidias || 1;
        // Post único: a arte nova substitui a anterior.
        const juntas = max === 1 ? novas.slice(-1) : [...(atual.midias || []), ...novas].slice(0, max);
        const fora = [...(atual.midias || []), ...novas].filter((m) => !juntas.includes(m));
        return { patch: { posts: trocaPost(plano, postId, (p) => ({ ...p, midias: juntas })) }, retorno: fora };
      });
      (sobras || []).forEach((m) => apagarArquivo(m.path));
      return { success: true };
    } catch (err) { return { success: false, error: erroDeUpload(err) }; }
  };

  const removerMidia = async (planoId, postId, path) => {
    try {
      await mexerNoPlano(planoId, (plano) => ({
        patch: { posts: trocaPost(plano, postId, (p) => ({ ...p, midias: (p.midias || []).filter((m) => m.path !== path) })) },
      }));
      apagarArquivo(path);
      return { success: true };
    } catch (err) { return { success: false, error: err.message }; }
  };

  // Manda para o cliente tudo que é rascunho ou ajuste. Cada envio abre
  // uma rodada nova; a resposta antiga do post corrigido deixa de valer.
  const enviarParaAprovacao = async (planoId, byName) => {
    try {
      const n = await mexerNoPlano(planoId, (plano) => {
        const rodada = (plano.rodada || 0) + 1;
        let qtd = 0;
        const posts = (plano.posts || []).map((p) => {
          if (!podeEditar(statusDoPost(p, plano))) return p;
          qtd += 1;
          return { ...p, rodada };
        });
        if (!qtd) return { retorno: 0 };
        const agora = agoraISO();
        return {
          patch: { posts, rodada, enviadoEm: plano.enviadoEm || agora, ultimoEnvioEm: agora, ultimoEnvioPor: byName || null },
          retorno: qtd,
        };
      });
      if (!n) return { success: false, error: 'Nada novo para enviar.' };
      return { success: true, n };
    } catch (err) { return { success: false, error: err.message }; }
  };

  // Etapa manual da social depois da aprovação: produção e publicação.
  const setEtapa = async (planoId, postId, etapa, byName) => {
    try {
      await mexerNoPlano(planoId, (plano) => ({
        patch: { posts: trocaPost(plano, postId, (p) => ({ ...p, etapa: etapa || null, etapaPor: byName || null, etapaEm: agoraISO() })) },
      }));
      return { success: true };
    } catch (err) { return { success: false, error: err.message }; }
  };

  const marcarVideo = async (planoId, postId, entregue, byName) => {
    try {
      await mexerNoPlano(planoId, (plano) => ({
        patch: { posts: trocaPost(plano, postId, (p) => ({ ...p, videoEntregue: !!entregue, videoPor: byName || null, videoEm: entregue ? agoraISO() : null })) },
      }));
      return { success: true };
    } catch (err) { return { success: false, error: err.message }; }
  };

  const excluirPlano = async (plano) => {
    try {
      await deleteDoc(doc(db, COL, plano.id));
      (plano.posts || []).forEach((p) => (p.midias || []).forEach((m) => apagarArquivo(m.path)));
      return { success: true };
    } catch (err) { return { success: false, error: err.message }; }
  };

  return {
    planejamentos, loading,
    criarPlano, adicionarPost, salvarCampos, removerPost,
    adicionarMidias, removerMidia, enviarParaAprovacao,
    setEtapa, marcarVideo, excluirPlano,
  };
}
