import React, { useState, useMemo } from 'react';
import { Plus, Send, Eye, EyeOff, CheckCircle2, Trash2 } from 'lucide-react';
import { SECTORS, TASK_PRIORITIES, REQUEST_STATUS, REQUEST_SECTORS } from '../../lib/firebase';
import {
  Overlay, ModalHeader, Tag, Empty,
  MODAL, LBL, INP, BTN_PRIMARY, BTN_GREEN, BTN_CANCEL, CARD, GRID,
} from './ui';

/*
 * Reporte da CS — lado da CS.
 *
 * A CS abre uma solicitação para UM colaborador. Enquanto ele não
 * responde, o card mostra se ele já abriu (visualizado) ou não — é o
 * que evita a solicitação morrer no silêncio. Mesmo que o colaborador
 * marque "resolvi", quem encerra é a CS.
 */

const fmt = (iso) => iso
  ? new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
  : '—';

const urgencyOf = (id) => TASK_PRIORITIES.find(p => p.id === id) || TASK_PRIORITIES[1];

export default function CSRequests({
  requests, clients, collaborators, currentUser, currentUserSector,
  onCreate, onReply, onCloseRequest, onDelete, toast,
}) {
  const [filter, setFilter] = useState('open');
  const [onlyMine, setOnlyMine] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [openId, setOpenId] = useState(null);

  const base = useMemo(
    () => requests.filter(r => (onlyMine ? r.createdBy === currentUser : true)),
    [requests, onlyMine, currentUser]
  );

  const counts = useMemo(() => ({
    open:     base.filter(r => r.status === 'open').length,
    answered: base.filter(r => r.status === 'answered').length,
    closed:   base.filter(r => r.status === 'closed').length,
  }), [base]);

  const visible = base.filter(r => r.status === filter);

  // Sempre do array vivo — o thread precisa atualizar em tempo real.
  const openRequest = openId ? requests.find(r => r.id === openId) || null : null;

  const handleCreate = async (data) => {
    const r = await onCreate(data);
    if (r.success) { toast('Solicitação enviada.'); setShowCreate(false); setFilter('open'); }
    else toast(r.error, 'e');
    return r;
  };

  return (
    <div className="fade-up">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 18, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {Object.values(REQUEST_STATUS).map(s => (
            <button
              key={s.id}
              onClick={() => setFilter(s.id)}
              style={{
                padding: '7px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                background: filter === s.id ? `${s.color}20` : 'var(--surface)',
                color: filter === s.id ? s.color : 'var(--muted)',
                border: `1px solid ${filter === s.id ? `${s.color}55` : 'var(--border)'}`,
              }}
            >
              {s.label} ({counts[s.id]})
            </button>
          ))}
          <button
            onClick={() => setOnlyMine(v => !v)}
            style={{
              padding: '7px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer',
              background: onlyMine ? 'var(--neon-dim)' : 'var(--surface)',
              color: onlyMine ? 'var(--neon)' : 'var(--muted)',
              border: `1px solid ${onlyMine ? 'var(--neon-border)' : 'var(--border)'}`,
            }}
          >
            {onlyMine ? '✓ Abertas por mim' : 'Abertas por mim'}
          </button>
        </div>

        <button onClick={() => setShowCreate(true)} style={{ ...BTN_PRIMARY, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Plus size={15} /> Nova solicitação
        </button>
      </div>

      {visible.length === 0
        ? <Empty msg={filter === 'open' ? 'Nenhuma solicitação aguardando resposta.' : 'Nada por aqui.'} />
        : (
          <div style={GRID}>
            {visible.map(r => <RequestCard key={r.id} request={r} onClick={() => setOpenId(r.id)} />)}
          </div>
        )}

      {showCreate && (
        <CreateRequestModal
          clients={clients}
          collaborators={collaborators}
          onClose={() => setShowCreate(false)}
          onSave={handleCreate}
        />
      )}

      {openRequest && (
        <RequestDrawer
          request={openRequest}
          currentUser={currentUser}
          currentUserSector={currentUserSector}
          onClose={() => setOpenId(null)}
          onReply={onReply}
          onCloseRequest={async () => {
            const r = await onCloseRequest(openRequest.id, currentUser);
            if (r.success) { toast('Solicitação encerrada.'); setOpenId(null); }
            else toast(r.error, 'e');
          }}
          onDelete={async () => {
            const r = await onDelete(openRequest.id);
            if (r.success) { toast('Solicitação excluída.'); setOpenId(null); }
            else toast(r.error, 'e');
          }}
        />
      )}
    </div>
  );
}

// ── Card ───────────────────────────────────────────────────────
function RequestCard({ request, onClick }) {
  const u = urgencyOf(request.urgency);
  const st = REQUEST_STATUS[request.status] || REQUEST_STATUS.open;
  const sec = SECTORS[request.toSector];

  return (
    <button onClick={onClick} style={{ ...CARD, textAlign: 'left', width: '100%', cursor: 'pointer', border: `1px solid ${st.color}33` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 8 }}>
        <p style={{ fontSize: 15, fontWeight: 700, color: '#fff', lineHeight: 1.35 }}>{request.subject}</p>
        <Tag text={u.label.toUpperCase()} color={u.color} />
      </div>

      <p style={{ fontSize: 12, color: 'var(--muted)' }}>👤 {request.clientName}</p>
      <p style={{ fontSize: 12, color: sec?.color || 'var(--text)', marginTop: 4 }}>
        {sec?.emoji} Para {request.toName}
      </p>

      <p style={{ fontSize: 12, color: '#999', marginTop: 10, lineHeight: 1.55, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
        {request.description}
      </p>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--border)', flexWrap: 'wrap' }}>
        {request.seenAt
          ? <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--green)', fontFamily: 'var(--fm)' }}><Eye size={12} /> Visualizada {fmt(request.seenAt)}</span>
          : <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--amber)', fontFamily: 'var(--fm)' }}><EyeOff size={12} /> Ainda não aberta</span>}
        {request.collaboratorDone && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--green)', fontFamily: 'var(--fm)' }}>
            <CheckCircle2 size={12} /> Resolvida pelo colaborador
          </span>
        )}
        <span style={{ fontSize: 10, color: '#555', fontFamily: 'var(--fm)', marginLeft: 'auto' }}>
          {(request.replies || []).length} resposta(s)
        </span>
      </div>
    </button>
  );
}

