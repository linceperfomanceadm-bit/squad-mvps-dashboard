import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';
import { ShieldAlert, RotateCw } from 'lucide-react';
import { EVENTO_TRAVA, gravacoesTravadas } from '../../lib/gravacoes';

/*
 * Aviso da trava de gravações (lib/gravacoes.js).
 *
 * Montado uma vez no App, para qualquer tela — inclusive a TV e as
 * páginas públicas. Só aparece quando a aba é pausada por gravar
 * demais. Fica fixo e sem botão de fechar de propósito: enquanto a aba
 * estiver pausada nada do que a pessoa fizer é salvo, e ela precisa
 * saber disso antes de continuar trabalhando.
 */
export default function TravaGravacoesAviso() {
  const [ativo, setAtivo] = useState(gravacoesTravadas);

  useEffect(() => {
    const aoTravar = () => setAtivo(true);
    window.addEventListener(EVENTO_TRAVA, aoTravar);
    return () => window.removeEventListener(EVENTO_TRAVA, aoTravar);
  }, []);

  if (!ativo) return null;

  return ReactDOM.createPortal(
    <div role="alert" style={S.barra}>
      <ShieldAlert size={18} style={{ color: 'var(--red)', flexShrink: 0 }} />
      <div style={S.texto}>
        <strong style={S.titulo}>Gravações pausadas nesta aba</strong>
        <span style={S.sub}>
          Ela tentou salvar vezes demais em pouco tempo, então pausamos por segurança.
          O que você fizer agora não será salvo. Recarregue para continuar.
        </span>
      </div>
      <button type="button" className="ui-btn primary small" onClick={() => window.location.reload()}>
        <RotateCw size={14} /> Recarregar
      </button>
    </div>,
    document.body,
  );
}

const S = {
  barra: {
    position: 'fixed', left: '50%', bottom: 20, transform: 'translateX(-50%)',
    zIndex: 99995, width: 'min(560px, calc(100vw - 32px))',
    display: 'flex', alignItems: 'center', gap: 12,
    padding: '12px 14px', borderRadius: 'var(--r)',
    background: 'var(--bg2)', border: '1px solid var(--red)',
    boxShadow: '0 12px 32px -12px rgba(0,0,0,.45)',
    fontFamily: 'var(--f)',
  },
  texto: { display: 'flex', flexDirection: 'column', gap: 2, flex: 1, minWidth: 0 },
  titulo: { fontSize: 13, color: 'var(--text)' },
  sub: { fontSize: 12, color: 'var(--muted)', lineHeight: 1.4 },
};
