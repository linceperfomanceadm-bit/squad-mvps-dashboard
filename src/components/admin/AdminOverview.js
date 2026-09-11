import React from 'react';
import { differenceInDays, subDays, startOfWeek } from 'date-fns';
import { Target, CheckCircle2, XCircle, Users, LayoutGrid, Package, AlertTriangle } from 'lucide-react';
import { SECTORS, stageOf, WD_SERVICE_CONFIG } from '../../lib/firebase';
import { wdCardsOf } from '../../lib/wdJobs';
import { PageHeader, Card, Grid, Kpi, Breakdown, MiniBars, Goal, Pills, Trio, Tag, Row } from '../shared/ui';

// ─── Visão Geral do Admin (Layout 01) ─────────────────────────
// Tudo calculado das coleções ao vivo. Cor só onde é informação:
// verde/vermelho para variação e alerta; a cor do painel (--c)
// no destaque dos gráficos.

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const toDate = (v) => (v?.toDate ? v.toDate() : v ? new Date(v) : null);
const sameMonth = (d, ref) => d && d.getMonth() === ref.getMonth() && d.getFullYear() === ref.getFullYear();
const pct = (a, b) => (b > 0 ? Math.round((a / b) * 100) : 0);
const deltaOf = (cur, prev) => {
  if (prev === 0 && cur === 0) return null;
  if (prev === 0) return { text: `▲ ${cur}`, tone: 'up' };
  const d = cur - prev;
  if (d === 0) return { text: '= mês anterior', tone: 'neutral' };
  return { text: `${d > 0 ? '▲' : '▼'} ${Math.abs(d)}`, tone: d > 0 ? 'up' : 'down' };
};

