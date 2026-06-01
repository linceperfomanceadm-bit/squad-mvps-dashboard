import React, { useState, useRef } from 'react';
import { differenceInDays } from 'date-fns';
import { ChevronDown, ChevronUp, CheckSquare, Square, ArrowRight, RotateCcw, Trash2, FileText, Layers, Plus } from 'lucide-react';
import { WD_SERVICE_CONFIG, RECURRENCE_SERVICES } from '../../../lib/firebase';
import Countdown from '../../shared/Countdown';

// ─── Progress Ring ─────────────────────────────────────────────
function Ring({ checked, total }) {
  const r = 14, circ = 2 * Math.PI * r;
  const pct = total > 0 ? checked / total : 0;
  const dash = pct * circ;
  const color = pct === 1 ? '#22c55e' : '#EE3363';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
      <span style={{ fontSize: 9, color: 'var(--muted)', fontFamily: 'var(--fm)' }}>{checked}/{total}</span>
      <svg width="36" height="36" viewBox="0 0 36 36">
        <circle cx="18" cy="18" r={r} fill="none" stroke="rgba(255,255,255,.06)" strokeWidth="3" />
        <circle cx="18" cy="18" r={r} fill="none" stroke={color} strokeWidth="3"
          strokeDasharray={`${dash.toFixed(2)} ${circ.toFixed(2)}`} strokeLinecap="round"
          transform="rotate(-90 18 18)" style={{ filter: `drop-shadow(0 0 4px ${color}60)`, transition: 'stroke-dasharray .4s' }} />
      </svg>
    </div>
  );
}

