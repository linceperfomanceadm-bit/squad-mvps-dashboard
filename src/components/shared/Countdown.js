import React, { useState, useEffect } from 'react';
import { differenceInMinutes } from 'date-fns';
import { Clock, AlertTriangle } from 'lucide-react';

export default function Countdown({ startDate, totalDays }) {
  const [, tick] = useState(0);
  useEffect(() => { const t = setInterval(() => tick(n => n+1), 60000); return () => clearInterval(t); }, []);

  const elapsed = differenceInMinutes(new Date(), new Date(startDate)) / 1440;
  const remaining = totalDays - elapsed;
  const pct = Math.min((elapsed / totalDays) * 100, 100);
  const isLate = remaining < 0;
  const isWarn = !isLate && remaining < totalDays * 0.25;
  const color = isLate ? 'var(--neon)' : isWarn ? 'var(--amber)' : 'var(--green)';
  const fill = isLate ? 'linear-gradient(90deg,rgba(238,51,99,.5),var(--neon))' : isWarn ? 'linear-gradient(90deg,rgba(245,158,11,.5),var(--amber))' : 'linear-gradient(90deg,rgba(34,197,94,.4),var(--green))';
  const badge = isLate ? 'ATRASADO' : isWarn ? 'URGENTE' : 'NO PRAZO';
  const label = isLate ? `${Math.abs(Math.floor(remaining))}d em atraso` : `${Math.ceil(remaining)}d restantes`;

  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color, fontFamily: 'var(--fm)', fontWeight: 500 }}>
          {isLate ? <AlertTriangle size={12} style={{ animation: 'pulse 1.5s infinite' }} /> : <Clock size={12} />}
          {label}
        </span>
        <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: `${color}18`, color, border: `1px solid ${color}50`, fontFamily: 'var(--fm)' }}>{badge}</span>
      </div>
      <div style={{ height: 4, background: 'rgba(255,255,255,.06)', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: fill, borderRadius: 2, boxShadow: `0 0 8px ${color}50`, transition: 'width .6s ease' }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
        <span style={{ fontSize: 10, color: 'var(--muted)' }}>Início</span>
        <span style={{ fontSize: 10, color: 'var(--muted)' }}>{totalDays}d prazo</span>
      </div>
    </div>
  );
}
