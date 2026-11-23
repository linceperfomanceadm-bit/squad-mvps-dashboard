import React, { useState } from 'react';
import { Kpi } from '../../shared/ui';
import { Activity, AlertTriangle, RefreshCw, CheckCircle, Users, Hourglass, Trophy } from 'lucide-react';
import { WD_SERVICE_CONFIG, WD_PONTOS } from '../../../lib/firebase';
import { wdCardsOf, wdJobsOf, WD_ACTIVE_STATUSES, wdOnboardingLate, wdProducaoLate, wdRelogio, wdPausaPendente, wdPlacarDoMes } from '../../../lib/wdJobs';
import { WDDecisaoPausaModal } from './WDJobModais';

const DIA_MS = 86400000;

function StatCard({ label, value, sub, color }) {
  const tone = color === 'var(--green)' ? 'good' : color === 'var(--amber)' ? 'warn' : (color === 'var(--neon)' || color === 'var(--red)') ? 'bad' : undefined;
  return <Kpi value={value} label={label} tone={tone}>{sub ? <span style={{ fontSize: 12, color: 'var(--muted)' }}>{sub}</span> : null}</Kpi>;
}

// `clients` = clientes ativos com Web; `todosClientes` entra só no
// placar (ponto ganho não some se o cliente sair depois).
export default function WDOverview({ clients, todosClientes, collaborators, onNavigate, souLider, onDecidirPausa }) {
  const [decidindo, setDecidindo] = useState(null); // { client, job }
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

  // Mesmo relógio do card (lib/wdJobs): onboarding conta da call
  // agendada pela CS, nada antes do zeramento e pausa aprovada descontada.
  const overdueOnboarding = onboarding.filter(({ client, job }) => wdOnboardingLate(client, job));
  const overdueProduction = production.filter(({ job }) => wdProducaoLate(job));
  const late = [...overdueOnboarding, ...overdueProduction];

  // Pedidos de pausa esperando o líder.
  const pendentes = [...onboarding, ...production].filter(({ job }) => wdPausaPendente(job));

  // Placar do mês do time (mesma conta do destaque da TV).
  const placar = wdPlacarDoMes(todosClientes || clients);

  const svcCounts = {};
  Object.keys(WD_SERVICE_CONFIG).forEach(k => { svcCounts[k] = production.filter(({ job }) => job.service === k).length; });

  return (
    <div className="fade-up">
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 21, fontWeight: 500, color: 'var(--text)', letterSpacing: '-.01em', marginBottom: 4 }}>Visão Geral</h1>
        <p style={{ fontSize: 13, color: 'var(--muted)' }}>WebDesign · {collaborators.length} colaborador{collaborators.length !== 1 ? 'es' : ''}</p>
      </div>

      {souLider && pendentes.length > 0 && (
        <div style={{ ...S.box, borderColor: 'var(--amber-b)', marginBottom: 14 }}>
          <h2 style={{ ...S.boxTitle, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Hourglass size={16} color="var(--amber)" /> {pendentes.length} pedido{pendentes.length !== 1 ? 's' : ''} de pausa para responder
          </h2>
          {pendentes.map(({ key, client: c, job }) => (
            <div key={key} style={S.pedido}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{c.name} <span style={{ fontWeight: 400, color: 'var(--muted)' }}>· {WD_SERVICE_CONFIG[job.service]?.label || job.service}</span></p>
                <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{job.pausa.pedidoPor}: {job.pausa.motivo}</p>
              </div>
              <button style={S.btn} onClick={() => setDecidindo({ client: c, job })}>Responder</button>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: 14, marginBottom: 14 }}>
        <StatCard icon={Activity} label="Clientes Ativos" value={activeClients.length} sub={`Serviços: ${onboarding.length} onboarding · ${production.length} produção`} color="var(--neon)" />
        <StatCard icon={AlertTriangle} label="Em Atraso" value={late.length} sub={late.length > 0 ? 'Requerem atenção' : 'Tudo no prazo'} color={late.length > 0 ? 'var(--neon)' : 'var(--green)'} />
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
            {late.length > 0 ? <AlertTriangle size={16} color="var(--red)" /> : <CheckCircle size={16} color="var(--green)" />}
            {late.length > 0 ? `${late.length} em Atraso` : 'Sem Atrasos'}
          </h2>
          {late.length === 0
            ? <p style={{ fontSize: 13, color: 'var(--green)', textAlign: 'center', padding: '12px 0' }}>Todos os serviços estão no prazo.</p>
            : late.slice(0, 5).map(({ key, client: c, job }) => {
              const isOnb = job.status === 'onboarding';
              const r = wdRelogio(c, job);
              const days = r && r.restanteMs < 0 ? Math.max(1, Math.floor(-r.restanteMs / DIA_MS)) : 0;
              const svc = WD_SERVICE_CONFIG[job.service]?.label || job.service;
              return (
                <div key={key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 12px', borderRadius: 8, background: 'var(--red-dim)', border: '1px solid var(--red-dim)', marginBottom: 7 }}>
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{c.name}</p>
                    <p style={{ fontSize: 11, color: 'var(--muted)' }}>{isOnb ? `Onboarding · ${svc}` : `Produção · ${svc}`}</p>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--red)', background: 'var(--red-dim)', padding: '2px 8px', borderRadius: 6, fontFamily: 'var(--fm)', whiteSpace: 'nowrap' }}>{days}d{r?.pausado ? ' · pausado' : ''}</span>
                </div>
              );
            })
          }
          {late.length > 0 && <button style={{ background: 'none', border: 'none', color: 'var(--c)', fontSize: 12, fontWeight: 600, cursor: 'pointer', marginTop: 8, padding: '4px 0' }} onClick={() => onNavigate('onboarding')}>Ver todos →</button>}
        </div>
      </div>

      {/* Carga por colaborador — conta por CLIENTE: +1 para cada responsável
          marcado em algum serviço ativo dele (dois serviços não somam 2). */}
      {collaborators.filter(c => c.active !== false).length > 0 && (
        <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 18, padding: '18px 20px', boxShadow: 'var(--shadow)' }}>
          <h2 style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)', marginBottom: 4 }}>Carga e pontos do mês</h2>
          <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 16 }}>
            {WD_PONTOS.check} ponto por item do checklist marcado · {WD_PONTOS.noPrazo} por projeto finalizado no prazo · {WD_PONTOS.foraDoPrazo} fora do prazo
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))', gap: 12 }}>
            {collaborators.filter(c => c.active !== false).map(co => {
              const count = activeClients.filter(c => activeJobsOf(c).some(j => j.responsibles.includes(co.name))).length;
              const pts = placar[co.name] || { pontos: 0, checks: 0, noPrazo: 0, foraDoPrazo: 0 };
              return (
                <div key={co.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 16px' }}>
                  <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 2 }}>{co.name}</p>
                  <p style={{ fontSize: 22, fontWeight: 500, color: count > 5 ? 'var(--red)' : 'var(--text)', marginTop: 8 }}>{count}</p>
                  <p style={{ fontSize: 11, color: 'var(--muted)' }}>cliente{count !== 1 ? 's' : ''} ativo{count !== 1 ? 's' : ''}</p>
                  <div style={{ borderTop: '1px solid var(--border)', marginTop: 10, paddingTop: 10 }}>
                    <p style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 18, fontWeight: 500, color: 'var(--text)', fontFamily: 'var(--fm)' }}>
                      <Trophy size={14} color="var(--c)" /> {pts.pontos} <span style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'var(--f)' }}>pts no mês</span>
                    </p>
                    <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>{pts.checks} etapas · {pts.noPrazo} no prazo · {pts.foraDoPrazo} fora</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {decidindo && (
        <WDDecisaoPausaModal client={decidindo.client} job={decidindo.job} onClose={() => setDecidindo(null)} onDecidir={onDecidirPausa} />
      )}
    </div>
  );
}

const S = {
  box: { background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 18, padding: '18px 20px', boxShadow: 'var(--shadow)' },
  boxTitle: { fontSize: 14, fontWeight: 500, color: 'var(--text)', marginBottom: 12 },
  pedido: { display: 'flex', alignItems: 'center', gap: 12, padding: '9px 12px', borderRadius: 8, background: 'var(--bg3)', border: '1px solid var(--border)', marginTop: 7 },
  btn: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 7, padding: '6px 12px', color: 'var(--text)', fontSize: 12, fontWeight: 600, cursor: 'pointer', flexShrink: 0 },
};