// ─── Single Card ───────────────────────────────────────────────
function WDCard({ client, onMoveToProduction, onMoveBackToOnboarding, onUpdateChecklist, onUpdateNotes, onMoveStatus, onDelete }) {
  const [expanded, setExpanded] = useState(false);
  const [delConfirm, setDelConfirm] = useState(false);
  const [showRecModal, setShowRecModal] = useState(false);
  const [recChoice, setRecChoice] = useState('');
  const [recCustom, setRecCustom] = useState('');
  const notesTimer = useRef(null);

  const wd = client.wd || {};
  const cfg = WD_SERVICE_CONFIG[wd.service] || {};
  const checklist = wd.checklist || [];
  const checked = checklist.filter(i => i.checked).length;
  const total = checklist.length;
  const allChecked = total > 0 && checked === total;
  const isOnboarding = wd.status === 'onboarding';
  const isProduction = wd.status === 'production';
  const startDate = isOnboarding ? wd.onboardingStartedAt : wd.productionStartedAt;
  const totalDays = isOnboarding ? 7 : cfg.days || 30;

  const handleCheck = (itemId, val) => {
    const updated = checklist.map(i => i.id === itemId ? { ...i, checked: !val, checkedAt: !val ? new Date().toISOString() : null } : i);
    onUpdateChecklist(client.id, updated);
  };

  const handleNotes = (value) => {
    clearTimeout(notesTimer.current);
    notesTimer.current = setTimeout(() => onUpdateNotes(client.id, value), 700);
  };

  const handleMoveRec = () => {
    const svc = recChoice === 'Outro' ? recCustom : recChoice;
    if (!svc.trim()) return;
    onMoveStatus(client.id, 'recurrence', { 'wd.recurrenceService': svc });
    setShowRecModal(false); setRecChoice(''); setRecCustom('');
  };

  return (
    <>
      <div style={S.card}>
        <div style={S.hd}>
          <div style={S.hdLeft}>
            <span style={S.tag}>{cfg.label || wd.service}</span>
            <div style={S.name}>{client.name}</div>
            <div style={S.resp}>👤 {client.responsibles?.webdesign || '—'}
              {wd.recurrenceService && <span style={S.recBadge}>↻ {wd.recurrenceService}</span>}
            </div>
          </div>
          <div style={S.hdRight}>
            {isProduction && <Ring checked={checked} total={total} />}
            <button style={S.xbtn} onClick={() => setExpanded(!expanded)}>{expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}</button>
          </div>
        </div>

        {startDate && <Countdown startDate={startDate} totalDays={totalDays} />}

        {expanded && (
          <div style={S.body} className="fade-in">
            {isOnboarding && (
              <button style={S.moveProdBtn} onClick={() => onMoveToProduction(client.id)}>
                <ArrowRight size={14} /> Call realizada — Mover para Produção
              </button>
            )}
            {isProduction && (
              <button style={S.backBtn} onClick={() => onMoveBackToOnboarding(client.id)}>
                <RotateCcw size={13} /> Voltou para Onboarding por engano?
              </button>
            )}
            {isProduction && checklist.length > 0 && (
              <div style={{ marginBottom: 14 }}>
                <p style={S.secLbl}>CHECKLIST</p>
                {checklist.map(item => (
                  <div key={item.id} style={{ ...S.ci, opacity: item.checked ? .55 : 1 }} onClick={() => handleCheck(item.id, item.checked)}>
                    {item.checked ? <CheckSquare size={15} color="var(--green)" style={{ flexShrink: 0 }} /> : <Square size={15} color="var(--muted)" style={{ flexShrink: 0 }} />}
                    <span style={{ fontSize: 13, textDecoration: item.checked ? 'line-through' : 'none', color: item.checked ? 'var(--muted)' : 'var(--text)' }}>{item.label}</span>
                  </div>
                ))}
              </div>
            )}
            {isProduction && cfg.hasNotes && (
              <div style={{ marginBottom: 14 }}>
                <p style={{ ...S.secLbl, display: 'flex', alignItems: 'center', gap: 5 }}><FileText size={10} /> ANOTAÇÕES</p>
                <textarea style={S.ta} defaultValue={wd.notes || ''} onChange={e => handleNotes(e.target.value)} placeholder="Anotações..." />
              </div>
            )}
            {allChecked && isProduction && (
              <div style={S.doneBox}>
                <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--green)' }}>✓ Todos os itens concluídos!</p>
                <p style={{ fontSize: 12, color: 'rgba(34,197,94,.7)', marginTop: 2 }}>Para onde mover o cliente?</p>
                <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                  <button style={S.btnFin} onClick={() => onMoveStatus(client.id, 'finished', { 'wd.status': 'finished' })}>✓ Finalizado</button>
                  <button style={S.btnRec} onClick={() => setShowRecModal(true)}>↻ Recorrência</button>
                </div>
              </div>
            )}
            <div style={S.arow}>
              {isProduction && <button style={S.asec} onClick={() => onMoveStatus(client.id, 'inactive', { 'wd.status': 'inactive' })}>Mover p/ Inativos</button>}
              {['inactive','recurrence','finished'].includes(wd.status) && (
                <button style={S.asec} onClick={() => onMoveStatus(client.id, 'onboarding', { 'wd.status': 'onboarding', 'wd.onboardingStartedAt': new Date().toISOString(), 'wd.productionStartedAt': null, 'wd.checklist': [] })}>
                  ↺ Reativar
                </button>
              )}
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'center' }}>
                {!delConfirm
                  ? <button style={S.delBtn} onClick={() => setDelConfirm(true)}><Trash2 size={13} /></button>
                  : <><span style={{ fontSize: 11, color: 'var(--muted)' }}>Excluir?</span>
                      <button style={S.confDel} onClick={() => onDelete(client.id)}>Sim</button>
                      <button style={S.cancDel} onClick={() => setDelConfirm(false)}>Não</button></>
                }
              </div>
            </div>
          </div>
        )}
      </div>

      {showRecModal && (
        <div style={S.overlay} onClick={() => setShowRecModal(false)}>
          <div style={S.recModal} onClick={e => e.stopPropagation()} className="fade-up">
            <h3 style={{ fontSize: 17, fontWeight: 700, color: '#fff', marginBottom: 6 }}>Qual serviço na Recorrência?</h3>
            <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 16 }}>Para <strong style={{ color: 'var(--text)' }}>{client.name}</strong></p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {RECURRENCE_SERVICES.map(s => (
                <button key={s} style={{ ...S.recOpt, ...(recChoice === s ? S.recOptSel : {}) }} onClick={() => setRecChoice(s)}>{s}</button>
              ))}
            </div>
            {recChoice === 'Outro' && <input style={{ ...S.ta, marginTop: 10, minHeight: 0, padding: '10px 12px' }} placeholder="Descreva o serviço..." value={recCustom} onChange={e => setRecCustom(e.target.value)} />}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
              <button style={S.cancDel} onClick={() => setShowRecModal(false)}>Cancelar</button>
              <button style={S.btnFin} onClick={handleMoveRec} disabled={!recChoice || (recChoice === 'Outro' && !recCustom.trim())}>Confirmar</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ─── Client List (page wrapper) ────────────────────────────────
const PROD_SUBTABS = Object.entries(WD_SERVICE_CONFIG).map(([key, v]) => ({ key, label: v.label }));