// ── Detalhe ────────────────────────────────────────────────────
function RequestDrawer({ request, currentUser, currentUserSector, onClose, onReply, onCloseRequest, onDelete }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);

  const u = urgencyOf(request.urgency);
  const st = REQUEST_STATUS[request.status] || REQUEST_STATUS.open;
  const sec = SECTORS[request.toSector];
  const encerrada = request.status === 'closed';

  const enviar = async () => {
    if (!text.trim()) return;
    setBusy(true);
    await onReply(request.id, { author: currentUser, sector: currentUserSector, text, role: 'cs' });
    setBusy(false);
    setText('');
  };

  return (
    <Overlay onClose={onClose}>
      <div style={{ ...MODAL, maxWidth: 560 }}>
        <ModalHeader title={request.subject} onClose={onClose} />

        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
          <Tag text={u.label.toUpperCase()} color={u.color} />
          <Tag text={st.label.toUpperCase()} color={st.color} />
          {request.collaboratorDone && <Tag text="RESOLVIDA PELO COLABORADOR" color="var(--green)" />}
        </div>

        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 14, marginBottom: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>👤 {request.clientName}</span>
            <span style={{ fontSize: 12, color: sec?.color || 'var(--text)' }}>{sec?.emoji} {request.toName}</span>
          </div>
          <p style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.7, whiteSpace: 'pre-wrap', marginTop: 8 }}>{request.description}</p>
          <p style={{ fontSize: 10, color: '#555', fontFamily: 'var(--fm)', marginTop: 10 }}>
            Aberta por {request.createdBy} · {fmt(request.createdAt)}
          </p>
        </div>

        <div style={{
          display: 'flex', alignItems: 'center', gap: 7, marginBottom: 14,
          fontSize: 12, fontFamily: 'var(--fm)',
          color: request.seenAt ? 'var(--green)' : 'var(--amber)',
        }}>
          {request.seenAt ? <Eye size={14} /> : <EyeOff size={14} />}
          {request.seenAt
            ? `${request.seenBy || request.toName} abriu em ${fmt(request.seenAt)}`
            : 'O colaborador ainda não abriu esta solicitação.'}
        </div>

        {/* Thread */}
        <p style={LBL}>CONVERSA</p>
        <div style={{ marginTop: 8, marginBottom: 14 }}>
          {(request.replies || []).length === 0
            ? <p style={{ fontSize: 12, color: '#555', padding: '10px 0' }}>Nenhuma resposta ainda.</p>
            : (request.replies || []).map(rep => (
              <div key={rep.id} style={{
                background: rep.role === 'cs' ? 'rgba(255,255,255,.03)' : 'rgba(56,189,248,.06)',
                border: `1px solid ${rep.role === 'cs' ? 'var(--border)' : 'rgba(56,189,248,.25)'}`,
                borderRadius: 9, padding: '10px 12px', marginBottom: 8,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: rep.role === 'cs' ? 'var(--neon)' : 'var(--blue)' }}>{rep.author}</span>
                  <span style={{ fontSize: 10, color: '#555', fontFamily: 'var(--fm)' }}>{fmt(rep.at)}</span>
                </div>
                <p style={{ fontSize: 13, color: '#ddd', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{rep.text}</p>
                {rep.role === 'collab' && (
                  <p style={{ fontSize: 11, color: rep.done ? 'var(--green)' : 'var(--amber)', fontFamily: 'var(--fm)', marginTop: 6 }}>
                    {rep.done ? '✓ marcou como resolvida' : '• ainda em andamento'}
                  </p>
                )}
              </div>
            ))}
        </div>

        {!encerrada && (
          <>
            <textarea
              value={text}
              onChange={e => setText(e.target.value)}
              rows={3}
              placeholder="Responder ao colaborador..."
              style={{ ...INP, resize: 'vertical' }}
            />
            <button
              onClick={enviar}
              disabled={!text.trim() || busy}
              style={{ ...BTN_PRIMARY, width: '100%', marginTop: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, opacity: (text.trim() && !busy) ? 1 : .5, cursor: text.trim() ? 'pointer' : 'not-allowed' }}
            >
              <Send size={14} /> {busy ? 'Enviando...' : 'Enviar resposta'}
            </button>

            <button onClick={onCloseRequest} style={{ ...BTN_GREEN, width: '100%', marginTop: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <CheckCircle2 size={15} /> Encerrar solicitação
            </button>
            <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 8, lineHeight: 1.5, textAlign: 'center' }}>
              Ao encerrar, ela sai da lista do colaborador e vai para "Encerradas".
            </p>
          </>
        )}

        {encerrada && (
          <p style={{ fontSize: 12, color: 'var(--green)', fontFamily: 'var(--fm)', textAlign: 'center', padding: '8px 0' }}>
            Encerrada por {request.closedBy || '—'} em {fmt(request.closedAt)}
          </p>
        )}

        <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: 8, alignItems: 'center' }}>
          {!confirmDel
            ? (
              <button onClick={() => setConfirmDel(true)} style={{ background: 'transparent', border: 'none', color: '#666', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
                <Trash2 size={13} /> Excluir
              </button>
            ) : (
              <>
                <span style={{ fontSize: 12, color: 'var(--muted)' }}>Excluir de vez?</span>
                <button onClick={onDelete} style={{ ...BTN_PRIMARY, padding: '7px 14px' }}>Sim</button>
                <button onClick={() => setConfirmDel(false)} style={{ ...BTN_CANCEL, padding: '7px 14px' }}>Não</button>
              </>
            )}
        </div>
      </div>
    </Overlay>
  );
}

