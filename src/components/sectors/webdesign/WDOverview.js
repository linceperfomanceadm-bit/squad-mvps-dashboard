import React from 'react';
import { Kpi } from '../../shared/ui';
import { differenceInDays } from 'date-fns';
import { Activity, AlertTriangle, RefreshCw, CheckCircle, Users } from 'lucide-react';
import { WD_SERVICE_CONFIG } from '../../../lib/firebase';
import { wdCardsOf, wdJobsOf, WD_ACTIVE_STATUSES } from '../../../lib/wdJobs';

function StatCard({ label, value, sub, color }) {
  const tone = color === 'var(--green)' ? 'good' : color === 'var(--amber)' ? 'warn' : (color === 'var(--neon)' || color === 'var(--red)') ? 'bad' : undefined;
  return <Kpi value={value} label={label} tone={tone}>{sub ? <span style={{ fontSize: 12, color: 'var(--muted)' }}>{sub}</span> : null}</Kpi>;
}

export default function WDOverview({ clients, collaborators, onNavigate }) {
  const now = new Date();
  // Pipeline conta por SERVIÇO; "Ativos" e a carga contam por CLIENTE.
  const cards = wdCardsOf(clients);
  const byStatus = (st) => cards.filter(k => k.job.status === st);
  const onboarding = byStatus('onboarding');
  const production = byStatus('production');
  const inactive = byStatus('inactive');
  const recurrence = byStatus('recurrence');
  const finished = byStatus('finished');
  const activeJobsOf = (c) => wdJobsOf(c).filter(j => WD_ACTIVE_STATUSES.includes(j.status));
  const activeClients = clients.filter(c => activeJobsOf(c).length > 0);

  const overdueOnboarding = onboarding.filter(({ job }) => {
    if (!job.onboardingStartedAt) return false;
    return differenceInDays(now, new Date(job.onboardingStartedAt)) > 7;
  });

  const overdueProduction = production.filter(({ job }) => {
    if (!job.productionStartedAt || !job.service) return false;
    const days = WD_SERVICE_CONFIG[job.service]?.days || 30;
    return differenceInDays(now, new Date(job.productionStartedAt)) > days;
  });

  const late = [...overdueOnboarding, ...overdueProduction];

  const svcCounts = {};
  Object.keys(WD_SERVICE_CONFIG).forEach(k => { svcCounts[k] = production.filter(({ job }) => job.service === k).length; });

  return (
    <div className="fade-up">
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 21, fontWeight: 500, color: 'var(--text)', letterSpacing: '-.01em', marginBottom: 4 }}>Visão Geral</h1>
        <p style={{ fontSize: 13, color: 'var(--muted)' }}>WebDesign · {collaborators.length} colaborador{collaborators.length !== 1 ? 'es' : ''}</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: 14, marginBottom: 14 }}>
        <StatCard icon={Activity} label="Clientes Ativos" value={activeClients.length} sub={`Serviços: ${onboarding.length} onboarding · ${production.length} produção`} color="var(--neon)" />
        <StatCard icon={AlertTriangle} label="Em Atraso" value={late.length} sub={late.length > 0 ? 'Requerem atenção' : 'Tudo no prazo ✓'} color={late.length > 0 ? 'var(--neon)' : 'var(--green)'} />
        <StatCard icon={RefreshCw} label="Recorrência" value={recurrence.length} sub="Serviços em recorrência" color="var(--purple)" />
        <StatCard icon={CheckCircle} label="Finalizados" value={finished.length} sub="Total histórico" color="var(--green)" />
        <StatCard icon={Users} label="Inativos" value={inactive.length} sub="Pausados" color="var(--amber)" />
      </div>

      {/* Production breakdown */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
        <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 18, padding: '18px 20px', boxShadow: 'var(--shadow)' }}>
          <h2 style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)', marginBottom: 16 }}>Produção por Serviço</h2>
          {production.length === 0
            ? <p style={{ fontSize: 13, color: 'var(--muted)', textAlign: 'center', padding: '12px 0' }}>Nenhum serviço em produção.</p>
            : Object.entries(WD_SERVICE_CONFIG).map(([k, v]) => {
              const count = svcCounts[k] || 0;
              const pct = production.length > 0 ? (count / production.length) * 100 : 0;
              return (
                <div key={k} style={{ marginBottom: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{v.label}</span>
                    <span style={{ fontSize: 12, color: 'var(--muted)', fontFamily: 'var(--fm)' }}>{count}</span>
                  </div>
                  <div style={{ height: 5, background: 'var(--soft)', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: 'var(--grad)', borderRadius: 3, transition: 'width .6s ease' }} />
                  </div>
                </div>
              );
            })
          }
        </div>

        {/* Late clients */}
        <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 18, padding: '18px 20px', boxShadow: 'var(--shadow)' }}>
          <h2 style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            {late.length > 0 ? <AlertTriangle size={16} color="var(--neon)" /> : '✓'}
            {late.length > 0 ? `${late.length} em Atraso` : 'Sem Atrasos'}
          </h2>
          {late.length === 0
            ? <p style={{ fontSize: 13, color: 'var(--green)', textAlign: 'center', padding: '12px 0' }}>✓ Todos os serviços estão no prazo.</p>
            : late.slice(0, 5).map(({ key, client: c, job }) => {
              const isOnb = job.status === 'onboarding';
              const startDate = isOnb ? job.onboardingStartedAt : job.productionStartedAt;
              const days = startDate ? differenceInDays(now, new Date(startDate)) : 0;
              const svc = WD_SERVICE_CONFIG[job.service]?.label || job.service;
              return (
                <div key={key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 12px', borderRadius: 8, background: 'var(--red-dim)', border: '1px solid var(--red-dim)', marginBottom: 7 }}>
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{c.name}</p>
                    <p style={{ fontSize: 11, color: 'var(--muted)' }}>{isOnb ? `Onboarding · ${svc}` : `Produção · ${svc}`}</p>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--neon)', background: 'var(--red-dim)', padding: '2px 8px', borderRadius: 6, fontFamily: 'var(--fm)', whiteSpace: 'nowrap' }}>{days}d</span>
                </div>
              );
            })
          }
          {late.length > 0 && <button style={{ background: 'none', border: 'none', color: 'var(--neon)', fontSize: 12, fontWeight: 600, cursor: 'pointer', marginTop: 8, padding: '4px 0' }} onClick={() => onNavigate('onboarding')}>Ver todos →</button>}
        </div>
      </div>

      {/* Carga por colaborador — conta por CLIENTE: +1 para cada responsável
          marcado em algum serviço ativo dele (dois serviços não somam 2). */}
      {collaborators.filter(c => c.active !== false).length > 0 && (
        <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 18, padding: '18px 20px', boxShadow: 'var(--shadow)' }}>
          <h2 style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)', marginBottom: 16 }}>Carga por Colaborador</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))', gap: 12 }}>
            {collaborators.filter(c => c.active !== false).map(co => {
              const count = activeClients.filter(c => activeJobsOf(c).some(j => j.responsibles.includes(co.name))).length;
              return (
                <div key={co.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 16px' }}>
                  <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 2 }}>{co.name}</p>
                  <p style={{ fontSize: 22, fontWeight: 500, color: count > 5 ? 'var(--neon)' : 'var(--text)', marginTop: 8 }}>{count}</p>
                  <p style={{ fontSize: 11, color: 'var(--muted)' }}>cliente{count !== 1 ? 's' : ''} ativo{count !== 1 ? 's' : ''}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
