import React, { useState, useMemo } from 'react';
import { Plus, Send, Eye, EyeOff, CheckCircle2, Trash2, Search, LayoutGrid, List } from 'lucide-react';
import { SECTORS, TASK_PRIORITIES, REQUEST_STATUS, REQUEST_SECTORS, REQUEST_SLA_HOURS } from '../../lib/firebase';
import { businessMsBetween, formatBusinessDuration } from '../../lib/taskTime';
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
 *
 * POR QUE OS FILTROS MUDARAM: antes havia um filtro de status único e
 * excludente mais um botão "abertas por mim". Com as duas CSs jogando
 * na mesma lista, isso virava uma pilha de cards sem como recortar. O
 * pedido era conseguir acompanhar o trabalho da outra CS e cobrar
 * quem está devendo — daí:
 *
 *   · escopo: minhas / da outra CS / todas
 *   · filtros combináveis de cliente, colaborador e urgência
 *   · busca por texto no assunto e na descrição
 *   · ordenação por urgência e tempo em aberto
 *   · selo de idade e de "ainda não visualizada"
 *   · lista compacta para varrer volume, além da grade
 */

const fmt = (iso) => iso
  ? new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
  : '—';

const urgencyOf = (id) => TASK_PRIORITIES.find(p => p.id === id) || TASK_PRIORITIES[1];

const URGENCY_RANK = { urgent: 0, high: 1, medium: 2, low: 3 };

// Idade em tempo ÚTIL e comparação com o SLA da urgência. Serve para
// ordenar a fila e marcar o que estourou — não bloqueia nada.
function agingOf(request) {
  if (!request?.createdAt) return null;
  const fim = request.status === 'closed' ? (request.closedAt || new Date()) : new Date();
  const ms = businessMsBetween(request.createdAt, fim);
  const slaMs = (REQUEST_SLA_HOURS[request.urgency] || REQUEST_SLA_HOURS.medium) * 3600000;
  return { ms, slaMs, estourou: ms > slaMs && request.status === 'open' };
}

const SCOPES = [
  { id: 'mine',   label: 'Minhas' },
  { id: 'others', label: 'Da outra CS' },
  { id: 'all',    label: 'Todas' },
];

