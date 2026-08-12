import React, { useState, useMemo } from 'react';
import ReactDOM from 'react-dom';
import {
  LayoutDashboard, CalendarCheck, AlertTriangle, Plus, Video,
  CheckSquare, Calendar, Trash2, Edit2, MessageSquare,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../components/shared/Toast';
import { useDeals } from '../../hooks/useDeals';
import { useSDRScripts } from '../../hooks/useSDRScripts';
import {
  useCommercialGoals, countScheduledThisMonth, countQualifiedThisMonth,
  countMQThisMonth, countNoShowThisMonth,
} from '../../hooks/useCloserData';
import Sidebar from '../../components/shared/Sidebar';
import TodoView from '../../components/shared/TodoView';
import AgendaView from '../../components/shared/AgendaView';
import { BANT_FIELDS } from '../../lib/firebase';
import {
  Overlay, ModalHeader, ConfirmModal, Field, Stat, Tag, Empty, Spinner, toLocalInput,
  CARD, GRID, MODAL, LBL, INP, BTN_PRIMARY, BTN_CANCEL, ICON_BTN,
} from '../../components/commercial/ui';

const ACCENT = 'var(--neon)';

/*
 * Painel do SDR — reformulado.
 * A prospecção acontece no Kommo. Aqui o SDR só cadastra a call que
 * conseguiu agendar; ela sobe na hora para o painel dos Closers como
 * "Cliente Agendado".
 *
 * Abas: Dashboard (meta) · Agendar Call · Minhas Calls · No-Shows
 */
export default function SDRDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const {
    deals, loading, addScheduledCall, updateScheduledCall, rescheduleCall, deleteCall,
  } = useDeals();
  const { goals } = useCommercialGoals();
  const { scripts, addScript, updateScript, removeScript } = useSDRScripts(user?.authUid);

  const [page, setPage] = useState('overview');
  const [showForm, setShowForm] = useState(false);
  const [editDeal, setEditDeal] = useState(null);
  const [rescheduleTarget, setRescheduleTarget] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const me = user?.name;

  const mine = useMemo(() => deals.filter(d => d.sdrName === me), [deals, me]);

  const buckets = useMemo(() => {
    const scheduled = mine
      .filter(d => d.status === 'scheduled')
      .sort((a, b) => new Date(a.callAt) - new Date(b.callAt));
    const noshow = mine
      .filter(d => d.status === 'noshow')
      .sort((a, b) => new Date(b.noShowAt || 0) - new Date(a.noShowAt || 0));
    const closed = mine
      .filter(d => ['followup', 'won', 'mq', 'active'].includes(d.status))
      .sort((a, b) => new Date(b.callAt || 0) - new Date(a.callAt || 0));
    return { scheduled, noshow, closed };
  }, [mine]);

  const metrics = useMemo(() => ({
    scheduled: countScheduledThisMonth(deals, me),
    qualified: countQualifiedThisMonth(deals, me),
    mq: countMQThisMonth(deals, me),
    noshow: countNoShowThisMonth(deals, me),
  }), [deals, me]);

  const myGoal = Number(goals?.sdrIndividual?.[me] || 0);

  const NAV = [
    { key: 'overview',  label: 'Dashboard',    icon: LayoutDashboard },
    { key: 'scheduled', label: 'Minhas Calls', icon: CalendarCheck, badge: buckets.scheduled.length },
    { key: 'noshow',    label: 'No-Shows',     icon: AlertTriangle, badge: buckets.noshow.length, badgeDanger: buckets.noshow.length > 0 },
    { key: 'scripts',   label: 'Meus Scripts', icon: MessageSquare },
    { key: 'todo',      label: 'Meu Dia',      icon: CheckSquare },
    { key: 'agenda',    label: 'Agenda',       icon: Calendar },
  ];

  const handleSave = async (data) => {
    const r = editDeal
      ? await updateScheduledCall(editDeal.id, data)
      : await addScheduledCall(me, data);
    if (r.success) {
      toast(editDeal ? 'Call atualizada!' : 'Call cadastrada! Já está no painel dos closers. 🚀');
      setShowForm(false);
      setEditDeal(null);
    } else toast(r.error, 'e');
    return r;
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar sectorId="comercial" navItems={NAV} activeKey={page} onNav={setPage} />
      <main style={{ flex: 1, marginLeft: 224, padding: 28, minHeight: '100vh', overflow: 'auto' }}>
        {loading ? <Spinner /> : (
          <>
            <Header
              title={
                page === 'overview' ? 'Dashboard do SDR'
                : page === 'scheduled' ? 'Minhas Calls Agendadas'
                : page === 'noshow' ? 'No-Shows para Reagendar'
                : page === 'scripts' ? 'Meus Scripts'
                : page === 'todo' ? 'Meu Dia' : 'Agenda'
              }
              subtitle={
                page === 'overview' ? 'Sua meta de agendamento no mês'
                : page === 'scheduled' ? `${buckets.scheduled.length} call(s) aguardando acontecer`
                : page === 'noshow' ? 'O cliente não apareceu — reagende ou descarte'
                : ''
              }
              onNew={['overview', 'scheduled'].includes(page) ? () => { setEditDeal(null); setShowForm(true); } : null}
            />

            {page === 'overview' && (
              <Overview metrics={metrics} goal={myGoal} teamGoal={Number(goals?.sdrTeamGoal || 0)} deals={deals} />
            )}

            {page === 'scheduled' && (
              buckets.scheduled.length === 0
                ? <Empty msg="Nenhuma call agendada. Agende no Kommo e cadastre aqui." />
                : (
                  <div style={GRID}>
                    {buckets.scheduled.map(d => (
                      <CallCard
                        key={d.id}
                        deal={d}
                        onEdit={() => { setEditDeal(d); setShowForm(true); }}
                        onDelete={() => setConfirmDelete(d)}
                      />
                    ))}
                  </div>
                )
            )}

            {page === 'noshow' && (
              buckets.noshow.length === 0
                ? <Empty msg="Nenhum no-show pendente. 👏" />
                : (
                  <div style={GRID}>
                    {buckets.noshow.map(d => (
                      <NoShowCard
                        key={d.id}
                        deal={d}
                        onReschedule={() => setRescheduleTarget(d)}
                        onDelete={() => setConfirmDelete(d)}
                      />
                    ))}
                  </div>
                )
            )}

            {page === 'scripts' && (
              <Scripts scripts={scripts} onAdd={addScript} onUpdate={updateScript} onRemove={removeScript} toast={toast} />
            )}

            {page === 'todo' && <TodoView accent={ACCENT} />}
            {page === 'agenda' && <AgendaView />}
          </>
        )}
      </main>

      {showForm && ReactDOM.createPortal(
        <CallFormModal
          initial={editDeal}
          onClose={() => { setShowForm(false); setEditDeal(null); }}
          onSave={handleSave}
        />, document.body)}

      {rescheduleTarget && ReactDOM.createPortal(
        <RescheduleModal
          deal={rescheduleTarget}
          onClose={() => setRescheduleTarget(null)}
          onConfirm={async (at, link) => {
            const r = await rescheduleCall(rescheduleTarget.id, me, at, link);
            if (r.success) { toast('Call reagendada!'); setRescheduleTarget(null); }
            else toast(r.error, 'e');
          }}
        />, document.body)}

      {confirmDelete && ReactDOM.createPortal(
        <ConfirmModal
          title="Excluir call"
          text={`Excluir o cadastro de ${confirmDelete.leadName}? Essa ação não tem volta.`}
          onClose={() => setConfirmDelete(null)}
          onConfirm={async () => {
            const r = await deleteCall(confirmDelete.id, user);
            if (r.success) toast('Call excluída.');
            else toast(r.error, 'e');
            setConfirmDelete(null);
          }}
        />, document.body)}
    </div>
  );
}

