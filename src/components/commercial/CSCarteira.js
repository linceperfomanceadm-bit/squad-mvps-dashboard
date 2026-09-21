import React, { useMemo, useState } from 'react';
import { Search, ChevronDown, ChevronUp, AlertTriangle, ClipboardCheck } from 'lucide-react';
import {
  SECTORS, TASK_COLUMNS, CLIENT_STAGES, CONTRACT_STATUS,
  stageOf, naCarteira, contractState,
} from '../../lib/firebase';
import { computeOpsHealth, resolveClientHealth, HEALTH_LEVELS_4 } from '../../hooks/useClientHealth';
import { parseLocalDate } from '../../lib/taskTime';
import { CARD, GRID, Tag, Empty, Stat, fmtDate } from './ui';
import { mesChave, entregasDoMes, resumoMes, statusGeral, cadastroPendencias } from '../../lib/entregas';
import { BarraEntrega, Aderencia } from '../entregas/EntregasKit';

const COLOR = 'var(--c)';
const asArray = (v) => (Array.isArray(v) ? v : v ? [v] : []);
const EM_ENTRADA = ['kickoff', 'staffing', 'onboarding'];

// Filtros de etapa/contrato sobre a carteira escolhida.
const STATUS_FILTERS = [
  { id: 'all',     label: 'Todos' },
  { id: 'live',    label: 'Na base' },
  { id: 'entrada', label: 'Entrando' },
  { id: 'atraso',  label: 'Com atraso' },
  { id: 'vencendo', label: 'Contrato vencendo' },
  { id: 'entregas', label: 'Entregas atrasadas' },
  { id: 'incompleto', label: 'Cadastro incompleto' },
];

// 'YYYY-MM-DD' comparado como texto — mesma regra do Kanban, sem a
// armadilha do fuso no new Date('2026-08-25').
const hojeYmd = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/*
 * CARTEIRA DE CLIENTES — visão da CS sobre quem ela atende.
 *
 * Abre na carteira de quem está logado; o seletor troca para a de
 * outra CS, para os clientes sem CS definida ou para todas. Cada card
 * junta o que antes ficava espalhado em várias abas: etapa, time do
 * projeto, os dois faróis de saúde, prazo do contrato e as tasks em
 * aberto (puxadas do Kanban em tempo real).
 *
 * Entram os clientes da base e os que ainda estão entrando (Kick Off,
 * staffing, onboarding) — a CS já é dona deles desde o cadastro.
 *
 * Entregas do contrato: cada card da base mostra o que o escopo prevê
 * no mês contra o que já foi marcado, e o selo de cadastro incompleto.
 * "Contrato e entregas" abre a ficha completa (histórico, entregas
 * únicas, completar cadastro). Foi decisão de produto deixar isso aqui
 * e não numa aba separada: é na Carteira que a CS já olha cada cliente.
 */