export default function WDClientList({ clients, collaborators, page, prodSubTab, setProdSubTab, onMoveToProduction, onMoveBackToOnboarding, onUpdateChecklist, onUpdateNotes, onMoveStatus, onDelete, onAddClient }) {
  const getDisplay = () => {
    if (page === 'inactive') return clients.filter(c => c.wd?.status === 'inactive');
    if (page === 'recurrence') return clients.filter(c => c.wd?.status === 'recurrence');
    if (page === 'finished') return clients.filter(c => c.wd?.status === 'finished');
    if (page === 'onboarding') return clients.filter(c => c.wd?.status === 'onboarding');
    return clients.filter(c => c.wd?.status === 'production' && c.wd?.service === prodSubTab);
  };
  const display = getDisplay();
  const prodCounts = {};
  Object.keys(WD_SERVICE_CONFIG).forEach(k => { prodCounts[k] = clients.filter(c => c.wd?.status === 'production' && c.wd?.service === k).length; });
  const PAGE_LABELS = { onboarding: 'Onboarding', production: 'Produção', inactive: 'Inativos', recurrence: 'Recorrência', finished: 'Finalizados' };
  const overdueOnb = clients.filter(c => c.wd?.status === 'onboarding' && c.wd?.onboardingStartedAt && differenceInDays(new Date(), new Date(c.wd.onboardingStartedAt)) > 7).length;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 22 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: '#fff', letterSpacing: '-.5px', marginBottom: 3 }}>{PAGE_LABELS[page]}</h1>
          <p style={{ fontSize: 13, color: 'var(--muted)' }}>
            {display.length} cliente{display.length !== 1 ? 's' : ''}
            {page === 'onboarding' && overdueOnb > 0 && <span style={{ color: 'var(--neon)' }}> · {overdueOnb} em atraso</span>}
          </p>
        </div>
        <button onClick={onAddClient} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'linear-gradient(135deg,var(--neon),#c41f4a)', border: 'none', borderRadius: 10, padding: '10px 18px', color: '#fff', fontSize: 13, fontWeight: 700, boxShadow: '0 4px 20px rgba(238,51,99,.35)', cursor: 'pointer' }}>
          <Plus size={15} /> Novo Cliente
        </button>
      </div>

      {page === 'production' && (
        <div style={{ display: 'flex', gap: 6, marginBottom: 18, flexWrap: 'wrap' }}>
          {PROD_SUBTABS.map(({ key, label }) => (
            <button key={key} onClick={() => setProdSubTab(key)}
              style={{ display: 'flex', alignItems: 'center', gap: 5, background: prodSubTab === key ? 'var(--neon-dim)' : 'var(--surface)', border: `1px solid ${prodSubTab === key ? 'var(--neon-border)' : 'var(--border)'}`, borderRadius: 8, padding: '6px 13px', color: prodSubTab === key ? 'var(--neon)' : 'var(--muted)', fontSize: 12, fontWeight: 500, cursor: 'pointer', transition: 'all .15s' }}>
              <Layers size={11} color={prodSubTab === key ? 'var(--neon)' : 'var(--muted)'} />
              {label}
              {prodCounts[key] > 0 && <span style={{ background: prodSubTab === key ? 'var(--neon-dim)' : 'rgba(255,255,255,.06)', borderRadius: 8, padding: '1px 6px', fontSize: 10, fontFamily: 'var(--fm)' }}>{prodCounts[key]}</span>}
            </button>
          ))}
        </div>
      )}

      {display.length === 0
        ? <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, paddingTop: 80, textAlign: 'center' }}>
            <div style={{ fontSize: 40, opacity: .25 }}>📋</div>
            <p style={{ fontSize: 16, color: 'var(--muted)', fontWeight: 600 }}>Nenhum cliente aqui</p>
            <p style={{ fontSize: 12, color: 'var(--muted)', opacity: .6, maxWidth: 280 }}>
              {page === 'onboarding' ? 'Cadastre um novo cliente para iniciar o onboarding.' : 'Mova clientes para esta aba quando necessário.'}
            </p>
          </div>
        : <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(330px,1fr))', gap: 12 }}>
            {display.map(c => (
              <WDCard key={c.id} client={c}
                onMoveToProduction={onMoveToProduction}
                onMoveBackToOnboarding={onMoveBackToOnboarding}
                onUpdateChecklist={onUpdateChecklist}
                onUpdateNotes={onUpdateNotes}
                onMoveStatus={onMoveStatus}
                onDelete={onDelete}
              />
            ))}
          </div>
      }
    </div>
  );
}