// ── Dashboard ──────────────────────────────────────────────────
function Overview({ metrics, goal, teamGoal, deals }) {
  const pct = goal > 0 ? Math.min(100, Math.round((metrics.scheduled / goal) * 100)) : 0;
  const teamScheduled = countScheduledThisMonth(deals);

  return (
    <div className="fade-up">
      {/* Meta individual */}
      <div style={{ ...CARD, marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 12 }}>
          <div>
            <p style={{ fontSize: 11, letterSpacing: '.12em', color: 'var(--muted)', fontFamily: 'var(--fm)' }}>MINHA META DE AGENDAMENTO</p>
            <p style={{ fontSize: 34, fontWeight: 800, color: '#fff', marginTop: 6 }}>
              {metrics.scheduled}
              <span style={{ fontSize: 16, color: 'var(--muted)', fontWeight: 600 }}> / {goal || '—'}</span>
            </p>
          </div>
          <span style={{ fontSize: 22, fontWeight: 800, color: pct >= 100 ? 'var(--green)' : ACCENT, fontFamily: 'var(--fm)' }}>{goal > 0 ? `${pct}%` : ''}</span>
        </div>
        <div style={{ height: 8, borderRadius: 6, background: 'rgba(255,255,255,.07)', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${pct}%`, borderRadius: 6, background: pct >= 100 ? 'linear-gradient(90deg,#22c55e,#16a34a)' : `linear-gradient(90deg,${ACCENT},#c41f4a)`, transition: 'width .4s' }} />
        </div>
        {goal === 0 && <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 8 }}>Nenhuma meta definida pelo admin ainda.</p>}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))', gap: 12 }}>
        <Stat label="Calls agendadas (mês)" value={metrics.scheduled} color={ACCENT} />
        <Stat label="Bem qualificadas" value={metrics.qualified} color="var(--green)" hint="Aconteceram e não viraram MQ nem no-show" />
        <Stat label="MQ (mal qualificadas)" value={metrics.mq} color={metrics.mq > 0 ? 'var(--neon)' : 'var(--muted)'} />
        <Stat label="No-shows" value={metrics.noshow} color={metrics.noshow > 0 ? 'var(--amber)' : 'var(--muted)'} />
      </div>

      {teamGoal > 0 && (
        <div style={{ ...CARD, marginTop: 16 }}>
          <p style={{ fontSize: 11, letterSpacing: '.12em', color: 'var(--muted)', fontFamily: 'var(--fm)', marginBottom: 8 }}>META DA EQUIPE</p>
          <p style={{ fontSize: 22, fontWeight: 800, color: '#fff' }}>
            {teamScheduled} <span style={{ fontSize: 14, color: 'var(--muted)' }}>/ {teamGoal} calls no mês</span>
          </p>
        </div>
      )}
    </div>
  );
}

