import React from 'react';
import { differenceInDays } from 'date-fns';
import { Activity, TrendingUp, Calendar, AlertTriangle, Users } from 'lucide-react';
import { SECTORS } from '../../lib/firebase';

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

export default function AdminOverview({ clients, collaborators, onNavigate }) {
  const now = new Date();
  const thisMonth = now.getMonth();
  const thisYear = now.getFullYear();

  const allDeliveries = [];
  clients.forEach(c => {
    (c.design?.deliveries || []).forEach(d => allDeliveries.push({ ...d, sector: 'design' }));
    (c.video?.deliveries || []).forEach(d => allDeliveries.push({ ...d, sector: 'video' }));
  });
  const monthDeliveries = allDeliveries.filter(d => {
    const date = new Date(d.deliveryDate || d.createdAt);
    return date.getMonth() === thisMonth && date.getFullYear() === thisYear;
  });
  const firstApproval = allDeliveries.filter(d => d.approvalStatus === 'first');
  const globalApprovalRate = allDeliveries.length > 0 ? Math.round((firstApproval.length / allDeliveries.length) * 100) : 0;

  const allPosts = [];
  clients.forEach(c => (c.sm?.posts || []).forEach(p => allPosts.push({ ...p, clientName: c.name })));
  const publishedPosts = allPosts.filter(p => p.status === 'published' || p.status === 'scheduled');

  const wdClients = clients.filter(c => c.wd?.status);
  const overdueOnboarding = wdClients.filter(c => {
    if (c.wd.status !== 'onboarding' || !c.wd.onboardingStartedAt) return false;
    return differenceInDays(now, new Date(c.wd.onboardingStartedAt)) > 7;
  });

  const stuckPosts = allPosts.filter(p => {
    if (p.status !== 'client') return false;
    return differenceInDays(now, new Date(p.updatedAt || p.createdAt)) >= 3;
  });

  const sectorData = Object.values(SECTORS).map(s => {
    const collabCount = collaborators.filter(c => c.sector === s.id && c.active).length;
    const clientCount = clients.filter(c => {
      if (s.id === 'webdesign')   return c.wd?.status && c.wd.status !== 'finished' && c.wd.status !== 'inactive';
      if (s.id === 'socialmedia') return (c.sm?.posts || []).length > 0;
      if (s.id === 'design')      return (c.design?.deliveries || []).length > 0;
      if (s.id === 'videomaker')  return (c.video?.deliveries || []).length > 0;
      return false;
    }).length;
    return { ...s, collabCount, clientCount };
  });

  return (
    <div className="fade-up">
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, color: '#fff', letterSpacing: '-.5px', marginBottom: 4 }}>Visão Geral da Agência</h1>
        <p style={{ fontSize: 13, color: 'var(--muted)' }}>Painel Admin · mês atual</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(210px,1fr))', gap: 12, marginBottom: 20 }}>
        <StatCard icon={Activity}      label="Entregas (Criação)"          value={monthDeliveries.length}    sub="Design + VideoMaker"  color="var(--neon)" />
        <StatCard icon={TrendingUp}    label="Taxa de Aprovação Global"     value={`${globalApprovalRate}%`}  sub="De primeira"          color={globalApprovalRate >= 70 ? 'var(--green)' : globalApprovalRate >= 40 ? 'var(--amber)' : 'var(--neon)'} />
        <StatCard icon={Calendar}      label="Posts Publicados/Agendados"   value={publishedPosts.length}     sub="Social Media"         color="var(--blue)" />
        <StatCard icon={AlertTriangle} label="Onboardings em Atraso"        value={overdueOnboarding.length}  sub="WebDesign"            color={overdueOnboarding.length > 0 ? 'var(--neon)' : 'var(--green)'} />
        <StatCard icon={Users}         label="Time Ativo"                   value={collaborators.filter(c => c.active).length} sub="Colaboradores" color="var(--purple)" />
      </div>

      {(overdueOnboarding.length > 0 || stuckPosts.length > 0) && (
        <div style={{ background: 'rgba(238,51,99,.06)', border: '1px solid rgba(238,51,99,.2)', borderRadius: 14, padding: '16px 20px', marginBottom: 20 }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--neon)', marginBottom: 12 }}>⚠ Alertas</p>
          {overdueOnboarding.map(c => (
            <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,.05)' }}>
              <div>
                <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{c.name}</p>
                <p style={{ fontSize: 11, color: 'var(--muted)' }}>WebDesign · Onboarding em atraso</p>
              </div>
              <span style={{ fontSize: 11, color: 'var(--neon)', background: 'rgba(238,51,99,.12)', padding: '2px 8px', borderRadius: 6, fontFamily: 'var(--fm)', fontWeight: 600 }}>
                {differenceInDays(now, new Date(c.wd.onboardingStartedAt))}d
              </span>
            </div>
          ))}
          {stuckPosts.map(p => (
            <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,.05)' }}>
              <div>
                <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{p.name}</p>
                <p style={{ fontSize: 11, color: 'var(--muted)' }}>Social Media · {p.clientName} · travado com cliente</p>
              </div>
              <span style={{ fontSize: 11, color: 'var(--amber)', background: 'rgba(245,158,11,.12)', padding: '2px 8px', borderRadius: 6, fontFamily: 'var(--fm)', fontWeight: 600 }}>
                +{differenceInDays(now, new Date(p.updatedAt || p.createdAt))}d
              </span>
            </div>
          ))}
        </div>
      )}

      <div style={{ background: 'rgba(12,12,24,.88)', border: '1px solid var(--border)', borderRadius: 14, padding: '20px 22px' }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 16 }}>Setores</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: 12 }}>
          {sectorData.map(s => (
            <div key={s.id} style={{ background: `${s.color}08`, border: `1px solid ${s.color}25`, borderRadius: 12, padding: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <span style={{ fontSize: 20 }}>{s.emoji}</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: s.color }}>{s.label}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <div>
                  <p style={{ fontSize: 22, fontWeight: 800, color: '#fff' }}>{s.collabCount}</p>
                  <p style={{ fontSize: 11, color: 'var(--muted)' }}>colaboradores</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ fontSize: 22, fontWeight: 800, color: '#fff' }}>{s.clientCount}</p>
                  <p style={{ fontSize: 11, color: 'var(--muted)' }}>clientes ativos</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
