import React from 'react';
import { differenceInDays, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Clock, AlertTriangle, MessageSquare, RefreshCw, Link } from 'lucide-react';
import { TASK_PRIORITIES, SECTORS } from '../../lib/firebase';

// Interpreta "YYYY-MM-DD" no fuso LOCAL (evita o bug de 1 dia antes,
// causado por new Date("YYYY-MM-DD") ser lido como meia-noite UTC).
export function parseLocalDate(str) {
  if (!str) return null;
  const [y, m, d] = String(str).split('-').map(Number);
  if (!y || !m || !d) return new Date(str);
  return new Date(y, m - 1, d);
}

export default function TaskCard({ task, onClick }) {
  const priority = TASK_PRIORITIES.find(p => p.id === task.priority);
  const sector = SECTORS[task.responsibleSector];
  const now = new Date();
  const deadline = task.deadline ? parseLocalDate(task.deadline) : null;
  const isOverdue = deadline && differenceInDays(now, deadline) > 0 && task.status !== 'done';
  const isUrgentDeadline = deadline && !isOverdue && differenceInDays(deadline, now) <= 1;

  return (
    <div
      onClick={onClick}
      style={{
        background: 'rgba(12,12,24,.92)',
        border: `1px solid ${task.isRework ? 'rgba(245,158,11,0.4)' : isOverdue ? 'rgba(238,51,99,0.35)' : 'rgba(255,255,255,0.07)'}`,
        borderRadius: 10,
        padding: '12px 13px',
        cursor: 'pointer',
        transition: 'all .15s',
        marginBottom: 8,
        animation: 'fadeUp .2s ease',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Rework flag */}
      {task.isRework && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 6 }}>
          <RefreshCw size={10} color="var(--amber)" style={{ animation: 'spin 2s linear infinite' }} />
          <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--amber)', letterSpacing: '.08em', fontFamily: 'var(--fm)' }}>
            AJUSTE #{task.reworkCount}
          </span>
        </div>
      )}

      {/* Priority + sector */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 7 }}>
        {priority && (
          <span style={{
            fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 20,
            background: `${priority.color}18`, color: priority.color,
            border: `1px solid ${priority.color}35`, fontFamily: 'var(--fm)',
            letterSpacing: '.06em',
          }}>
            {priority.label.toUpperCase()}
          </span>
        )}
        {sector && (
          <span style={{ fontSize: 10, color: sector.color }}>{sector.emoji}</span>
        )}
      </div>

      {/* Task name */}
      <p style={{ fontSize: 13, fontWeight: 600, color: '#f0f0ff', marginBottom: 4, lineHeight: 1.4 }}>
        {task.name}
      </p>

      {/* Client */}
      <p style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 8 }}>
        👤 {task.clientName}
      </p>

      {/* Deadline */}
      {deadline && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 8 }}>
          {isOverdue
            ? <AlertTriangle size={11} color="var(--neon)" style={{ animation: 'pulse 1.5s infinite' }} />
            : <Clock size={11} color={isUrgentDeadline ? 'var(--amber)' : 'var(--muted)'} />}
          <span style={{
            fontSize: 11, fontFamily: 'var(--fm)',
            color: isOverdue ? 'var(--neon)' : isUrgentDeadline ? 'var(--amber)' : 'var(--muted)',
          }}>
            {isOverdue
              ? `${differenceInDays(now, deadline)}d atrasada`
              : format(deadline, "dd MMM", { locale: ptBR })}
          </span>
        </div>
      )}

      {/* Footer: responsible + comments + links */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          {(() => {
            const names = (Array.isArray(task.responsibleNames) && task.responsibleNames.length) ? task.responsibleNames : (task.responsibleName ? [task.responsibleName] : []);
            const shown = names.slice(0, 3);
            return (
              <>
                {shown.map((n, i) => (
                  <div key={i} title={n} style={{
                    width: 24, height: 24, borderRadius: 8,
                    background: sector ? `${sector.color}20` : 'var(--surface)',
                    border: `1px solid ${sector ? `${sector.color}35` : 'var(--border)'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 10, fontWeight: 700, color: sector?.color || 'var(--muted)',
                    marginLeft: i === 0 ? 0 : -6,
                  }}>
                    {n.charAt(0).toUpperCase()}
                  </div>
                ))}
                {names.length > 3 && (
                  <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)', marginLeft: 4 }}>+{names.length - 3}</span>
                )}
              </>
            );
          })()}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {(task.comments?.length > 0) && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, color: 'var(--muted)' }}>
              <MessageSquare size={11} /> {task.comments.length}
            </span>
          )}
          {(task.links?.length > 0) && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, color: 'var(--muted)' }}>
              <Link size={11} /> {task.links.length}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
