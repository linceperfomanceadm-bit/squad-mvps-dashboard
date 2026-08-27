import React, { useState, useRef } from 'react';
import { ChevronDown, ChevronUp, CheckSquare, Square, ArrowRight, RotateCcw, FileText, Palette } from 'lucide-react';
import { ID_VISUAL_CONFIG } from '../../../lib/firebase';
import Countdown from '../../shared/Countdown';

/*
 * ID Visual — painel do designer.
 *
 * Mesmas fases do WebDesign (onboarding → produção → finalizado) e o
 * mesmo checklist, mas em bloco próprio (`idv`) e com dono próprio:
 * só o designer responsável pelo ID Visual daquele cliente enxerga
 * este quadro. O time de web não vê nada disso.
 */

const TABS = [
  { key: 'onboarding', label: 'Onboarding' },
  { key: 'production', label: 'Produção' },
  { key: 'finished',   label: 'Finalizados' },
];

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

function IdvCard({ client, onMoveToProduction, onMoveBackToOnboarding, onUpdateChecklist, onUpdateNotes, onMoveStatus }) {
  const [expanded, setExpanded] = useState(false);
  const notesTimer = useRef(null);

  const idv = client.idv || {};
  const checklist = idv.checklist || [];
  const checked = checklist.filter(i => i.checked).length;
  const total = checklist.length;
  const allChecked = total > 0 && checked === total;
  const isOnboarding = idv.status === 'onboarding';
  const isProduction = idv.status === 'production';
  const startDate = isOnboarding ? idv.onboardingStartedAt : (isProduction ? idv.productionStartedAt : null);
  const totalDays = isOnboarding ? ID_VISUAL_CONFIG.onboardingDays : ID_VISUAL_CONFIG.days;

  const handleCheck = (itemId, val) => {
    const updated = checklist.map(i => i.id === itemId
      ? { ...i, checked: !val, checkedAt: !val ? new Date().toISOString() : null }
      : i);
    onUpdateChecklist(client.id, updated);
  };

  const handleNotes = (value) => {
    clearTimeout(notesTimer.current);
    notesTimer.current = setTimeout(() => onUpdateNotes(client.id, value), 700);
  };

  return (
    <div style={S.card}>
      <div style={S.hd}>
        <div style={S.hdLeft}>
          <span style={S.tag}><Palette size={10} /> {ID_VISUAL_CONFIG.label}</span>
          <div style={S.name}>{client.name}</div>
          <div style={S.resp}>👤 {idv.responsible || '—'}</div>
        </div>
        <div style={S.hdRight}>
          {isProduction && <Ring checked={checked} total={total} />}
          <button style={S.xbtn} onClick={() => setExpanded(!expanded)}>
            {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          </button>
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
                  {item.checked
                    ? <CheckSquare size={15} color="var(--green)" style={{ flexShrink: 0 }} />
                    : <Square size={15} color="var(--muted)" style={{ flexShrink: 0 }} />}
                  <span style={{ fontSize: 13, textDecoration: item.checked ? 'line-through' : 'none', color: item.checked ? 'var(--muted)' : 'var(--text)' }}>{item.label}</span>
                </div>
              ))}
            </div>
          )}

          {isProduction && (
            <div style={{ marginBottom: 14 }}>
              <p style={{ ...S.secLbl, display: 'flex', alignItems: 'center', gap: 5 }}><FileText size={10} /> ANOTAÇÕES</p>
              <textarea style={S.ta} defaultValue={idv.notes || ''} onChange={e => handleNotes(e.target.value)} placeholder="Anotações..." />
            </div>
          )}

          {allChecked && isProduction && (
            <div style={S.doneBox}>
              <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--green)' }}>✓ Todos os itens concluídos!</p>
              <p style={{ fontSize: 12, color: 'rgba(34,197,94,.7)', marginTop: 2 }}>Pode encerrar o ID Visual deste cliente.</p>
              <button style={{ ...S.btnFin, marginTop: 10, width: '100%' }} onClick={() => onMoveStatus(client.id, 'finished')}>
                ✓ Marcar como Finalizado
              </button>
            </div>
          )}

          {idv.status === 'finished' && (
            <button style={S.asec} onClick={() => onMoveStatus(client.id, 'production')}>
              ↺ Reabrir produção
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default function IdVisualBoard({
  clients, onMoveToProduction, onMoveBackToOnboarding,
  onUpdateChecklist, onUpdateNotes, onMoveStatus,
}) {
  const [tab, setTab] = useState('production');

  const counts = {
    onboarding: clients.filter(c => c.idv?.status === 'onboarding').length,
    production: clients.filter(c => c.idv?.status === 'production').length,
    finished:   clients.filter(c => c.idv?.status === 'finished').length,
  };

  const display = clients.filter(c => c.idv?.status === tab);

  return (
    <div className="fade-up">
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, color: '#fff', letterSpacing: '-.5px', marginBottom: 4 }}>
          ID Visual
        </h1>
        <p style={{ fontSize: 13, color: 'var(--muted)' }}>
          Identidades visuais sob sua responsabilidade — só você enxerga este quadro.
        </p>
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 18, flexWrap: 'wrap' }}>
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, borderRadius: 8, padding: '6px 13px',
              fontSize: 12, fontWeight: 500, cursor: 'pointer', transition: 'all .15s',
              background: tab === t.key ? 'var(--neon-dim)' : 'var(--surface)',
              border: `1px solid ${tab === t.key ? 'var(--neon-border)' : 'var(--border)'}`,
              color: tab === t.key ? 'var(--neon)' : 'var(--muted)',
            }}
          >
            {t.label}
            {counts[t.key] > 0 && (
              <span style={{ background: tab === t.key ? 'var(--neon-dim)' : 'rgba(255,255,255,.06)', borderRadius: 8, padding: '1px 6px', fontSize: 10, fontFamily: 'var(--fm)' }}>
                {counts[t.key]}
              </span>
            )}
          </button>
        ))}
      </div>

      {display.length === 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, paddingTop: 70, textAlign: 'center' }}>
          <Palette size={30} color="var(--muted)" style={{ opacity: .5 }} />
          <p style={{ fontSize: 15, color: 'var(--muted)', fontWeight: 600 }}>Nenhum cliente nesta fase</p>
          <p style={{ fontSize: 12, color: 'var(--muted)', opacity: .6, maxWidth: 300 }}>
            O ID Visual chega aqui quando a CS cadastra o cliente e escolhe você como responsável.
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(330px,1fr))', gap: 12 }}>
          {display.map(c => (
            <IdvCard
              key={c.id}
              client={c}
              onMoveToProduction={onMoveToProduction}
              onMoveBackToOnboarding={onMoveBackToOnboarding}
              onUpdateChecklist={onUpdateChecklist}
              onUpdateNotes={onUpdateNotes}
              onMoveStatus={onMoveStatus}
            />
          ))}
        </div>
      )}
    </div>
  );
}

