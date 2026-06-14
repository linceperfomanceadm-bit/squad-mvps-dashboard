import React, { useState } from 'react';
import { UserPlus, Edit2, Trash2, X, Check, Eye, EyeOff } from 'lucide-react';
import { SECTORS } from '../../lib/firebase';

export default function AdminCollaborators({ collaborators, onAdd, onUpdate, onDelete }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', sector: '', commercialRole: '', phone: '', loginId: '', password: '', isAdmin: false });
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [editId, setEditId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [delConfirm, setDelConfirm] = useState(null);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) { setError('Preencha o nome.'); return; }
    if (!form.sector) { setError('Selecione o setor.'); return; }
    if (form.sector === 'comercial' && !form.commercialRole) { setError('Selecione a função comercial (SDR ou Closer).'); return; }
    if (!form.loginId.trim()) { setError('Defina o ID de acesso.'); return; }
    if (!form.password.trim() || form.password.length < 6) { setError('Senha provisória deve ter pelo menos 6 caracteres.'); return; }
    if (collaborators.some(c => c.loginId === form.loginId.trim())) { setError('Este ID já está em uso.'); return; }
    setLoading(true);
    // commercialRole só faz sentido para o setor comercial.
    const payload = { ...form, loginId: form.loginId.trim() };
    if (payload.sector !== 'comercial') payload.commercialRole = null;
    const res = await onAdd(payload);
    setLoading(false);
    if (res.success) { setForm({ name: '', sector: '', commercialRole: '', phone: '', loginId: '', password: '', isAdmin: false }); setShowForm(false); setError(''); }
    else setError(res.error);
  };

  const handleEdit = async (id) => {
    if (!editForm.name?.trim()) { setEditId(null); return; }
    if (editForm.sector === 'comercial' && !editForm.commercialRole) { return; }
    const patch = {
      name: editForm.name.trim(),
      phone: editForm.phone || '',
      sector: editForm.sector,
      isAdmin: editForm.isAdmin || false,
      commercialRole: editForm.sector === 'comercial' ? editForm.commercialRole : null,
    };
    await onUpdate(id, patch);
    setEditId(null);
  };

  // Reset compatível com Firebase Auth (sem backend):
  // Reabilita a migração lazy — grava a nova senha provisória e
  // limpa o vínculo do Auth, para que a conta seja recriada no
  // próximo login do colaborador. Ver guia para o caso "senha
  // esquecida" (exige excluir a conta no console primeiro).
  const handleResetPassword = async (id, newPw) => {
    if (!newPw || newPw.length < 6) return { ok: false };
    const res = await onUpdate(id, {
      password: newPw,
      firstAccess: true,
      authUid: null,
      authMigrated: false,
    });
    return { ok: res.success };
  };

  return (
    <div className="fade-up">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: '#fff', letterSpacing: '-.5px', marginBottom: 4 }}>Colaboradores</h1>
          <p style={{ fontSize: 13, color: 'var(--muted)' }}>{collaborators.filter(c => c.active).length} ativo{collaborators.filter(c => c.active).length !== 1 ? 's' : ''} · {collaborators.length} total</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'linear-gradient(135deg,var(--neon),#c41f4a)', border: 'none', borderRadius: 10, padding: '10px 18px', color: '#fff', fontSize: 13, fontWeight: 700, boxShadow: '0 4px 20px rgba(238,51,99,.35)', cursor: 'pointer' }}>
          {showForm ? <><X size={15} /> Cancelar</> : <><UserPlus size={15} /> Novo Colaborador</>}
        </button>
      </div>

      {/* Add form */}
      {showForm && (
        <div style={{ background: 'rgba(12,12,24,.9)', border: '1px solid var(--neon-border)', borderRadius: 14, padding: 22, marginBottom: 20 }} className="fade-up">
          <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 16 }}>Cadastrar Colaborador</h3>
          <form onSubmit={handleAdd} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div style={S.field}>
              <label style={S.label}>NOME COMPLETO *</label>
              <input style={S.input} value={form.name} onChange={e => set('name', e.target.value)} placeholder="Nome do colaborador" autoFocus />
            </div>
            <div style={S.field}>
              <label style={S.label}>SETOR *</label>
              <select style={S.select} value={form.sector} onChange={e => set('sector', e.target.value)}>
                <option value="">Selecionar setor</option>
                {Object.values(SECTORS).map(s => <option key={s.id} value={s.id}>{s.emoji} {s.label}</option>)}
              </select>
            </div>
            {form.sector === 'comercial' && (
              <div style={S.field}>
                <label style={S.label}>FUNÇÃO COMERCIAL *</label>
                <select style={S.select} value={form.commercialRole} onChange={e => set('commercialRole', e.target.value)}>
                  <option value="">Selecionar função</option>
                  <option value="sdr">🎯 SDR (prospecção)</option>
                  <option value="closer">🤝 Closer (fechamento)</option>
                </select>
              </div>
            )}
            <div style={S.field}>
              <label style={S.label}>TELEFONE</label>
              <input style={S.input} value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="(47) 9 9999-9999" />
            </div>
            <div style={S.field}>
              <label style={S.label}>ID DE ACESSO *</label>
              <input style={S.input} value={form.loginId} onChange={e => set('loginId', e.target.value)} placeholder="Ex: henrique.wd" />
            </div>
            <div style={S.field}>
              <label style={S.label}>SENHA PROVISÓRIA *</label>
              <div style={{ position: 'relative' }}>
                <input style={{ ...S.input, paddingRight: 40 }} type={showPw ? 'text' : 'password'} value={form.password} onChange={e => set('password', e.target.value)} placeholder="Mínimo 6 caracteres" />
                <button type="button" style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center' }} onClick={() => setShowPw(!showPw)}>
                  {showPw ? <EyeOff size={14} color="var(--muted)" /> : <Eye size={14} color="var(--muted)" />}
                </button>
              </div>
            </div>
            <div style={{ ...S.field, justifyContent: 'flex-end', flexDirection: 'row', alignItems: 'flex-end', gap: 12 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: 'var(--text)', userSelect: 'none' }}>
                <input type="checkbox" checked={form.isAdmin} onChange={e => set('isAdmin', e.target.checked)} style={{ width: 16, height: 16, accentColor: 'var(--neon)' }} />
                Permissões de Admin
              </label>
            </div>
            {error && <p style={{ gridColumn: '1/-1', fontSize: 12, color: 'var(--neon)' }}>⚠ {error}</p>}
            <div style={{ gridColumn: '1/-1', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button type="button" style={S.cancelBtn} onClick={() => setShowForm(false)}>Cancelar</button>
              <button type="submit" style={S.submitBtn} disabled={loading}>
                {loading ? <span className="spinner" style={{ width: 16, height: 16, borderTopColor: '#fff', borderColor: 'rgba(255,255,255,.3)' }} /> : 'Cadastrar'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* List grouped by sector */}
      {Object.values(SECTORS).map(sector => {
        const sectorCollabs = collaborators.filter(c => c.sector === sector.id);
        if (!sectorCollabs.length) return null;
        return (
          <div key={sector.id} style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <span style={{ fontSize: 16 }}>{sector.emoji}</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: sector.color }}>{sector.label}</span>
              <span style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'var(--fm)' }}>{sectorCollabs.length}</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 10 }}>
              {sectorCollabs.map(collab => (
                <CollabCard
                  key={collab.id}
                  collab={collab}
                  sector={sector}
                  isEditing={editId === collab.id}
                  editForm={editForm}
                  onEdit={() => { setEditId(collab.id); setEditForm({ name: collab.name, phone: collab.phone || '', sector: collab.sector, commercialRole: collab.commercialRole || '', isAdmin: collab.isAdmin || false }); }}
                  onSaveEdit={() => handleEdit(collab.id)}
                  onCancelEdit={() => setEditId(null)}
                  onEditFormChange={(k, v) => setEditForm(f => ({ ...f, [k]: v }))}
                  onToggleActive={() => onUpdate(collab.id, { active: !collab.active })}
                  onDelete={() => setDelConfirm(collab.id)}
                  onConfirmDelete={() => { onDelete(collab.id); setDelConfirm(null); }}
                  onCancelDelete={() => setDelConfirm(null)}
                  confirmDelete={delConfirm === collab.id}
                  onResetPassword={(pw) => handleResetPassword(collab.id, pw)}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function CollabCard({ collab, sector, isEditing, editForm, onEdit, onSaveEdit, onCancelEdit, onEditFormChange, onToggleActive, onDelete, onConfirmDelete, onCancelDelete, confirmDelete, onResetPassword }) {
  const [resetPw, setResetPw] = useState('');
  const [showReset, setShowReset] = useState(false);
  const [resetMsg, setResetMsg] = useState('');

  const doReset = async () => {
    if (resetPw.length < 6) { setResetMsg('Mínimo 6 caracteres.'); return; }
    const r = await onResetPassword(resetPw);
    if (r?.ok) { setResetPw(''); setShowReset(false); setResetMsg(''); }
    else setResetMsg('Falha ao redefinir.');
  };

  return (
    <div style={{ background: 'rgba(12,12,24,.88)', border: '1px solid var(--border)', borderRadius: 14, padding: 18, opacity: collab.active ? 1 : 0.5, transition: 'opacity .3s' }}>
      {isEditing ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <input style={S.input} value={editForm.name} onChange={e => onEditFormChange('name', e.target.value)} placeholder="Nome" />
          <input style={S.input} value={editForm.phone} onChange={e => onEditFormChange('phone', e.target.value)} placeholder="Telefone" />
          <select style={S.select} value={editForm.sector} onChange={e => onEditFormChange('sector', e.target.value)}>
            {Object.values(SECTORS).map(s => <option key={s.id} value={s.id}>{s.emoji} {s.label}</option>)}
          </select>
          {editForm.sector === 'comercial' && (
            <select style={S.select} value={editForm.commercialRole || ''} onChange={e => onEditFormChange('commercialRole', e.target.value)}>
              <option value="">Função comercial...</option>
              <option value="sdr">🎯 SDR</option>
              <option value="closer">🤝 Closer</option>
            </select>
          )}
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text)', cursor: 'pointer' }}>
            <input type="checkbox" checked={editForm.isAdmin} onChange={e => onEditFormChange('isAdmin', e.target.checked)} style={{ accentColor: 'var(--neon)' }} />
            Permissões de Admin
          </label>
          <div style={{ display: 'flex', gap: 8 }}>
            <button style={{ ...S.iconBtnGreen, flex: 1, justifyContent: 'center', gap: 6, padding: 7 }} onClick={onSaveEdit}><Check size={14} /> Salvar</button>
            <button style={{ ...S.iconBtn, padding: '7px 12px' }} onClick={onCancelEdit}><X size={14} /></button>
          </div>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 40, height: 40, borderRadius: 12, background: `${sector.color}18`, border: `1px solid ${sector.color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 700, color: sector.color, flexShrink: 0 }}>
                {collab.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{collab.name}</p>
                <p style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'var(--fm)' }}>ID: {collab.loginId}</p>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 5 }}>
              <button style={S.iconBtn} onClick={onEdit}><Edit2 size={13} /></button>
              <button style={S.iconBtn} onClick={onToggleActive} title={collab.active ? 'Desativar' : 'Ativar'}>{collab.active ? '⏸' : '▶'}</button>
              {confirmDelete
                ? <><button style={{ ...S.iconBtn, background: 'rgba(238,51,99,.1)', borderColor: 'rgba(238,51,99,.3)', color: 'var(--neon)' }} onClick={onConfirmDelete}><Check size={13} /></button>
                    <button style={S.iconBtn} onClick={onCancelDelete}><X size={13} /></button></>
                : <button style={S.iconBtn} onClick={onDelete}><Trash2 size={13} color="rgba(238,51,99,.6)" /></button>
              }
            </div>
          </div>
          {collab.phone && <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}>📱 {collab.phone}</p>}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
            <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 4, background: collab.active ? 'var(--green-dim)' : 'var(--surface)', color: collab.active ? 'var(--green)' : 'var(--muted)', border: `1px solid ${collab.active ? 'var(--green-b)' : 'var(--border)'}`, fontFamily: 'var(--fm)' }}>
              {collab.active ? '● Ativo' : '○ Inativo'}
            </span>
            {collab.isAdmin && <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 4, background: 'var(--neon-dim)', color: 'var(--neon)', border: '1px solid var(--neon-border)', fontFamily: 'var(--fm)' }}>👑 Admin</span>}
            {collab.sector === 'comercial' && collab.commercialRole && (
              <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 4, background: `${sector.color}1a`, color: sector.color, border: `1px solid ${sector.color}40`, fontFamily: 'var(--fm)' }}>
                {collab.commercialRole === 'sdr' ? '🎯 SDR' : '🤝 Closer'}
              </span>
            )}
            {collab.firstAccess && <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 4, background: 'var(--amber-dim)', color: 'var(--amber)', border: '1px solid var(--amber-b)', fontFamily: 'var(--fm)' }}>1º Acesso pendente</span>}
          </div>
          {showReset
            ? <div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <input style={{ ...S.input, flex: 1, fontSize: 12, padding: '6px 10px' }} placeholder="Nova senha (mín. 6)" value={resetPw} onChange={e => setResetPw(e.target.value)} />
                  <button style={{ ...S.iconBtnGreen, padding: '6px 10px' }} onClick={doReset}><Check size={13} /></button>
                  <button style={{ ...S.iconBtn, padding: '6px 8px' }} onClick={() => { setShowReset(false); setResetMsg(''); }}><X size={13} /></button>
                </div>
                {resetMsg && <p style={{ fontSize: 10, color: 'var(--neon)', marginTop: 4 }}>{resetMsg}</p>}
                <p style={{ fontSize: 10, color: 'var(--muted)', marginTop: 4, lineHeight: 1.4 }}>
                  Se o colaborador esqueceu a senha, exclua a conta dele em Authentication no console do Firebase antes de redefinir.
                </p>
              </div>
            : <button style={{ fontSize: 11, color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0', textDecoration: 'underline', textUnderlineOffset: 2 }} onClick={() => setShowReset(true)}>Redefinir senha</button>
          }
        </>
      )}
    </div>
  );
}

const S = {
  field: { display: 'flex', flexDirection: 'column', gap: 7 },
  label: { fontSize: 10, letterSpacing: '.14em', color: 'var(--muted)', fontWeight: 600, fontFamily: 'var(--fm)' },
  input: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 9, padding: '10px 13px', color: 'var(--text)', fontSize: 13, outline: 'none', width: '100%', fontFamily: 'var(--f)' },
  select: { background: '#12121f', border: '1px solid var(--border)', borderRadius: 9, padding: '10px 13px', color: 'var(--text)', fontSize: 13, outline: 'none', width: '100%', fontFamily: 'var(--f)', cursor: 'pointer' },
  cancelBtn: { background: 'transparent', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 18px', color: 'var(--muted)', fontSize: 13, fontWeight: 500, cursor: 'pointer' },
  submitBtn: { background: 'linear-gradient(135deg,var(--neon),#c41f4a)', border: 'none', borderRadius: 8, padding: '9px 22px', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 14px rgba(238,51,99,.3)', display: 'flex', alignItems: 'center', gap: 8 },
  iconBtn: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, padding: '5px 7px', color: 'var(--muted)', display: 'flex', alignItems: 'center', cursor: 'pointer' },
  iconBtnGreen: { background: 'var(--green-dim)', border: '1px solid var(--green-b)', borderRadius: 6, padding: '5px 7px', color: 'var(--green)', display: 'flex', alignItems: 'center', cursor: 'pointer' },
};
