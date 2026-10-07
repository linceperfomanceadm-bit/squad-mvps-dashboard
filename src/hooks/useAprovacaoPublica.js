import { useState, useEffect } from 'react';
import { doc, onSnapshot, updateDoc, deleteField } from 'firebase/firestore';
import { onAuthStateChanged, signInAnonymously } from 'firebase/auth';
import { db, auth } from '../lib/firebase';

// ─────────────────────────────────────────────────────────────
// Página pública de aprovação (/aprovar/:token)
//
// Mesmo login anônimo da /tv: o cliente não tem conta. O token é o id
// do documento — a regra deixa o anônimo dar `get` nele (nunca `list`)
// e escrever SÓ `respostas` e `respondidoEm`. O conteúdo dos posts é
// da social media e o cliente não consegue alterar.
//
// Se quem abre o link é alguém da equipe logado (botão "Ver como o
// cliente"), a página vira prévia: mostra tudo e não grava resposta,
// para ninguém aprovar no lugar do cliente sem querer.
// ─────────────────────────────────────────────────────────────

export function useAprovacaoPublica(token) {
  const [plano, setPlano] = useState(null);
  const [estado, setEstado] = useState('carregando'); // carregando | ok | inexistente | erro
  const [authPronto, setAuthPronto] = useState(false);
  const [previa, setPrevia] = useState(false);

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      if (u) { setPrevia(!u.isAnonymous); setAuthPronto(true); return; }
      signInAnonymously(auth).catch(() => setEstado('erro'));
    });
  }, []);

  useEffect(() => {
    if (!authPronto || !token) return undefined;
    return onSnapshot(doc(db, 'planejamentos', token), (snap) => {
      if (!snap.exists()) { setPlano(null); setEstado('inexistente'); return; }
      setPlano({ id: snap.id, ...snap.data() });
      setEstado('ok');
    }, (err) => setEstado(err?.code === 'permission-denied' ? 'inexistente' : 'erro'));
  }, [authPronto, token]);

  const gravar = async (patch) => {
    if (previa) return { success: false, error: 'Prévia da equipe: a resposta não é enviada.' };
    try {
      await updateDoc(doc(db, 'planejamentos', token), { ...patch, respondidoEm: new Date().toISOString() });
      return { success: true };
    } catch (err) { return { success: false, error: 'Não foi possível enviar. Confira a internet e tente de novo.' }; }
  };

  // A resposta guarda a rodada do post: se a social corrigir e reenviar,
  // ela deixa de valer sozinha.
  const responder = (post, st, comentario = '') => gravar({
    [`respostas.${post.id}`]: { st, comentario: String(comentario || '').slice(0, 2000), rodada: post.rodada, em: new Date().toISOString() },
  });

  const aprovarVarios = (posts) => {
    const patch = {};
    const em = new Date().toISOString();
    posts.forEach((p) => { patch[`respostas.${p.id}`] = { st: 'aprovado', comentario: '', rodada: p.rodada, em }; });
    return gravar(patch);
  };

  const desfazer = (post) => gravar({ [`respostas.${post.id}`]: deleteField() });

  return { plano, estado, previa, responder, aprovarVarios, desfazer };
}
