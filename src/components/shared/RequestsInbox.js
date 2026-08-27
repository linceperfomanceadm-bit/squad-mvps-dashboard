import React, { useState, useMemo } from 'react';
import { Send, CheckCircle2, Square, CheckSquare, Inbox } from 'lucide-react';
import { SECTORS, TASK_PRIORITIES, REQUEST_STATUS } from '../../lib/firebase';
import {
  Overlay, ModalHeader, Tag,
  MODAL, LBL, INP, BTN_PRIMARY, BTN_CANCEL, CARD, GRID,
} from '../commercial/ui';

/*
 * Reporte da CS — lado do colaborador.
 *
 * Só aparecem as solicitações endereçadas a ESTA pessoa e que a CS
 * ainda não encerrou. Abrir uma solicitação carimba o "visualizado",
 * que a CS enxerga do outro lado — por isso a marcação acontece no
 * clique, não no render da lista.
 */

const fmt = (iso) => iso
  ? new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
  : '—';

const urgencyOf = (id) => TASK_PRIORITIES.find(p => p.id === id) || TASK_PRIORITIES[1];

export default function RequestsInbox({
  requests, currentUser, currentUserSector, accent = 'var(--neon)',
  onMarkSeen, onReply, toast,
}) {
  const [filter, setFilter] = useState('open');
  const [openId, setOpenId] = useState(null);

  const mine = useMemo(
    () => requests.filter(r => r.toName === currentUser && r.status !== 'closed'),
    [requests, currentUser]
  );

  const counts = {
    open: mine.filter(r => r.status === 'open').length,
    answered: mine.filter(r => r.status === 'answered').length,
  };

  const visible = mine.filter(r => r.status === filter);
  const openRequest = openId ? requests.find(r => r.id === openId) || null : null;

  const abrir = (r) => {
    setOpenId(r.id);
    if (!r.seenAt) onMarkSeen(r, currentUser);
  };

  return (
    <div className="fade-up">
      <div style={{ marginBottom: 18 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, color: '#fff', letterSpacing: '-.5px', marginBottom: 4 }}>
          Reporte da CS
        </h1>
        <p style={{ fontSize: 13, color: 'var(--muted)' }}>
          Pedidos que a CS abriu para você. Não são tasks de produção — respondê-los é o que fecha o ciclo.
        </p>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 18, flexWrap: 'wrap' }}>
        {[
          { id: 'open',     label: 'Aguardando você', color: 'var(--amber)', count: counts.open },
          { id: 'answered', label: 'Respondidas',      color: 'var(--blue)',  count: counts.answered },
        ].map(f => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            style={{
              padding: '7px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer',
              background: filter === f.id ? `${accent}20` : 'var(--surface)',
              color: filter === f.id ? accent : 'var(--muted)',
              border: `1px solid ${filter === f.id ? `${accent}55` : 'var(--border)'}`,
            }}
          >
            {f.label} ({f.count})
          </button>
        ))}
      </div>

      {visible.length === 0
        ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, paddingTop: 60, textAlign: 'center' }}>
            <Inbox size={30} color="var(--muted)" style={{ opacity: .5 }} />
            <p style={{ fontSize: 14, color: 'var(--muted)', fontWeight: 600 }}>
              {filter === 'open' ? 'Nenhuma solicitação esperando por você.' : 'Nada respondido ainda.'}
            </p>
          </div>
        ) : (
          <div style={GRID}>
            {visible.map(r => <InboxCard key={r.id} request={r} onClick={() => abrir(r)} />)}
          </div>
        )}

      {openRequest && (
        <RequestDetail
          request={openRequest}
          currentUser={currentUser}
          currentUserSector={currentUserSector}
          onClose={() => setOpenId(null)}
          onReply={async (payload) => {
            const r = await onReply(openRequest.id, payload);
            if (r.success) toast('Resposta enviada à CS.');
            else toast(r.error, 'e');
            return r;
          }}
        />
      )}
    </div>
  );
}

