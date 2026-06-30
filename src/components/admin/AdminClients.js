import React, { useState } from 'react';
import { Plus, X, Search, Trash2, Check, Edit2 } from 'lucide-react';
import { SECTORS, WD_SERVICE_CONFIG } from '../../lib/firebase';

// Normaliza responsáveis de um setor para SEMPRE um array.
// (clientes antigos guardam string; novos guardam array.)
export function asArray(val) {
  if (!val) return [];
  return Array.isArray(val) ? val : [val];
}

// Seletor de múltiplos responsáveis (chips clicáveis) de um setor.
function MultiResponsibleSelect({ sector, collaborators, selected, onChange }) {
  const sectorCollabs = collaborators.filter(c => c.sector === sector.id && c.active);
  const sel = asArray(selected);
  const toggle = (name) => {
    if (sel.includes(name)) onChange(sel.filter(n => n !== name));
    else onChange([...sel, name]);
  };
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
      <span style={{ fontSize: 13, color: sector.color, minWidth: 110, display: 'flex', alignItems: 'center', gap: 5, paddingTop: 4 }}>{sector.emoji} {sector.label}</span>
      <div style={{ flex: 1, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {sectorCollabs.length === 0
          ? <span style={{ fontSize: 12, color: 'var(--muted)', paddingTop: 4 }}>Sem colaboradores</span>
          : sectorCollabs.map(c => {
              const active = sel.includes(c.name);
              return (
                <button key={c.id} type="button" onClick={() => toggle(c.name)} style={{
                  fontSize: 12, fontWeight: 600, padding: '5px 11px', borderRadius: 16, cursor: 'pointer',
                  background: active ? `${sector.color}22` : 'var(--surface)',
                  color: active ? sector.color : 'var(--muted)',
                  border: `1px solid ${active ? `${sector.color}66` : 'var(--border)'}`,
                  display: 'flex', alignItems: 'center', gap: 4,
                }}>
                  {active && <Check size={11} />} {c.name}
                </button>
              );
            })}
      </div>
    </div>
  );
}

function AddClientModal({ collaborators, onClose, onAdd }) {
  const [form, setForm] = useState({ name: '', wdService: '', responsibles: {} });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) { setError('Preencha o nome do cliente.'); return; }
    setLoading(true);
    const res = await onAdd(form);
    setLoading(false);
    if (res.success) onClose();
    else setError(res.error);
  };

  return (
    <div style={MS.overlay} onClick={onClose}>
      <div style={MS.modal} onClick={e => e.stopPropagation()} className="fade-up">
        <div style={MS.header}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={MS.icon}><Plus size={18} color="var(--neon)" /></div>
            <h2 style={MS.title}>Novo Cliente</h2>
          </div>
          <button style={MS.closeBtn} onClick={onClose}><X size={16} color="var(--muted)" /></button>
        </div>
        <form onSubmit={handleSubmit} style={MS.body}>
          <div style={MS.field}>
            <label style={MS.label}>NOME DO CLIENTE *</label>
            <input style={MS.input} value={form.name} onChange={e => set('name', e.target.value)} placeholder="Ex: Empresa XYZ" autoFocus />
          </div>
          <div style={MS.field}>
            <label style={MS.label}>SERVIÇO WEBDESIGN</label>
            <select style={MS.select} value={form.wdService} onChange={e => set('wdService', e.target.value)}>
              <option value="">Nenhum (sem WebDesign)</option>
              {Object.entries(WD_SERVICE_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>
          <div style={MS.field}>
            <label style={MS.label}>RESPONSÁVEIS POR SETOR</label>
            <p style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 8 }}>Clique para adicionar/remover. Pode escolher mais de um por setor.</p>
            {Object.values(SECTORS).map(s => (
              <MultiResponsibleSelect
                key={s.id}
                sector={s}
                collaborators={collaborators}
                selected={form.responsibles[s.id]}
                onChange={(arr) => set('responsibles', { ...form.responsibles, [s.id]: arr })}
              />
            ))}
          </div>
          {error && <p style={{ fontSize: 12, color: 'var(--neon)' }}>⚠ {error}</p>}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button type="button" style={MS.cancelBtn} onClick={onClose}>Cancelar</button>
            <button type="submit" style={MS.submitBtn} disabled={loading}>
              {loading ? <span className="spinner" style={{ width: 16, height: 16, borderTopColor: '#fff', borderColor: 'rgba(255,255,255,.3)' }} /> : 'Cadastrar Cliente'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function EditResponsibleModal({ client, collaborators, onClose, onSave }) {
  const [responsibles, setResponsibles] = useState({ ...(client.responsibles || {}) });
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    setLoading(true);
    await onSave(client.id, { responsibles });
    setLoading(false);
    onClose();
  };

  return (
    <div style={MS.overlay} onClick={onClose}>
      <div style={MS.modal} onClick={e => e.stopPropagation()} className="fade-up">
        <div style={MS.header}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ ...MS.icon, background: 'rgba(56,189,248,.12)', border: '1px solid rgba(56,189,248,.3)' }}>
              <Edit2 size={16} color="var(--blue)" />
            </div>
            <div>
              <h2 style={MS.title}>Editar Responsáveis</h2>
              <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{client.name}</p>
            </div>
          </div>
          <button style={MS.closeBtn} onClick={onClose}><X size={16} color="var(--muted)" /></button>
        </div>
        <div style={MS.body}>
          <div style={MS.field}>
            <label style={MS.label}>RESPONSÁVEIS POR SETOR</label>
            {Object.values(SECTORS).map(s => (
              <MultiResponsibleSelect
                key={s.id}
                sector={s}
                collaborators={collaborators}
                selected={responsibles[s.id]}
                onChange={(arr) => setResponsibles(r => ({ ...r, [s.id]: arr }))}
              />
            ))}
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
            <button style={MS.cancelBtn} onClick={onClose}>Cancelar</button>
            <button style={{ ...MS.submitBtn, background: 'linear-gradient(135deg,var(--blue),#0284c7)', boxShadow: '0 4px 14px rgba(56,189,248,.3)' }} onClick={handleSave} disabled={loading}>
              {loading ? <span className="spinner" style={{ width: 16, height: 16, borderTopColor: '#fff', borderColor: 'rgba(255,255,255,.3)' }} /> : 'Salvar Alterações'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AdminClients({ clients, collaborators, onAdd, onUpdate, onDelete }) {
  const [showAdd, setShowAdd] = useState(false);
  const [editClient, setEditClient] = useState(null);
  const [search, setSearch] = useState('');
  const [delConfirm, setDelConfirm] = useState(null);

  const filtered = clients.filter(c => c.name?.toLowerCase().includes(search.toLowerCase()));

  const wdStatusLabel = s => ({ onboarding:'Onboarding', production:'Produção', inactive:'Inativo', recurrence:'Recorrência', finished:'Finalizado' }[s] || s);
  const wdStatusColor = s => ({ onboarding:'var(--blue)', production:'var(--neon)', inactive:'var(--muted)', recurrence:'var(--purple)', finished:'var(--green)' }[s] || 'var(--muted)');

  return (
    <div className="fade-up">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: '#fff', letterSpacing: '-.5px', marginBottom: 4 }}>Clientes</h1>
          <p style={{ fontSize: 13, color: 'var(--muted)' }}>{clients.filter(c => c.active).length} ativos · {clients.length} total</p>
        </div>
        <button onClick={() => setShowAdd(true)} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'linear-gradient(135deg,var(--neon),#c41f4a)', border: 'none', borderRadius: 10, padding: '10px 18px', color: '#fff', fontSize: 13, fontWeight: 700, boxShadow: '0 4px 20px rgba(238,51,99,.35)', cursor: 'pointer' }}>
          <Plus size={15} /> Novo Cliente
        </button>
      </div>

      <div style={{ position: 'relative', marginBottom: 16 }}>
        <Search size={15} color="var(--muted)" style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)' }} />
        <input style={{ ...S.input, paddingLeft: 38, width: '100%', maxWidth: 380 }} placeholder="Buscar cliente..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <div style={{ background: 'rgba(12,12,24,.88)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', background: 'rgba(255,255,255,.02)' }}>
                {['Cliente', 'WD Status', 'Serviço WD', ...Object.values(SECTORS).map(s => s.label), 'Ações'].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 10, letterSpacing: '.1em', color: 'var(--muted)', fontWeight: 600, fontFamily: 'var(--fm)', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => (
                <tr key={c.id} style={{ borderBottom: '1px solid rgba(255,255,255,.04)' }}>
                  <td style={{ padding: '12px 14px', fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap' }}>{c.name}</td>
                  <td style={{ padding: '12px 14px' }}>
                    {c.wd?.status
                      ? <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6, background: `${wdStatusColor(c.wd.status)}15`, color: wdStatusColor(c.wd.status) }}>{wdStatusLabel(c.wd.status)}</span>
                      : <span style={{ fontSize: 11, color: 'var(--muted)' }}>—</span>}
                  </td>
                  <td style={{ padding: '12px 14px', fontSize: 12, color: 'var(--muted)' }}>
                    {c.wd?.service ? WD_SERVICE_CONFIG[c.wd.service]?.label : '—'}
                  </td>
                  {Object.values(SECTORS).map(s => {
                    const names = asArray(c.responsibles?.[s.id]);
                    return (
                      <td key={s.id} style={{ padding: '12px 14px', fontSize: 12, whiteSpace: 'nowrap' }}>
                        {names.length > 0
                          ? <span style={{ color: s.color, fontWeight: 500 }}>{names.join(', ')}</span>
                          : <span style={{ color: 'var(--muted)' }}>—</span>}
                      </td>
                    );
                  })}
                  <td style={{ padding: '12px 14px' }}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button style={S.iconBtnBlue} onClick={() => setEditClient(c)} title="Editar responsáveis">
                        <Edit2 size={13} />
                      </button>
                      {delConfirm === c.id
                        ? <>
                            <button style={S.iconBtnRed} onClick={() => { onDelete(c.id); setDelConfirm(null); }}><Check size={13} /></button>
                            <button style={S.iconBtn} onClick={() => setDelConfirm(null)}><X size={13} /></button>
                          </>
                        : <button style={S.iconBtn} onClick={() => setDelConfirm(c.id)}><Trash2 size={13} color="rgba(238,51,99,.6)" /></button>
                      }
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan="10" style={{ padding: '32px', textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>Nenhum cliente encontrado.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showAdd && <AddClientModal collaborators={collaborators} onClose={() => setShowAdd(false)} onAdd={onAdd} />}
      {editClient && <EditResponsibleModal client={editClient} collaborators={collaborators} onClose={() => setEditClient(null)} onSave={onUpdate} />}
    </div>
  );
}

const S = {
  input: { background: 'rgba(12,12,24,.9)', border: '1px solid var(--border)', borderRadius: 9, padding: '10px 13px', color: 'var(--text)', fontSize: 13, outline: 'none', fontFamily: 'var(--f)' },
  iconBtn: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, padding: '5px 7px', color: 'var(--muted)', display: 'flex', alignItems: 'center', cursor: 'pointer' },
  iconBtnBlue: { background: 'rgba(56,189,248,.08)', border: '1px solid rgba(56,189,248,.25)', borderRadius: 6, padding: '5px 7px', color: 'var(--blue)', display: 'flex', alignItems: 'center', cursor: 'pointer' },
  iconBtnRed: { background: 'rgba(238,51,99,.1)', border: '1px solid rgba(238,51,99,.3)', borderRadius: 6, padding: '5px 7px', color: 'var(--neon)', display: 'flex', alignItems: 'center', cursor: 'pointer' },
};

