import React, { useState, useMemo } from 'react';
import ReactDOM from 'react-dom';
import {
  LayoutDashboard, Rocket, Activity, HeartPulse, CheckSquare, Calendar, X,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../components/shared/Toast';
import { useClients } from '../../hooks/useClients';
import { useTasks } from '../../hooks/useTasks';
import Sidebar from '../../components/shared/Sidebar';
import TodoView from '../../components/shared/TodoView';
import AgendaView from '../../components/shared/AgendaView';
import { SECTORS } from '../../lib/firebase';
import {
  computeOpsHealth, resolveClientHealth, isCritical,
  HEALTH_LEVELS_4, HEALTH_ORDER_4,
} from '../../hooks/useClientHealth';
import {
  Overlay, ModalHeader, Stat, Tag, Empty, Spinner, Section, RO,
  fmtDate, money,
  CARD, GRID, MODAL, LBL, INP, BTN_PRIMARY, BTN_GREEN, BTN_CANCEL,
} from '../../components/commercial/ui';

const COLOR = SECTORS.cs.color;

/*
 * CS OPERACIONAL — 3 abas, como no fluxograma:
 *
 *  1. Kickoff          → clientes que acabaram de sair do onboarding.
 *                        A CS confirma o kickoff realizado e o cliente
 *                        sai desta aba.
 *  2. Saúde Operacional→ farol AUTOMÁTICO por tasks em atraso:
 *                        0 verde · 1 amarelo · 2 laranja · 3+ vermelho
 *  3. Saúde do Cliente → farol MANUAL, alimentado pela CS com base no
 *                        relacionamento e nas pendências do cliente.
 */
export default function CSOperacionalDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { clients, loading, confirmKickoff, setClientHealth } = useClients();
  const { tasks } = useTasks();

  const [page, setPage] = useState('kickoff');
  const [onlyMine, setOnlyMine] = useState(false);
  const [opsFilter, setOpsFilter] = useState('all');
  const [openId, setOpenId] = useState(null);
  const [healthTarget, setHealthTarget] = useState(null);

  const me = user?.name;

  const activeClients = useMemo(
    () => clients.filter(c => c.active !== false),
    [clients]
  );

  const mineFilter = (c) => {
    if (!onlyMine) return true;
    const r = c.responsibles?.cs;
    return Array.isArray(r) ? r.includes(me) : r === me;
  };

  const kickoffPending = useMemo(
    () => activeClients.filter(c => c.kickoff?.pending),
    [activeClients]
  );

  const liveClients = useMemo(
    () => activeClients.filter(c => !c.kickoff?.pending).filter(mineFilter),
    [activeClients, onlyMine, me] // eslint-disable-line react-hooks/exhaustive-deps
  );

  const withOps = useMemo(() => liveClients
    .map(c => ({ client: c, health: computeOpsHealth(c.id, tasks) }))
    .sort((a, b) => HEALTH_ORDER_4[a.health.level] - HEALTH_ORDER_4[b.health.level]),
    [liveClients, tasks]);

  const withManual = useMemo(() => liveClients
    .map(c => ({ client: c, health: resolveClientHealth(c) }))
    .sort((a, b) => {
      const ao = a.health.level ? HEALTH_ORDER_4[a.health.level] : 9;
      const bo = b.health.level ? HEALTH_ORDER_4[b.health.level] : 9;
      return ao - bo;
    }),
    [liveClients]);

  const opsCounts = useMemo(() => {
    const c = { green: 0, yellow: 0, orange: 0, red: 0 };
    withOps.forEach(w => { c[w.health.level]++; });
    return c;
  }, [withOps]);

  const criticalCount = useMemo(
    () => liveClients.filter(c => isCritical(c, tasks)).length,
    [liveClients, tasks]
  );

  const visibleOps = opsFilter === 'all' ? withOps : withOps.filter(w => w.health.level === opsFilter);

  const openClient = openId ? liveClients.find(c => c.id === openId) || null : null;

  const NAV = [
    { key: 'kickoff',  label: 'Kickoff',           icon: Rocket,     badge: kickoffPending.length, badgeDanger: kickoffPending.length > 0 },
    { key: 'ops',      label: 'Saúde Operacional', icon: Activity,   badge: opsCounts.red, badgeDanger: opsCounts.red > 0 },
    { key: 'client',   label: 'Saúde do Cliente',  icon: HeartPulse },
    { key: 'overview', label: 'Visão Geral',       icon: LayoutDashboard },
    { key: 'todo',     label: 'Meu Dia',           icon: CheckSquare },
    { key: 'agenda',   label: 'Agenda',            icon: Calendar },
  ];

  const HEAD = {
    kickoff:  ['Clientes pendentes de Kickoff', 'Confirme quando a reunião de kickoff for realizada'],
    ops:      ['Saúde Operacional', 'Farol automático pelas tasks em atraso de cada cliente'],
    client:   ['Saúde do Cliente', 'Farol manual — relacionamento e pendências por parte do cliente'],
    overview: ['Visão Geral', 'Sua carteira em números'],
    todo:     ['Meu Dia', ''],
    agenda:   ['Agenda', ''],
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar sectorId="cs" navItems={NAV} activeKey={page} onNav={setPage} />
      <main style={{ flex: 1, marginLeft: 224, padding: 28, minHeight: '100vh', overflow: 'auto' }}>
        {loading ? <Spinner /> : (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 22, gap: 12 }}>
              <div>
                <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: `${COLOR}1a`, color: COLOR, border: `1px solid ${COLOR}40`, fontFamily: 'var(--fm)' }}>🎧 CS OPERACIONAL</span>
                <h1 style={{ fontSize: 26, fontWeight: 800, color: '#fff', letterSpacing: '-.5px', marginTop: 10, marginBottom: 4 }}>{HEAD[page][0]}</h1>
                {HEAD[page][1] && <p style={{ fontSize: 13, color: 'var(--muted)' }}>{HEAD[page][1]}</p>}
              </div>
              {['ops', 'client', 'overview'].includes(page) && (
                <button
                  onClick={() => setOnlyMine(v => !v)}
                  style={{ background: onlyMine ? `${COLOR}20` : 'var(--surface)', border: `1px solid ${onlyMine ? `${COLOR}55` : 'var(--border)'}`, borderRadius: 9, padding: '9px 14px', color: onlyMine ? COLOR : 'var(--muted)', fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}
                >
                  {onlyMine ? '✓ Meus clientes' : 'Meus clientes'}
                </button>
              )}
            </div>

            {page === 'overview' && (
              <div className="fade-up" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))', gap: 12 }}>
                <Stat label="Clientes ativos" value={liveClients.length} color={COLOR} />
                <Stat label="Saúde crítica" value={criticalCount} color={criticalCount > 0 ? '#ef4444' : 'var(--muted)'} hint="Vermelho no farol operacional ou no farol do cliente" />
                <Stat label="Pendentes de kickoff" value={kickoffPending.length} color="var(--amber)" />
                <Stat label="Em dia (operacional)" value={opsCounts.green} color="var(--green)" />
              </div>
            )}

            {page === 'kickoff' && (
              kickoffPending.length === 0
                ? <Empty msg="Nenhum kickoff pendente. ✨" />
                : (
                  <div style={GRID}>
                    {kickoffPending.map(c => (
                      <KickoffCard
                        key={c.id}
                        client={c}
                        onConfirm={async () => {
                          const r = await confirmKickoff(c.id, me);
                          if (r.success) toast(`Kickoff de ${c.name} confirmado! 🚀`);
                          else toast(r.error, 'e');
                        }}
                      />
                    ))}
                  </div>
                )
            )}

            {page === 'ops' && (
              <>
                <div style={{ display: 'flex', gap: 8, marginBottom: 18, flexWrap: 'wrap' }}>
                  <Chip active={opsFilter === 'all'} onClick={() => setOpsFilter('all')} label={`Todos (${withOps.length})`} />
                  {['red', 'orange', 'yellow', 'green'].map(l => (
                    <Chip
                      key={l}
                      active={opsFilter === l}
                      onClick={() => setOpsFilter(l)}
                      color={HEALTH_LEVELS_4[l].color}
                      label={`${HEALTH_LEVELS_4[l].emoji} ${HEALTH_LEVELS_4[l].label} (${opsCounts[l]})`}
                    />
                  ))}
                </div>
                {visibleOps.length === 0
                  ? <Empty msg="Nenhum cliente nesse filtro." />
                  : (
                    <div style={GRID}>
                      {visibleOps.map(({ client, health }) => (
                        <OpsCard key={client.id} client={client} health={health} onClick={() => setOpenId(client.id)} />
                      ))}
                    </div>
                  )}
              </>
            )}

            {page === 'client' && (
              liveClients.length === 0
                ? <Empty msg="Nenhum cliente ativo na sua visão." />
                : (
                  <div style={GRID}>
                    {withManual.map(({ client, health }) => (
                      <ClientHealthCard
                        key={client.id}
                        client={client}
                        health={health}
                        onSet={() => setHealthTarget(client)}
                      />
                    ))}
                  </div>
                )
            )}

            {page === 'todo' && <TodoView accent={COLOR} />}
            {page === 'agenda' && <AgendaView />}
          </>
        )}
      </main>

      {openClient && ReactDOM.createPortal(
        <ClientDrawer
          client={openClient}
          health={computeOpsHealth(openClient.id, tasks)}
          manual={resolveClientHealth(openClient)}
          onClose={() => setOpenId(null)}
          onSetHealth={() => { setHealthTarget(openClient); setOpenId(null); }}
        />, document.body)}

      {healthTarget && ReactDOM.createPortal(
        <ClientHealthModal
          client={healthTarget}
          onClose={() => setHealthTarget(null)}
          onSave={async (level, note) => {
            const r = await setClientHealth(healthTarget.id, level, note, me);
            if (r.success) toast(level ? 'Saúde do cliente atualizada.' : 'Marcação removida.');
            else toast(r.error, 'e');
            setHealthTarget(null);
          }}
        />, document.body)}
    </div>
  );
}