function InboxCard({ request, onClick }) {
  const u = urgencyOf(request.urgency);
  const st = REQUEST_STATUS[request.status] || REQUEST_STATUS.open;
  const nova = !request.seenAt;

  return (
    <button onClick={onClick} style={{ ...CARD, textAlign: 'left', width: '100%', cursor: 'pointer', border: `1px solid ${nova ? 'var(--amber-b)' : `${st.color}33`}`, position: 'relative' }}>
      {nova && <div style={{ position: 'absolute', top: 14, right: 14, width: 8, height: 8, borderRadius: '50%', background: 'var(--amber)', boxShadow: '0 0 8px var(--amber)' }} />}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 14, marginBottom: 8 }}>
        <p style={{ fontSize: 15, fontWeight: 700, color: '#fff', lineHeight: 1.35 }}>{request.subject}</p>
      </div>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
        <Tag text={u.label.toUpperCase()} color={u.color} />
        {request.collaboratorDone && <Tag text="VOCÊ RESOLVEU" color="var(--green)" />}
      </div>

      <p style={{ fontSize: 12, color: 'var(--muted)' }}>👤 {request.clientName}</p>
      <p style={{ fontSize: 12, color: '#999', marginTop: 10, lineHeight: 1.55, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
        {request.description}
      </p>

      <p style={{ fontSize: 10, color: '#555', fontFamily: 'var(--fm)', marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
        {request.createdBy} · {fmt(request.createdAt)}
      </p>
    </button>
  );
}

function RequestDetail({ request, currentUser, currentUserSector, onClose, onReply }) {
  const [text, setText] = useState('');
  const [done, setDone] = useState(request.collaboratorDone === true);
  const [busy, setBusy] = useState(false);

  const u = urgencyOf(request.urgency);
  const sec = SECTORS[request.toSector];

  const enviar = async () => {
    if (!text.trim()) return;
    setBusy(true);
    const r = await onReply({ author: currentUser, sector: currentUserSector, text, done, role: 'collab' });
    setBusy(false);
    if (r.success) { setText(''); onClose(); }
  };

  return (
    <Overlay onClose={onClose}>
      <div style={{ ...MODAL, maxWidth: 560 }}>
        <ModalHeader title={request.subject} onClose={onClose} />

        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
          <Tag text={u.label.toUpperCase()} color={u.color} />
          <Tag text={`PARA ${String(sec?.label || '').toUpperCase()}`} color={sec?.color || 'var(--muted)'} />
        </div>

        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 14, marginBottom: 16 }}>
          <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 8 }}>👤 {request.clientName}</p>
          <p style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{request.description}</p>
          <p style={{ fontSize: 10, color: '#555', fontFamily: 'var(--fm)', marginTop: 10 }}>
            {request.createdBy} · {fmt(request.createdAt)}
          </p>
        </div>

        {(request.replies || []).length > 0 && (
          <>
            <p style={LBL}>CONVERSA</p>
            <div style={{ marginTop: 8, marginBottom: 16 }}>
              {(request.replies || []).map(rep => (
                <div key={rep.id} style={{
                  background: rep.role === 'cs' ? 'rgba(238,51,99,.06)' : 'rgba(255,255,255,.03)',
                  border: `1px solid ${rep.role === 'cs' ? 'var(--neon-border)' : 'var(--border)'}`,
                  borderRadius: 9, padding: '10px 12px', marginBottom: 8,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: rep.role === 'cs' ? 'var(--neon)' : 'var(--blue)' }}>{rep.author}</span>
                    <span style={{ fontSize: 10, color: '#555', fontFamily: 'var(--fm)' }}>{fmt(rep.at)}</span>
                  </div>
                  <p style={{ fontSize: 13, color: '#ddd', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{rep.text}</p>
                </div>
              ))}
            </div>
          </>
        )}

        <p style={LBL}>AÇÃO TOMADA *</p>
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          rows={4}
          placeholder="Conte para a CS o que você fez ou vai fazer."
          style={{ ...INP, marginTop: 6, resize: 'vertical' }}
        />

        <button
          onClick={() => setDone(v => !v)}
          style={{
            display: 'flex', alignItems: 'center', gap: 9, width: '100%', marginTop: 12,
            background: done ? 'var(--green-dim)' : 'var(--surface)',
            border: `1px solid ${done ? 'var(--green-b)' : 'var(--border)'}`,
            borderRadius: 9, padding: '11px 13px', cursor: 'pointer',
            color: done ? 'var(--green)' : 'var(--muted)', fontSize: 13, fontWeight: 600, textAlign: 'left',
          }}
        >
          {done ? <CheckSquare size={16} /> : <Square size={16} />}
          Resolvi esta solicitação do meu lado
        </button>

        <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 8, lineHeight: 1.55 }}>
          Marcar como resolvida avisa a CS, mas não encerra o chamado — quem encerra é ela.
        </p>

        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          <button
            onClick={enviar}
            disabled={!text.trim() || busy}
            style={{ ...BTN_PRIMARY, flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: text.trim() && !busy ? 1 : .5 }}
          >
            <Send size={15} /> {busy ? 'Enviando...' : 'Enviar resposta'}
          </button>
          <button style={BTN_CANCEL} onClick={onClose}>Fechar</button>
        </div>

        {request.collaboratorDone && (
          <p style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, fontSize: 12, color: 'var(--green)', fontFamily: 'var(--fm)', marginTop: 14 }}>
            <CheckCircle2 size={14} /> Você já marcou como resolvida. Aguardando a CS encerrar.
          </p>
        )}
      </div>
    </Overlay>
  );
}
