import React, { useState, useMemo } from 'react';
import { Upload, Plus, Trash2 } from 'lucide-react';

/*
 * Aba de Leads (admin). Dois modos de entrada:
 *  - Um a um (formulário)
 *  - Em lote (colar linhas: nome, telefone, empresa)
 * Também lista os leads com seu status atual e permite excluir.
 */
const STATUS_LABEL = {
  queue: { label: 'Na fila', color: 'var(--muted)' },
  followup: { label: 'Follow-up', color: 'var(--amber)' },
  cold: { label: 'Frio', color: '#38bdf8' },
  scheduled: { label: 'Agendado', color: 'var(--green)' },
  lost: { label: 'Perdido', color: 'var(--neon)' },
};

export default function AdminLeads({ leads, onAdd, onAddBulk, onDelete, toast }) {
  const [mode, setMode] = useState(null); // 'one' | 'bulk' | null
  const [form, setForm] = useState({ name: '', phone: '', company: '', notes: '' });
  const [bulk, setBulk] = useState('');
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState('');

  const counts = useMemo(() => {
    const c = { queue: 0, followup: 0, cold: 0, scheduled: 0, lost: 0 };
    leads.forEach(l => { if (c[l.status] != null) c[l.status]++; });
    return c;
  }, [leads]);

  const visible = filter ? leads.filter(l => l.status === filter) : leads;

  const submitOne = async () => {
    if (!form.name.trim() && !form.phone.trim()) { toast('Informe ao menos nome ou telefone.', 'e'); return; }
    setBusy(true);
    const r = await onAdd(form);
    setBusy(false);
    if (r.success) { toast('Lead adicionado.'); setForm({ name: '', phone: '', company: '', notes: '' }); setMode(null); }
    else toast(r.error, 'e');
  };

  const submitBulk = async () => {
    const rows = parseBulk(bulk);
    if (!rows.length) { toast('Nenhuma linha válida.', 'e'); return; }
    setBusy(true);
    const r = await onAddBulk(rows);
    setBusy(false);
    if (r.success) { toast(`${r.count} leads importados.`); setBulk(''); setMode(null); }
    else toast(r.error, 'e');
  };

  return (
    <div className="fade-up">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 22, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: '#fff', letterSpacing: '-.5px', marginBottom: 4 }}>Leads</h1>
          <p style={{ fontSize: 13, color: 'var(--muted)' }}>{leads.length} no total · fila compartilhada do time SDR</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setMode(mode === 'one' ? null : 'one')} style={BTN_PRIMARY}><Plus size={15} /> Um a um</button>
          <button onClick={() => setMode(mode === 'bulk' ? null : 'bulk')} style={BTN_SOFT}><Upload size={15} /> Importar lote</button>
        </div>
      </div>

      {mode === 'one' && (
        <div style={{ ...CARD, marginBottom: 18 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="NOME"><input style={INP} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Nome do lead" /></Field>
            <Field label="TELEFONE"><input style={INP} value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="Ex: 5547999999999" /></Field>
            <Field label="EMPRESA"><input style={INP} value={form.company} onChange={e => setForm(f => ({ ...f, company: e.target.value }))} placeholder="Opcional" /></Field>
            <Field label="OBSERVAÇÃO"><input style={INP} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Opcional" /></Field>
          </div>
          <button onClick={submitOne} disabled={busy} style={{ ...BTN_PRIMARY, marginTop: 14 }}>{busy ? '...' : 'Adicionar lead'}</button>
        </div>
      )}

      {mode === 'bulk' && (
        <div style={{ ...CARD, marginBottom: 18 }}>
          <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 10, lineHeight: 1.5 }}>
            Cole uma linha por lead, com campos separados por vírgula ou tabulação:<br />
            <span style={{ fontFamily: 'var(--fm)', color: 'var(--text)' }}>nome, telefone, empresa, observação</span> (empresa e observação opcionais).
          </p>
          <textarea value={bulk} onChange={e => setBulk(e.target.value)} rows={8} placeholder={"João Silva, 5547999990000, Padaria do João\nMaria Souza, 5547988887777"} style={{ ...INP, resize: 'vertical', fontFamily: 'var(--fm)', fontSize: 12 }} />
          <button onClick={submitBulk} disabled={busy} style={{ ...BTN_PRIMARY, marginTop: 12 }}>{busy ? 'Importando...' : 'Importar'}</button>
        </div>
      )}

      {/* Filtros por status */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <Chip active={!filter} onClick={() => setFilter('')} label={`Todos (${leads.length})`} />
        {Object.entries(STATUS_LABEL).map(([k, v]) => (
          <Chip key={k} active={filter === k} onClick={() => setFilter(k)} label={`${v.label} (${counts[k]})`} color={v.color} />
        ))}
      </div>

      {visible.length === 0 ? (
        <p style={{ fontSize: 13, color: 'var(--muted)', textAlign: 'center', padding: '40px 0' }}>Nenhum lead aqui.</p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: 10 }}>
          {visible.map(l => {
            const st = STATUS_LABEL[l.status] || STATUS_LABEL.queue;
            return (
              <div key={l.id} style={CARD}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{l.name || 'Sem nome'}</span>
                  <button onClick={() => onDelete(l.id)} style={ICON_BTN}><Trash2 size={13} color="rgba(238,51,99,.6)" /></button>
                </div>
                {l.company && <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{l.company}</p>}
                {l.phone && <p style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'var(--fm)', marginTop: 2 }}>📱 {l.phone}</p>}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 10, background: `${st.color}1a`, color: st.color, fontFamily: 'var(--fm)' }}>{st.label}</span>
                  {l.claimedBy && <span style={{ fontSize: 10, color: 'var(--muted)' }}>· {l.claimedBy}</span>}
                  <span style={{ fontSize: 10, color: 'var(--muted)', fontFamily: 'var(--fm)', marginLeft: 'auto' }}>{l.attemptsLeft ?? 0} tent.</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Field({ label, children }) {
  return <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}><label style={LBL}>{label}</label>{children}</div>;
}
function Chip({ active, onClick, label, color }) {
  return (
    <button onClick={onClick} style={{
      fontSize: 12, fontWeight: 600, padding: '6px 12px', borderRadius: 20, cursor: 'pointer',
      background: active ? (color ? `${color}1a` : 'var(--neon-dim)') : 'var(--surface)',
      color: active ? (color || 'var(--neon)') : 'var(--muted)',
      border: `1px solid ${active ? (color ? `${color}40` : 'var(--neon-border)') : 'var(--border)'}`,
      fontFamily: 'var(--fm)',
    }}>{label}</button>
  );
}

