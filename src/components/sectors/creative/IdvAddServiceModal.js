import React, { useMemo, useState } from 'react';
import ReactDOM from 'react-dom';
import { X, Palette, Search, Check } from 'lucide-react';
import { ID_VISUAL_CONFIG } from '../../../lib/firebase';

const STATUS_LABEL = { onboarding: 'Onboarding', production: 'Produção', finished: 'Finalizado' };
const emAndamento = (c) => c?.idv?.status === 'onboarding' || c?.idv?.status === 'production';

// Adiciona um ID Visual a um cliente que JÁ está na base.
// Espelha o WDAddServiceModal, com uma diferença de regra: ID Visual
// tem UM dono só (é o `idv.responsible` que decide quem enxerga o
// quadro), então a escolha de responsável é única, não múltipla.
// Não cria cliente: o cadastro de cliente novo é da CS Comercial.
export default function IdvAddServiceModal({ onClose, onAdd, clients, collaborators, currentUser }) {
  const [search, setSearch] = useState('');
  const [clientId, setClientId] = useState(null);
  // Já vem marcado quem está abrindo, se for do Design — é o caso mais
  // comum. Admin (fora do time) começa sem ninguém escolhido.
  const [responsible, setResponsible] = useState(
    () => (collaborators.some(c => c.active !== false && c.name === currentUser) ? currentUser : '')
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const client = clients.find(c => c.id === clientId) || null;
  const bloqueado = emAndamento(client);
  const team = collaborators.filter(c => c.active !== false);

  const results = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = [...clients].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    return (q ? list.filter(c => (c.name || '').toLowerCase().includes(q)) : list).slice(0, 8);
  }, [clients, search]);

  const pickClient = (c) => { setClientId(c.id); setError(''); };

  const submit = async () => {
    if (!client) { setError('Selecione o cliente.'); return; }
    if (bloqueado) { setError('Este cliente já tem um ID Visual em andamento.'); return; }
    if (!responsible) { setError('Selecione o designer responsável.'); return; }
    setLoading(true);
    const res = await onAdd(client.id, { responsible }, client.name);
    setLoading(false);
    if (res?.success) onClose();
    else setError(res?.error || 'Não foi possível adicionar o ID Visual.');
  };

  return ReactDOM.createPortal(
    <div style={S.overlay} onClick={onClose}>
      <div style={S.modal} onClick={e => e.stopPropagation()} className="fade-up">
        <div style={S.hd}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={S.icon}><Palette size={18} color="var(--neon)" /></div>
            <div>
              <h2 style={S.title}>Adicionar {ID_VISUAL_CONFIG.label}</h2>
              <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>Para um cliente que já está na base</p>
            </div>
          </div>
          <button style={S.xbtn} onClick={onClose}><X size={16} color="var(--muted)" /></button>
        </div>

        <div style={S.body}>
          {/* 1 · Cliente */}
          <div style={S.field}>
            <label style={S.label}>CLIENTE *</label>
            {client ? (
              <div style={{ ...S.picked, ...(bloqueado ? S.pickedOff : {}) }}>
                <div style={{ minWidth: 0 }}>
                  <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{client.name}</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 6 }}>
                    {!client.idv?.status
                      ? <span style={{ fontSize: 11, color: 'var(--muted)' }}>Nenhum ID Visual ainda</span>
                      : (
                        <span style={S.jobChip}>
                          {ID_VISUAL_CONFIG.label} · {STATUS_LABEL[client.idv.status] || client.idv.status}
                          {client.idv.responsible ? ` · ${client.idv.responsible}` : ''}
                        </span>
                      )}
                    {(client.idvHistory || []).length > 0 && (
                      <span style={S.jobChip}>{client.idvHistory.length} anterior{client.idvHistory.length > 1 ? 'es' : ''}</span>
                    )}
                  </div>
                  {bloqueado && (
                    <p style={{ fontSize: 11, color: 'var(--amber)', marginTop: 8, lineHeight: 1.5 }}>
                      Já existe um ID Visual em andamento. Finalize o atual antes de abrir outro.
                    </p>
                  )}
                  {client.idv?.status === 'finished' && (
                    <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 8, lineHeight: 1.5 }}>
                      O ID Visual finalizado fica guardado no histórico do cliente.
                    </p>
                  )}
                </div>
                <button type="button" style={S.linkBtn} onClick={() => setClientId(null)}>Trocar</button>
              </div>
            ) : (
              <>
                <div style={{ position: 'relative' }}>
                  <Search size={14} color="var(--muted)" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
                  <input style={{ ...S.input, paddingLeft: 34 }} value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar cliente pelo nome..." autoFocus />
                </div>
                <div style={S.results}>
                  {results.length === 0
                    ? <p style={{ fontSize: 12, color: 'var(--muted)', padding: '10px 12px' }}>Nenhum cliente encontrado.</p>
                    : results.map(c => (
                        <button type="button" key={c.id} style={S.resultItem} onClick={() => pickClient(c)}>
                          <span style={{ fontSize: 13, color: 'var(--text)', fontWeight: 600 }}>{c.name}</span>
                          <span style={{ fontSize: 11, color: emAndamento(c) ? 'var(--amber)' : 'var(--muted)', fontFamily: 'var(--fm)' }}>
                            {c.idv?.status ? `ID Visual · ${STATUS_LABEL[c.idv.status] || c.idv.status}` : 'sem ID Visual'}
                          </span>
                        </button>
                      ))}
                </div>
              </>
            )}
          </div>

          {/* 2 · Responsável (único) */}
          <div style={{ ...S.field, opacity: client && !bloqueado ? 1 : .4, pointerEvents: client && !bloqueado ? 'auto' : 'none' }}>
            <label style={S.label}>DESIGNER RESPONSÁVEL *</label>
            <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: -2, lineHeight: 1.5 }}>
              A criação de marca tem um dono só — é quem vê este ID Visual no quadro.
            </p>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {team.length === 0
                ? <span style={{ fontSize: 12, color: 'var(--muted)' }}>Sem colaboradores de Design ativos</span>
                : team.map(c => {
                    const sel = responsible === c.name;
                    return (
                      <button type="button" key={c.id} style={{ ...S.chip, ...(sel ? S.chipSel : {}) }} onClick={() => setResponsible(c.name)}>
                        {sel && <Check size={11} />} {c.name}
                      </button>
                    );
                  })}
            </div>
          </div>

          {error && <p style={{ fontSize: 12, color: 'var(--neon)' }}>⚠ {error}</p>}

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button type="button" style={S.cancelBtn} onClick={onClose}>Cancelar</button>
            <button type="button" style={{ ...S.submitBtn, opacity: loading || bloqueado ? .6 : 1 }} disabled={loading || bloqueado} onClick={submit}>
              {loading ? <span className="spinner" style={{ width: 16, height: 16, borderTopColor: '#fff', borderColor: 'var(--dim)' }} /> : 'Adicionar ID Visual'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

const S = {
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,.75)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 },
  modal: { background: 'var(--bg2)', border: '1px solid var(--neon-border)', borderRadius: 16, width: '100%', maxWidth: 500, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 24px 80px rgba(0,0,0,.7)' },
  hd: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 22px', borderBottom: '1px solid var(--border)' },
  icon: { width: 40, height: 40, borderRadius: 10, background: 'var(--neon-dim)', border: '1px solid var(--neon-border)', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 18, fontWeight: 700, color: 'var(--text)' },
  xbtn: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 8px', display: 'flex', alignItems: 'center', cursor: 'pointer' },
  body: { padding: 22, display: 'flex', flexDirection: 'column', gap: 18 },
  field: { display: 'flex', flexDirection: 'column', gap: 8, transition: 'opacity .2s' },
  label: { fontSize: 10, letterSpacing: '.14em', color: 'var(--muted)', fontWeight: 600, fontFamily: 'var(--fm)' },
  input: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 9, padding: '10px 13px', color: 'var(--text)', fontSize: 13, outline: 'none', width: '100%', fontFamily: 'var(--f)' },
  results: { border: '1px solid var(--border)', borderRadius: 9, overflow: 'hidden', background: 'var(--surface)' },
  resultItem: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, width: '100%', background: 'transparent', border: 'none', borderBottom: '1px solid var(--border)', padding: '9px 12px', cursor: 'pointer', textAlign: 'left' },
  picked: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, background: 'var(--neon-dim)', border: '1px solid var(--neon-border)', borderRadius: 10, padding: '12px 14px' },
  pickedOff: { background: 'var(--amber-dim)', border: '1px solid var(--amber-b)' },
  jobChip: { fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 5, background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--muted)', fontFamily: 'var(--fm)' },
  linkBtn: { background: 'none', border: 'none', color: 'var(--neon)', fontSize: 12, fontWeight: 600, cursor: 'pointer', flexShrink: 0 },
  chip: { display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 600, padding: '5px 11px', borderRadius: 16, cursor: 'pointer', background: 'var(--surface)', color: 'var(--muted)', border: '1px solid var(--border)' },
  chipSel: { background: 'var(--neon-dim)', color: 'var(--neon)', border: '1px solid var(--neon-border)' },
  cancelBtn: { background: 'transparent', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 18px', color: 'var(--muted)', fontSize: 13, fontWeight: 500, cursor: 'pointer' },
  submitBtn: { background: 'var(--grad)', border: 'none', borderRadius: 8, padding: '9px 22px', color: 'var(--on)', fontSize: 13, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 14px rgba(238,51,99,.3)', display: 'flex', alignItems: 'center', gap: 8 },
};