export default function CSCarteira({ clients, tasks, collaborators, me, onOpenClient, onOpenTask, onOpenFicha, csInicial = '__me__' }) {
  // O líder da CS abre em "Todas as CSs"; a CS, na própria carteira.
  const [csFilter, setCsFilter] = useState(csInicial);
  const [statusFilter, setStatusFilter] = useState('all');
  const [busca, setBusca] = useState('');

  const carteira = useMemo(() => clients.filter(naCarteira), [clients]);

  // Lista de CSs para o seletor: ativas no cadastro + quem aparece
  // como responsável em algum cliente (cobre quem saiu da agência e
  // ainda tem carteira para ser redistribuída).
  const csNames = useMemo(() => {
    const set = new Set(
      collaborators.filter(c => c.sector === 'cs' && c.active !== false).map(c => c.name)
    );
    carteira.forEach(c => asArray(c.responsibles?.cs).forEach(n => set.add(n)));
    set.delete(me);
    return Array.from(set).filter(Boolean).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [collaborators, carteira, me]);

  const contaCs = (nome) => carteira.filter(c => asArray(c.responsibles?.cs).includes(nome)).length;
  const semCs = carteira.filter(c => asArray(c.responsibles?.cs).length === 0).length;

  const hoje = hojeYmd();
  const mes = mesChave();

  // Enriquecimento: calculado uma vez por cliente e reaproveitado no
  // filtro, no resumo e no card.
  const itens = useMemo(() => carteira.map(c => {
    const abertas = tasks
      .filter(t => t.clientId === c.id && t.status !== 'done')
      .sort((a, b) => {
        if (!a.deadline) return 1;
        if (!b.deadline) return -1;
        return a.deadline < b.deadline ? -1 : a.deadline > b.deadline ? 1 : 0;
      });
    const atrasadas = abertas.filter(t => t.deadline && t.deadline < hoje);
    const stage = stageOf(c);
    const entregas = stage === 'live' ? entregasDoMes(c, mes) : [];
    return {
      client: c,
      stage: stageOf(c),
      abertas,
      atrasadas,
      aprovacao: abertas.filter(t => t.status === 'approval').length,
      ops: computeOpsHealth(c.id, tasks),
      manual: resolveClientHealth(c),
      contrato: contractState(c),
      entregas,
      entregasResumo: resumoMes(entregas),
      entregasStatus: statusGeral(entregas, mes),
      pendencias: stage === 'live' ? cadastroPendencias(c) : [],
    };
  }), [carteira, tasks, hoje, mes]);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return itens
      .filter(({ client }) => {
        const cs = asArray(client.responsibles?.cs);
        if (csFilter === '__me__') return cs.includes(me);
        if (csFilter === '__none__') return cs.length === 0;
        if (csFilter === '__all__') return true;
        return cs.includes(csFilter);
      })
      .filter(it => {
        if (statusFilter === 'live') return it.stage === 'live';
        if (statusFilter === 'entrada') return EM_ENTRADA.includes(it.stage);
        if (statusFilter === 'atraso') return it.atrasadas.length > 0;
        if (statusFilter === 'vencendo') return ['ending', 'expired'].includes(it.contrato.status);
        if (statusFilter === 'entregas') return ['atrasado', 'abaixo'].includes(it.entregasStatus);
        if (statusFilter === 'incompleto') return it.pendencias.length > 0;
        return true;
      })
      .filter(({ client }) => !q || (client.name || '').toLowerCase().includes(q))
      // Mais atrasadas primeiro; empate por nome.
      .sort((a, b) => (b.atrasadas.length - a.atrasadas.length)
        || (a.client.name || '').localeCompare(b.client.name || '', 'pt-BR'));
  }, [itens, csFilter, statusFilter, busca, me]);

  const resumo = useMemo(() => ({
    clientes: filtrados.length,
    abertas: filtrados.reduce((s, it) => s + it.abertas.length, 0),
    atrasadas: filtrados.reduce((s, it) => s + it.atrasadas.length, 0),
    vencendo: filtrados.filter(it => ['ending', 'expired'].includes(it.contrato.status)).length,
    combinado: filtrados.reduce((s, it) => s + it.entregasResumo.combinado, 0),
    entregue: filtrados.reduce((s, it) => s + it.entregasResumo.entregue, 0),
  }), [filtrados]);
  const pctEntregas = resumo.combinado ? Math.round((resumo.entregue / resumo.combinado) * 100) : null;

  const mostraCs = csFilter === '__all__';

  return (
    <div className="fade-up">
      {/* Filtros */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14 }}>
        <select
          value={csFilter}
          onChange={e => setCsFilter(e.target.value)}
          style={{ ...S.input, minWidth: 220, ...(csFilter !== '__me__' ? S.inputActive : null) }}
        >
          <option value="__me__">Minha carteira ({contaCs(me)})</option>
          {csNames.map(n => <option key={n} value={n}>{n} ({contaCs(n)})</option>)}
          {semCs > 0 && <option value="__none__">Sem CS definida ({semCs})</option>}
          <option value="__all__">Todas as CSs ({carteira.length})</option>
        </select>

        <div style={{ position: 'relative', flex: '1 1 200px', maxWidth: 320 }}>
          <Search size={14} color="var(--muted)" style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)' }} />
          <input
            value={busca}
            onChange={e => setBusca(e.target.value)}
            placeholder="Buscar cliente..."
            style={{ ...S.input, width: '100%', paddingLeft: 32 }}
          />
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 18 }}>
        {STATUS_FILTERS.map(f => (
          <button
            key={f.id}
            onClick={() => setStatusFilter(f.id)}
            style={{
              padding: '7px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer',
              background: statusFilter === f.id ? `color-mix(in srgb, ${COLOR} 13%, transparent)` : 'var(--surface)',
              color: statusFilter === f.id ? COLOR : 'var(--muted)',
              border: `1px solid ${statusFilter === f.id ? `color-mix(in srgb, ${COLOR} 33%, transparent)` : 'var(--border)'}`,
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Resumo da seleção */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(170px,1fr))', gap: 12, marginBottom: 18 }}>
        <Stat label="Clientes" value={resumo.clientes} color={COLOR} />
        <Stat label="Tasks em aberto" value={resumo.abertas} color="var(--blue)" />
        <Stat label="Tasks atrasadas" value={resumo.atrasadas} color={resumo.atrasadas > 0 ? 'var(--red)' : 'var(--muted)'} />
        <Stat label="Contratos vencendo" value={resumo.vencendo} color={resumo.vencendo > 0 ? 'var(--amber)' : 'var(--muted)'} />
        <Stat
          label="Entregue do combinado no mês"
          value={pctEntregas == null ? '—' : `${pctEntregas}%`}
          color={pctEntregas == null ? 'var(--muted)' : pctEntregas >= 100 ? 'var(--green)' : pctEntregas >= 70 ? 'var(--amber)' : 'var(--red)'}
        />
      </div>

      {filtrados.length === 0
        ? <Empty msg={csFilter === '__me__' ? 'Nenhum cliente na sua carteira com esse filtro.' : 'Nenhum cliente com esse filtro.'} />
        : (
          <div style={GRID}>
            {filtrados.map(it => (
              <CarteiraCard
                key={it.client.id}
                item={it}
                mostraCs={mostraCs || csFilter === '__none__'}
                hoje={hoje}
                onOpen={() => onOpenClient(it.client)}
                onOpenTask={onOpenTask}
                onOpenFicha={onOpenFicha ? () => onOpenFicha(it.client) : undefined}
                mes={mes}
              />
            ))}
          </div>
        )}
    </div>
  );
}

function CarteiraCard({ item, mostraCs, hoje, mes, onOpen, onOpenTask, onOpenFicha }) {
  const [aberto, setAberto] = useState(false);
  const { client, stage, abertas, atrasadas, aprovacao, ops, manual, contrato, entregas, entregasResumo, entregasStatus, pendencias } = item;
  const opsLv = HEALTH_LEVELS_4[ops.level];
  const manLv = manual.level ? HEALTH_LEVELS_4[manual.level] : null;
  const ctSt = CONTRACT_STATUS[contrato.status] || CONTRACT_STATUS.unknown;
  const cs = asArray(client.responsibles?.cs);
  const time = Object.entries(client.responsibles || {})
    .filter(([sid, v]) => sid !== 'cs' && asArray(v).length);
  const contato = client.contrato?.contactName || client.contactName;

  return (
    <div style={{ ...CARD, border: `1px solid ${atrasadas.length ? `color-mix(in srgb, ${opsLv.color} 30%, transparent)` : 'var(--border)'}` }}>
      <button onClick={onOpen} style={{ background: 'none', border: 'none', padding: 0, textAlign: 'left', width: '100%', cursor: 'pointer' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
          <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>{client.name}</p>
          {stage !== 'live' && (
            <Tag text={(CLIENT_STAGES[stage]?.label || stage).toUpperCase()} color={CLIENT_STAGES[stage]?.color || COLOR} />
          )}
        </div>
        {contato && <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 5 }}>👤 {contato}</p>}
        {mostraCs && (
          <p style={{ fontSize: 11, color: COLOR, fontFamily: 'var(--fm)', marginTop: 5 }}>
            🎧 {cs.length ? cs.join(', ') : 'sem CS definida'}
          </p>
        )}

        {/* Faróis */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
          <span title="Saúde operacional (automática, por tasks em atraso)" style={{ ...S.pill, color: opsLv.color, borderColor: `color-mix(in srgb, ${opsLv.color} 30%, transparent)` }}>
            {opsLv.emoji} Operação
          </span>
          <span title={manual.note || 'Saúde do cliente (manual, da CS)'} style={{ ...S.pill, color: manLv ? manLv.color : 'var(--muted)', borderColor: manLv ? `color-mix(in srgb, ${manLv.color} 30%, transparent)` : 'var(--border)' }}>
            {manLv ? `${manLv.emoji} Cliente` : '— Cliente sem avaliação'}
          </span>
        </div>

        {/* Tasks */}
        <div style={{ display: 'flex', gap: 16, marginTop: 12 }}>
          <Mini label="Abertas" value={abertas.length} color={abertas.length ? 'var(--blue)' : 'var(--muted)'} />
          <Mini label="Atrasadas" value={atrasadas.length} color={atrasadas.length ? 'var(--neon)' : 'var(--muted)'} />
          <Mini label="Aprovação" value={aprovacao} color={aprovacao ? 'var(--amber)' : 'var(--muted)'} />
        </div>

        {/* Time do projeto */}
        {time.length > 0 && (
          <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
            {time.map(([sid, v]) => (
              <div key={sid} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
                <span style={{ fontSize: 11.5, color: SECTORS[sid]?.color || 'var(--text)' }}>{SECTORS[sid]?.emoji} {SECTORS[sid]?.label || sid}</span>
                <span style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'var(--fm)', textAlign: 'right' }}>{asArray(v).join(', ')}</span>
              </div>
            ))}
          </div>
        )}

        {/* Contrato */}
        {stage === 'live' && (
          <p style={{ fontSize: 11, color: ctSt.color, fontFamily: 'var(--fm)', marginTop: 10 }}>
            📄 {ctSt.label}
            {contrato.endAt && contrato.status !== 'closed' && ` · até ${fmtDate(contrato.endAt)}`}
            {contrato.daysLeft != null && contrato.status === 'ending' && ` (${contrato.daysLeft}d)`}
          </p>
        )}

        {/* Entregas do mês (escopo do contrato) */}
        {stage === 'live' && entregas.length > 0 && (
          <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7 }}>
              <span style={{ fontSize: 11.5, color: 'var(--muted)', flex: 1 }}>Entregas do mês</span>
              <span style={{ fontSize: 11.5, fontFamily: 'var(--fm)', color: 'var(--text)' }}>{entregasResumo.entregue}/{entregasResumo.combinado}</span>
              <Aderencia pct={entregasResumo.pct} />
            </div>
            <BarraEntrega feito={entregasResumo.entregue} qtd={entregasResumo.combinado} status={entregasStatus} />
          </div>
        )}
        {pendencias.length > 0 && (
          <p style={{ fontSize: 11, color: 'var(--amber)', marginTop: 10, lineHeight: 1.45 }}>
            Cadastro incompleto · falta {pendencias.length} {pendencias.length === 1 ? 'item' : 'itens'}
          </p>
        )}
      </button>

      {stage === 'live' && onOpenFicha && (
        <button onClick={onOpenFicha} style={{ ...S.toggle, color: pendencias.length ? 'var(--c)' : 'var(--muted)', borderColor: pendencias.length ? 'var(--c-border)' : 'var(--border)' }}>
          <ClipboardCheck size={13} />
          {pendencias.length ? 'Completar cadastro e ver entregas' : 'Contrato e entregas'}
        </button>
      )}

      {abertas.length > 0 && (
        <button onClick={() => setAberto(v => !v)} style={S.toggle}>
          {aberto ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          {aberto ? 'Esconder tasks' : `Ver tasks em aberto (${abertas.length})`}
        </button>
      )}

      {aberto && (
        <div style={{ marginTop: 8 }} className="fade-in">
          {abertas.map(t => {
            const col = TASK_COLUMNS.find(c => c.id === t.status);
            const atrasada = t.deadline && t.deadline < hoje;
            const prazo = t.deadline ? parseLocalDate(t.deadline) : null;
            return (
              <button key={t.id} onClick={() => onOpenTask(t.id)} style={S.taskRow}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <p style={{ fontSize: 12, color: 'var(--text)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {t.isRework && <span style={{ color: 'var(--amber)' }}>🔄 </span>}{t.name}
                  </p>
                  <p style={{ fontSize: 10.5, color: 'var(--muted)', marginTop: 2 }}>
                    <span style={{ color: col?.color }}>{col?.label || t.status}</span>
                    {' · '}{t.responsibleName || '—'}
                  </p>
                </div>
                <span style={{ fontSize: 10.5, fontFamily: 'var(--fm)', color: atrasada ? 'var(--neon)' : 'var(--muted)', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 3 }}>
                  {atrasada && <AlertTriangle size={10} />}
                  {prazo ? prazo.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : 'sem prazo'}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Mini({ label, value, color }) {
  return (
    <div>
      <p style={{ fontSize: 9, letterSpacing: '.1em', color: 'var(--muted)', fontFamily: 'var(--fm)' }}>{label.toUpperCase()}</p>
      <p style={{ fontSize: 19, fontWeight: 600, color }}>{value}</p>
    </div>
  );
}

const S = {
  input: {
    background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 9,
    padding: '9px 13px', color: 'var(--text)', fontSize: 13, outline: 'none', fontFamily: 'var(--f)',
  },
  inputActive: { borderColor: 'var(--c)', background: 'var(--c-dim)', fontWeight: 600 },
  pill: {
    fontSize: 10.5, fontWeight: 600, padding: '3px 9px', borderRadius: 20,
    border: '1px solid var(--border)', background: 'var(--surface)', fontFamily: 'var(--fm)',
  },
  toggle: {
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, width: '100%',
    marginTop: 12, padding: '8px', borderRadius: 9, background: 'var(--surface)',
    border: '1px solid var(--border)', color: 'var(--muted)', fontSize: 11.5, fontWeight: 600, cursor: 'pointer',
  },
  taskRow: {
    display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left',
    padding: '8px 10px', marginBottom: 5, borderRadius: 8, cursor: 'pointer',
    background: 'var(--bg3)', border: '1px solid var(--border)',
  },
};