// Parse de lote: aceita vírgula, tab ou ponto-e-vírgula.
function parseBulk(text) {
  return text.split('\n').map(line => {
    const parts = line.split(/[,;\t]/).map(p => p.trim());
    if (!parts.length || (!parts[0] && !parts[1])) return null;
    return { name: parts[0] || '', phone: parts[1] || '', company: parts[2] || '', notes: parts[3] || '' };
  }).filter(Boolean);
}

const LBL = { fontSize: 10, letterSpacing: '.14em', color: 'var(--muted)', fontWeight: 600, fontFamily: 'var(--fm)' };
const INP = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 9, padding: '10px 13px', color: 'var(--text)', fontSize: 13, outline: 'none', width: '100%', fontFamily: 'var(--f)' };
const CARD = { background: 'rgba(12,12,24,.88)', border: '1px solid var(--border)', borderRadius: 14, padding: 16 };
const BTN_PRIMARY = { display: 'flex', alignItems: 'center', gap: 8, background: 'linear-gradient(135deg,var(--neon),#c41f4a)', border: 'none', borderRadius: 10, padding: '10px 18px', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 14px rgba(238,51,99,.3)' };
const BTN_SOFT = { display: 'flex', alignItems: 'center', gap: 8, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 18px', color: 'var(--text)', fontSize: 13, fontWeight: 600, cursor: 'pointer' };
const ICON_BTN = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, padding: '5px 7px', color: 'var(--muted)', display: 'flex', alignItems: 'center', cursor: 'pointer' };
