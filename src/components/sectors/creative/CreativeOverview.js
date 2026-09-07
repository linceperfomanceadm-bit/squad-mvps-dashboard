import React from 'react';
import { Kpi } from '../../shared/ui';
import { differenceInDays } from 'date-fns';
import { Package, Clock, Star, Kanban } from 'lucide-react';
import { SECTORS, TASK_PRIORITIES } from '../../../lib/firebase';

function StatCard({ label, value, sub, color }) {
  const tone = color === 'var(--green)' ? 'good' : color === 'var(--amber)' ? 'warn' : (color === 'var(--neon)' || color === 'var(--red)') ? 'bad' : undefined;
  return <Kpi value={value} label={label} tone={tone}>{sub ? <span style={{ fontSize: 12, color: 'var(--muted)' }}>{sub}</span> : null}</Kpi>;
}

export default function CreativeOverview({ tasks, myTasks, sectorId }) {
  const color = SECTORS[sectorId]?.color || 'var(--neon)';
  const now = new Date();
  const thisMonth = now.getMonth();
  const thisYear = now.getFullYear();
  const userName = myTasks?.[0]?.responsibleName; // used for personal metric

  // Use deliveredBy for "done" metrics — who actually did the work
  const doneTasks = tasks.filter(t => t.status === 'done');

  const monthDone = doneTasks.filter(t => {
    const d = new Date(t.completedAt || t.createdAt);
    return d.getMonth() === thisMonth && d.getFullYear() === thisYear;
  });

  // First approval = no rework
  const firstApproval = doneTasks.filter(t => t.reworkCount === 0);
  const pctFirst = doneTasks.length > 0
    ? Math.round((firstApproval.length / doneTasks.length) * 100)
    : 0;

  // Avg time: from startedAt to completedAt
  const avgDays = (() => {
    const withDates = doneTasks.filter(t => t.startedAt && t.completedAt);
    if (!withDates.length) return 0;
    const total = withDates.reduce((sum, t) =>
      sum + Math.max(0, differenceInDays(new Date(t.completedAt), new Date(t.startedAt))), 0);
    return (total / withDates.length).toFixed(1);
  })();

  const myActiveTasks = (myTasks || []).filter(t => t.status !== 'done');
  const pendingApproval = (myTasks || []).filter(
    t => t.status === 'approval' && t.responsibleName === userName
  );

  return (
    <div className="fade-up">
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 21, fontWeight: 500, color: 'var(--text)', letterSpacing: '-.01em', marginBottom: 4 }}>Visão Geral</h1>
        <p style={{ fontSize: 13, color: 'var(--muted)' }}>{SECTORS[sectorId]?.label} · mês atual</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: 12, marginBottom: 28 }}>
        <StatCard icon={Package} label="Entregas no Mês"        value={monthDone.length}     color={color} />
        <StatCard icon={Clock}   label="Tempo Médio"            value={`${avgDays}d`}        sub="por entrega" color={color} />
        <StatCard icon={Star}    label="Aprovação de Primeira"  value={`${pctFirst}%`}       sub={`${firstApproval.length} tasks`} color={pctFirst >= 70 ? 'var(--green)' : pctFirst >= 40 ? 'var(--amber)' : 'var(--neon)'} />
        <StatCard icon={Kanban}  label="Pendentes Aprovação"    value={pendingApproval.length} sub="aguardando ok" color={pendingApproval.length > 0 ? 'var(--amber)' : 'var(--muted)'} />
      </div>

      {/* My active tasks */}
      <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 18, padding: '18px 20px', boxShadow: 'var(--shadow)' }}>
        <h2 style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)', marginBottom: 16 }}>Minhas Tasks Ativas</h2>
        {myActiveTasks.length === 0 ? (
          <p style={{ fontSize: 13, color: 'var(--muted)', textAlign: 'center', padding: '16px 0' }}>
            Nenhuma task ativa no momento. 🎉
          </p>
        ) : (
          myActiveTasks.slice(0, 8).map(t => {
            const priority = TASK_PRIORITIES.find(p => p.id === t.priority);
            const isOverdue = t.deadline && differenceInDays(now, new Date(t.deadline)) > 0;
            return (
              <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                    {t.isRework && <span style={{ fontSize: 9, color: 'var(--amber)', fontFamily: 'var(--fm)', fontWeight: 700 }}>🔄 AJUSTE</span>}
                    <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.name}</p>
                  </div>
                  <p style={{ fontSize: 11, color: 'var(--muted)' }}>{t.clientName}</p>
                </div>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  {priority && (
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 10, background: `${priority.color}15`, color: priority.color, fontFamily: 'var(--fm)' }}>
                      {priority.label}
                    </span>
                  )}
                  {isOverdue && (
                    <span style={{ fontSize: 10, color: 'var(--neon)', fontWeight: 700, fontFamily: 'var(--fm)' }}>ATRASADA</span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
