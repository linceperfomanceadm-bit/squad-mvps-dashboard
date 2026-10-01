import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { X, Sparkles } from 'lucide-react';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
 
/*
 * Popup de novidades (patch notes). Aparece 1x quando o colaborador
 * loga e ainda não viu a versão atual das notas. Some ao fechar e só
 * volta quando a versão (PATCH_VERSION) mudar.
 *
 * Como adicionar novas notas no futuro: incremente PATCH_VERSION e
 * edite PATCH_NOTES. Todos os colaboradores verão uma vez no próximo
 * login. Use só linguagem que faz sentido para o usuário (sem tecnês).
 */
 
export const PATCH_VERSION = '2026-10-1';
 
const PATCH_NOTES = {
  date: 'Outubro de 2026',
  title: 'Novidades no painel',
  items: [
    { emoji: '1️⃣', text: 'No cadastro do cliente, cada entrega agora pode ser Mensal ou Única. A Única (ex.: Google Meu Negócio) aparece como 0 de 1 até alguém marcar, conta no mês em que foi feita e não volta nos meses seguintes.' },
    { emoji: '🔧', text: 'Trocar o setor ou corrigir o nome de uma entrega no cadastro agora vale na hora, inclusive no mês em andamento. Mudança de quantidade continua valendo a partir do próximo mês.' },
    { emoji: '👥', text: 'Nas tasks, quem criou a task (ou o admin) agora pode tirar qualquer responsável e escolher quem é o principal, tocando na estrela. Quem sai da task deixa de contar nas entregas e ajustes dela.' },
    { emoji: '🚀', text: 'Landing Page, E-commerce e ID Visual agora contam sozinhos em "Entregas do mês": o serviço aparece como 0 de 1 enquanto está em andamento e vira 1 de 1 no mês em que você finaliza o card no painel. Não precisa marcar nada.' },
    { emoji: '👤', text: 'Quando alguém sai da agência e é excluído do app, o nome sai também da carteira dos clientes. Se o cliente ficar sem ninguém no seu setor, ele aparece para o líder em "Clientes sem responsável", na aba de Onboarding, para indicar outra pessoa.' },
    { emoji: '📊', text: 'Entregas do mês sem "atrasado" ou "abaixo do ritmo": o acompanhamento agora é só o contador e a barra, respeitando o planejamento de cada cliente.' },
    { emoji: '🗂️', text: 'Documentos agora ficam em pastas por cliente. A pasta aparece sozinha com o primeiro documento e reúne todos os relatórios daquele cliente.' },
    { emoji: '✅', text: 'No Mural, o card de cada cliente tem o checklist do mês: planejamento mensal aprovado e relatório mensal criado.' },
    { emoji: '🏆', text: 'No Painel de TV, a destaque das Social Medias agora é quem tem a melhor média do mês entre planejamentos, relatórios, posts publicados e clientes em operação — tudo com base no que vocês marcam no app.' },
  ],
};
 
export default function PatchNotesPopup({ user }) {
  const [show, setShow] = useState(false);
 
  useEffect(() => {
    if (!user?.id && !user?.authUid) return;
    const docId = user.id || user.authUid;
    const lsKey = `patchSeen_${docId}`;
    let cancelled = false;
    (async () => {
      // 1 checagem local rapida: se ja viu nesta maquina, nem mostra
      try {
        if (localStorage.getItem(lsKey) === PATCH_VERSION) return;
      } catch {}
      // 2 checagem no Firestore, persiste entre dispositivos
      try {
        const snap = await getDoc(doc(db, 'collaborators', docId));
        const seen = snap.exists() ? snap.data().lastPatchSeen : null;
        if (!cancelled && seen !== PATCH_VERSION) setShow(true);
      } catch {
        // sem doc, ex admin master: cai no controle local apenas
        if (!cancelled) setShow(true);
      }
    })();
    return () => { cancelled = true; };
  }, [user]);
 
  const close = async () => {
    setShow(false);
    const docId = user.id || user.authUid;
    // grava local sempre, cobre admin master e falhas de escrita
    try { localStorage.setItem(`patchSeen_${docId}`, PATCH_VERSION); } catch {}
    // grava no Firestore quando há doc, persiste entre dispositivos
    try { await updateDoc(doc(db, 'collaborators', docId), { lastPatchSeen: PATCH_VERSION }); } catch { /* best-effort */ }
  };
 
  if (!show) return null;
 
  return ReactDOM.createPortal(
    <div onClick={close} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.65)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, padding: 20 }}>
      <div onClick={e => e.stopPropagation()} className="fade-up" style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 18, width: '100%', maxWidth: 440, overflow: 'hidden', boxShadow: '0 24px 64px rgba(0,0,0,.7)' }}>
        <div style={{ background: 'var(--grad)', padding: '22px 24px', position: 'relative' }}>
          <Sparkles size={26} color="#fff" style={{ marginBottom: 8 }} />
          <h2 style={{ fontSize: 20, fontWeight: 600, color: 'var(--text)' }}>{PATCH_NOTES.title}</h2>
          <p style={{ fontSize: 12, color: 'var(--text)', fontFamily: 'var(--fm)', marginTop: 2 }}>{PATCH_NOTES.date}</p>
          <button onClick={close} style={{ position: 'absolute', top: 16, right: 16, background: 'var(--border-s)', border: 'none', borderRadius: 8, padding: 6, cursor: 'pointer', display: 'flex' }}><X size={16} color="#fff" /></button>
        </div>
        <div style={{ padding: 22 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {PATCH_NOTES.items.map((it, i) => (
              <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <span style={{ fontSize: 18, flexShrink: 0 }}>{it.emoji}</span>
                <span style={{ fontSize: 14, color: 'var(--text)', lineHeight: 1.5 }}>{it.text}</span>
              </div>
            ))}
          </div>
          <button onClick={close} style={{ width: '100%', marginTop: 22, background: 'var(--grad)', border: 'none', borderRadius: 10, padding: '13px', color: 'var(--on)', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
            Entendi!
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