const S = {
  card: { background: 'rgba(12,12,24,.88)', border: '1px solid var(--border)', borderRadius: 14, padding: 16, marginBottom: 0, transition: 'border-color .2s', backdropFilter: 'blur(12px)' },
  hd: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  hdLeft: { flex: 1, minWidth: 0 },
  hdRight: { display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 },
  tag: { display: 'inline-flex', alignItems: 'center', gap: 4, background: 'var(--neon-dim)', border: '1px solid var(--neon-border)', borderRadius: 5, padding: '2px 8px', fontSize: 10, color: 'var(--neon)', fontWeight: 600, marginBottom: 5 },
  name: { fontSize: 15, fontWeight: 700, color: '#f0f0ff', marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  resp: { display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--muted)', flexWrap: 'wrap' },
  recBadge: { background: 'var(--purple-dim)', border: '1px solid var(--purple-b)', borderRadius: 4, padding: '1px 6px', fontSize: 10, color: 'var(--purple)', marginLeft: 4 },
  xbtn: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 7, padding: '4px 7px', color: 'var(--muted)', display: 'flex', alignItems: 'center', cursor: 'pointer' },
  body: { borderTop: '1px solid var(--border)', paddingTop: 12, marginTop: 12 },
  secLbl: { fontSize: 10, letterSpacing: '.12em', color: 'var(--muted)', marginBottom: 8, fontWeight: 600, textTransform: 'uppercase', fontFamily: 'var(--fm)' },
  moveProdBtn: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: 'linear-gradient(135deg,rgba(238,51,99,.18),rgba(238,51,99,.08))', border: '1px solid var(--neon-border)', borderRadius: 9, padding: 10, color: 'var(--neon)', fontSize: 13, fontWeight: 600, width: '100%', marginBottom: 10, cursor: 'pointer', transition: 'all .2s' },
  backBtn: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, background: 'rgba(255,255,255,.03)', border: '1px solid var(--border)', borderRadius: 8, padding: '7px 12px', color: 'var(--muted)', fontSize: 12, width: '100%', marginBottom: 12, cursor: 'pointer' },
  ci: { display: 'flex', alignItems: 'center', gap: 9, padding: '7px 9px', borderRadius: 7, cursor: 'pointer', marginBottom: 3, background: 'var(--surface)', transition: 'background .15s' },
  ta: { width: '100%', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 10px', color: 'var(--text)', fontSize: 13, fontFamily: 'var(--f)', resize: 'vertical', minHeight: 72, outline: 'none' },
  doneBox: { background: 'var(--green-dim)', border: '1px solid var(--green-b)', borderRadius: 10, padding: 14, marginBottom: 14 },
  btnFin: { flex: 1, background: 'var(--green-dim)', border: '1px solid var(--green-b)', borderRadius: 8, padding: 8, color: 'var(--green)', fontSize: 12, fontWeight: 600, cursor: 'pointer' },
  btnRec: { flex: 1, background: 'var(--purple-dim)', border: '1px solid var(--purple-b)', borderRadius: 8, padding: 8, color: 'var(--purple)', fontSize: 12, fontWeight: 600, cursor: 'pointer' },
  arow: { display: 'flex', gap: 8, alignItems: 'center', marginTop: 4, flexWrap: 'wrap' },
  asec: { display: 'flex', alignItems: 'center', gap: 5, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 7, padding: '6px 12px', color: 'var(--muted)', fontSize: 12, cursor: 'pointer' },
  delBtn: { background: 'rgba(238,51,99,.07)', border: '1px solid rgba(238,51,99,.18)', borderRadius: 7, padding: '6px 8px', color: 'var(--neon)', display: 'flex', alignItems: 'center', cursor: 'pointer' },
  confDel: { background: 'var(--neon)', border: 'none', borderRadius: 6, padding: '5px 12px', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' },
  cancDel: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, padding: '5px 12px', color: 'var(--muted)', fontSize: 12, cursor: 'pointer' },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,.75)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, padding: 20 },
  recModal: { background: '#0f0f1e', border: '1px solid var(--neon-border)', borderRadius: 16, padding: 24, width: '100%', maxWidth: 420, boxShadow: '0 24px 80px rgba(0,0,0,.7)' },
  recOpt: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '7px 13px', color: 'var(--muted)', fontSize: 12, fontWeight: 500, cursor: 'pointer', transition: 'all .15s' },
  recOptSel: { background: 'var(--purple-dim)', border: '1px solid var(--purple-b)', color: 'var(--purple)' },
};