// ── Nova solicitação ───────────────────────────────────────────
function CreateRequestModal({ clients, collaborators, onClose, onSave }) {
  const [form, setForm] = useState({
    subject: '', clientId: '', urgency: 'medium',
    toSector: '', toName: '', description: '',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const activeClients = (clients || [])
    .filter(c => c.active !== false)
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));

  const sectorPeople = (collaborators || [])
    .filter(c => c.active !== false && c.sector === form.toSector)
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));

  const salvar = async () => {
    setError('');
    setBusy(true);
    const client = activeClients.find(c => c.id === form.clientId);
    const r = await onSave({
      subject: form.subject,
      clientId: form.clientId || null,
      clientName: client?.name || 'Sem cliente',
      urgency: form.urgency,
      description: form.description,
      toName: form.toName,
      toSector: form.toSector,
    });
    setBusy(false);
    if (!r.success) setError(r.error || 'Não foi possível enviar.');
  };

  return (
    <Overlay onClose={onClose}>
      <div style={MODAL}>
        <ModalHeader title="Nova solicitação" onClose={onClose} />
        <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 16, lineHeight: 1.55 }}>
          Pedido pontual para um colaborador. Não entra no Kanban nem conta como entrega —
          serve para o que precisa de atenção fora do fluxo de produção.
        </p>

        <p style={LBL}>ASSUNTO *</p>
        <input
          style={{ ...INP, marginTop: 6, marginBottom: 14 }}
          value={form.subject}
          onChange={e => set('subject', e.target.value)}
          placeholder="Ex: Cliente pediu ajuste no post de ontem"
          autoFocus
        />

        <p style={LBL}>CLIENTE</p>
        <select style={{ ...INP, marginTop: 6, marginBottom: 14, cursor: 'pointer' }} value={form.clientId} onChange={e => set('clientId', e.target.value)}>
          <option value="">Sem cliente vinculado</option>
          {activeClients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>

        <p style={LBL}>SETOR *</p>
        <select
          style={{ ...INP, marginTop: 6, marginBottom: 14, cursor: 'pointer' }}
          value={form.toSector}
          onChange={e => setForm(f => ({ ...f, toSector: e.target.value, toName: '' }))}
        >
          <option value="">Selecionar setor</option>
          {REQUEST_SECTORS.map(id => (
            <option key={id} value={id}>{SECTORS[id]?.emoji} {SECTORS[id]?.label}</option>
          ))}
        </select>

        {form.toSector && (
          <>
            <p style={LBL}>COLABORADOR *</p>
            <select style={{ ...INP, marginTop: 6, marginBottom: 14, cursor: 'pointer' }} value={form.toName} onChange={e => set('toName', e.target.value)}>
              <option value="">Selecionar colaborador</option>
              {sectorPeople.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
            </select>
          </>
        )}

        <p style={LBL}>GRAU DE URGÊNCIA</p>
        <div style={{ display: 'flex', gap: 6, marginTop: 8, marginBottom: 14, flexWrap: 'wrap' }}>
          {TASK_PRIORITIES.map(p => (
            <button
              key={p.id}
              onClick={() => set('urgency', p.id)}
              style={{
                flex: '1 1 45%', padding: '10px', borderRadius: 9, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                background: form.urgency === p.id ? `${p.color}22` : 'var(--surface)',
                color: form.urgency === p.id ? p.color : 'var(--muted)',
                border: `1px solid ${form.urgency === p.id ? `${p.color}66` : 'var(--border)'}`,
              }}
            >
              {p.label}
            </button>
          ))}
        </div>

        <p style={LBL}>O QUE VOCÊ PRECISA *</p>
        <textarea
          style={{ ...INP, marginTop: 6, resize: 'vertical' }}
          rows={5}
          value={form.description}
          onChange={e => set('description', e.target.value)}
          placeholder="Descreva o pedido com o contexto que o colaborador precisa para agir."
        />

        {error && <p style={{ fontSize: 12, color: 'var(--neon)', marginTop: 12 }}>{error}</p>}

        <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
          <button
            style={{ ...BTN_PRIMARY, flex: 1, opacity: busy ? .6 : 1 }}
            disabled={busy}
            onClick={salvar}
          >
            {busy ? 'Enviando...' : 'Enviar solicitação'}
          </button>
          <button style={BTN_CANCEL} onClick={onClose}>Cancelar</button>
        </div>
      </div>
    </Overlay>
  );
}
