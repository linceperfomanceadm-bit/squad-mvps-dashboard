import React, { useState } from 'react';
import ReactDOM from 'react-dom';
import { X, Plus, Trash2 } from 'lucide-react';
import { TASK_PRIORITIES, SECTORS } from '../../lib/firebase';

export default function CreateTaskModal({ clients, collaborators, currentUser, currentUserSector, onClose, onSave }) {
  const [form, setForm] = useState({
    name: '',
    clientId: '',
    deadline: '',
    priority: 'medium',
    responsibleSector: '',
    responsibleName: '',
    comment: '',
  });
  const [links, setLinks] = useState([{ name: '', url: '' }]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const sectorCollabs = (sectorId) => collaborators.filter(c => c.sector === sectorId && c.active);

  const addLink = () => setLinks(l => [...l, { name: '', url: '' }]);
  const updateLink = (i, field, val) => setLinks(l => l.map((x, idx) => idx === i ? { ...x, [field]: val } : x));
  const removeLink = (i) => setLinks(l => l.filter((_, idx) => idx !== i));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim())           { setError('Preencha o nome da task.'); return; }
    if (!form.clientId)              { setError('Selecione o cliente.'); return; }
    if (!form.responsibleSector)     { setError('Selecione o setor responsável.'); return; }
    if (!form.responsibleName)       { setError('Selecione o colaborador responsável.'); return; }

    setLoading(true);
    const client = clients.find(c => c.id === form.clientId);

    // Only include links that have both name and url filled
    const validLinks = links
      .filter(l => l.name.trim() && l.url.trim())
      .map(l => ({
        name:    l.name.trim(),
        url:     l.url.trim(),
        addedBy: currentUser,
        addedAt: new Date().toISOString(),
      }));

    const res = await onSave({
      ...form,
      clientName:        client?.name || '',
      links:             validLinks,
      requestedBy:       currentUser,
      requestedBySector: currentUserSector,
    });
    setLoading(false);
    if (res.success) onClose();
    else setError(res.error || 'Erro ao criar task.');
  };

  const content = (
    <div
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        background: 'rgba(0,0,0,.82)', backdropFilter: 'blur(10px)',
        zIndex: 99999, overflowY: 'auto',
        display: 'flex', justifyContent: 'center',
        padding: '40px 20px',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#0e0e1c', border: '1px solid var(--neon-border)',
          borderRadius: 18, width: '100%', maxWidth: 580,
          boxShadow: '0 24px 80px rgba(0,0,0,.8)',
          height: 'fit-content', flexShrink: 0,
        }}
        onClick={e => e.stopPropagation()}
        className="fade-up"
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 22px', borderBottom: '1px solid rgba(255,255,255,.07)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--neon-dim)', border: '1px solid var(--neon-border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Plus size={18} color="var(--neon)" />
            </div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: '#fff' }}>Nova Task</h2>
          </div>
          <button style={{ background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 8, padding: '6px 8px', display: 'flex', alignItems: 'center', cursor: 'pointer' }} onClick={onClose}>
            <X size={16} color="#aaa" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Name */}
          <div style={S.field}>
            <label style={S.label}>NOME DA TASK *</label>
            <input style={S.input} value={form.name} onChange={e => set('name', e.target.value)} placeholder="Ex: Criar banner para campanha de Black Friday" autoFocus />
          </div>

          {/* Client + Deadline */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={S.field}>
              <label style={S.label}>CLIENTE *</label>
              <select style={S.select} value={form.clientId} onChange={e => set('clientId', e.target.value)}>
                <option value="">Selecionar cliente</option>
                {clients.filter(c => c.active).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div style={S.field}>
              <label style={S.label}>PRAZO</label>
              <input style={S.input} type="date" value={form.deadline} onChange={e => set('deadline', e.target.value)} />
            </div>
          </div>

          {/* Priority */}
          <div style={S.field}>
            <label style={S.label}>PRIORIDADE *</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {TASK_PRIORITIES.map(p => (
                <button type="button" key={p.id}
                  style={{
                    flex: 1,
                    background: form.priority === p.id ? `${p.color}22` : 'rgba(255,255,255,.04)',
                    border: `1px solid ${form.priority === p.id ? p.color : 'rgba(255,255,255,.1)'}`,
                    borderRadius: 8, padding: '8px 6px',
                    color: form.priority === p.id ? p.color : '#888',
                    fontSize: 12, fontWeight: form.priority === p.id ? 700 : 500,
                    cursor: 'pointer', transition: 'all .15s',
                  }}
                  onClick={() => set('priority', p.id)}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Sector + Responsible */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={S.field}>
              <label style={S.label}>SETOR RESPONSÁVEL *</label>
              <select style={S.select} value={form.responsibleSector} onChange={e => { set('responsibleSector', e.target.value); set('responsibleName', ''); }}>
                <option value="">Selecionar setor</option>
                {Object.values(SECTORS).map(s => <option key={s.id} value={s.id}>{s.emoji} {s.label}</option>)}
              </select>
            </div>
            <div style={S.field}>
              <label style={S.label}>COLABORADOR RESPONSÁVEL *</label>
              <select style={S.select} value={form.responsibleName} onChange={e => set('responsibleName', e.target.value)} disabled={!form.responsibleSector}>
                <option value="">Selecionar colaborador</option>
                {sectorCollabs(form.responsibleSector).map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
              </select>
            </div>
          </div>

          {/* Links with name */}
          <div style={S.field}>
            <label style={S.label}>LINKS DO MATERIAL (OPCIONAL)</label>
            <p style={{ fontSize: 11, color: '#555', marginBottom: 8 }}>Adicione uma descrição para cada link, para facilitar a identificação</p>
            {links.map((link, i) => (
              <div key={i} style={{ background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.07)', borderRadius: 8, padding: '10px 12px', marginBottom: 8 }}>
                <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                  <input
                    style={{ ...S.input, flex: 1 }}
                    value={link.name}
                    onChange={e => updateLink(i, 'name', e.target.value)}
                    placeholder="Descrição (ex: Referência, Briefing, Arte final...)"
                  />
                  {links.length > 1 && (
                    <button type="button"
                      style={{ background: 'rgba(238,51,99,.08)', border: '1px solid rgba(238,51,99,.2)', borderRadius: 7, padding: '6px 8px', color: 'var(--neon)', cursor: 'pointer', display: 'flex', alignItems: 'center', flexShrink: 0 }}
                      onClick={() => removeLink(i)}
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
                <input
                  style={S.input}
                  value={link.url}
                  onChange={e => updateLink(i, 'url', e.target.value)}
                  placeholder="https://drive.google.com/..."
                />
              </div>
            ))}
            <button type="button"
              style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,.03)', border: '1px dashed rgba(255,255,255,.12)', borderRadius: 7, padding: '7px 12px', color: '#777', fontSize: 12, cursor: 'pointer', width: '100%', justifyContent: 'center' }}
              onClick={addLink}
            >
              <Plus size={13} /> Adicionar link
            </button>
          </div>

          {/* Comment */}
          <div style={S.field}>
            <label style={S.label}>COMENTÁRIO INICIAL (OPCIONAL)</label>
            <textarea
              style={{ ...S.input, minHeight: 72, resize: 'vertical' }}
              value={form.comment}
              onChange={e => set('comment', e.target.value)}
              placeholder="Descreva detalhes, referências ou instruções para o responsável..."
            />
          </div>

          {error && <p style={{ fontSize: 12, color: 'var(--neon)' }}>⚠ {error}</p>}

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 4 }}>
            <button type="button"
              style={{ background: 'transparent', border: '1px solid rgba(255,255,255,.12)', borderRadius: 8, padding: '10px 18px', color: '#888', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}
              onClick={onClose}
            >
              Cancelar
            </button>
            <button type="submit"
              style={{ background: 'linear-gradient(135deg,var(--neon),#c41f4a)', border: 'none', borderRadius: 8, padding: '10px 22px', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 14px rgba(238,51,99,.3)', display: 'flex', alignItems: 'center', gap: 8 }}
              disabled={loading}
            >
              {loading
                ? <span className="spinner" style={{ width: 16, height: 16, borderTopColor: '#fff', borderColor: 'rgba(255,255,255,.3)' }} />
                : 'Criar Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return ReactDOM.createPortal(content, document.body);
}

const S = {
  field: { display: 'flex', flexDirection: 'column', gap: 7 },
  label: { fontSize: 10, letterSpacing: '.14em', color: '#666', fontWeight: 600, fontFamily: 'var(--fm)' },
  input: { background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 9, padding: '10px 13px', color: '#eee', fontSize: 13, outline: 'none', width: '100%', fontFamily: 'var(--f)' },
  select: { background: '#12121f', border: '1px solid rgba(255,255,255,.1)', borderRadius: 9, padding: '10px 13px', color: '#eee', fontSize: 13, outline: 'none', width: '100%', fontFamily: 'var(--f)', cursor: 'pointer' },
};