export default function CSRequests({
  requests, clients, collaborators, currentUser, currentUserSector,
  onCreate, onReply, onCloseRequest, onDelete, toast,
}) {
  const [scope, setScope] = useState('all');
  const [statuses, setStatuses] = useState(['open']);
  const [clientFilter, setClientFilter] = useState('');
  const [personFilter, setPersonFilter] = useState('');
  const [urgencyFilter, setUrgencyFilter] = useState('');
  const [search, setSearch] = useState('');
  const [view, setView] = useState('list');
  const [showCreate, setShowCreate] = useState(false);
  const [openId, setOpenId] = useState(null);

  // Escopo primeiro: é o recorte que responde "isso é meu ou dela?".
  const scoped = useMemo(() => requests.filter(r => {
    if (scope === 'mine')   return r.createdBy === currentUser;
    if (scope === 'others') return r.createdBy !== currentUser;
    return true;
  }), [requests, scope, currentUser]);

  const counts = useMemo(() => ({
    open:     scoped.filter(r => r.status === 'open').length,
    answered: scoped.filter(r => r.status === 'answered').length,
    closed:   scoped.filter(r => r.status === 'closed').length,
  }), [scoped]);

  const atrasadas = useMemo(
    () => scoped.filter(r => r.status === 'open' && agingOf(r)?.estourou).length,
    [scoped]
  );

  const visible = useMemo(() => {
    const termo = search.trim().toLowerCase();
    return scoped
      .filter(r => {
        if (statuses.length && !statuses.includes(r.status)) return false;
        if (clientFilter && r.clientId !== clientFilter) return false;
        if (personFilter && r.toName !== personFilter) return false;
        if (urgencyFilter && r.urgency !== urgencyFilter) return false;
        if (termo) {
          const alvo = `${r.subject || ''} ${r.description || ''} ${r.clientName || ''} ${r.toName || ''}`.toLowerCase();
          if (!alvo.includes(termo)) return false;
        }
        return true;
      })
      .sort((a, b) => {
        // Fila de trabalho: o que estourou o SLA primeiro, depois por
        // urgência, depois pelo que está esperando há mais tempo.
        const ea = agingOf(a)?.estourou ? 0 : 1;
        const eb = agingOf(b)?.estourou ? 0 : 1;
        if (ea !== eb) return ea - eb;
        const ua = URGENCY_RANK[a.urgency] ?? 2;
        const ub = URGENCY_RANK[b.urgency] ?? 2;
        if (ua !== ub) return ua - ub;
        return new Date(a.createdAt || 0) - new Date(b.createdAt || 0);
      });
  }, [scoped, statuses, clientFilter, personFilter, urgencyFilter, search]);

  // Só quem já recebeu alguma solicitação entra no filtro de pessoa —
  // evita um select com a agência inteira.
  const pessoas = useMemo(() => {
    const nomes = new Set(requests.map(r => r.toName).filter(Boolean));
    return Array.from(nomes).sort();
  }, [requests]);

  const clientesComRequest = useMemo(() => {
    const ids = new Set(requests.map(r => r.clientId).filter(Boolean));
    return clients.filter(c => ids.has(c.id)).sort((a, b) => a.name.localeCompare(b.name));
  }, [requests, clients]);

  const toggleStatus = (id) => setStatuses(prev =>
    prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
  );

  const limparFiltros = () => {
    setClientFilter(''); setPersonFilter(''); setUrgencyFilter(''); setSearch('');
  };
  const temFiltro = clientFilter || personFilter || urgencyFilter || search.trim();

  // Sempre do array vivo — o thread precisa atualizar em tempo real.
  const openRequest = openId ? requests.find(r => r.id === openId) || null : null;

  const handleCreate = async (data) => {
    const r = await onCreate(data);
    if (r.success) { toast('Solicitação enviada.'); setShowCreate(false); setStatuses(['open']); }
    else toast(r.error, 'e');
    return r;
  };

  return (
    <div className="fade-up">
      {/* Escopo + ação */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 4, background: 'rgba(255,255,255,.03)', borderRadius: 10, padding: 4 }}>
          {SCOPES.map(s => (
            <button
              key={s.id}
              onClick={() => setScope(s.id)}
              style={{ background: scope === s.id ? 'var(--neon-dim)' : 'transparent', border: 'none', borderRadius: 7, padding: '7px 14px', color: scope === s.id ? 'var(--neon)' : 'var(--muted)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
            >
              {s.label}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: 4, background: 'rgba(255,255,255,.03)', borderRadius: 9, padding: 3 }}>
            <button onClick={() => setView('list')} title="Lista compacta"
              style={{ background: view === 'list' ? 'var(--surface)' : 'transparent', border: 'none', borderRadius: 6, padding: '6px 8px', color: view === 'list' ? 'var(--text)' : 'var(--muted)', cursor: 'pointer', display: 'flex' }}>
              <List size={14} />
            </button>
            <button onClick={() => setView('grid')} title="Grade"
              style={{ background: view === 'grid' ? 'var(--surface)' : 'transparent', border: 'none', borderRadius: 6, padding: '6px 8px', color: view === 'grid' ? 'var(--text)' : 'var(--muted)', cursor: 'pointer', display: 'flex' }}>
              <LayoutGrid size={14} />
            </button>
          </div>
          <button onClick={() => setShowCreate(true)} style={{ ...BTN_PRIMARY, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Plus size={15} /> Nova solicitação
          </button>
        </div>
      </div>

      {/* Status (combinável) */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        {Object.values(REQUEST_STATUS).map(s => {
          const on = statuses.includes(s.id);
          return (
            <button
              key={s.id}
              onClick={() => toggleStatus(s.id)}
              style={{
                padding: '7px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                background: on ? `${s.color}20` : 'var(--surface)',
                color: on ? s.color : 'var(--muted)',
                border: `1px solid ${on ? `${s.color}55` : 'var(--border)'}`,
              }}
            >
              {on ? '✓ ' : ''}{s.label} ({counts[s.id]})
            </button>
          );
        })}
        {atrasadas > 0 && (
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--neon)', fontFamily: 'var(--fm)', marginLeft: 4 }}>
            {atrasadas} fora do SLA
          </span>
        )}
      </div>

      {/* Filtros combináveis */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 18, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: '1 1 200px', minWidth: 180 }}>
          <Search size={13} color="var(--muted)" style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)' }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por assunto, descrição, cliente..."
            style={{ ...INP, paddingLeft: 32, fontSize: 12 }}
          />
        </div>
        <select value={clientFilter} onChange={e => setClientFilter(e.target.value)} style={SELECT}>
          <option value="">Todos os clientes</option>
          {clientesComRequest.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select value={personFilter} onChange={e => setPersonFilter(e.target.value)} style={SELECT}>
          <option value="">Todos os colaboradores</option>
          {pessoas.map(n => <option key={n} value={n}>{n}</option>)}
        </select>
        <select value={urgencyFilter} onChange={e => setUrgencyFilter(e.target.value)} style={SELECT}>
          <option value="">Todas as urgências</option>
          {TASK_PRIORITIES.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
        </select>
        {temFiltro && (
          <button onClick={limparFiltros} style={{ ...BTN_CANCEL, padding: '8px 12px', fontSize: 12 }}>Limpar</button>
        )}
      </div>

      {visible.length === 0
        ? <Empty msg={temFiltro ? 'Nada encontrado com esses filtros.' : 'Nenhuma solicitação neste recorte.'} />
        : view === 'grid'
          ? (
            <div style={GRID}>
              {visible.map(r => <RequestCard key={r.id} request={r} onClick={() => setOpenId(r.id)} />)}
            </div>
          )
          : (
            <div style={{ background: 'rgba(12,12,24,.88)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
              {visible.map((r, i) => (
                <RequestRow key={r.id} request={r} last={i === visible.length - 1} onClick={() => setOpenId(r.id)} />
              ))}
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

const SELECT = {
  background: '#12121f', border: '1px solid var(--border)', borderRadius: 9,
  padding: '9px 12px', color: 'var(--text)', fontSize: 12, outline: 'none',
  cursor: 'pointer', fontFamily: 'var(--f)',
};

// ── Linha da lista compacta ────────────────────────────────────
// É a visão para varrer volume: quem pediu, para quem, há quanto
// tempo e se já foi visto. Tudo o que a CS precisa para cobrar.
function RequestRow({ request, last, onClick }) {
  const u = urgencyOf(request.urgency);
  const st = REQUEST_STATUS[request.status] || REQUEST_STATUS.open;
  const sec = SECTORS[request.toSector];
  const aging = agingOf(request);

  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left',
        background: 'transparent', border: 'none',
        borderBottom: last ? 'none' : '1px solid rgba(255,255,255,.05)',
        padding: '11px 14px', cursor: 'pointer',
      }}
    >
      <span style={{ width: 3, height: 30, borderRadius: 2, background: u.color, flexShrink: 0 }} />

      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: '#eee', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {request.subject}
        </p>
        <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
          {request.clientName} · para <strong style={{ color: sec?.color || '#bbb' }}>{request.toName}</strong> · por {request.createdBy}
        </p>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        {request.status === 'open' && (
          request.seenAt
            ? <Eye size={13} color="var(--blue)" />
            : <EyeOff size={13} color="var(--muted)" />
        )}
        {aging && (
          <span style={{ fontSize: 11, fontFamily: 'var(--fm)', color: aging.estourou ? 'var(--neon)' : '#777', minWidth: 58, textAlign: 'right' }}>
            {formatBusinessDuration(aging.ms)}
          </span>
        )}
        <Tag text={st.label} color={st.color} />
      </div>
    </button>
  );
}
// ── Card ───────────────────────────────────────────────────────
function RequestCard({ request, onClick }) {
  const u = urgencyOf(request.urgency);
  const st = REQUEST_STATUS[request.status] || REQUEST_STATUS.open;
  const sec = SECTORS[request.toSector];
  const aging = agingOf(request);

  return (
    <button onClick={onClick} style={{ ...CARD, textAlign: 'left', width: '100%', cursor: 'pointer', border: `1px solid ${aging?.estourou ? 'var(--neon-border)' : `${st.color}33`}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 8 }}>
        <p style={{ fontSize: 15, fontWeight: 700, color: '#fff', lineHeight: 1.35 }}>{request.subject}</p>
        <Tag text={u.label.toUpperCase()} color={u.color} />
      </div>

      <p style={{ fontSize: 12, color: 'var(--muted)' }}>👤 {request.clientName}</p>
      <p style={{ fontSize: 12, color: sec?.color || 'var(--text)', marginTop: 4 }}>
        {sec?.emoji} Para {request.toName} · aberta por {request.createdBy}
      </p>

      {aging && (
        <p style={{ fontSize: 11, fontFamily: 'var(--fm)', color: aging.estourou ? 'var(--neon)' : '#777', marginTop: 6 }}>
          {aging.estourou ? '⚠ ' : ''}em aberto há {formatBusinessDuration(aging.ms)}
          {aging.estourou ? ' · fora do SLA' : ''}
        </p>
      )}

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
