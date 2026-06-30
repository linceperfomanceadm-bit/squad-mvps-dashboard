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

export const PATCH_VERSION = '2026-06-1';

const PATCH_NOTES = {
  date: 'Junho de 2026',
  title: 'Novidades no painel',
  items: [
    { emoji: '👥', text: 'Agora uma task pode ter mais de um responsável.' },
    { emoji: '📅', text: 'Dá para alterar a data de entrega de uma task — basta justificar a mudança.' },
    { emoji: '✅', text: 'O "Meu Dia" foi repaginado: um botão único para criar atividades (anotação, card ou lembrete).' },
    { emoji: '🤝', text: 'No cadastro de clientes, cada setor pode ter mais de um responsável.' },
    { emoji: '🛠️', text: 'Corrigimos a data de entrega que aparecia um dia antes.' },
  ],
};

export default function PatchNotesPopup({ user }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!user?.authUid && !user?.id) return;
    const uid = user.authUid || user.id;
    let cancelled = false;
    (async () => {
      try {
        const ref = doc(db, 'collaborators', uid);
        const snap = await getDoc(ref);
        const seen = snap.exists() ? snap.data().lastPatchSeen : null;
        if (!cancelled && seen !== PATCH_VERSION) setShow(true);
      } catch {
        // se não der para ler, não mostra (evita popup repetido sem controle)
      }
    })();
    return () => { cancelled = true; };
  }, [user]);

  const close = async () => {
    setShow(false);
    try {
      const uid = user.authUid || user.id;
      await updateDoc(doc(db, 'collaborators', uid), { lastPatchSeen: PATCH_VERSION });
    } catch { /* best-effort */ }
  };

  if (!show) return null;

  return ReactDOM.createPortal(
    <div onClick={close} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.65)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, padding: 20 }}>
      <div onClick={e => e.stopPropagation()} className="fade-up" style={{ background: 'rgba(18,18,32,.99)', border: '1px solid var(--border)', borderRadius: 18, width: '100%', maxWidth: 440, overflow: 'hidden', boxShadow: '0 24px 64px rgba(0,0,0,.7)' }}>
        <div style={{ background: 'linear-gradient(135deg,var(--neon),#c41f4a)', padding: '22px 24px', position: 'relative' }}>
          <Sparkles size={26} color="#fff" style={{ marginBottom: 8 }} />
          <h2 style={{ fontSize: 20, fontWeight: 800, color: '#fff' }}>{PATCH_NOTES.title}</h2>
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,.85)', fontFamily: 'var(--fm)', marginTop: 2 }}>{PATCH_NOTES.date}</p>
          <button onClick={close} style={{ position: 'absolute', top: 16, right: 16, background: 'rgba(255,255,255,.2)', border: 'none', borderRadius: 8, padding: 6, cursor: 'pointer', display: 'flex' }}><X size={16} color="#fff" /></button>
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
          <button onClick={close} style={{ width: '100%', marginTop: 22, background: 'linear-gradient(135deg,var(--neon),#c41f4a)', border: 'none', borderRadius: 10, padding: '13px', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
            Entendi!
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
