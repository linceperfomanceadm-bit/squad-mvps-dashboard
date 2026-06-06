import React, { useState, useRef, useEffect } from 'react';
import { X, Send, Plus, Trash2, ExternalLink, Check, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { TASK_PRIORITIES, TASK_COLUMNS, SECTORS } from '../../lib/firebase';

// ─── Success popup ────────────────────────────────────────────
function CompletionPopup({ task, onClose }) {
  const tl = task.timeline || [];
  const created = tl.find(t => t.action === 'created');
  const started = tl.find(t => t.action === 'started');
  const completed = tl.find(t => t.action === 'completed');

  const calcDiff = (from, to) => {
    if (!from || !to) return '—';
    const diff = Math.round((new Date(to) - new Date(from)) / 3600000);
    if (diff < 24) return `${diff}h`;
    return `${Math.round(diff / 24)}d`;
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(12px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3000, padding: 20 }}>
      <div style={{ background: '#0e0e1c', border: '1px solid var(--green-b)', borderRadius: 20, padding: 32, width: '100%', maxWidth: 440, textAlign: 'center', boxShadow: '0 0 60px rgba(34,197,94,0.15), 0 24px 64px rgba(0,0,0,0.7)', animation: 'fadeUp .4s ease' }}>
        <div style={{ fontSize: 56, marginBottom: 12 }}>🎉</div>
        <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--green)', marginBottom: 6 }}>Task Concluída!</h2>
        <p style={{ fontSize: 14, color: 'var(--muted)', marginBottom: 24 }}>{task.name}</p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 24 }}>
          {[
            { label: 'Criada', value: created?.at ? format(new Date(created.at), "dd/MM HH:mm") : '—' },
            { label: 'Iniciada', value: started?.at ? format(new Date(started.at), "dd/MM HH:mm") : '—' },
            { label: 'Concluída', value: completed?.at ? format(new Date(completed.at), "dd/MM HH:mm") : '—' },
          ].map(item => (
            <div key={item.label} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 8px' }}>
              <p style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 4, fontFamily: 'var(--fm)' }}>{item.label.toUpperCase()}</p>
              <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{item.value}</p>
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 24 }}>
          <div style={{ background: 'var(--green-dim)', border: '1px solid var(--green-b)', borderRadius: 10, padding: 12 }}>
            <p style={{ fontSize: 10, color: 'var(--green)', marginBottom: 4, fontFamily: 'var(--fm)' }}>TEMPO TOTAL</p>
            <p style={{ fontSize: 18, fontWeight: 800, color: 'var(--green)' }}>{calcDiff(created?.at, completed?.at)}</p>
          </div>
          <div style={{ background: task.reworkCount > 0 ? 'var(--amber-dim)' : 'var(--green-dim)', border: `1px solid ${task.reworkCount > 0 ? 'var(--amber-b)' : 'var(--green-b)'}`, borderRadius: 10, padding: 12 }}>
            <p style={{ fontSize: 10, color: task.reworkCount > 0 ? 'var(--amber)' : 'var(--green)', marginBottom: 4, fontFamily: 'var(--fm)' }}>AJUSTES</p>
            <p style={{ fontSize: 18, fontWeight: 800, color: task.reworkCount > 0 ? 'var(--amber)' : 'var(--green)' }}>{task.reworkCount || 0}</p>
          </div>
        </div>

        <button onClick={onClose} style={{ background: 'linear-gradient(135deg,var(--green),#16a34a)', border: 'none', borderRadius: 10, padding: '12px 32px', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', width: '100%' }}>
          Fechar
        </button>
      </div>
    </div>
  );
}

