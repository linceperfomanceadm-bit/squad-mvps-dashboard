import React from 'react';
import { differenceInDays } from 'date-fns';
import { Package, Clock, Star } from 'lucide-react';
import { APPROVAL_STATUS, SECTORS } from '../../../lib/firebase';

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

export default function CreativeOverview({ myDeliveries, sectorId }) {
  const color = SECTORS[sectorId]?.color || 'var(--neon)';
  const now = new Date();
  const thisMonth = now.getMonth();
  const thisYear = now.getFullYear();

  const monthDeliveries = myDeliveries.filter(d => {
    const date = new Date(d.deliveryDate || d.createdAt);
    return date.getMonth() === thisMonth && date.getFullYear() === thisYear;
  });

  const firstApproval = myDeliveries.filter(d => d.approvalStatus === 'first');
  const pctFirst = myDeliveries.length > 0 ? Math.round((firstApproval.length / myDeliveries.length) * 100) : 0;

  const avgDays = (() => {
    const withDates = myDeliveries.filter(d => d.requestDate && d.deliveryDate);
    if (!withDates.length) return 0;
    const total = withDates.reduce((sum, d) => sum + Math.max(0, differenceInDays(new Date(d.deliveryDate), new Date(d.requestDate))), 0);
    return (total / withDates.length).toFixed(1);
  })();

  // Hall da Fama - first approval deliveries
  const hallOfFame = myDeliveries.filter(d => d.approvalStatus === 'first').slice(0, 8);

  return (
    <div className="fade-up">
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, color: '#fff', letterSpacing: '-.5px', marginBottom: 4 }}>Visão Geral</h1>
        <p style={{ fontSize: 13, color: 'var(--muted)' }}>{SECTORS[sectorId]?.label} · mês atual</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: 12, marginBottom: 28 }}>
        <StatCard icon={Package} label="Entregas no Mês" value={monthDeliveries.length} color={color} />
        <StatCard icon={Clock} label="Tempo Médio" value={`${avgDays}d`} sub="por entrega" color={color} />
        <StatCard icon={Star} label="Aprovação de Primeira" value={`${pctFirst}%`} sub={`${firstApproval.length} entregas`} color={pctFirst >= 70 ? 'var(--green)' : pctFirst >= 40 ? 'var(--amber)' : 'var(--neon)'} />
      </div>

      {/* Hall da Fama */}
      <div style={{ background: 'rgba(12,12,24,.88)', border: '1px solid var(--border)', borderRadius: 14, padding: '20px 22px', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <span style={{ fontSize: 20 }}>🏆</span>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>Hall da Fama</h2>
          <span style={{ fontSize: 12, color: 'var(--muted)' }}>— aprovadas de primeira</span>
        </div>
        {hallOfFame.length === 0 ? (
          <p style={{ fontSize: 13, color: 'var(--muted)', textAlign: 'center', padding: '20px 0' }}>Nenhuma entrega aprovada de primeira ainda.</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))', gap: 10 }}>
            {hallOfFame.map(d => (
              <div key={d.id} style={{ background: 'linear-gradient(135deg,rgba(34,197,94,.08),rgba(34,197,94,.04))', border: '1px solid var(--green-b)', borderRadius: 10, padding: '12px 14px' }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.name}</p>
                <p style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 8 }}>{d.clientName}</p>
                {d.link && (
                  <a href={d.link} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: 'var(--green)', textDecoration: 'none' }}>Ver material →</a>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent deliveries */}
      <div style={{ background: 'rgba(12,12,24,.88)', border: '1px solid var(--border)', borderRadius: 14, padding: '20px 22px' }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 16 }}>Últimas Entregas</h2>
        {myDeliveries.length === 0 ? (
          <p style={{ fontSize: 13, color: 'var(--muted)', textAlign: 'center', padding: '20px 0' }}>Nenhuma entrega cadastrada ainda.</p>
        ) : (
          myDeliveries.slice(0, 10).map(d => {
            const status = APPROVAL_STATUS.find(s => s.id === d.approvalStatus);
            return (
              <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.name}</p>
                  <p style={{ fontSize: 11, color: 'var(--muted)' }}>{d.clientName} · {d.requestingSector}</p>
                </div>
                {status && (
                  <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 6, background: `${status.color}15`, color: status.color, fontFamily: 'var(--fm)', whiteSpace: 'nowrap' }}>
                    {status.label}
                  </span>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
