import React, { useState } from 'react';
import { X, UserPlus } from 'lucide-react';
import { WD_SERVICE_CONFIG } from '../../../lib/firebase';

export default function WDAddClientModal({ onClose, onAdd, collaborators }) {
  const [form, setForm] = useState({ name: '', wdService: '', responsibles: {} });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) { setError('Preencha o nome do cliente.'); return; }
    if (!form.wdService) { setError('Selecione o serviço WebDesign.'); return; }
    setLoading(true);
    const res = await onAdd(form);
    setLoading(false);
    if (res.success) onClose();
    else setError(res.error);
  };

  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={S.modal} onClick={e => e.stopPropagation()} className="fade-up">
        <div style={S.hd}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={S.icon}><UserPlus size={18} color="var(--neon)" /></div>
            <h2 style={S.title}>Novo Cliente</h2>
          </div>
          <button style={S.xbtn} onClick={onClose}><X size={16} color="var(--muted)" /></button>
        </div>
        <form onSubmit={handleSubmit} style={S.body}>
          <div style={S.field}>
            <label style={S.label}>NOME DO CLIENTE *</label>
            <input style={S.input} value={form.name} onChange={e => set('name', e.target.value)} placeholder="Ex: Empresa XYZ" autoFocus />
          </div>
          <div style={S.field}>
            <label style={S.label}>SERVIÇO *</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {Object.entries(WD_SERVICE_CONFIG).map(([k, v]) => (
                <button type="button" key={k}
                  style={{ background: form.wdService === k ? 'var(--neon-dim)' : 'var(--surface)', border: `1px solid ${form.wdService === k ? 'var(--neon-border)' : 'var(--border)'}`, borderRadius: 8, padding: '8px 14px', color: form.wdService === k ? 'var(--neon)' : 'var(--muted)', fontSize: 12, fontWeight: 500, cursor: 'pointer', transition: 'all .15s' }}
                  onClick={() => set('wdService', k)}>
                  {v.label}
                </button>
              ))}
            </div>
          </div>
          <div style={S.field}>
            <label style={S.label}>RESPONSÁVEL</label>
            <select style={S.input} value={form.responsibles?.webdesign || ''} onChange={e => set('responsibles', { ...form.responsibles, webdesign: e.target.value })}>
              <option value="">Selecionar responsável</option>
              {collaborators.filter(c => c.active).map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
            </select>
          </div>
          {error && <p style={{ fontSize: 12, color: 'var(--neon)' }}>⚠ {error}</p>}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button type="button" style={S.cancelBtn} onClick={onClose}>Cancelar</button>
            <button type="submit" style={S.submitBtn} disabled={loading}>
              {loading ? <span className="spinner" style={{ width: 16, height: 16, borderTopColor: '#fff', borderColor: 'rgba(255,255,255,.3)' }} /> : 'Cadastrar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const S = {
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,.75)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 },
  modal: { background: '#0e0e1c', border: '1px solid var(--neon-border)', borderRadius: 16, width: '100%', maxWidth: 460, boxShadow: '0 24px 80px rgba(0,0,0,.7)' },
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
