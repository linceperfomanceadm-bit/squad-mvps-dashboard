import React, { useState } from 'react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { REQUESTING_SECTORS } from '../../lib/firebase';

const COLORS = ['#EE3363','#a78bfa','#38bdf8','#fb923c','#22c55e','#f59e0b'];

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: '#0e0e1c', border: '1px solid rgba(255,255,255,.1)', borderRadius: 8, padding: '10px 14px' }}>
      {label && <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 4 }}>{label}</p>}
      {payload.map((p, i) => (
        <p key={i} style={{ fontSize: 13, fontWeight: 600, color: p.color || p.fill }}>{p.name}: {p.value}</p>
      ))}
    </div>
  );
};

export default function AdminCharts({ clients }) {
  const [hoveredPie, setHoveredPie] = useState(null);

  // All deliveries for redo ranking
  const clientRedoMap = {};
  clients.forEach(c => {
    let redos = 0;
    (c.design?.deliveries || []).forEach(d => { if (d.approvalStatus === 'redo') redos++; });
    (c.video?.deliveries || []).forEach(d => { if (d.approvalStatus === 'redo') redos++; });
    if (redos > 0) clientRedoMap[c.name] = (clientRedoMap[c.name] || 0) + redos;
  });
  const redoData = Object.entries(clientRedoMap)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);

  // Demand by requesting sector
  const sectorDemandMap = {};
  clients.forEach(c => {
    [...(c.design?.deliveries || []), ...(c.video?.deliveries || [])].forEach(d => {
      if (d.requestingSector) sectorDemandMap[d.requestingSector] = (sectorDemandMap[d.requestingSector] || 0) + 1;
    });
  });
  const pieData = Object.entries(sectorDemandMap).map(([name, value]) => ({ name, value }));

  return (
    <div className="fade-up">
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, color: '#fff', letterSpacing: '-.5px', marginBottom: 4 }}>Relatórios</h1>
        <p style={{ fontSize: 13, color: 'var(--muted)' }}>Gargalos e eficiência da criação</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* Redo ranking */}
        <div style={{ background: 'rgba(12,12,24,.88)', border: '1px solid var(--border)', borderRadius: 14, padding: '20px 22px' }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>Ranking de Refações</h2>
          <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 20 }}>Clientes que mais geram refações</p>
          {redoData.length === 0
            ? <p style={{ fontSize: 13, color: 'var(--muted)', textAlign: 'center', padding: '32px 0' }}>Nenhuma refação registrada.</p>
            : <ResponsiveContainer width="100%" height={260}>
                <BarChart data={redoData} layout="vertical" margin={{ left: 0, right: 16 }}>
                  <XAxis type="number" tick={{ fill: 'var(--muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="name" tick={{ fill: 'var(--text)', fontSize: 12 }} width={110} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,.04)' }} />
                  <Bar dataKey="value" name="Refações" radius={[0,6,6,0]}>
                    {redoData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
          }
        </div>

        {/* Demand by sector pie */}
        <div style={{ background: 'rgba(12,12,24,.88)', border: '1px solid var(--border)', borderRadius: 14, padding: '20px 22px' }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>Demanda por Setor</h2>
          <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 20 }}>Quem mais demanda o time de criação</p>
          {pieData.length === 0
            ? <p style={{ fontSize: 13, color: 'var(--muted)', textAlign: 'center', padding: '32px 0' }}>Nenhuma entrega cadastrada ainda.</p>
            : <>
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" outerRadius={90} dataKey="value"
                      onMouseEnter={(_, i) => setHoveredPie(i)}
                      onMouseLeave={() => setHoveredPie(null)}>
                      {pieData.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]}
                          opacity={hoveredPie === null || hoveredPie === i ? 1 : 0.5}
                          stroke={hoveredPie === i ? '#fff' : 'transparent'} strokeWidth={2} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                    <Legend formatter={(v) => <span style={{ color: 'var(--text)', fontSize: 12 }}>{v}</span>} />
                  </PieChart>
                </ResponsiveContainer>
              </>
          }
        </div>
      </div>
    </div>
  );
}
