import React, { useState } from 'react';
import ReactDOM from 'react-dom';
import { X, FileText } from 'lucide-react';
import { DOCS } from '../../../../lib/docs/catalogo';

// ─────────────────────────────────────────────────────────────
// Lince Docs — NOVO DOCUMENTO
//
// A tela de escolha lê o catálogo inteiro, inclusive os documentos
// ainda em construção, que aparecem apagados e não abrem. Documento
// novo no catálogo aparece aqui sem tocar neste arquivo.
//
// Portal no body, como os outros modais do app, para não ser cortado
// por `overflow` de contêiner.
// ─────────────────────────────────────────────────────────────

export default function NovoDocumentoModal({ clients, onClose, onCreate }) {
  const [tipo, setTipo] = useState(null);
  const [clientId, setClientId] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  const criar = async () => {
    if (!tipo) { setErro('Escolha o tipo de documento.'); return; }
    if (!clientId) { setErro('Escolha o cliente.'); return; }
    setSalvando(true);
    setErro('');
    const cliente = clients.find((c) => c.id === clientId);
    const res = await onCreate({ tipo, clientId, clientName: cliente?.name || '' });
    setSalvando(false);
    if (!res?.success) setErro(res?.error || 'Não foi possível criar o documento.');
  };

  return ReactDOM.createPortal(
    <div style={S.overlay} onClick={onClose}>
      <div style={S.modal} className="fade-up" onClick={(e) => e.stopPropagation()}>
        <div style={S.cab}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={S.icone}><FileText size={17} color="var(--neon)" /></div>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: '#fff' }}>Novo documento</h2>
          </div>
          <button type="button" style={S.fechar} onClick={onClose}>
            <X size={16} color="var(--muted)" />
          </button>
        </div>

        <div style={S.corpo}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            <label style={S.label}>Tipo</label>
            {DOCS.map((d) => {
              const disponivel = d.ativo !== false;
              const escolhido = tipo === d.id;
              return (
                <button
                  key={d.id}
                  type="button"
                  disabled={!disponivel}
                  onClick={() => disponivel && setTipo(d.id)}
                  style={{
                    ...S.opcao,
                    ...(escolhido ? S.opcaoAtiva : {}),
                    ...(disponivel ? {} : S.opcaoOff),
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'baseline' }}>
                    <span style={{ fontSize: 13.5, fontWeight: 600, color: disponivel ? 'var(--text)' : 'var(--muted)' }}>
                      {d.nome}
                    </span>
                    <span style={S.meta}>{d.meta}</span>
                  </div>
                  <p style={S.desc}>{d.desc}</p>
                </button>
              );
            })}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={S.label}>Cliente</label>
            <select style={S.input} value={clientId} onChange={(e) => setClientId(e.target.value)}>
              <option value="">Selecionar cliente</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <p style={S.dica}>
              O documento fica guardado no cliente, junto com a base de cálculo do engajamento.
            </p>
          </div>

          {erro && <p style={S.erro}>{erro}</p>}

          <div style={{ display: 'flex', gap: 9, justifyContent: 'flex-end' }}>
            <button type="button" style={S.btnGhost} onClick={onClose}>Cancelar</button>
            <button type="button" style={S.btn} onClick={criar} disabled={salvando}>
              {salvando ? 'Criando…' : 'Criar documento'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

const S = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(3,3,8,.78)', backdropFilter: 'blur(3px)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9998, padding: 20,
  },
  modal: {
    background: 'var(--bg2)', border: '1px solid var(--neon-border)', borderRadius: 16,
    width: '100%', maxWidth: 520, maxHeight: '88vh', overflowY: 'auto',
    boxShadow: '0 24px 70px rgba(0,0,0,.6)',
  },
  cab: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '16px 20px', borderBottom: '1px solid var(--border)',
  },
  icone: {
    width: 34, height: 34, borderRadius: 10, background: 'var(--neon-dim)',
    border: '1px solid var(--neon-border)', display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  fechar: {
    background: 'transparent', border: '1px solid var(--border)', borderRadius: 8,
    width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  corpo: { padding: 20, display: 'flex', flexDirection: 'column', gap: 18 },
  label: { fontSize: 11, fontWeight: 600, color: 'var(--muted)', letterSpacing: '.1em', textTransform: 'uppercase' },
  opcao: {
    background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 11,
    padding: '12px 14px', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 4, width: '100%',
  },
  opcaoAtiva: { background: 'var(--neon-dim)', borderColor: 'var(--neon-border)' },
  opcaoOff: { opacity: 0.45, cursor: 'not-allowed' },
  meta: { fontSize: 10.5, color: 'var(--muted)', fontFamily: 'var(--fm)', flexShrink: 0 },
  desc: { fontSize: 12, color: 'var(--muted)', lineHeight: 1.45 },
  input: {
    background: '#12121f', border: '1px solid var(--border)', borderRadius: 9,
    padding: '10px 13px', fontSize: 13, color: 'var(--text)', outline: 'none', width: '100%',
  },
  dica: { fontSize: 11.5, color: 'var(--muted)', lineHeight: 1.45 },
  erro: { fontSize: 12.5, color: 'var(--neon)' },
  btn: {
    background: 'var(--neon)', border: 'none', borderRadius: 9,
    padding: '10px 18px', fontSize: 13, fontWeight: 600, color: '#fff',
  },
  btnGhost: {
    background: 'transparent', border: '1px solid var(--border-h)', borderRadius: 9,
    padding: '10px 18px', fontSize: 13, color: 'var(--muted)',
  },
};
