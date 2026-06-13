import React, { useState, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { X, Send, Plus, Trash2, ExternalLink } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { TASK_PRIORITIES, TASK_COLUMNS, SECTORS } from '../../lib/firebase';

// ─── Success popup ────────────────────────────────────────────
function CompletionPopup({ task, onClose }) {
  const tl = task.timeline || [];
  const created   = tl.find(t => t.action === 'created');
  const started   = tl.find(t => t.action === 'started');
  const completed = tl.find(t => t.action === 'completed');

  const calcDiff = (from, to) => {
    if (!from || !to) return null;
    const ms = new Date(to) - new Date(from);
    if (ms <= 0) return null;
    const totalMins = Math.round(ms / 60000);
    if (totalMins < 60) return `${totalMins}min`;
    const hours = Math.floor(totalMins / 60);
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    const remH = hours % 24;
    return remH > 0 ? `${days}d ${remH}h` : `${days}d`;
  };

  // Time each collaborator held the task
  const collabTimes = [];
  for (let i = 0; i < tl.length; i++) {
    const entry = tl[i];
    const next  = tl[i + 1];
    if ((entry.action === 'started' || entry.action === 'rejected') && entry.by) {
      const endTime = next?.at || completed?.at;
      const diff = calcDiff(entry.at, endTime);
      if (diff) collabTimes.push({ name: entry.by, time: diff });
    }
  }

  const totalTime = calcDiff(created?.at, completed?.at);

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(12px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999, padding: 20 }}>
      <div style={{ background: '#0e0e1c', border: '1px solid var(--green-b)', borderRadius: 20, padding: 32, width: '100%', maxWidth: 460, textAlign: 'center', boxShadow: '0 0 60px rgba(34,197,94,0.15), 0 24px 64px rgba(0,0,0,0.7)', animation: 'fadeUp .4s ease' }}>
        <div style={{ fontSize: 56, marginBottom: 12 }}>🎉</div>
        <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--green)', marginBottom: 6 }}>Task Concluída!</h2>
        <p style={{ fontSize: 14, color: '#ccc', marginBottom: 24 }}>{task.name}</p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 16 }}>
          {[
            { label: 'Criada',    value: created?.at   ? format(new Date(created.at),   "dd/MM HH:mm") : '—' },
            { label: 'Iniciada',  value: started?.at   ? format(new Date(started.at),   "dd/MM HH:mm") : '—' },
            { label: 'Concluída', value: completed?.at ? format(new Date(completed.at), "dd/MM HH:mm") : '—' },
          ].map(item => (
            <div key={item.label} style={{ background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 10, padding: '12px 8px' }}>
              <p style={{ fontSize: 10, color: '#888', marginBottom: 4, fontFamily: 'var(--fm)' }}>{item.label.toUpperCase()}</p>
              <p style={{ fontSize: 12, fontWeight: 600, color: '#fff' }}>{item.value}</p>
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: collabTimes.length > 0 ? 16 : 24 }}>
          <div style={{ background: 'var(--green-dim)', border: '1px solid var(--green-b)', borderRadius: 10, padding: 12 }}>
            <p style={{ fontSize: 10, color: 'var(--green)', marginBottom: 4, fontFamily: 'var(--fm)' }}>TEMPO TOTAL</p>
            <p style={{ fontSize: 20, fontWeight: 800, color: 'var(--green)' }}>{totalTime || '—'}</p>
          </div>
          <div style={{ background: task.reworkCount > 0 ? 'var(--amber-dim)' : 'var(--green-dim)', border: `1px solid ${task.reworkCount > 0 ? 'var(--amber-b)' : 'var(--green-b)'}`, borderRadius: 10, padding: 12 }}>
            <p style={{ fontSize: 10, color: task.reworkCount > 0 ? 'var(--amber)' : 'var(--green)', marginBottom: 4, fontFamily: 'var(--fm)' }}>AJUSTES</p>
            <p style={{ fontSize: 20, fontWeight: 800, color: task.reworkCount > 0 ? 'var(--amber)' : 'var(--green)' }}>{task.reworkCount || 0}</p>
          </div>
        </div>

        {collabTimes.length > 0 && (
          <div style={{ background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 10, padding: '12px 16px', marginBottom: 20, textAlign: 'left' }}>
            <p style={{ fontSize: 10, color: '#888', fontFamily: 'var(--fm)', marginBottom: 10 }}>TEMPO POR COLABORADOR</p>
            {collabTimes.map((c, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', borderBottom: i < collabTimes.length - 1 ? '1px solid rgba(255,255,255,.06)' : 'none' }}>
                <span style={{ fontSize: 13, color: '#ddd', fontWeight: 500 }}>{c.name}</span>
                <span style={{ fontSize: 13, color: 'var(--blue)', fontFamily: 'var(--fm)', fontWeight: 600 }}>{c.time}</span>
              </div>
            ))}
          </div>
        )}

        <button onClick={onClose} style={{ background: 'linear-gradient(135deg,var(--green),#16a34a)', border: 'none', borderRadius: 10, padding: '12px 32px', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', width: '100%' }}>
          Fechar
        </button>
      </div>
    </div>
  );
}

// ─── Main TaskModal ───────────────────────────────────────────
export default function TaskModal({ task, currentUser, currentUserSector, collaborators, onClose, onMoveToProduction, onMoveToApproval, onApprove, onReject, onAddComment, onUpdateLinks, onDelete, isAdmin = false }) {
  const [comment, setComment] = useState('');
  const [newLink, setNewLink] = useState('');
  const [newLinkName, setNewLinkName] = useState('');
  const [showApprovalForm, setShowApprovalForm] = useState(false);
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [approver, setApprover] = useState({ name: '', sector: '' });
  const [reworkNote, setReworkNote] = useState('');
  const [newResponsible, setNewResponsible] = useState({ name: '', sector: '' });
  const [showCompletion, setShowCompletion] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const chatEndRef = useRef(null);

  const isResponsible = task.responsibleName === currentUser;
  const isRequester   = task.requestedBy === currentUser;
  const priority      = TASK_PRIORITIES.find(p => p.id === task.priority);
  const responsibleSector = SECTORS[task.responsibleSector];

  // Realtime: scroll chat to bottom when comments change
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [task.comments]);

  const handleSendComment = async () => {
    if (!comment.trim()) return;
    const text = comment;
    setComment(''); // clear immediately for instant feedback
    await onAddComment(task.id, currentUser, currentUserSector, text);
  };

  const handleAddLink = async () => {
    if (!newLink.trim() || !newLinkName.trim()) return;
    const links = [...(task.links || []), {
      url: newLink.trim(),
      name: newLinkName.trim(),
      addedBy: currentUser,
      addedAt: new Date().toISOString(),
    }];
    await onUpdateLinks(task.id, links);
    setNewLink('');
    setNewLinkName('');
  };

  const handleRemoveLink = async (idx) => {
    const links = (task.links || []).filter((_, i) => i !== idx);
    await onUpdateLinks(task.id, links);
  };

  const handleMoveToApproval = async () => {
    if (!approver.name || !approver.sector) return;
    await onMoveToApproval(task.id, approver.name, approver.sector, task.links);
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

  const allCollabs  = collaborators.filter(c => c.active);
  const sectorCollabs = (sectorId) => allCollabs.filter(c => c.sector === sectorId);

  const content = (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.82)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99998, padding: 20, overflowY: 'auto' }}
      onClick={onClose}
    >
      <div
        style={{ background: '#0c0c1e', border: '1px solid rgba(255,255,255,.1)', borderRadius: 18, width: '100%', maxWidth: 860, maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 80px rgba(0,0,0,.8)', flexShrink: 0 }}
        onClick={e => e.stopPropagation()}
        className="fade-up"
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, padding: '18px 22px', borderBottom: '1px solid rgba(255,255,255,.08)', flexShrink: 0 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
              {task.isRework && (
                <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: 'var(--amber-dim)', color: 'var(--amber)', border: '1px solid var(--amber-b)', fontFamily: 'var(--fm)' }}>
                  🔄 AJUSTE #{task.reworkCount}
                </span>
              )}
              {priority && (
                <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: `${priority.color}20`, color: priority.color, border: `1px solid ${priority.color}40`, fontFamily: 'var(--fm)' }}>
                  {priority.label.toUpperCase()}
                </span>
              )}
              <span style={{ fontSize: 11, color: TASK_COLUMNS.find(c => c.id === task.status)?.color || '#aaa', fontFamily: 'var(--fm)', fontWeight: 600 }}>
                {TASK_COLUMNS.find(c => c.id === task.status)?.label}
              </span>
            </div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: '#fff', marginBottom: 4 }}>{task.name}</h2>
            <p style={{ fontSize: 12, color: '#888' }}>
              👤 {task.clientName} · Solicitado por <strong style={{ color: '#ccc' }}>{task.requestedBy}</strong>
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            {(isAdmin || isRequester) && (
              <button style={{ background: 'rgba(238,51,99,.1)', border: '1px solid rgba(238,51,99,.25)', borderRadius: 8, padding: '6px 8px', color: 'var(--neon)', display: 'flex', alignItems: 'center', cursor: 'pointer' }} onClick={() => setShowDeleteConfirm(true)}>
                <Trash2 size={14} />
              </button>
            )}
            <button style={{ background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 8, padding: '6px 8px', color: '#aaa', display: 'flex', alignItems: 'center', cursor: 'pointer' }} onClick={onClose}>
              <X size={16} />
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          {/* Left */}
          <div style={{ flex: 1, padding: '18px 20px', overflowY: 'auto', borderRight: '1px solid rgba(255,255,255,.06)' }}>
            {/* Info grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 18 }}>
              {[
                { label: 'RESPONSÁVEL', value: `${responsibleSector?.emoji || ''} ${task.responsibleName}`, color: responsibleSector?.color },
                { label: 'SETOR',       value: responsibleSector?.label, color: responsibleSector?.color },
                task.deadline ? { label: 'PRAZO', value: format(new Date(task.deadline), "dd/MM/yyyy", { locale: ptBR }), color: '#ddd' } : null,
                { label: 'AJUSTES',     value: task.reworkCount || 0,   color: task.reworkCount > 0 ? 'var(--amber)' : '#888' },
              ].filter(Boolean).map(item => (
                <div key={item.label} style={{ background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 8, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span style={{ fontSize: 9, letterSpacing: '.1em', color: '#666', fontFamily: 'var(--fm)', fontWeight: 600 }}>{item.label}</span>
                  <span style={{ fontSize: 13, color: item.color || '#ddd', fontWeight: 600 }}>{item.value}</span>
                </div>
              ))}
            </div>

            {/* Links */}
            <div style={{ marginBottom: 18 }}>
              <p style={{ fontSize: 10, letterSpacing: '.12em', color: '#666', fontFamily: 'var(--fm)', fontWeight: 600, marginBottom: 10, textTransform: 'uppercase' }}>LINKS</p>
              {(task.links || []).length === 0 && (
                <p style={{ fontSize: 12, color: '#555', marginBottom: 8 }}>Nenhum link adicionado ainda.</p>
              )}
              {(task.links || []).map((link, i) => {
                // Support both old format (string) and new format (object)
                const isObj = typeof link === 'object';
                const url     = isObj ? link.url  : link;
                const name    = isObj ? link.name : 'Link';
                const addedBy = isObj ? link.addedBy : null;
                const canDelete = isAdmin || !addedBy || addedBy === currentUser;

                return (
                  <div key={i} style={{ background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.07)', borderRadius: 8, padding: '9px 12px', marginBottom: 7 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: '#ccc' }}>{name}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {addedBy && <span style={{ fontSize: 10, color: '#555', fontFamily: 'var(--fm)' }}>{addedBy}</span>}
                        {canDelete && (
                          <button style={{ background: 'none', border: 'none', color: '#EE3363', cursor: 'pointer', padding: 2, display: 'flex', alignItems: 'center', opacity: .7 }} onClick={() => handleRemoveLink(i)}>
                            <X size={12} />
                          </button>
                        )}
                      </div>
                    </div>
                    <a href={url} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: 'var(--blue)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4, wordBreak: 'break-all' }}>
                      <ExternalLink size={11} style={{ flexShrink: 0 }} /> {url}
                    </a>
                  </div>
                );
              })}

              {/* Add link */}
              {(isAdmin || isResponsible || isRequester) && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
                  <input style={S.input} value={newLinkName} onChange={e => setNewLinkName(e.target.value)} placeholder="Nome / descrição do link" />
                  <div style={{ display: 'flex', gap: 6 }}>
                    <input style={{ ...S.input, flex: 1 }} value={newLink} onChange={e => setNewLink(e.target.value)} placeholder="https://..." onKeyDown={e => e.key === 'Enter' && handleAddLink()} />
                    <button style={{ background: 'var(--neon-dim)', border: '1px solid var(--neon-border)', borderRadius: 8, padding: '8px 12px', color: 'var(--neon)', display: 'flex', alignItems: 'center', cursor: 'pointer', flexShrink: 0, gap: 5, fontSize: 12, fontWeight: 600 }} onClick={handleAddLink} disabled={!newLink.trim() || !newLinkName.trim()}>
                      <Plus size={14} /> Adicionar
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Actions */}
            {task.status !== 'done' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <p style={{ fontSize: 10, letterSpacing: '.12em', color: '#666', fontFamily: 'var(--fm)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 4 }}>AÇÕES</p>

                {/* todo → doing */}
                {task.status === 'todo' && (isAdmin || isResponsible) && (
                  <button style={S.actionBtn('#38bdf8')} onClick={() => onMoveToProduction(task.id, task.links)}>
                    ▶ Iniciar — Mover para Em Produção
                  </button>
                )}

                {/* doing → approval */}
                {task.status === 'doing' && (isAdmin || isResponsible) && !showApprovalForm && (
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
                        <button style={{ ...S.actionBtn('#f59e0b'), flex: 1 }} onClick={handleMoveToApproval} disabled={!approver.name}>Confirmar Envio</button>
                        <button style={S.cancelBtn} onClick={() => setShowApprovalForm(false)}>Cancelar</button>
                      </div>
                    </div>
                  </div>
                )}

                {/* approval → done or back */}
                {task.status === 'approval' && (isAdmin || isResponsible) && (
                  <>
                    <button style={S.actionBtn('#22c55e')} onClick={handleApprove}>✓ Aprovar e Concluir Task</button>
                    {!showRejectForm && (
                      <button style={S.actionBtn('#EE3363')} onClick={() => setShowRejectForm(true)}>✕ Reprovar — Solicitar Ajuste</button>
                    )}
                  </>
                )}

                {showRejectForm && (
                  <div style={{ background: 'rgba(238,51,99,.06)', border: '1px solid var(--neon-border)', borderRadius: 10, padding: 14 }}>
                    <p style={{ fontSize: 12, color: 'var(--neon)', marginBottom: 10, fontWeight: 600 }}>Descreva o que precisa ser ajustado *</p>
                    <textarea style={{ ...S.input, minHeight: 80, resize: 'vertical', marginBottom: 10 }} value={reworkNote} onChange={e => setReworkNote(e.target.value)} placeholder="Explique detalhadamente o que precisa ser alterado..." />
                    <p style={{ fontSize: 12, color: '#888', marginBottom: 8 }}>Quem vai fazer o ajuste?</p>
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
                      <button style={{ ...S.actionBtn('#EE3363'), flex: 1 }} onClick={handleReject} disabled={!reworkNote.trim() || !newResponsible.name}>Enviar para Ajuste</button>
                      <button style={S.cancelBtn} onClick={() => setShowRejectForm(false)}>Cancelar</button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {showDeleteConfirm && (
              <div style={{ background: 'rgba(238,51,99,.06)', border: '1px solid var(--neon-border)', borderRadius: 10, padding: 12, marginTop: 12 }}>
                <p style={{ fontSize: 13, color: '#ddd', marginBottom: 10 }}>Excluir esta task permanentemente?</p>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button style={{ ...S.actionBtn('#EE3363'), flex: 1 }} onClick={() => { onDelete(task.id); onClose(); }}>Sim, excluir</button>
                  <button style={S.cancelBtn} onClick={() => setShowDeleteConfirm(false)}>Não</button>
                </div>
              </div>
            )}
          </div>

          {/* Right — Chat */}
          <div style={{ width: 300, padding: '18px 16px', display: 'flex', flexDirection: 'column' }}>
            <p style={{ fontSize: 10, letterSpacing: '.12em', color: '#666', fontFamily: 'var(--fm)', fontWeight: 600, marginBottom: 10, textTransform: 'uppercase' }}>COMENTÁRIOS</p>
            <div style={{ flex: 1, overflowY: 'auto', marginBottom: 10 }}>
              {(task.comments || []).length === 0 && (
                <p style={{ fontSize: 12, color: '#555', textAlign: 'center', padding: '20px 0' }}>Nenhum comentário ainda.</p>
              )}
              {(task.comments || []).map(c => (
                <div key={c.id} style={{ marginBottom: 10, background: c.isRework ? 'rgba(245,158,11,.07)' : 'rgba(255,255,255,.03)', border: `1px solid ${c.isRework ? 'var(--amber-b)' : 'rgba(255,255,255,.07)'}`, borderRadius: 8, padding: '9px 12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: c.isRework ? 'var(--amber)' : 'var(--neon)' }}>{c.author}</span>
                    <span style={{ fontSize: 10, color: '#555', fontFamily: 'var(--fm)' }}>
                      {c.createdAt ? format(new Date(c.createdAt), "dd/MM HH:mm", { locale: ptBR }) : ''}
                    </span>
                  </div>
                  <p style={{ fontSize: 13, color: '#ddd', lineHeight: 1.5 }}>{c.text}</p>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input style={{ ...S.input, flex: 1 }} value={comment} onChange={e => setComment(e.target.value)} placeholder="Escreva um comentário..." onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSendComment()} />
              <button style={{ background: 'var(--neon-dim)', border: '1px solid var(--neon-border)', borderRadius: 8, padding: '9px 12px', color: 'var(--neon)', display: 'flex', alignItems: 'center', cursor: 'pointer', flexShrink: 0 }} onClick={handleSendComment} disabled={!comment.trim()}>
                <Send size={15} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {ReactDOM.createPortal(content, document.body)}
      {showCompletion && ReactDOM.createPortal(
        <CompletionPopup task={task} onClose={() => { setShowCompletion(false); onClose(); }} />,
        document.body
      )}
    </>
  );
}

const S = {
  input: { background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 8, padding: '9px 12px', color: '#eee', fontSize: 13, outline: 'none', width: '100%', fontFamily: 'var(--f)' },
  select: { background: '#12121f', border: '1px solid rgba(255,255,255,.1)', borderRadius: 8, padding: '9px 12px', color: '#eee', fontSize: 13, outline: 'none', width: '100%', fontFamily: 'var(--f)', cursor: 'pointer' },
  actionBtn: (color) => ({ background: `${color}15`, border: `1px solid ${color}35`, borderRadius: 9, padding: '10px 14px', color, fontSize: 13, fontWeight: 600, cursor: 'pointer', width: '100%', transition: 'all .15s' }),
  cancelBtn: { background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 8, padding: '9px 14px', color: '#aaa', fontSize: 13, cursor: 'pointer', flexShrink: 0 },
};
