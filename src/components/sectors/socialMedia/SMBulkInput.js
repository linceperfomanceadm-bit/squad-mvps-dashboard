import React, { useState } from 'react';
import { Plus, Trash2, Send } from 'lucide-react';

const emptyRow = () => ({ id: Date.now() + Math.random(), date: '', name: '', clientId: '', linkArt: '' });

export default function SMBulkInput({ clients, responsible, onSave }) {
  const [rows, setRows] = useState([emptyRow()]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const activeClients = clients.filter(c => c.active);

  const updateRow = (id, field, value) => {
    setRows(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));
  };
  const addRow = () => setRows(prev => [...prev, emptyRow()]);
  const removeRow = (id) => setRows(prev => prev.length > 1 ? prev.filter(r => r.id !== id) : prev);

  const handleSave = async () => {
    const filled = rows.filter(r => r.name.trim() && r.clientId && r.date);
    if (!filled.length) { setError('Preencha pelo menos uma linha completa (data, nome e cliente).'); return; }
    setError('');
    setLoading(true);
    const payload = filled.map(r => ({ ...r, responsible }));
    const res = await onSave(payload);
    setLoading(false);
    if (res.success) setRows([emptyRow()]);
    else setError(res.error);
  };

  return (
    <div className="fade-up">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: '#fff', letterSpacing: '-.5px', marginBottom: 4 }}>Planejamento</h1>
          <p style={{ fontSize: 13, color: 'var(--muted)' }}>Adicione múltiplos posts de uma vez — cada linha vira um card no Kanban</p>
        </div>
        <button onClick={handleSave} disabled={loading} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'linear-gradient(135deg,var(--blue),#0284c7)', border: 'none', borderRadius: 10, padding: '10px 20px', color: '#fff', fontSize: 13, fontWeight: 700, boxShadow: '0 4px 20px rgba(56,189,248,.3)' }}>
          {loading ? <span className="spinner" style={{ borderTopColor: '#fff', borderColor: 'rgba(255,255,255,.3)', width: 16, height: 16 }} /> : <><Send size={15} /> Salvar Planejamento</>}
        </button>
      </div>

      <div style={{ background: 'rgba(12,12,24,.88)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr 180px 1fr 40px', gap: 0, background: 'rgba(255,255,255,.03)', borderBottom: '1px solid var(--border)', padding: '10px 16px' }}>
          {['Data Prevista', 'Nome da Publicação', 'Cliente', 'Link da Arte', ''].map((h, i) => (
            <span key={i} style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)', letterSpacing: '.1em', fontFamily: 'var(--fm)' }}>{h}</span>
          ))}
        </div>

        {/* Rows */}
        <div style={{ padding: '8px' }}>
          {rows.map((row, idx) => (
            <div key={row.id} style={{ display: 'grid', gridTemplateColumns: '140px 1fr 180px 1fr 40px', gap: 6, marginBottom: 6, alignItems: 'center' }}>
              <input type="date" value={row.date} onChange={e => updateRow(row.id, 'date', e.target.value)} style={S.cell} />
              <input type="text" value={row.name} onChange={e => updateRow(row.id, 'name', e.target.value)} placeholder="Ex: Post carrossel — Promoção..." style={S.cell} />
              <select value={row.clientId} onChange={e => updateRow(row.id, 'clientId', e.target.value)} style={S.cell}>
                <option value="">Selecionar cliente</option>
                {activeClients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <input type="url" value={row.linkArt} onChange={e => updateRow(row.id, 'linkArt', e.target.value)} placeholder="https://drive.google.com/..." style={S.cell} />
              <button onClick={() => removeRow(row.id)} style={{ background: 'rgba(238,51,99,.08)', border: '1px solid rgba(238,51,99,.2)', borderRadius: 6, padding: '6px 7px', color: 'var(--neon)', display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>

        <div style={{ padding: '0 8px 12px' }}>
          <button onClick={addRow} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--surface)', border: '1px dashed var(--border)', borderRadius: 8, padding: '8px 16px', color: 'var(--muted)', fontSize: 13, cursor: 'pointer', width: '100%', justifyContent: 'center' }}>
            <Plus size={14} /> Adicionar linha
          </button>
        </div>
      </div>

      {error && <p style={{ marginTop: 12, fontSize: 12, color: 'var(--neon)', textAlign: 'center' }}>⚠ {error}</p>}
    </div>
  );
}

const S = {
  cell: { background: 'rgba(255,255,255,.04)', border: '1px solid var(--border)', borderRadius: 7, padding: '8px 10px', color: 'var(--text)', fontSize: 13, outline: 'none', width: '100%', fontFamily: 'var(--f)' },
};