const MS = {
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,.75)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 },
  modal: { background: '#0e0e1c', border: '1px solid var(--neon-border)', borderRadius: 16, width: '100%', maxWidth: 560, boxShadow: '0 24px 80px rgba(0,0,0,.7)', maxHeight: '90vh', overflow: 'auto' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 22px', borderBottom: '1px solid var(--border)' },
  icon: { width: 40, height: 40, borderRadius: 10, background: 'var(--neon-dim)', border: '1px solid var(--neon-border)', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 18, fontWeight: 700, color: '#fff' },
  closeBtn: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 8px', display: 'flex', alignItems: 'center', cursor: 'pointer' },
  body: { padding: 22, display: 'flex', flexDirection: 'column', gap: 16 },
  field: { display: 'flex', flexDirection: 'column', gap: 8 },
  label: { fontSize: 10, letterSpacing: '.14em', color: 'var(--muted)', fontWeight: 600, fontFamily: 'var(--fm)' },
  input: { background: 'rgba(12,12,24,.9)', border: '1px solid var(--border)', borderRadius: 9, padding: '10px 13px', color: 'var(--text)', fontSize: 13, outline: 'none', width: '100%', fontFamily: 'var(--f)' },
  select: { background: '#12121f', border: '1px solid var(--border)', borderRadius: 9, padding: '10px 13px', color: 'var(--text)', fontSize: 13, outline: 'none', width: '100%', fontFamily: 'var(--f)', cursor: 'pointer' },
  cancelBtn: { background: 'transparent', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 18px', color: 'var(--muted)', fontSize: 13, fontWeight: 500, cursor: 'pointer' },
  submitBtn: { background: 'linear-gradient(135deg,var(--neon),#c41f4a)', border: 'none', borderRadius: 8, padding: '9px 22px', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 14px rgba(238,51,99,.3)', display: 'flex', alignItems: 'center', gap: 8 },
};