export default function AdminOverview({ clients = [], collaborators = [], tasks = [], onNavigate }) {
  const now = new Date();
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const active = clients.filter(c => c.active !== false);

  // ── tasks ──
  const done = tasks.filter(t => t.status === 'done');
  const doneThis = done.filter(t => sameMonth(toDate(t.completedAt || t.createdAt), now));
  const doneLast = done.filter(t => sameMonth(toDate(t.completedAt || t.createdAt), lastMonth));
  const firstApproval = done.filter(t => !t.reworkCount);
  const approvalRate = pct(firstApproval.length, done.length);
  const approvalLast = pct(doneLast.filter(t => !t.reworkCount).length, doneLast.length);
  const approval = tasks.filter(t => t.status === 'approval');
  const doing = tasks.filter(t => t.status === 'doing');
  const rework = tasks.filter(t => t.isRework && t.status !== 'done');
  const dueSoon = approval.filter(t => {
    const d = toDate(t.deadline);
    return d && differenceInDays(d, now) <= 2;
  });

  // aprovação de primeira nas últimas 8 semanas
  const weeks = Array.from({ length: 8 }, (_, i) => {
    const start = startOfWeek(subDays(now, (7 - i) * 7), { weekStartsOn: 1 });
    const end = subDays(startOfWeek(subDays(now, (6 - i) * 7), { weekStartsOn: 1 }), 0);
    const w = done.filter(t => { const d = toDate(t.completedAt); return d && d >= start && d < end; });
    return w.length ? w.filter(t => !t.reworkCount).length / w.length : 0;
  });

  // entregas por setor (mês)
  const bySector = Object.values(SECTORS).map(s => ({
    label: s.label, id: s.id,
    value: doneThis.filter(t => (t.deliveredBySector || t.responsibleSector) === s.id).length,
  }));
  const top4 = [...bySector].sort((a, b) => b.value - a.value);
  const breakdown = [...top4.slice(0, 3).map(s => [s.label, s.value]), ['Outros', top4.slice(3).reduce((a, s) => a + s.value, 0)]];

  // ── clientes ──
  // Ordem real do ciclo desde o lote 2: Kick Off vem antes do staffing.
  const stages = ['kickoff', 'staffing', 'onboarding', 'live'].map(k => ({ k, n: active.filter(c => stageOf(c) === k).length }));
  const newWeek = active.filter(c => { const d = toDate(c.createdAt); return d && differenceInDays(now, d) < 7; }).length;
  const newMonth = active.filter(c => sameMonth(toDate(c.createdAt), now)).length;

  // ── time ──
  const team = collaborators.filter(c => c.active !== false);
  const heroes = Object.values(SECTORS).filter(s => doneThis.some(t => (t.deliveredBySector || t.responsibleSector) === s.id));

  // ── alertas ──
  // Um alerta por serviço de Web (o cliente pode ter mais de um).
  const wdOverdue = wdCardsOf(active).filter(({ job }) => job.status === 'onboarding' && job.onboardingStartedAt && differenceInDays(now, toDate(job.onboardingStartedAt)) > 7);
  const staffing = active.filter(c => stageOf(c) === 'staffing');
  const alerts = [
    rework.length > 0 && { key: 'rework', title: `${rework.length} task${rework.length > 1 ? 's' : ''} em ajuste/refação`, sub: 'Kanban', tone: 'bad', go: 'kanban' },
    staffing.length > 0 && { key: 'staff', title: `${staffing.length} cliente${staffing.length > 1 ? 's' : ''} aguardando responsáveis`, sub: 'Onboarding · staffing', tone: 'warn', go: 'onboarding' },
    ...wdOverdue.map(({ key, client: c, job }) => ({ key, title: c.name, sub: `WebDesign · ${WD_SERVICE_CONFIG[job.service]?.label || job.service} · onboarding há ${differenceInDays(now, toDate(job.onboardingStartedAt))} dias`, tone: 'warn', go: 'clients' })),
  ].filter(Boolean);

  const dEntregas = deltaOf(doneThis.length, doneLast.length);
  const dAprov = doneLast.length ? deltaOf(approvalRate, approvalLast) : null;

  return (
    <div className="fade-up">
      <PageHeader title="Visão Geral da Agência" sub={`Painel Admin · ${MESES[now.getMonth()]}`} />

      <Grid cols={4}>
        <Kpi value={doneThis.length} label="Entregas no mês" delta={dEntregas?.text} deltaTone={dEntregas?.tone}>
          <Breakdown rows={breakdown} />
        </Kpi>
        <Kpi value={`${approvalRate}%`} label="Aprovação de primeira" delta={dAprov ? `${dAprov.text}${dAprov.tone !== 'neutral' ? ' pts' : ''}` : null} deltaTone={dAprov?.tone}>
          <MiniBars values={weeks} />
        </Kpi>
        <Kpi value={approval.length} label="Aguardando aprovação" tone={approval.length > 0 ? 'warn' : undefined}>
          <Goal pct={approval.length ? (dueSoon.length / approval.length) * 100 : 0}>
            <b style={{ color: 'var(--text)', fontWeight: 500 }}>{dueSoon.length}</b> {dueSoon.length === 1 ? 'vence' : 'vencem'} nas próximas 48h
          </Goal>
        </Kpi>
        <Kpi value={team.length} label="Colaboradores ativos">
          <p style={{ color: 'var(--muted)', fontSize: 12 }}>Setores com entrega no mês</p>
          <div style={{ display: 'flex', alignItems: 'center', marginTop: 10 }}>
            {heroes.slice(0, 5).map((s, i) => (
              <span key={s.id} title={s.label} style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--bg4)', border: '2px solid var(--bg2)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginLeft: i ? -8 : 0, overflow: 'hidden' }}>
                <img src={s.logo} alt={s.label} style={{ width: 22, height: 22, objectFit: 'contain' }} />
              </span>
            ))}
            {heroes.length === 0 && <span style={{ fontSize: 12, color: 'var(--dim)' }}>Nenhuma entrega ainda</span>}
          </div>
        </Kpi>
      </Grid>

      {alerts.length > 0 && (
        <Card title={<><AlertTriangle size={14} color="var(--red)" /> Alertas</>} style={{ marginBottom: 14 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
            {alerts.map(a => (
              <Row key={a.key} title={a.title} sub={a.sub} onClick={onNavigate ? () => onNavigate(a.go) : undefined}
                right={<Tag tone={a.tone}>{a.tone === 'bad' ? 'ação' : 'atenção'}</Tag>} />
            ))}
          </div>
        </Card>
      )}

      <Grid cols="1fr 2fr">
        <Card title="Clientes ativos">
          <div style={{ fontSize: 38, fontWeight: 500, letterSpacing: '-.02em', lineHeight: 1, marginTop: 10, color: 'var(--text)' }}>{active.length}</div>
          <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[['Novos na semana', newWeek], ['Novos no mês', newMonth]].map(([l, v]) => (
              <div key={l} style={{ display: 'flex', justifyContent: 'space-between', background: 'var(--bg3)', borderRadius: 10, padding: '9px 12px', fontSize: 12, color: 'var(--muted)' }}>
                <span>{l}</span><b style={{ fontFamily: 'var(--fm)', fontSize: 11, color: v > 0 ? 'var(--green)' : 'var(--muted)' }}>{v > 0 ? `▲ ${v}` : '—'}</b>
              </div>
            ))}
          </div>
        </Card>
        <Card title="Ciclo de vida" sub="kick off → staffing → onboarding → live">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', marginTop: 14 }}>
            {stages.map((s, i) => (
              <div key={s.k} style={{ padding: '6px 18px 4px 0', borderRight: i < 3 ? '1px solid var(--border)' : 'none', marginRight: i < 3 ? 18 : 0 }}>
                <div style={{ color: 'var(--muted)', fontSize: 12, textTransform: 'capitalize' }}>{s.k === 'kickoff' ? 'Kick Off' : s.k}</div>
                <b style={{ display: 'block', fontSize: 26, fontWeight: 500, marginTop: 8, color: s.k === 'staffing' && s.n > 0 ? 'var(--amber)' : 'var(--text)' }}>{s.n}</b>
                <div style={{ marginTop: 10 }}>
                  <Tag tone={s.k === 'live' ? 'good' : s.k === 'staffing' && s.n > 0 ? 'warn' : undefined}>{pct(s.n, active.length)}% da carteira</Tag>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </Grid>

      <Grid cols="1.55fr 1fr" style={{ marginBottom: 0 }}>
        <Card title="Entregas por setor" sub="no mês">
          <Pills rows={bySector} />
        </Card>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Card title="Tasks">
            <Trio items={[
              { icon: Target, label: 'Em produção', value: doing.length, color: 'var(--purple)' },
              { icon: CheckCircle2, label: 'Aprovadas', value: done.length, color: 'var(--green)' },
              { icon: XCircle, label: 'Refação', value: rework.length, color: rework.length ? 'var(--red)' : 'var(--muted)' },
            ]} />
          </Card>
          <Card title="Time">
            <Trio items={[
              { icon: Users, label: 'Colaboradores', value: team.length, color: 'var(--purple)' },
              { icon: LayoutGrid, label: 'Clientes', value: active.length, color: 'var(--blue)' },
              { icon: Package, label: 'Setores', value: Object.keys(SECTORS).length, color: 'var(--c)' },
            ]} />
          </Card>
        </div>
      </Grid>
    </div>
  );
}
