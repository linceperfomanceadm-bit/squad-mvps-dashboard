import React, { useState } from 'react';
import { X, UserPlus } from 'lucide-react';
import { SECTORS } from '../../lib/firebase';

/*
 * Modal de ativação do CS. Reaproveita o conceito do cadastro de
 * cliente, mas montado a partir do briefing: o CS confirma o nome,
 * vê os serviços contratados e define um responsável por setor.
 * Ao concluir, dispara onActivate(clientData) — que cria o cliente
 * via useClients.addClient (estrutura completa).
 */
export default function CSActivateModal({ deal, collaborators, onClose, onActivate }) {
  const b = deal.briefing || {};
  const services = b.services || [];

  const [name, setName] = useState(b.companyName || deal.leadName || '');
  const [responsibles, setResponsibles] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const setResp = (sectorId, value) => setResponsibles(r => ({ ...r, [sectorId]: value }));

  const submit = async (e) => {
    e.preventDefault();
    if (!name.trim()) { setError('Informe o nome do cliente.'); return; }
    setLoading(true);
    // Monta o payload compatível com useClients.addClient.
    // Limpa responsáveis vazios.
    const cleanResp = {};
    Object.entries(responsibles).forEach(([k, v]) => { if (v) cleanResp[k] = v; });
    await onActivate({
      name: name.trim(),
      responsibles: cleanResp,
    });
    setLoading(false);
  };

  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={S.modal} onClick={e => e.stopPropagation()} className="fade-up">
        <div style={S.hd}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={S.icon}><UserPlus size={18} color="var(--neon)" /></div>
            <h2 style={S.title}>Ativar Cliente</h2>
          </div>
          <button style={S.xbtn} onClick={onClose}><X size={16} color="var(--muted)" /></button>
        </div>

        <form onSubmit={submit} style={S.body}>
          <div style={S.field}>
            <label style={S.label}>NOME DO CLIENTE *</label>
            <input style={S.input} value={name} onChange={e => setName(e.target.value)} placeholder="Nome / empresa" autoFocus />
          </div>

          <div style={S.field}>
            <label style={S.label}>RESPONSÁVEIS POR SETOR</label>
            <p style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>
              Defina quem cuida de cada serviço contratado. Os destacados vieram do briefing.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {Object.values(SECTORS).filter(s => s.id !== 'comercial').map(s => {
                const contracted = services.includes(s.id);
                const options = collaborators.filter(c => c.active && c.sector === s.id);
                return (
                  <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 10, opacity: contracted ? 1 : 0.6 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: contracted ? s.color : 'var(--muted)', minWidth: 110, display: 'flex', alignItems: 'center', gap: 5 }}>
                      {s.emoji} {s.label}{contracted ? ' ★' : ''}
                    </span>
                    <select style={{ ...S.input, flex: 1, background: '#12121f', cursor: 'pointer' }} value={responsibles[s.id] || ''} onChange={e => setResp(s.id, e.target.value)}>
                      <option value="">{options.length ? 'Selecionar' : 'Ninguém nesse setor'}</option>
                      {options.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                    </select>
                  </div>
                );
              })}
            </div>
          </div>

          {error && <p style={{ fontSize: 12, color: 'var(--neon)' }}>⚠ {error}</p>}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button type="button" style={S.cancelBtn} onClick={onClose}>Cancelar</button>
            <button type="submit" style={S.submitBtn} disabled={loading}>
              {loading ? <span className="spinner" style={{ width: 16, height: 16, borderTopColor: '#fff', borderColor: 'rgba(255,255,255,.3)' }} /> : 'Ativar e cadastrar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const S = {
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,.75)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1400, padding: 20 },
  modal: { background: '#0e0e1c', border: '1px solid var(--neon-border)', borderRadius: 16, width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 24px 80px rgba(0,0,0,.7)' },
  hd: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 22px', borderBottom: '1px solid var(--border)' },
  icon: { width: 40, height: 40, borderRadius: 10, background: 'var(--neon-dim)', border: '1px solid var(--neon-border)', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 18, fontWeight: 700, color: '#fff' },
  xbtn: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 8px', display: 'flex', alignItems: 'center', cursor: 'pointer' },
  body: { padding: 22, display: 'flex', flexDirection: 'column', gap: 16 },
  field: { display: 'flex', flexDirection: 'column', gap: 8 },
  label: { fontSize: 10, letterSpacing: '.14em', color: 'var(--muted)', fontWeight: 600, fontFamily: 'var(--fm)' },
  input: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 9, padding: '10px 13px', color: 'var(--text)', fontSize: 13, outline: 'none', width: '100%', fontFamily: 'var(--f)' },
  cancelBtn: { background: 'transparent', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 18px', color: 'var(--muted)', fontSize: 13, fontWeight: 500, cursor: 'pointer' },
  submitBtn: { background: 'linear-gradient(135deg,var(--neon),#c41f4a)', border: 'none', borderRadius: 8, padding: '9px 22px', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 14px rgba(238,51,99,.3)', display: 'flex', alignItems: 'center', gap: 8 },
};