const S = {
  card: { background: 'rgba(12,12,24,.88)', border: '1px solid var(--border)', borderRadius: 14, padding: 16, transition: 'border-color .2s', backdropFilter: 'blur(12px)' },
  hd: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  hdLeft: { flex: 1, minWidth: 0 },
  hdRight: { display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 },
  tag: { display: 'inline-flex', alignItems: 'center', gap: 4, background: 'var(--neon-dim)', border: '1px solid var(--neon-border)', borderRadius: 5, padding: '2px 8px', fontSize: 10, color: 'var(--neon)', fontWeight: 600, marginBottom: 5 },
  name: { fontSize: 15, fontWeight: 700, color: '#f0f0ff', marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  resp: { display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--muted)', flexWrap: 'wrap' },
  xbtn: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 7, padding: '4px 7px', color: 'var(--muted)', display: 'flex', alignItems: 'center', cursor: 'pointer' },
  body: { borderTop: '1px solid var(--border)', paddingTop: 12, marginTop: 12 },
  secLbl: { fontSize: 10, letterSpacing: '.12em', color: 'var(--muted)', marginBottom: 8, fontWeight: 600, textTransform: 'uppercase', fontFamily: 'var(--fm)' },
  moveProdBtn: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: 'linear-gradient(135deg,rgba(238,51,99,.18),rgba(238,51,99,.08))', border: '1px solid var(--neon-border)', borderRadius: 9, padding: 10, color: 'var(--neon)', fontSize: 13, fontWeight: 600, width: '100%', marginBottom: 10, cursor: 'pointer', transition: 'all .2s' },
  backBtn: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, background: 'rgba(255,255,255,.03)', border: '1px solid var(--border)', borderRadius: 8, padding: '7px 12px', color: 'var(--muted)', fontSize: 12, width: '100%', marginBottom: 12, cursor: 'pointer' },
  ci: { display: 'flex', alignItems: 'center', gap: 9, padding: '7px 9px', borderRadius: 7, cursor: 'pointer', marginBottom: 3, background: 'var(--surface)', transition: 'background .15s' },
  ta: { width: '100%', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 10px', color: 'var(--text)', fontSize: 13, fontFamily: 'var(--f)', resize: 'vertical', minHeight: 72, outline: 'none' },
  doneBox: { background: 'var(--green-dim)', border: '1px solid var(--green-b)', borderRadius: 10, padding: 14, marginBottom: 14 },
  btnFin: { background: 'var(--green-dim)', border: '1px solid var(--green-b)', borderRadius: 8, padding: 8, color: 'var(--green)', fontSize: 12, fontWeight: 600, cursor: 'pointer' },
  asec: { display: 'flex', alignItems: 'center', gap: 5, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 7, padding: '6px 12px', color: 'var(--muted)', fontSize: 12, cursor: 'pointer' },
};
