import React from 'react';
import { ExternalLink } from 'lucide-react';

function RankBadge({ rank }) {
  const medals = { 1: '🥇', 2: '🥈', 3: '🥉' };
  if (medals[rank]) return <span style={{ fontSize: 24 }}>{medals[rank]}</span>;
  return <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--muted)', width: 24, textAlign: 'center' }}>#{rank}</span>;
}

export default function HallOfFame({ tasks }) {
  // First-approval = done with no rework
  const firstApprovalTasks = tasks.filter(
    t => t.status === 'done' && t.reworkCount === 0
  );

  // Rank by deliveredBy (who actually did the work), fallback to responsibleName for old tasks
  const rankMap = {};
  firstApprovalTasks.forEach(t => {
    const key = t.deliveredBy || t.responsibleName || 'Desconhecido';
    if (!rankMap[key]) rankMap[key] = { name: key, count: 0, tasks: [] };
    rankMap[key].count++;
    rankMap[key].tasks.push(t);
  });

  const ranking = Object.values(rankMap)
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const recentFirstApproval = firstApprovalTasks
    .sort((a, b) => new Date(b.completedAt || b.createdAt) - new Date(a.completedAt || a.createdAt))
    .slice(0, 12);

  return (
    <div className="fade-up">
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, color: '#fff', letterSpacing: '-.5px', marginBottom: 4 }}>
          🏆 Hall da Fama
        </h1>
        <p style={{ fontSize: 13, color: 'var(--muted)' }}>
          Ranking de entregas aprovadas de primeira — Design & VideoMaker
        </p>
      </div>

      {/* Ranking */}
      <div style={{ background: 'rgba(12,12,24,.88)', border: '1px solid var(--border)', borderRadius: 14, padding: '22px', marginBottom: 20 }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 18 }}>Ranking Geral</h2>

        {ranking.length === 0 ? (
          <p style={{ fontSize: 13, color: 'var(--muted)', textAlign: 'center', padding: '24px 0' }}>
            Nenhuma entrega aprovada de primeira ainda. Seja o primeiro! 🚀
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {ranking.map((collab, idx) => {
              const rank = idx + 1;
              const isTop3 = rank <= 3;
              const bgColors  = { 1: 'rgba(255,215,0,0.06)',   2: 'rgba(192,192,192,0.06)', 3: 'rgba(205,127,50,0.06)' };
              const brdColors = { 1: 'rgba(255,215,0,0.2)',    2: 'rgba(192,192,192,0.2)',  3: 'rgba(205,127,50,0.2)' };
              const valColors = { 1: '#ffd700',                2: '#c0c0c0',                3: '#cd7f32' };

              return (
                <div key={collab.name} style={{ display: 'flex', alignItems: 'center', gap: 14, background: isTop3 ? bgColors[rank] : 'var(--surface)', border: `1px solid ${isTop3 ? brdColors[rank] : 'var(--border)'}`, borderRadius: 10, padding: '12px 16px' }}>
                  <RankBadge rank={rank} />
                  <div style={{ width: 38, height: 38, borderRadius: 10, background: 'linear-gradient(135deg,var(--neon-dim),rgba(167,139,250,.1))', border: '1px solid var(--neon-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 800, color: 'var(--neon)', flexShrink: 0 }}>
                    {collab.name.charAt(0).toUpperCase()}
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>{collab.name}</p>
                    <p style={{ fontSize: 11, color: 'var(--muted)' }}>
                      {collab.count} entrega{collab.count !== 1 ? 's' : ''} aprovada{collab.count !== 1 ? 's' : ''} de primeira
                    </p>
                  </div>
                  <p style={{ fontSize: 28, fontWeight: 800, color: isTop3 ? valColors[rank] : 'var(--text)' }}>
                    {collab.count}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Recent first-approval grid */}
      {recentFirstApproval.length > 0 && (
        <div style={{ background: 'rgba(12,12,24,.88)', border: '1px solid var(--border)', borderRadius: 14, padding: '22px' }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 16 }}>
            Últimas Aprovações de Primeira ✨
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: 10 }}>
            {recentFirstApproval.map(task => (
              <div key={task.id} style={{ background: 'linear-gradient(135deg,rgba(34,197,94,.08),rgba(34,197,94,.04))', border: '1px solid var(--green-b)', borderRadius: 10, padding: '12px 14px' }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{task.name}</p>
                {/* Show who actually delivered */}
                <p style={{ fontSize: 11, color: 'var(--green)', fontWeight: 500, marginBottom: 2 }}>
                  {task.deliveredBy || task.responsibleName}
                </p>
                <p style={{ fontSize: 11, color: 'var(--muted)', marginBottom: task.links?.length > 0 ? 8 : 0 }}>
                  {task.clientName}
                </p>
                {task.links?.length > 0 && (
                  <a href={task.links[0]} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--green)', textDecoration: 'none' }}>
                    <ExternalLink size={11} /> Ver material
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
