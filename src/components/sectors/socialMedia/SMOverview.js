import React from 'react';
import { differenceInDays } from 'date-fns';
import { Calendar, Users, AlertTriangle } from 'lucide-react';
import { SM_COLUMNS } from '../../../lib/firebase';

function StatCard({ icon: Icon, label, value, color = 'var(--blue)' }) {
  return (
    <div style={{ background: 'rgba(12,12,24,.88)', border: '1px solid var(--border)', borderRadius: 14, padding: '20px 22px', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg,${color},transparent)` }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 8 }}>{label}</p>
          <p style={{ fontSize: 32, fontWeight: 800, color }}>{value}</p>
        </div>
        <div style={{ width: 44, height: 44, borderRadius: 12, background: `${color}18`, border: `1px solid ${color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={20} color={color} />
        </div>
      </div>
    </div>
  );
}

export default function SMOverview({ myPosts, onNavigate }) {
  const now = new Date();
  const thisMonth = now.getMonth();
  const thisYear = now.getFullYear();

  const monthPosts = myPosts.filter(p => {
    const d = new Date(p.date || p.createdAt);
    return d.getMonth() === thisMonth && d.getFullYear() === thisYear;
  });
  const published = myPosts.filter(p => p.status === 'published').length;
  const scheduled = myPosts.filter(p => p.status === 'scheduled').length;
  const blocked = myPosts.filter(p => p.status === 'client').length;

  const uniqueClients = [...new Set(myPosts.map(p => p.clientId))].length;

  return (
    <div className="fade-up">
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, color: '#fff', letterSpacing: '-.5px', marginBottom: 4 }}>Visão Geral</h1>
        <p style={{ fontSize: 13, color: 'var(--muted)' }}>Social Media · mês atual</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: 12, marginBottom: 28 }}>
        <StatCard icon={Calendar} label="Posts no Mês" value={`${published + scheduled}/${monthPosts.length}`} color="var(--blue)" />
        <StatCard icon={Users} label="Clientes Ativos" value={uniqueClients} color="var(--green)" />
        <StatCard icon={AlertTriangle} label="Aguardando Cliente" value={blocked} color={blocked > 0 ? 'var(--neon)' : 'var(--muted)'} />
      </div>

      {/* Column summary */}
      <div style={{ background: 'rgba(12,12,24,.88)', border: '1px solid var(--border)', borderRadius: 14, padding: '20px 22px' }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 16 }}>Status do Kanban</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))', gap: 12 }}>
          {SM_COLUMNS.map(col => {
            const count = myPosts.filter(p => p.status === col.id).length;
            return (
              <div key={col.id} style={{ background: `${col.color}10`, border: `1px solid ${col.color}30`, borderRadius: 10, padding: '14px 16px', cursor: 'pointer' }} onClick={() => onNavigate('kanban')}>
                <p style={{ fontSize: 11, color: col.color, fontWeight: 600, marginBottom: 6, fontFamily: 'var(--fm)' }}>{col.label}</p>
                <p style={{ fontSize: 28, fontWeight: 800, color: col.color }}>{count}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Blocked more than 3 days */}
      {blocked > 0 && (
        <div style={{ background: 'rgba(238,51,99,.06)', border: '1px solid rgba(238,51,99,.2)', borderRadius: 14, padding: '16px 20px', marginTop: 16 }}>
          <p style={{ fontSize: 13, color: 'var(--neon)', fontWeight: 600, marginBottom: 10 }}>⚠ Posts travados com o cliente</p>
          {myPosts.filter(p => p.status === 'client').map(p => {
            const days = differenceInDays(now, new Date(p.updatedAt || p.createdAt));
            return (
              <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: '1px solid rgba(255,255,255,.05)' }}>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{p.name}</p>
                  <p style={{ fontSize: 11, color: 'var(--muted)' }}>{p.clientName}</p>
                </div>
                <span style={{ fontSize: 11, fontFamily: 'var(--fm)', color: days >= 3 ? 'var(--neon)' : 'var(--amber)', background: days >= 3 ? 'rgba(238,51,99,.12)' : 'rgba(245,158,11,.12)', padding: '2px 8px', borderRadius: 6 }}>
                  {days}d
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