// ── Kickoff ────────────────────────────────────────────────────
function KickoffCard({ client, onConfirm }) {
  const sectors = Object.entries(client.responsibles || {}).filter(([, v]) => v && (Array.isArray(v) ? v.length : true));

  return (
    <div style={{ ...CARD, border: '1px solid var(--amber-b)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <p style={{ fontSize: 16, fontWeight: 800, color: '#fff' }}>{client.name}</p>
        <Tag text="KICKOFF PENDENTE" color="var(--amber)" />
      </div>

      {client.contactName && <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 6 }}>👤 {client.contactName}</p>}
      {client.contactPhone && <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>📞 {client.contactPhone}</p>}
      {client.onboardingCallAt && (
        <p style={{ fontSize: 11, color: '#666', fontFamily: 'var(--fm)', marginTop: 6 }}>
          Onboarding em {fmtDate(client.onboardingCallAt)}
        </p>
      )}

      {sectors.length > 0 && (
        <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
          <p style={{ fontSize: 9, letterSpacing: '.12em', color: 'var(--muted)', fontFamily: 'var(--fm)', marginBottom: 6 }}>TIME DO PROJETO</p>
          {sectors.map(([sid, v]) => (
            <div key={sid} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 3 }}>
              <span style={{ fontSize: 12, color: SECTORS[sid]?.color || 'var(--text)' }}>{SECTORS[sid]?.emoji} {SECTORS[sid]?.label || sid}</span>
              <span style={{ fontSize: 11, color: '#bbb', fontFamily: 'var(--fm)', textAlign: 'right' }}>{Array.isArray(v) ? v.join(', ') : v}</span>
            </div>
          ))}
        </div>
      )}

      <button style={{ ...BTN_GREEN, width: '100%', marginTop: 14 }} onClick={onConfirm}>
        ✓ Kickoff realizado
      </button>
    </div>
  );
}