// ─── Main TaskModal ───────────────────────────────────────────
export default function TaskModal({ task, currentUser, currentUserSector, collaborators, onClose, onMoveToProduction, onMoveToApproval, onApprove, onReject, onAddComment, onUpdateLinks, onDelete }) {
  const [comment, setComment] = useState('');
  const [links, setLinks] = useState(task.links || []);
  const [newLink, setNewLink] = useState('');
  const [showApprovalForm, setShowApprovalForm] = useState(false);
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [approver, setApprover] = useState({ name: '', sector: '' });
  const [reworkNote, setReworkNote] = useState('');
  const [newResponsible, setNewResponsible] = useState({ name: '', sector: '' });
  const [showCompletion, setShowCompletion] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const chatEndRef = useRef(null);

  const isResponsible = task.responsibleName === currentUser;
  const isRequester = task.requestedBy === currentUser;
  const priority = TASK_PRIORITIES.find(p => p.id === task.priority);
  const responsibleSector = SECTORS[task.responsibleSector];

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [task.comments]);

  const handleSendComment = async () => {
    if (!comment.trim()) return;
    await onAddComment(task.id, currentUser, currentUserSector, comment);
    setComment('');
  };

  const handleAddLink = () => {
    if (!newLink.trim()) return;
    const updated = [...links, newLink.trim()];
    setLinks(updated);
    onUpdateLinks(task.id, updated);
    setNewLink('');
  };

  const handleRemoveLink = (idx) => {
    const updated = links.filter((_, i) => i !== idx);
    setLinks(updated);
    onUpdateLinks(task.id, updated);
  };

  const handleMoveToApproval = async () => {
    if (!approver.name || !approver.sector) return;
    await onMoveToApproval(task.id, approver.name, approver.sector, links);
    setShowApprovalForm(false);
  };

  const handleApprove = async () => {
    await onApprove(task.id);
    setShowCompletion(true);
  };

  const handleReject = async () => {
    if (!reworkNote.trim() || !newResponsible.name) return;
    await onReject(task.id, reworkNote, newResponsible.name, newResponsible.sector);
    setShowRejectForm(false);
    onClose();
  };

  const allCollabs = collaborators.filter(c => c.active);
  const sectorCollabs = (sectorId) => allCollabs.filter(c => c.sector === sectorId);

  return (
    <>
      <div style={S.overlay} onClick={onClose}>
        <div style={S.modal} onClick={e => e.stopPropagation()} className="fade-up">
          {/* Header */}
          <div style={S.header}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                {task.isRework && (
                  <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: 'var(--amber-dim)', color: 'var(--amber)', border: '1px solid var(--amber-b)', fontFamily: 'var(--fm)' }}>
                    🔄 AJUSTE #{task.reworkCount}
                  </span>
                )}
                {priority && (
                  <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: `${priority.color}18`, color: priority.color, border: `1px solid ${priority.color}35`, fontFamily: 'var(--fm)' }}>
                    {priority.label.toUpperCase()}
                  </span>
                )}
                <span style={{ fontSize: 11, color: TASK_COLUMNS.find(c => c.id === task.status)?.color || 'var(--muted)', fontFamily: 'var(--fm)', fontWeight: 600 }}>
                  {TASK_COLUMNS.find(c => c.id === task.status)?.label}
                </span>
              </div>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: '#fff', marginBottom: 4 }}>{task.name}</h2>
              <p style={{ fontSize: 12, color: 'var(--muted)' }}>
                👤 {task.clientName} · Solicitado por <strong style={{ color: 'var(--text)' }}>{task.requestedBy}</strong>
              </p>
            </div>
            <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
              {(isRequester || currentUser === 'admin') && task.status !== 'done' && (
                <button style={S.deleteBtn} onClick={() => setShowDeleteConfirm(true)}><Trash2 size={14} /></button>
              )}
              <button style={S.closeBtn} onClick={onClose}><X size={16} /></button>
            </div>
          </div>

          <div style={S.body}>
            {/* Left column */}
            <div style={S.left}>
              {/* Info grid */}
              <div style={S.infoGrid}>
                <div style={S.infoItem}>
                  <span style={S.infoLabel}>RESPONSÁVEL</span>
                  <span style={{ fontSize: 13, color: responsibleSector?.color || 'var(--text)', fontWeight: 600 }}>
                    {responsibleSector?.emoji} {task.responsibleName}
                  </span>
                </div>
                <div style={S.infoItem}>
                  <span style={S.infoLabel}>SETOR</span>
                  <span style={{ fontSize: 13, color: responsibleSector?.color || 'var(--text)' }}>{responsibleSector?.label}</span>
                </div>
                {task.deadline && (
                  <div style={S.infoItem}>
                    <span style={S.infoLabel}>PRAZO</span>
                    <span style={{ fontSize: 13, color: 'var(--text)' }}>
                      {format(new Date(task.deadline), "dd/MM/yyyy", { locale: ptBR })}
                    </span>
                  </div>
                )}
                <div style={S.infoItem}>
                  <span style={S.infoLabel}>AJUSTES</span>
                  <span style={{ fontSize: 13, color: task.reworkCount > 0 ? 'var(--amber)' : 'var(--muted)' }}>{task.reworkCount || 0}</span>
                </div>
              </div>

              {/* Links */}
              <div style={{ marginBottom: 16 }}>
                <p style={S.secLabel}>LINKS DO MATERIAL</p>
                {links.map((link, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <a href={link} target="_blank" rel="noreferrer" style={{ flex: 1, fontSize: 12, color: 'var(--blue)', textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <ExternalLink size={11} /> {link}
                    </a>
                    {isResponsible && (
                      <button style={{ background: 'none', border: 'none', color: 'var(--neon)', cursor: 'pointer', padding: 2 }} onClick={() => handleRemoveLink(i)}>
                        <X size={12} />
                      </button>
                    )}
                  </div>
                ))}
                {isResponsible && (
                  <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                    <input style={S.input} value={newLink} onChange={e => setNewLink(e.target.value)} placeholder="https://..." onKeyDown={e => e.key === 'Enter' && handleAddLink()} />
                    <button style={S.smallBtn} onClick={handleAddLink}><Plus size={14} /></button>
                  </div>
                )}
              </div>

              {/* Actions */}
              {task.status !== 'done' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <p style={S.secLabel}>AÇÕES</p>

                  {/* Move to production */}
                  {task.status === 'todo' && isResponsible && (
                    <button style={S.actionBtn('#38bdf8')} onClick={() => onMoveToProduction(task.id, links)}>
                      ▶ Iniciar — Mover para Em Produção
                    </button>
                  )}

                  {/* Send for approval */}
                  {task.status === 'doing' && isResponsible && !showApprovalForm && (
                    <button style={S.actionBtn('#f59e0b')} onClick={() => setShowApprovalForm(true)}>
                      ✓ Concluí — Enviar para Aprovação
                    </button>
                  )}

                  {showApprovalForm && (
                    <div style={{ background: 'rgba(245,158,11,.06)', border: '1px solid var(--amber-b)', borderRadius: 10, padding: 14 }}>
                      <p style={{ fontSize: 12, color: 'var(--amber)', marginBottom: 10, fontWeight: 600 }}>Quem vai aprovar?</p>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <select style={S.select} value={approver.sector} onChange={e => setApprover({ sector: e.target.value, name: '' })}>
                          <option value="">Selecionar setor</option>
                          {Object.values(SECTORS).map(s => <option key={s.id} value={s.id}>{s.emoji} {s.label}</option>)}
                        </select>
                        {approver.sector && (
                          <select style={S.select} value={approver.name} onChange={e => setApprover(a => ({ ...a, name: e.target.value }))}>
                            <option value="">Selecionar colaborador</option>
                            {sectorCollabs(approver.sector).map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                          </select>
                        )}
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button style={{ ...S.actionBtn('#f59e0b'), flex: 1 }} onClick={handleMoveToApproval} disabled={!approver.name}>
                            Confirmar Envio
                          </button>
                          <button style={S.cancelBtn} onClick={() => setShowApprovalForm(false)}>Cancelar</button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Approve or reject */}
                  {task.status === 'approval' && isResponsible && (
                    <>
                      <button style={S.actionBtn('#22c55e')} onClick={handleApprove}>
                        ✓ Aprovar e Concluir Task
                      </button>
                      {!showRejectForm && (
                        <button style={S.actionBtn('#EE3363')} onClick={() => setShowRejectForm(true)}>
                          ✕ Reprovar — Solicitar Ajuste
                        </button>
                      )}
                    </>
                  )}

                  {showRejectForm && (
                    <div style={{ background: 'rgba(238,51,99,.06)', border: '1px solid var(--neon-border)', borderRadius: 10, padding: 14 }}>
                      <p style={{ fontSize: 12, color: 'var(--neon)', marginBottom: 10, fontWeight: 600 }}>Descreva o que precisa ser ajustado *</p>
                      <textarea
                        style={{ ...S.input, minHeight: 80, resize: 'vertical', marginBottom: 10 }}
                        value={reworkNote}
                        onChange={e => setReworkNote(e.target.value)}
                        placeholder="Explique detalhadamente o que precisa ser alterado..."
                      />
                      <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 8 }}>Quem vai fazer o ajuste?</p>
                      <select style={{ ...S.select, marginBottom: 8 }} value={newResponsible.sector} onChange={e => setNewResponsible({ sector: e.target.value, name: '' })}>
                        <option value="">Selecionar setor</option>
                        {Object.values(SECTORS).map(s => <option key={s.id} value={s.id}>{s.emoji} {s.label}</option>)}
                      </select>
                      {newResponsible.sector && (
                        <select style={{ ...S.select, marginBottom: 10 }} value={newResponsible.name} onChange={e => setNewResponsible(r => ({ ...r, name: e.target.value }))}>
                          <option value="">Selecionar colaborador</option>
                          {sectorCollabs(newResponsible.sector).map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                        </select>
                      )}
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button style={{ ...S.actionBtn('#EE3363'), flex: 1 }} onClick={handleReject} disabled={!reworkNote.trim() || !newResponsible.name}>
                          Enviar para Ajuste
                        </button>
                        <button style={S.cancelBtn} onClick={() => setShowRejectForm(false)}>Cancelar</button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Delete confirm */}
              {showDeleteConfirm && (
                <div style={{ background: 'rgba(238,51,99,.06)', border: '1px solid var(--neon-border)', borderRadius: 10, padding: 12, marginTop: 10 }}>
                  <p style={{ fontSize: 13, color: 'var(--text)', marginBottom: 10 }}>Excluir esta task permanentemente?</p>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button style={{ ...S.actionBtn('#EE3363'), flex: 1 }} onClick={() => { onDelete(task.id); onClose(); }}>
                      Sim, excluir
                    </button>
                    <button style={S.cancelBtn} onClick={() => setShowDeleteConfirm(false)}>Não</button>
                  </div>
                </div>
              )}
            </div>

            {/* Right column — Chat */}
            <div style={S.right}>
              <p style={S.secLabel}>COMENTÁRIOS</p>
              <div style={S.chatBox}>
                {(task.comments || []).length === 0 && (
                  <p style={{ fontSize: 12, color: 'var(--muted)', textAlign: 'center', padding: '20px 0' }}>Nenhum comentário ainda.</p>
                )}
                {(task.comments || []).map(c => (
                  <div key={c.id} style={{
                    marginBottom: 10,
                    background: c.isRework ? 'rgba(245,158,11,.06)' : 'var(--surface)',
                    border: `1px solid ${c.isRework ? 'var(--amber-b)' : 'var(--border)'}`,
                    borderRadius: 8, padding: '9px 12px',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: c.isRework ? 'var(--amber)' : 'var(--neon)' }}>{c.author}</span>
                      <span style={{ fontSize: 10, color: 'var(--muted)', fontFamily: 'var(--fm)' }}>
                        {c.createdAt ? format(new Date(c.createdAt), "dd/MM HH:mm", { locale: ptBR }) : ''}
                      </span>
                    </div>
                    <p style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.5 }}>{c.text}</p>
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                <input
                  style={{ ...S.input, flex: 1 }}
                  value={comment}
                  onChange={e => setComment(e.target.value)}
                  placeholder="Escreva um comentário..."
                  onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSendComment()}
                />
                <button style={S.sendBtn} onClick={handleSendComment} disabled={!comment.trim()}>
                  <Send size={15} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showCompletion && <CompletionPopup task={task} onClose={() => { setShowCompletion(false); onClose(); }} />}
    </>
  );
}

const S = {
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,.8)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, padding: 20 },
  modal: { background: '#0c0c1e', border: '1px solid var(--border)', borderRadius: 18, width: '100%', maxWidth: 860, maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 80px rgba(0,0,0,.7)' },
  header: { display: 'flex', alignItems: 'flex-start', gap: 16, padding: '18px 22px', borderBottom: '1px solid var(--border)' },
  closeBtn: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 8px', color: 'var(--muted)', display: 'flex', alignItems: 'center', cursor: 'pointer' },
  deleteBtn: { background: 'rgba(238,51,99,.08)', border: '1px solid rgba(238,51,99,.2)', borderRadius: 8, padding: '6px 8px', color: 'var(--neon)', display: 'flex', alignItems: 'center', cursor: 'pointer' },
  body: { display: 'flex', flex: 1, overflow: 'hidden' },
  left: { flex: 1, padding: '18px 20px', overflowY: 'auto', borderRight: '1px solid var(--border)' },
  right: { width: 300, padding: '18px 16px', display: 'flex', flexDirection: 'column' },
  infoGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 18 },
  infoItem: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 4 },
  infoLabel: { fontSize: 9, letterSpacing: '.1em', color: 'var(--muted)', fontFamily: 'var(--fm)', fontWeight: 600 },
  secLabel: { fontSize: 10, letterSpacing: '.12em', color: 'var(--muted)', fontFamily: 'var(--fm)', fontWeight: 600, marginBottom: 8, textTransform: 'uppercase' },
  input: { background: 'rgba(255,255,255,.04)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 12px', color: 'var(--text)', fontSize: 13, outline: 'none', width: '100%', fontFamily: 'var(--f)' },
  select: { background: '#12121f', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 12px', color: 'var(--text)', fontSize: 13, outline: 'none', width: '100%', fontFamily: 'var(--f)', cursor: 'pointer' },
  smallBtn: { background: 'var(--neon-dim)', border: '1px solid var(--neon-border)', borderRadius: 8, padding: '8px 10px', color: 'var(--neon)', display: 'flex', alignItems: 'center', cursor: 'pointer', flexShrink: 0 },
  actionBtn: (color) => ({ background: `${color}15`, border: `1px solid ${color}35`, borderRadius: 9, padding: '10px 14px', color, fontSize: 13, fontWeight: 600, cursor: 'pointer', width: '100%', transition: 'all .15s' }),
  cancelBtn: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 14px', color: 'var(--muted)', fontSize: 13, cursor: 'pointer', flexShrink: 0 },
  chatBox: { flex: 1, overflowY: 'auto', marginBottom: 0 },
  sendBtn: { background: 'var(--neon-dim)', border: '1px solid var(--neon-border)', borderRadius: 8, padding: '9px 12px', color: 'var(--neon)', display: 'flex', alignItems: 'center', cursor: 'pointer', flexShrink: 0 },
};
