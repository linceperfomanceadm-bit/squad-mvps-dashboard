import React from 'react';
import { Kpi } from '../../shared/ui';
import { differenceInDays } from 'date-fns';
import { Activity, AlertTriangle, RefreshCw, CheckCircle, Users } from 'lucide-react';
import { WD_SERVICE_CONFIG } from '../../../lib/firebase';

function StatCard({ label, value, sub, color }) {
  const tone = color === 'var(--green)' ? 'good' : color === 'var(--amber)' ? 'warn' : (color === 'var(--neon)' || color === 'var(--red)') ? 'bad' : undefined;
  return <Kpi value={value} label={label} tone={tone}>{sub ? <span style={{ fontSize: 12, color: 'var(--muted)' }}>{sub}</span> : null}</Kpi>;
}

export default function WDOverview({ clients, collaborators, onNavigate }) {
  const now = new Date();
  const onboarding = clients.filter(c => c.wd?.status === 'onboarding');
  const production = clients.filter(c => c.wd?.status === 'production');
  const inactive = clients.filter(c => c.wd?.status === 'inactive');
  const recurrence = clients.filter(c => c.wd?.status === 'recurrence');
  const finished = clients.filter(c => c.wd?.status === 'finished');
  const active = [...onboarding, ...production];

  const overdueOnboarding = onboarding.filter(c => {
    if (!c.wd.onboardingStartedAt) return false;
    return differenceInDays(now, new Date(c.wd.onboardingStartedAt)) > 7;
  });

  const overdueProduction = production.filter(c => {
    if (!c.wd.productionStartedAt || !c.wd.service) return false;
    const days = WD_SERVICE_CONFIG[c.wd.service]?.days || 30;
    return differenceInDays(now, new Date(c.wd.productionStartedAt)) > days;
  });

  const late = [...overdueOnboarding, ...overdueProduction];

  const svcCounts = {};
  Object.keys(WD_SERVICE_CONFIG).forEach(k => { svcCounts[k] = production.filter(c => c.wd.service === k).length; });

  return (
    <div className="fade-up">
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 21, fontWeight: 500, color: 'var(--text)', letterSpacing: '-.01em', marginBottom: 4 }}>Visão Geral</h1>
        <p style={{ fontSize: 13, color: 'var(--muted)' }}>WebDesign · {collaborators.length} colaborador{collaborators.length !== 1 ? 'es' : ''}</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: 14, marginBottom: 14 }}>
        <StatCard icon={Activity} label="Ativos" value={active.length} sub={`${onboarding.length} onboarding · ${production.length} produção`} color="var(--neon)" />
        <StatCard icon={AlertTriangle} label="Em Atraso" value={late.length} sub={late.length > 0 ? 'Requerem atenção' : 'Tudo no prazo ✓'} color={late.length > 0 ? 'var(--neon)' : 'var(--green)'} />
        <StatCard icon={RefreshCw} label="Recorrência" value={recurrence.length} sub="Contratos ativos" color="var(--purple)" />
        <StatCard icon={CheckCircle} label="Finalizados" value={finished.length} sub="Total histórico" color="var(--green)" />
        <StatCard icon={Users} label="Inativos" value={inactive.length} sub="Pausados" color="var(--amber)" />
      </div>

      {/* Production breakdown */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
        <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 18, padding: '18px 20px', boxShadow: 'var(--shadow)' }}>
          <h2 style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)', marginBottom: 16 }}>Produção por Serviço</h2>
          {production.length === 0
            ? <p style={{ fontSize: 13, color: 'var(--muted)', textAlign: 'center', padding: '12px 0' }}>Nenhum cliente em produção.</p>
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
            ? <p style={{ fontSize: 13, color: 'var(--green)', textAlign: 'center', padding: '12px 0' }}>✓ Todos os clientes estão no prazo.</p>
            : late.slice(0, 5).map(c => {
              const isOnb = c.wd.status === 'onboarding';
              const startDate = isOnb ? c.wd.onboardingStartedAt : c.wd.productionStartedAt;
              const days = startDate ? differenceInDays(now, new Date(startDate)) : 0;
              return (
                <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 12px', borderRadius: 8, background: 'var(--red-dim)', border: '1px solid var(--red-dim)', marginBottom: 7 }}>
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{c.name}</p>
                    <p style={{ fontSize: 11, color: 'var(--muted)' }}>{isOnb ? 'Onboarding' : `Produção · ${WD_SERVICE_CONFIG[c.wd.service]?.label}`}</p>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--neon)', background: 'var(--red-dim)', padding: '2px 8px', borderRadius: 6, fontFamily: 'var(--fm)', whiteSpace: 'nowrap' }}>{days}d</span>
                </div>
              );
            })
          }
          {late.length > 0 && <button style={{ background: 'none', border: 'none', color: 'var(--neon)', fontSize: 12, fontWeight: 600, cursor: 'pointer', marginTop: 8, padding: '4px 0' }} onClick={() => onNavigate('onboarding')}>Ver todos →</button>}
        </div>
      </div>

      {/* Collaborator workload */}
      {collaborators.filter(c => c.active).length > 0 && (
        <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 18, padding: '18px 20px', boxShadow: 'var(--shadow)' }}>
          <h2 style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)', marginBottom: 16 }}>Carga por Colaborador</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))', gap: 12 }}>
            {collaborators.filter(c => c.active).map(co => {
              const count = active.filter(c => c.responsibles?.webdesign === co.name).length;
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