// ── Saúde Operacional ──────────────────────────────────────────
function OpsCard({ client, health, onClick }) {
  const lv = HEALTH_LEVELS_4[health.level];
  return (
    <button onClick={onClick} style={{ ...CARD, textAlign: 'left', cursor: 'pointer', width: '100%', border: `1px solid ${lv.color}44`, position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: 3, background: lv.color }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, paddingLeft: 6 }}>
        <p style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>{client.name}</p>
        <Tag text={`${lv.emoji} ${lv.label.toUpperCase()}`} color={lv.color} />
      </div>
      <div style={{ display: 'flex', gap: 14, marginTop: 12, paddingLeft: 6 }}>
        <Mini label="Ativas" value={health.stats.active} color="var(--blue)" />
        <Mini label="Atrasadas" value={health.stats.overdue} color={health.stats.overdue > 0 ? lv.color : 'var(--muted)'} />
        <Mini label="Ajustes" value={health.stats.reworks} color={health.stats.reworks > 0 ? 'var(--amber)' : 'var(--muted)'} />
      </div>
      <p style={{ fontSize: 11, color: '#777', marginTop: 10, paddingLeft: 6, lineHeight: 1.5 }}>{health.reasons.join(' · ')}</p>
    </button>
  );
}

function Mini({ label, value, color }) {
  return (
    <div>
      <p style={{ fontSize: 9, letterSpacing: '.1em', color: 'var(--muted)', fontFamily: 'var(--fm)' }}>{label.toUpperCase()}</p>
      <p style={{ fontSize: 20, fontWeight: 800, color }}>{value}</p>
    </div>
  );
}