// ── Cards ──────────────────────────────────────────────────────
function CallCard({ deal, onEdit, onDelete }) {
  const when = deal.callAt ? new Date(deal.callAt) : null;
  const soon = when && (when - new Date()) < 24 * 3600 * 1000 && when > new Date();
  const past = when && when < new Date();

  return (
    <div style={{ ...CARD, border: `1px solid ${past ? 'var(--amber-b)' : soon ? `${ACCENT}44` : 'var(--border)'}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <div style={{ minWidth: 0 }}>
          <p style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>{deal.leadName}</p>
          {deal.company && <p style={{ fontSize: 12, color: 'var(--muted)' }}>{deal.company}</p>}
        </div>
        <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
          <button style={ICON_BTN} onClick={onEdit} title="Editar"><Edit2 size={13} /></button>
          <button style={ICON_BTN} onClick={onDelete} title="Excluir"><Trash2 size={13} color="rgba(238,51,99,.7)" /></button>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: past ? 'var(--amber)' : ACCENT, fontFamily: 'var(--fm)' }}>
          📅 {when ? when.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'}
        </span>
        {past && <Tag text="AGUARDANDO CLOSER" color="var(--amber)" />}
        {deal.niche && <Tag text={deal.niche} color="var(--muted)" />}
      </div>

      {deal.contact && <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 8 }}>📞 {deal.contact}</p>}
      {deal.socials && <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 3 }}>🔗 {deal.socials}</p>}

      {deal.meetLink && (
        <a href={deal.meetLink} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 10, fontSize: 12, color: 'var(--blue)', textDecoration: 'none' }}>
          <Video size={13} /> Link da call
        </a>
      )}

      <BantSummary bant={deal.bant} />
    </div>
  );
}

function NoShowCard({ deal, onReschedule, onDelete }) {
  return (
    <div style={{ ...CARD, border: '1px solid var(--amber-b)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <div>
          <p style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>{deal.leadName}</p>
          {deal.company && <p style={{ fontSize: 12, color: 'var(--muted)' }}>{deal.company}</p>}
        </div>
        <Tag text={`NO-SHOW ${deal.noShowCount > 1 ? `×${deal.noShowCount}` : ''}`} color="var(--amber)" />
      </div>

      <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 10 }}>
        Marcado por <strong style={{ color: '#ccc' }}>{deal.noShowBy || '—'}</strong>
        {deal.noShowAt && ` · ${new Date(deal.noShowAt).toLocaleDateString('pt-BR')}`}
      </p>
      {deal.noShowNote && (
        <p style={{ fontSize: 12, color: '#ddd', background: 'rgba(255,255,255,.04)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px', marginTop: 8, lineHeight: 1.5 }}>
          {deal.noShowNote}
        </p>
      )}
      {deal.contact && <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 8 }}>📞 {deal.contact}</p>}

      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <button style={{ ...BTN_PRIMARY, flex: 1 }} onClick={onReschedule}>Reagendar</button>
        <button style={ICON_BTN} onClick={onDelete} title="Descartar"><Trash2 size={13} color="rgba(238,51,99,.7)" /></button>
      </div>
    </div>
  );
}

function BantSummary({ bant }) {
  const filled = BANT_FIELDS.filter(f => (bant?.[f.id] || '').trim());
  if (filled.length === 0) return null;
  return (
    <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
      <p style={{ fontSize: 9, letterSpacing: '.12em', color: 'var(--muted)', fontFamily: 'var(--fm)', marginBottom: 6 }}>BANT</p>
      {filled.map(f => (
        <p key={f.id} style={{ fontSize: 12, color: '#ccc', lineHeight: 1.5, marginBottom: 4 }}>
          <strong style={{ color: ACCENT, fontFamily: 'var(--fm)', fontSize: 11 }}>{f.id.charAt(0).toUpperCase()}</strong> — {bant[f.id]}
        </p>
      ))}
    </div>
  );
}

// ── Modal: cadastro / edição da call ───────────────────────────
function CallFormModal({ initial, onClose, onSave }) {
  const [form, setForm] = useState({
    leadName: initial?.leadName || '',
    company: initial?.company || '',
    contact: initial?.contact || '',
    niche: initial?.niche || '',
    socials: initial?.socials || '',
    callAt: initial?.callAt ? toLocalInput(initial.callAt) : '',
    meetLink: initial?.meetLink || '',
    notes: initial?.notes || '',
    bant: {
      budget: initial?.bant?.budget || '',
      authority: initial?.bant?.authority || '',
      need: initial?.bant?.need || '',
      timing: initial?.bant?.timing || '',
    },
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const setBant = (k, v) => setForm(f => ({ ...f, bant: { ...f.bant, [k]: v } }));

  const valid = form.leadName.trim() && form.callAt && form.contact.trim();

  const save = async () => {
    if (!valid) { setError('Nome, contato e data/hora da call são obrigatórios.'); return; }
    setBusy(true);
    const r = await onSave({ ...form, callAt: new Date(form.callAt).toISOString() });
    setBusy(false);
    if (!r?.success) setError(r?.error || 'Falha ao salvar.');
  };

  return (
    <Overlay onClose={onClose}>
      <div style={{ ...MODAL, maxWidth: 560 }}>
        <ModalHeader title={initial ? 'Editar call agendada' : 'Cadastrar call agendada'} onClose={onClose} />
        <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 16, lineHeight: 1.5 }}>
          Use as mesmas informações do Kommo. Ao salvar, a call aparece na hora no painel dos closers.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <Field label="Nome do lead *" value={form.leadName} onChange={v => set('leadName', v)} />
          <Field label="Empresa" value={form.company} onChange={v => set('company', v)} />
          <Field label="Contato * (telefone / e-mail)" value={form.contact} onChange={v => set('contact', v)} />
          <Field label="Nicho" value={form.niche} onChange={v => set('niche', v)} />
        </div>
        <Field label="Redes sociais" value={form.socials} onChange={v => set('socials', v)} placeholder="@instagram, site, LinkedIn..." />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div>
            <p style={LBL}>DATA E HORA DA CALL *</p>
            <input type="datetime-local" value={form.callAt} onChange={e => set('callAt', e.target.value)} style={{ ...INP, marginTop: 6, colorScheme: 'dark' }} />
          </div>
          <Field label="Link da call" value={form.meetLink} onChange={v => set('meetLink', v)} placeholder="https://meet..." />
        </div>

        <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: ACCENT, marginBottom: 4 }}>Qualificação BANT</p>
          <p style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 10 }}>Quanto melhor o BANT, mais preparado o closer entra na call.</p>
          {BANT_FIELDS.map(f => (
            <div key={f.id} style={{ marginBottom: 8 }}>
              <p style={LBL}>{f.label.toUpperCase()}</p>
              <textarea value={form.bant[f.id]} onChange={e => setBant(f.id, e.target.value)} rows={2} placeholder={f.placeholder} style={{ ...INP, marginTop: 5, resize: 'vertical' }} />
            </div>
          ))}
        </div>

        <div>
          <p style={LBL}>OBSERVAÇÕES</p>
          <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={2} placeholder="Qualquer coisa que o closer precise saber..." style={{ ...INP, marginTop: 6, resize: 'vertical' }} />
        </div>

        {error && <p style={{ fontSize: 12, color: 'var(--neon)', marginTop: 10 }}>⚠ {error}</p>}

        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          <button style={{ ...BTN_PRIMARY, flex: 1, opacity: (valid && !busy) ? 1 : .5 }} disabled={!valid || busy} onClick={save}>
            {busy ? 'Salvando...' : (initial ? 'Salvar alterações' : 'Cadastrar call')}
          </button>
          <button style={BTN_CANCEL} onClick={onClose}>Cancelar</button>
        </div>
      </div>
    </Overlay>
  );
}

function RescheduleModal({ deal, onClose, onConfirm }) {
  const [at, setAt] = useState('');
  const [link, setLink] = useState(deal.meetLink || '');
  return (
    <Overlay onClose={onClose}>
      <div style={MODAL}>
        <ModalHeader title="Reagendar call" onClose={onClose} />
        <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 14 }}>
          <strong style={{ color: '#fff' }}>{deal.leadName}</strong> volta para o painel dos closers na nova data.
        </p>
        <p style={LBL}>NOVA DATA E HORA *</p>
        <input type="datetime-local" value={at} onChange={e => setAt(e.target.value)} style={{ ...INP, marginTop: 6, marginBottom: 10, colorScheme: 'dark' }} />
        <Field label="Link da call" value={link} onChange={setLink} />
        <button disabled={!at} onClick={() => onConfirm(new Date(at).toISOString(), link)} style={{ ...BTN_PRIMARY, width: '100%', marginTop: 14, opacity: at ? 1 : .5 }}>
          Reagendar
        </button>
      </div>
    </Overlay>
  );
}

// ── Scripts do SDR ─────────────────────────────────────────────
function Scripts({ scripts, onAdd, onUpdate, onRemove, toast }) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [editing, setEditing] = useState(null);

  const save = async () => {
    if (!title.trim() || !body.trim()) return;
    const r = editing ? await onUpdate(editing, { title: title.trim(), text: body.trim() }) : await onAdd(title, body);
    if (r?.success !== false) { setTitle(''); setBody(''); setEditing(null); toast('Script salvo!'); }
  };

  return (
    <div className="fade-up">
      <div style={{ ...CARD, marginBottom: 16 }}>
        <p style={LBL}>TÍTULO</p>
        <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Ex: Abordagem inicial WhatsApp" style={{ ...INP, marginTop: 6, marginBottom: 10 }} />
        <p style={LBL}>SCRIPT</p>
        <textarea value={body} onChange={e => setBody(e.target.value)} rows={4} placeholder="Escreva o script..." style={{ ...INP, marginTop: 6, resize: 'vertical' }} />
        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          <button style={{ ...BTN_PRIMARY, flex: 1, opacity: (title.trim() && body.trim()) ? 1 : .5 }} disabled={!title.trim() || !body.trim()} onClick={save}>
            {editing ? 'Salvar alterações' : 'Adicionar script'}
          </button>
          {editing && <button style={BTN_CANCEL} onClick={() => { setEditing(null); setTitle(''); setBody(''); }}>Cancelar</button>}
        </div>
      </div>

      {scripts.length === 0 ? <Empty msg="Nenhum script salvo ainda." /> : (
        <div style={GRID}>
          {scripts.map(s => (
            <div key={s.id} style={CARD}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <p style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>{s.title}</p>
                <div style={{ display: 'flex', gap: 5 }}>
                  <button style={ICON_BTN} onClick={() => { setEditing(s.id); setTitle(s.title); setBody(s.text || ''); }}><Edit2 size={13} /></button>
                  <button style={ICON_BTN} onClick={() => onRemove(s.id)}><Trash2 size={13} color="rgba(238,51,99,.7)" /></button>
                </div>
              </div>
              <p style={{ fontSize: 12, color: '#ccc', whiteSpace: 'pre-wrap', lineHeight: 1.6, marginTop: 8 }}>{s.text}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Cabeçalho da página ────────────────────────────────────────
function Header({ title, subtitle, onNew }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 22 }}>
      <div>
        <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: `${ACCENT}1a`, color: ACCENT, border: `1px solid ${ACCENT}40`, fontFamily: 'var(--fm)' }}>💼 SDR</span>
        <h1 style={{ fontSize: 26, fontWeight: 800, color: '#fff', letterSpacing: '-.5px', marginTop: 10, marginBottom: 4 }}>{title}</h1>
        {subtitle && <p style={{ fontSize: 13, color: 'var(--muted)' }}>{subtitle}</p>}
      </div>
      {onNew && (
        <button onClick={onNew} style={{ ...BTN_PRIMARY, display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px' }}>
          <Plus size={15} /> Cadastrar Call
        </button>
      )}
    </div>
  );
}
