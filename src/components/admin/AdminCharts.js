import React, { useState } from 'react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { SECTORS } from '../../lib/firebase';
import { entregadoresDe } from '../../hooks/useTasks';

const COLORS = ['#EE3363','var(--purple)','var(--blue)','var(--orange)','var(--green)','var(--amber)','#e879f9'];

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: 'var(--bg2)', border: '1px solid var(--border-h)', borderRadius: 8, padding: '10px 14px' }}>
      {label && <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 4 }}>{label}</p>}
      {payload.map((p, i) => (
        <p key={i} style={{ fontSize: 13, fontWeight: 600, color: p.color || p.fill }}>{p.name}: {p.value}</p>
      ))}
    </div>
  );
};

export default function AdminCharts({ clients, tasks = [] }) {
  const [hoveredPie, setHoveredPie] = useState(null);

  // Rework ranking by client
  const clientRedoMap = {};
  tasks.forEach(t => {
    if (t.reworkCount > 0) {
      clientRedoMap[t.clientName] = (clientRedoMap[t.clientName] || 0) + t.reworkCount;
    }
  });
  const redoData = Object.entries(clientRedoMap)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);

  // Demand by sector (who creates tasks)
  const sectorDemandMap = {};
  tasks.forEach(t => {
    if (t.requestedBySector) {
      const label = SECTORS[t.requestedBySector]?.label || t.requestedBySector;
      sectorDemandMap[label] = (sectorDemandMap[label] || 0) + 1;
    }
  });
  const pieData = Object.entries(sectorDemandMap).map(([name, value]) => ({ name, value }));

  // Approval rate by collaborator
  // Use deliveredBy for done tasks (who actually did the work)
  const collabMap = {};
  tasks.filter(t => t.status === 'done').forEach(t => {
    // A entrega conta para TODOS que executaram, não só para o
    // principal. O total da agência não muda: quem soma aqui é o
    // ranking por pessoa, não o número de tasks.
    const nomes = entregadoresDe(t);
    (nomes.length ? nomes : ['Desconhecido']).forEach(name => {
      if (!collabMap[name]) collabMap[name] = { name, total: 0, firstApproval: 0 };
      collabMap[name].total++;
      if (t.reworkCount === 0) collabMap[name].firstApproval++;
    });
  });
  const collabData = Object.values(collabMap)
    .map(c => ({
      name: c.name,
      'De Primeira': c.firstApproval,
      'Com Ajuste': c.total - c.firstApproval,
    }))
    .sort((a, b) => (b['De Primeira'] + b['Com Ajuste']) - (a['De Primeira'] + a['Com Ajuste']))
    .slice(0, 8);

  return (
    <div className="fade-up">
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 21, fontWeight: 500, color: 'var(--text)', letterSpacing: '-.01em', marginBottom: 4 }}>Relatórios</h1>
        <p style={{ fontSize: 13, color: 'var(--muted)' }}>Gargalos e eficiência do time</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        {/* Redo ranking */}
        <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 14, padding: '20px 22px' }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>Ranking de Refações</h2>
          <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 20 }}>Clientes que mais geram ajustes</p>
          {redoData.length === 0
            ? <p style={{ fontSize: 13, color: 'var(--muted)', textAlign: 'center', padding: '32px 0' }}>Nenhuma refação registrada.</p>
            : <ResponsiveContainer width="100%" height={260}>
                <BarChart data={redoData} layout="vertical" margin={{ left: 0, right: 16 }}>
                  <XAxis type="number" tick={{ fill: 'var(--muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="name" tick={{ fill: 'var(--text)', fontSize: 12 }} width={110} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: 'var(--surface)' }} />
                  <Bar dataKey="value" name="Refações" radius={[0,6,6,0]}>
                    {redoData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
          }
        </div>

        {/* Demand by sector */}
        <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 14, padding: '20px 22px' }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>Demanda por Setor</h2>
          <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 20 }}>Quem mais cria tasks</p>
          {pieData.length === 0
            ? <p style={{ fontSize: 13, color: 'var(--muted)', textAlign: 'center', padding: '32px 0' }}>Nenhuma task criada ainda.</p>
            : <ResponsiveContainer width="100%" height={220}>
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
                  <Legend formatter={v => <span style={{ color: 'var(--text)', fontSize: 12 }}>{v}</span>} />
                </PieChart>
              </ResponsiveContainer>
          }
        </div>
      </div>

      {/* Approval rate by collaborator */}
      <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 14, padding: '20px 22px' }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>Aprovação por Colaborador</h2>
        <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 20 }}>De primeira vs. com ajuste — baseado em quem entregou</p>
        {collabData.length === 0
          ? <p style={{ fontSize: 13, color: 'var(--muted)', textAlign: 'center', padding: '24px 0' }}>Nenhuma task concluída ainda.</p>
          : <ResponsiveContainer width="100%" height={260}>
              <BarChart data={collabData} layout="vertical" margin={{ left: 0, right: 16 }}>
                <XAxis type="number" tick={{ fill: 'var(--muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" tick={{ fill: 'var(--text)', fontSize: 12 }} width={110} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'var(--surface)' }} />
                <Bar dataKey="De Primeira" stackId="a" fill="#22c55e" radius={[0,0,0,0]} />
                <Bar dataKey="Com Ajuste"  stackId="a" fill="#EE3363" radius={[0,6,6,0]} />
                <Legend formatter={v => <span style={{ color: 'var(--text)', fontSize: 12 }}>{v}</span>} />
              </BarChart>
            </ResponsiveContainer>
        }
      </div>
    </div>
  );
}
