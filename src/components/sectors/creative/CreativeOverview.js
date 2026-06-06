import React from 'react';
import { differenceInDays } from 'date-fns';
import { Package, Clock, Star, Kanban } from 'lucide-react';
import { SECTORS, TASK_PRIORITIES } from '../../../lib/firebase';

function StatCard({ icon: Icon, label, value, sub, color }) {
  return (
    <div style={{ background: 'rgba(12,12,24,.88)', border: '1px solid var(--border)', borderRadius: 14, padding: '20px 22px', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg,${color},transparent)` }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 8 }}>{label}</p>
          <p style={{ fontSize: 32, fontWeight: 800, color }}>{value}</p>
          {sub && <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>{sub}</p>}
        </div>
        <div style={{ width: 44, height: 44, borderRadius: 12, background: `${color}18`, border: `1px solid ${color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={20} color={color} />
        </div>
      </div>
    </div>
  );
}

export default function CreativeOverview({ tasks, myTasks, sectorId }) {
  const color = SECTORS[sectorId]?.color || 'var(--neon)';
  const now = new Date();
  const thisMonth = now.getMonth();
  const thisYear = now.getFullYear();

  const doneTasks = tasks.filter(t => t.status === 'done');

  const monthDone = doneTasks.filter(t => {
    const d = new Date(t.completedAt || t.createdAt);
    return d.getMonth() === thisMonth && d.getFullYear() === thisYear;
  });

  const firstApproval = doneTasks.filter(t => t.reworkCount === 0);
  const pctFirst = doneTasks.length > 0 ? Math.round((firstApproval.length / doneTasks.length) * 100) : 0;

  const avgDays = (() => {
    const withDates = doneTasks.filter(t => t.startedAt && t.completedAt);
    if (!withDates.length) return 0;
    const total = withDates.reduce((sum, t) => sum + Math.max(0, differenceInDays(new Date(t.completedAt), new Date(t.startedAt))), 0);
    return (total / withDates.length).toFixed(1);
  })();

  // My active tasks
  const myActiveTasks = (myTasks || []).filter(t => t.status !== 'done');
  const pendingApproval = (myTasks || []).filter(t => t.status === 'approval');

  return (
    <div className="fade-up">
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, color: '#fff', letterSpacing: '-.5px', marginBottom: 4 }}>Visão Geral</h1>
        <p style={{ fontSize: 13, color: 'var(--muted)' }}>{SECTORS[sectorId]?.label} · mês atual</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: 12, marginBottom: 28 }}>
        <StatCard icon={Package} label="Entregas no Mês" value={monthDone.length} color={color} />
        <StatCard icon={Clock} label="Tempo Médio" value={`${avgDays}d`} sub="por entrega" color={color} />
        <StatCard icon={Star} label="Aprovação de Primeira" value={`${pctFirst}%`} sub={`${firstApproval.length} tasks`} color={pctFirst >= 70 ? 'var(--green)' : pctFirst >= 40 ? 'var(--amber)' : 'var(--neon)'} />
        <StatCard icon={Kanban} label="Pendentes Aprovação" value={pendingApproval.length} sub="aguardando ok" color={pendingApproval.length > 0 ? 'var(--amber)' : 'var(--muted)'} />
      </div>

      {/* My active tasks */}
      <div style={{ background: 'rgba(12,12,24,.88)', border: '1px solid var(--border)', borderRadius: 14, padding: '20px 22px' }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 16 }}>Minhas Tasks Ativas</h2>
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
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                  {priority && (
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 10, background: `${priority.color}15`, color: priority.color, fontFamily: 'var(--fm)' }}>
                      {priority.label}
                    </span>
                  )}
                  {isOverdue && <span style={{ fontSize: 10, color: 'var(--neon)', fontWeight: 700, fontFamily: 'var(--fm)' }}>ATRASADA</span>}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
