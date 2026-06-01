import React, { useState } from 'react';
import { X, PlusCircle } from 'lucide-react';
import { APPROVAL_STATUS, REQUESTING_SECTORS } from '../../../lib/firebase';

export default function DeliveryModal({ clients, sectorId, onClose, onSave }) {
  const [form, setForm] = useState({ name: '', clientId: '', requestingSector: '', requestDate: '', deliveryDate: '', approvalStatus: '', link: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.clientId || !form.requestDate || !form.deliveryDate || !form.approvalStatus) {
      setError('Preencha todos os campos obrigatórios.'); return;
    }
    setLoading(true);
    await onSave(form);
    setLoading(false);
  };

  const color = sectorId === 'design' ? 'var(--purple)' : 'var(--orange)';
  const colorRaw = sectorId === 'design' ? '#a78bfa' : '#fb923c';

  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={{ ...S.modal, border: `1px solid ${colorRaw}35` }} onClick={e => e.stopPropagation()} className="fade-up">
        <div style={S.header}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ ...S.icon, background: `${colorRaw}18`, border: `1px solid ${colorRaw}35` }}>
              <PlusCircle size={18} color={color} />
            </div>
            <h2 style={S.title}>Cadastrar Entrega</h2>
          </div>
          <button style={S.closeBtn} onClick={onClose}><X size={16} color="var(--muted)" /></button>
        </div>

        <form onSubmit={handleSubmit} style={S.body}>
          <div style={S.field}>
            <label style={S.label}>NOME DA TASK *</label>
            <input style={S.input} value={form.name} onChange={e => set('name', e.target.value)} placeholder="Ex: Criação de banner para campanha..." autoFocus />
          </div>

          <div style={S.field}>
            <label style={S.label}>CLIENTE *</label>
            <select style={S.input} value={form.clientId} onChange={e => set('clientId', e.target.value)}>
              <option value="">Selecionar cliente</option>
              {clients.filter(c => c.active).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          <div style={S.field}>
            <label style={S.label}>SETOR SOLICITANTE *</label>
            <div style={S.optGroup}>
              {REQUESTING_SECTORS.map(s => (
                <button type="button" key={s}
                  style={{ ...S.opt, ...(form.requestingSector === s ? { background: `${colorRaw}18`, border: `1px solid ${colorRaw}40`, color } : {}) }}
                  onClick={() => set('requestingSector', s)}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={S.field}>
              <label style={S.label}>DATA DA SOLICITAÇÃO *</label>
              <input style={S.input} type="date" value={form.requestDate} onChange={e => set('requestDate', e.target.value)} />
            </div>
            <div style={S.field}>
              <label style={S.label}>DATA DA ENTREGA *</label>
              <input style={S.input} type="date" value={form.deliveryDate} onChange={e => set('deliveryDate', e.target.value)} />
            </div>
          </div>

          <div style={S.field}>
            <label style={S.label}>STATUS DE APROVAÇÃO *</label>
            <div style={S.optGroup}>
              {APPROVAL_STATUS.map(s => (
                <button type="button" key={s.id}
                  style={{ ...S.opt, ...(form.approvalStatus === s.id ? { background: `${s.color}18`, border: `1px solid ${s.color}40`, color: s.color } : {}) }}
                  onClick={() => set('approvalStatus', s.id)}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <div style={S.field}>
            <label style={S.label}>LINK DO MATERIAL</label>
            <input style={S.input} type="url" value={form.link} onChange={e => set('link', e.target.value)} placeholder="https://drive.google.com/..." />
          </div>

          {error && <p style={{ fontSize: 12, color: 'var(--neon)' }}>⚠ {error}</p>}

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button type="button" style={S.cancelBtn} onClick={onClose}>Cancelar</button>
            <button type="submit" style={{ ...S.submitBtn, background: `linear-gradient(135deg,${colorRaw},${colorRaw}99)`, boxShadow: `0 4px 16px ${colorRaw}35` }} disabled={loading}>
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
  modal: { background: '#0e0e1c', borderRadius: 16, width: '100%', maxWidth: 500, boxShadow: '0 24px 80px rgba(0,0,0,.7)', maxHeight: '90vh', overflow: 'auto' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 22px', borderBottom: '1px solid var(--border)' },
  icon: { width: 40, height: 40, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 17, fontWeight: 700, color: '#fff' },
  closeBtn: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 8px', display: 'flex', alignItems: 'center', cursor: 'pointer' },
  body: { padding: 22, display: 'flex', flexDirection: 'column', gap: 16 },
  field: { display: 'flex', flexDirection: 'column', gap: 7 },
  label: { fontSize: 10, letterSpacing: '.14em', color: 'var(--muted)', fontWeight: 600, fontFamily: 'var(--fm)' },
  input: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 9, padding: '10px 13px', color: 'var(--text)', fontSize: 13, outline: 'none', width: '100%', fontFamily: 'var(--f)' },
  optGroup: { display: 'flex', gap: 8, flexWrap: 'wrap' },
  opt: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '7px 13px', color: 'var(--muted)', fontSize: 12, fontWeight: 500, cursor: 'pointer', transition: 'all .15s' },
  cancelBtn: { background: 'transparent', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 18px', color: 'var(--muted)', fontSize: 13, fontWeight: 500, cursor: 'pointer' },
  submitBtn: { border: 'none', borderRadius: 8, padding: '9px 22px', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 },
};