// ── Saúde do Cliente (manual) ──────────────────────────────────
function ClientHealthCard({ client, health, onSet }) {
  const lv = health.level ? HEALTH_LEVELS_4[health.level] : null;
  return (
    <div style={{ ...CARD, border: `1px solid ${lv ? `${lv.color}44` : 'var(--border)'}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <p style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>{client.name}</p>
        {lv
          ? <Tag text={`${lv.emoji} ${lv.label.toUpperCase()}`} color={lv.color} />
          : <Tag text="SEM AVALIAÇÃO" color="var(--muted)" />}
      </div>
      {health.note && (
        <p style={{ fontSize: 12, color: '#ddd', background: 'rgba(255,255,255,.04)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px', marginTop: 10, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
          {health.note}
        </p>
      )}
      {health.set && (
        <p style={{ fontSize: 10, color: '#555', fontFamily: 'var(--fm)', marginTop: 8 }}>
          {health.by || '—'} · {fmtDate(health.at)}
        </p>
      )}
      <button style={{ ...BTN_CANCEL, width: '100%', marginTop: 12 }} onClick={onSet}>
        {health.set ? 'Atualizar avaliação' : 'Avaliar cliente'}
      </button>
    </div>
  );
}

function ClientHealthModal({ client, onClose, onSave }) {
  const current = resolveClientHealth(client);
  const [level, setLevel] = useState(current.level || '');
  const [note, setNote] = useState(current.note || '');

  return (
    <Overlay onClose={onClose}>
      <div style={MODAL}>
        <ModalHeader title={`Saúde de ${client.name}`} onClose={onClose} />
        <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 14, lineHeight: 1.5 }}>
          Avaliação manual, baseada no relacionamento e nas pendências por parte do cliente.
          Não substitui o farol operacional (que é automático pelas tasks).
        </p>

        <p style={LBL}>NÍVEL</p>
        <div style={{ display: 'flex', gap: 6, marginTop: 8, marginBottom: 14, flexWrap: 'wrap' }}>
          {Object.values(HEALTH_LEVELS_4).map(l => (
            <button
              key={l.id}
              onClick={() => setLevel(l.id)}
              style={{ flex: '1 1 45%', padding: '10px', borderRadius: 9, fontSize: 12, fontWeight: 700, cursor: 'pointer', background: level === l.id ? `${l.color}22` : 'var(--surface)', color: level === l.id ? l.color : 'var(--muted)', border: `1px solid ${level === l.id ? `${l.color}66` : 'var(--border)'}` }}
            >
              {l.emoji} {l.label}
            </button>
          ))}
        </div>

        <p style={LBL}>OBSERVAÇÃO</p>
        <textarea
          value={note}
          onChange={e => setNote(e.target.value)}
          rows={4}
          placeholder="O que está acontecendo com esse cliente? Pendências dele, clima da relação, risco de churn..."
          style={{ ...INP, marginTop: 6, resize: 'vertical' }}
        />

        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          <button style={{ ...BTN_PRIMARY, flex: 1, opacity: level ? 1 : .5 }} disabled={!level} onClick={() => onSave(level, note)}>
            Salvar avaliação
          </button>
          {current.set && (
            <button style={BTN_CANCEL} onClick={() => onSave(null, '')}>
              <X size={13} style={{ verticalAlign: 'middle' }} /> Limpar
            </button>
          )}
        </div>
      </div>
    </Overlay>
  );
}

// ── Drawer do cliente ──────────────────────────────────────────
function ClientDrawer({ client, health, manual, onClose, onSetHealth }) {
  const lv = HEALTH_LEVELS_4[health.level];
  const mlv = manual.level ? HEALTH_LEVELS_4[manual.level] : null;
  const sectors = Object.entries(client.responsibles || {}).filter(([, v]) => v && (Array.isArray(v) ? v.length : true));

  return (
    <Overlay onClose={onClose}>
      <div style={{ ...MODAL, maxWidth: 560 }}>
        <ModalHeader title={client.name} onClose={onClose} />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 18 }}>
          <div style={{ background: `${lv.color}12`, border: `1px solid ${lv.color}40`, borderRadius: 10, padding: 12 }}>
            <p style={{ fontSize: 9, letterSpacing: '.1em', color: 'var(--muted)', fontFamily: 'var(--fm)' }}>SAÚDE OPERACIONAL</p>
            <p style={{ fontSize: 15, fontWeight: 800, color: lv.color, marginTop: 4 }}>{lv.emoji} {lv.label}</p>
          </div>
          <div style={{ background: mlv ? `${mlv.color}12` : 'var(--surface)', border: `1px solid ${mlv ? `${mlv.color}40` : 'var(--border)'}`, borderRadius: 10, padding: 12 }}>
            <p style={{ fontSize: 9, letterSpacing: '.1em', color: 'var(--muted)', fontFamily: 'var(--fm)' }}>SAÚDE DO CLIENTE</p>
            <p style={{ fontSize: 15, fontWeight: 800, color: mlv ? mlv.color : 'var(--muted)', marginTop: 4 }}>
              {mlv ? `${mlv.emoji} ${mlv.label}` : '— sem avaliação'}
            </p>
          </div>
        </div>

        <button style={{ ...BTN_CANCEL, width: '100%', marginBottom: 18 }} onClick={onSetHealth}>
          Avaliar saúde do cliente
        </button>

        {health.overdueTasks.length > 0 && (
          <Section title={`Tasks em atraso (${health.overdueTasks.length})`} color={lv.color}>
            {health.overdueTasks.map(t => (
              <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                <span style={{ fontSize: 12, color: 'var(--text)' }}>{t.name}</span>
                <span style={{ fontSize: 10, color: lv.color, fontFamily: 'var(--fm)', whiteSpace: 'nowrap' }}>
                  {t.deadline} · {t.responsibleName || '—'}
                </span>
              </div>
            ))}
          </Section>
        )}

        {sectors.length > 0 && (
          <Section title="Time do projeto" color={COLOR}>
            {sectors.map(([sid, v]) => (
              <div key={sid} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 5 }}>
                <span style={{ fontSize: 12, color: SECTORS[sid]?.color || 'var(--text)' }}>{SECTORS[sid]?.emoji} {SECTORS[sid]?.label || sid}</span>
                <span style={{ fontSize: 11, color: '#bbb', fontFamily: 'var(--fm)', textAlign: 'right' }}>{Array.isArray(v) ? v.join(', ') : v}</span>
              </div>
            ))}
          </Section>
        )}

        <Section title="Contrato" color={COLOR}>
          <RO label="Responsável" value={client.contactName} />
          <RO label="Telefone" value={client.contactPhone} />
          <RO label="E-mail" value={client.contactEmail} />
          <RO label="CNPJ" value={client.cnpj} />
          <RO label="Valor" value={client.saleTotal != null ? money(client.saleTotal) : null} />
          <RO label="Duração" value={client.contractMonths ? `${client.contractMonths} meses` : null} />
          <RO label="Kickoff" value={client.kickoff?.confirmedAt ? `realizado em ${fmtDate(client.kickoff.confirmedAt)} por ${client.kickoff.confirmedBy || '—'}` : null} />
        </Section>

        {client.briefing && (
          <Section title="Briefing" color={COLOR}>
            <p style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{client.briefing}</p>
          </Section>
        )}
      </div>
    </Overlay>
  );
}

function Chip({ active, onClick, label, color = COLOR }) {
  return (
    <button
      onClick={onClick}
      style={{ padding: '7px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer', background: active ? `${color}20` : 'var(--surface)', color: active ? color : 'var(--muted)', border: `1px solid ${active ? `${color}55` : 'var(--border)'}` }}
    >
      {label}
    </button>
  );
}
