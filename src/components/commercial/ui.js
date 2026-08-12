import React from 'react';
import { X, Check } from 'lucide-react';

/*
 * Peças de UI compartilhadas pelos painéis do funil
 * (SDR, Closer, CS Comercial e CS Operacional).
 * Mantém o mesmo padrão de estilo inline do resto do app.
 */

export const CARD = { background: 'rgba(12,12,24,.88)', border: '1px solid var(--border)', borderRadius: 14, padding: 16 };
export const GRID = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: 12 };
export const MODAL = { background: 'rgba(16,16,30,.99)', border: '1px solid var(--border)', borderRadius: 16, padding: 24, width: '100%', maxWidth: 480, maxHeight: '88vh', overflowY: 'auto' };
export const LBL = { fontSize: 10, letterSpacing: '.12em', color: 'var(--muted)', fontWeight: 600, fontFamily: 'var(--fm)' };
export const INP = { width: '100%', background: '#12121f', border: '1px solid var(--border)', borderRadius: 9, padding: '10px 13px', color: 'var(--text)', fontSize: 13, outline: 'none', fontFamily: 'var(--f)' };
export const BTN_PRIMARY = { background: 'linear-gradient(135deg,var(--neon),#c41f4a)', border: 'none', borderRadius: 10, padding: '11px 16px', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' };
export const BTN_GREEN = { background: 'linear-gradient(135deg,#22c55e,#16a34a)', border: 'none', borderRadius: 10, padding: '11px 16px', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' };
export const BTN_CANCEL = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '11px 16px', color: 'var(--muted)', fontSize: 13, fontWeight: 600, cursor: 'pointer' };
export const ICON_BTN = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 7, padding: '5px 7px', color: 'var(--muted)', display: 'flex', alignItems: 'center', cursor: 'pointer' };

export function Overlay({ children, onClose }) {
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1300, padding: 20, overflowY: 'auto' }}>
      <div onClick={e => e.stopPropagation()} className="fade-up" style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
        {children}
      </div>
    </div>
  );
}

export function ModalHeader({ title, onClose }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
      <h3 style={{ fontSize: 18, fontWeight: 800, color: '#fff' }}>{title}</h3>
      <button onClick={onClose} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: 6, cursor: 'pointer', display: 'flex' }}>
        <X size={15} color="var(--muted)" />
      </button>
    </div>
  );
}

export function ConfirmModal({ title, text, onClose, onConfirm, confirmLabel = 'Confirmar' }) {
  return (
    <Overlay onClose={onClose}>
      <div style={{ ...MODAL, maxWidth: 400 }}>
        <ModalHeader title={title} onClose={onClose} />
        <p style={{ fontSize: 13, color: '#ddd', lineHeight: 1.6, marginBottom: 16 }}>{text}</p>
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={{ ...BTN_PRIMARY, flex: 1 }} onClick={onConfirm}>{confirmLabel}</button>
          <button style={BTN_CANCEL} onClick={onClose}>Cancelar</button>
        </div>
      </div>
    </Overlay>
  );
}

// Modal simples de agendamento (data/hora + link).
export function ScheduleModal({ title, subtitle, initialAt = '', initialLink = '', confirmLabel = 'Confirmar', onClose, onConfirm }) {
  const [at, setAt] = React.useState(initialAt);
  const [link, setLink] = React.useState(initialLink);
  const [busy, setBusy] = React.useState(false);

  return (
    <Overlay onClose={onClose}>
      <div style={MODAL}>
        <ModalHeader title={title} onClose={onClose} />
        {subtitle && <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 14, lineHeight: 1.5 }}>{subtitle}</p>}
        <p style={LBL}>DATA E HORA *</p>
        <input type="datetime-local" value={at} onChange={e => setAt(e.target.value)} style={{ ...INP, marginTop: 6, marginBottom: 12, colorScheme: 'dark' }} />
        <Field label="Link da call" value={link} onChange={setLink} placeholder="https://meet..." />
        <button
          style={{ ...BTN_PRIMARY, width: '100%', marginTop: 16, opacity: (at && !busy) ? 1 : .5 }}
          disabled={!at || busy}
          onClick={async () => { setBusy(true); await onConfirm(new Date(at).toISOString(), link); setBusy(false); }}
        >
          {busy ? 'Salvando...' : confirmLabel}
        </button>
      </div>
    </Overlay>
  );
}

export function Field({ label, value, onChange, placeholder, area }) {
  return (
    <div style={{ marginTop: 10 }}>
      <p style={LBL}>{String(label).toUpperCase()}</p>
      {area
        ? <textarea value={value} onChange={e => onChange(e.target.value)} rows={2} placeholder={placeholder} style={{ ...INP, marginTop: 6, resize: 'vertical' }} />
        : <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={{ ...INP, marginTop: 6 }} />}
    </div>
  );
}

export function Stat({ label, value, color, hint }) {
  return (
    <div style={{ ...CARD, position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg,${color},transparent)` }} />
      <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 8 }}>{label}</p>
      <p style={{ fontSize: 32, fontWeight: 800, color }}>{value}</p>
      {hint && <p style={{ fontSize: 10, color: '#555', marginTop: 6, lineHeight: 1.4 }}>{hint}</p>}
    </div>
  );
}

export function Tag({ text, color }) {
  const muted = color === 'var(--muted)';
  return (
    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 10, background: muted ? 'rgba(255,255,255,.06)' : `${color}1a`, color, fontFamily: 'var(--fm)', border: `1px solid ${muted ? 'var(--border)' : `${color}40`}`, whiteSpace: 'nowrap' }}>
      {text}
    </span>
  );
}

export function Empty({ msg }) {
  return (
    <div style={{ background: 'rgba(12,12,24,.6)', border: '1px dashed var(--border)', borderRadius: 14, padding: '48px 24px', textAlign: 'center' }}>
      <Check size={24} color="var(--muted)" style={{ marginBottom: 10 }} />
      <p style={{ fontSize: 13, color: 'var(--muted)' }}>{msg}</p>
    </div>
  );
}

export function Spinner() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
      <div className="spinner" style={{ width: 36, height: 36 }} />
    </div>
  );
}

export function Section({ title, color = 'var(--neon)', children }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <h3 style={{ fontSize: 12, fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 8 }}>{title}</h3>
      <div style={{ background: 'rgba(12,12,24,.6)', border: '1px solid var(--border)', borderRadius: 10, padding: 14 }}>{children}</div>
    </div>
  );
}

export function RO({ label, value, block }) {
  if (!value) return null;
  return (
    <div style={{ marginBottom: 10 }}>
      <p style={{ fontSize: 10, letterSpacing: '.12em', color: 'var(--muted)', fontFamily: 'var(--fm)', marginBottom: 2 }}>{String(label).toUpperCase()}</p>
      <p style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.6, whiteSpace: block ? 'pre-wrap' : 'normal' }}>{value}</p>
    </div>
  );
}

// datetime-local precisa de "YYYY-MM-DDTHH:mm" no fuso LOCAL.
export function toLocalInput(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export const money = (n) => (Number(n) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export const fmtDateTime = (iso) => iso ? new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—';
export const fmtDate = (iso) => iso ? new Date(iso).toLocaleDateString('pt-BR') : '—';
