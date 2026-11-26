import React, { useMemo, useState } from 'react';
import {
  Search, ShoppingBag, AlertTriangle, CheckCircle2, CalendarDays, PauseCircle, Archive,
  ClipboardCheck, ListChecks, FileText, ArrowRight,
} from 'lucide-react';
import {
  SECTORS, TASK_COLUMNS, CLIENT_STAGES, CLIENTE_FORA, CADASTRO_PENDENCIAS,
  stageOf, naCarteira, isInativo, situacaoFora, onboardingAgendado, contractState, temTiktokShop, sectorTheme,
} from '../../lib/firebase';
import { SeloTiktokShop, bordaTiktok, Faixa } from '../shared/ui';
import { useTheme } from '../../contexts/ThemeContext';
import { resolveClientHealth, HEALTH_LEVELS_4 } from '../../hooks/useClientHealth';
import { parseLocalDate } from '../../lib/taskTime';
import { GRID, Empty, fmtDate } from './ui';
import { mesChave, entregasDoMes, resumoMes, cadastroPendencias } from '../../lib/entregas';
import { Gaveta, BotaoFechar, JANELA, Sigla } from '../planejamento/kit';

const COLOR = 'var(--c)';
const asArray = (v) => (Array.isArray(v) ? v : v ? [v] : []);
const EM_ENTRADA = ['kickoff', 'staffing', 'onboarding'];

// Filtros de etapa/contrato sobre a carteira escolhida. Os de saída
// (pausados e encerrados) ficam à parte: são os únicos que mostram quem
// saiu da base — "Todos" é a carteira ativa (base + entrando).
const STATUS_FILTERS = [
  { id: 'all',     label: 'Todos' },
  { id: 'live',    label: 'Na base' },
  { id: 'entrada', label: 'Entrando' },
  { id: 'atraso',  label: 'Com atraso' },
  { id: 'vencendo', label: 'Contrato vencendo' },
  { id: 'incompleto', label: 'Cadastro incompleto' },
];
const FORA_FILTERS = Object.values(CLIENTE_FORA).map(f => ({ id: f.id, label: f.plural }));

// Avatares da equipe que cabem no rodapé do card; o resto vira "+N".
const MAX_AVATARES = 6;

// 'YYYY-MM-DD' comparado como texto — mesma regra do Kanban, sem a
// armadilha do fuso no new Date('2026-08-25').
const hojeYmd = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// "Casa Aurora" → "CA"; nome de uma palavra só → duas primeiras letras.
const siglaDe = (nome = '') => {
  const partes = String(nome).trim().split(/\s+/).filter(Boolean);
  if (!partes.length) return '?';
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[1][0]).toUpperCase();
};

// "03/12 às 14:00" — data e hora de call, sem o ano.
const quando = (iso) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} às ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
};

const plural = (n, um, varios) => (n === 1 ? um : varios);

/*
 * Linha de aviso do card — uma só, sempre no mesmo lugar.
 *
 * Junta o que antes ficava espalhado (farol de operação, contrato,
 * cadastro incompleto, etapa de entrada) numa frase, pintada pelo item
 * mais grave: vermelho para atraso e contrato vencido, âmbar para o que
 * pede ação, neutro para informação. Sem nada a apontar, "Tudo em dia".
 * A saúde operacional (que é só a contagem de atrasadas) aparece aqui e
 * no contador de atrasadas, não num selo próprio.
 */
const AVISO = {
  ok:        { cor: 'var(--muted)', fundo: 'var(--bg3)',       Icone: CheckCircle2 },
  info:      { cor: 'var(--muted)', fundo: 'var(--bg3)',       Icone: CalendarDays },
  atencao:   { cor: 'var(--amber)', fundo: 'var(--amber-dim)', Icone: AlertTriangle },
  erro:      { cor: 'var(--red)',   fundo: 'var(--red-dim)',   Icone: AlertTriangle },
  pausado:   { cor: 'var(--amber)', fundo: 'var(--amber-dim)', Icone: PauseCircle },
  encerrado: { cor: 'var(--muted)', fundo: 'var(--bg3)',       Icone: Archive },
};
const PESO = { info: 1, atencao: 2, erro: 3 };

function avisoDo({ client, stage, fora, atrasadas, contrato, pendencias, vagas }) {
  if (fora) {
    const cfg = CLIENTE_FORA[fora];
    return { tipo: fora, texto: [`${cfg.desde} ${fmtDate(client.inativo.at)}`, client.inativo.motivo].filter(Boolean).join(' · ') };
  }
  const itens = [];
  if (atrasadas.length) itens.push(['erro', `${atrasadas.length} ${plural(atrasadas.length, 'task atrasada', 'tasks atrasadas')}`]);
  if (stage === 'live') {
    if (contrato.status === 'expired') itens.push(['erro', 'contrato com prazo vencido']);
    else if (contrato.status === 'ending') {
      const d = contrato.daysLeft;
      itens.push(['atencao', d <= 0 ? 'contrato vence hoje' : `contrato vence em ${d} ${plural(d, 'dia', 'dias')}`]);
    }
    if (pendencias.length) {
      itens.push(['atencao', `cadastro incompleto · falta ${pendencias.map(p => (CADASTRO_PENDENCIAS[p]?.label || p).toLowerCase()).join(', ')}`]);
    }
  } else {
    if (vagas.length) itens.push(['atencao', `falta indicar ${vagas.map(sid => SECTORS[sid]?.label || sid).join(', ')}`]);
    if (stage === 'kickoff') {
      itens.push(client.kickoffCall?.at ? ['info', `Kick Off · ${quando(client.kickoffCall.at)}`] : ['atencao', 'agendar o Kick Off']);
    } else {
      itens.push(onboardingAgendado(client) ? ['info', `call de onboarding · ${quando(client.kickoff.at)}`] : ['atencao', 'agendar a call de onboarding']);
    }
  }
  if (!itens.length) return { tipo: 'ok', texto: 'Tudo em dia' };
  const pior = itens.reduce((m, [t]) => (PESO[t] > PESO[m] ? t : m), 'info');
  const texto = itens.map(([, t]) => t).join(' · ');
  return { tipo: pior, texto: texto.charAt(0).toUpperCase() + texto.slice(1) };
}

// Rodapé: o prazo do contrato em poucas letras.
function contratoDo({ stage, fora, contrato: ct }) {
  const neutro = 'var(--muted)';
  if (fora === 'encerrado' || ct.status === 'closed') return { txt: 'encerrado', cor: neutro };
  if (stage !== 'live') {
    // Em entrada o relógio ainda não começou: mostra a duração vendida.
    const m = ct.baseMonths;
    return { txt: m ? `${m} ${plural(m, 'mês', 'meses')}` : 'sem prazo', cor: neutro };
  }
  if (!ct.endAt) return { txt: 'sem prazo', cor: neutro };
  if (ct.status === 'expired') return { txt: `venceu ${fmtDate(ct.endAt)}`, cor: 'var(--red)' };
  if (ct.status === 'ending') return { txt: `vence ${fmtDate(ct.endAt)}`, cor: 'var(--amber)' };
  return { txt: `até ${fmtDate(ct.endAt)}`, cor: neutro };
}

/*
 * CARTEIRA DE CLIENTES — visão da CS sobre quem ela atende.
 *
 * Abre na carteira de quem está logado; o seletor troca para a de
 * outra CS, para os clientes sem CS definida ou para todas. Entram os
 * clientes da base e os que ainda estão entrando (Kick Off, staffing,
 * onboarding) — a CS já é dona deles desde o cadastro. Pausados e
 * encerrados só aparecem nos filtros de saída.
 *
 * Card com hierarquia fixa (decisão de nov/2026): todos têm o mesmo
 * tamanho e as mesmas cinco linhas, na mesma ordem — identificação com
 * selo, aviso, contadores de tasks, equipe e contrato, ações. O que muda
 * é o conteúdo de cada linha, nunca a estrutura, para a CS bater o olho
 * na mesma posição em todos. Por isso a lista de tasks abre numa gaveta
 * lateral em vez de esticar o card, e as entregas do mês ficam no
 * "Contrato e entregas" (o card mostrava a barra, mas a CS abre a ficha
 * de qualquer forma para ver o detalhe); o resumo do topo mantém o
 * percentual geral da seleção.
 */
export default function CSCarteira({ clients, tasks, collaborators, me, onOpenClient, onOpenTask, onOpenFicha, onAvaliarSaude, csInicial = '__me__' }) {
  const { theme } = useTheme();
  // O líder da CS abre em "Todas as CSs"; a CS, na própria carteira.
  const [csFilter, setCsFilter] = useState(csInicial);
  const [statusFilter, setStatusFilter] = useState('all');
  const [busca, setBusca] = useState('');
  // Soma aos outros filtros (CS, etapa e busca): só quem tem TikTok Shop.
  const [soTiktok, setSoTiktok] = useState(false);
  // Cliente cuja lista de tasks está aberta na gaveta (só o id, para
  // ler as tasks ao vivo).
  const [tasksDe, setTasksDe] = useState(null);

  const carteira = useMemo(() => clients.filter(naCarteira), [clients]);
  // Carteira ativa + quem saiu da base (pausado ou encerrado), que só
  // aparece nos filtros de saída.
  const universo = useMemo(() => clients.filter(c => naCarteira(c) || isInativo(c)), [clients]);

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
  const itens = useMemo(() => universo.map(c => {
    const abertas = tasks
      .filter(t => t.clientId === c.id && t.status !== 'done')
      .sort((a, b) => {
        if (!a.deadline) return 1;
        if (!b.deadline) return -1;
        return a.deadline < b.deadline ? -1 : a.deadline > b.deadline ? 1 : 0;
      });
    const atrasadas = abertas.filter(t => t.deadline && t.deadline < hoje);
    const stage = stageOf(c);
    const fora = situacaoFora(c);
    // Fora da base não tem entrega esperada nem cadastro a cobrar.
    const naBase = stage === 'live' && !fora;
    const entregas = naBase ? entregasDoMes(c, mes) : [];
    const it = {
      client: c,
      stage,
      fora,
      abertas,
      atrasadas,
      aprovacao: abertas.filter(t => t.status === 'approval').length,
      manual: resolveClientHealth(c),
      contrato: contractState(c),
      entregasResumo: resumoMes(entregas),
      pendencias: naBase ? cadastroPendencias(c) : [],
      // Setores do cadastro ainda sem responsável (mesma regra do
      // `pendingSectorsOf` do useClients). Só importa em entrada.
      vagas: EM_ENTRADA.includes(stage)
        ? (c.staffing?.sectors || []).filter(sid => !asArray(c.responsibles?.[sid]).length)
        : [],
    };
    return { ...it, aviso: avisoDo(it), prazo: contratoDo(it) };
  }), [universo, tasks, hoje, mes]);

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
        if (CLIENTE_FORA[statusFilter]) return it.fora === statusFilter;
        if (it.fora) return false;
        if (statusFilter === 'live') return it.stage === 'live';
        if (statusFilter === 'entrada') return EM_ENTRADA.includes(it.stage);
        if (statusFilter === 'atraso') return it.atrasadas.length > 0;
        if (statusFilter === 'vencendo') return ['ending', 'expired'].includes(it.contrato.status);
        if (statusFilter === 'incompleto') return it.pendencias.length > 0;
        return true;
      })
      .filter(({ client }) => !soTiktok || temTiktokShop(client))
      .filter(({ client }) => !q || (client.name || '').toLowerCase().includes(q))
      // Mais atrasadas primeiro; empate por nome.
      .sort((a, b) => (b.atrasadas.length - a.atrasadas.length)
        || (a.client.name || '').localeCompare(b.client.name || '', 'pt-BR'));
  }, [itens, csFilter, statusFilter, soTiktok, busca, me]);

  const resumo = useMemo(() => ({
    clientes: filtrados.length,
    abertas: filtrados.reduce((s, it) => s + it.abertas.length, 0),
    atrasadas: filtrados.reduce((s, it) => s + it.atrasadas.length, 0),
    vencendo: filtrados.filter(it => !it.fora && ['ending', 'expired'].includes(it.contrato.status)).length,
    combinado: filtrados.reduce((s, it) => s + it.entregasResumo.combinado, 0),
    entregue: filtrados.reduce((s, it) => s + it.entregasResumo.entregue, 0),
  }), [filtrados]);
  const pctEntregas = resumo.combinado ? Math.round((resumo.entregue / resumo.combinado) * 100) : null;

  const mostraCs = csFilter === '__all__' || csFilter === '__none__';
  const gaveta = tasksDe ? itens.find(it => it.client.id === tasksDe) : null;

  return (
    <div className="fade-up">
      {/* Filtros */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10 }}>
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
            aria-label="Buscar cliente"
            style={{ ...S.input, width: '100%', paddingLeft: 32 }}
          />
        </div>

        <button
          type="button"
          className={`ui-btn small ${soTiktok ? 'on' : ''}`}
          onClick={() => setSoTiktok(v => !v)}
          title="Mostrar só os clientes com TikTok Shop contratado"
        >
          <ShoppingBag size={13} /> TikTok Shop
        </button>
      </div>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginBottom: 16 }}>
        {[...STATUS_FILTERS, null, ...FORA_FILTERS].map(f => (f
          ? (
            <button
              key={f.id}
              type="button"
              onClick={() => setStatusFilter(f.id)}
              aria-pressed={statusFilter === f.id}
              style={{
                ...S.chip,
                background: statusFilter === f.id ? 'var(--c-dim)' : 'var(--surface)',
                color: statusFilter === f.id ? COLOR : 'var(--muted)',
                borderColor: statusFilter === f.id ? 'var(--c-border)' : 'var(--border)',
              }}
            >
              {f.label}
            </button>
          )
          : <span key="sep" style={{ width: 1, height: 20, margin: '0 4px', background: 'var(--border-h)' }} />
        ))}
      </div>

      {/* Resumo da seleção */}
      <Faixa
        style={{ marginBottom: 16 }}
        items={[
          { label: 'Clientes', value: resumo.clientes },
          { label: 'Tasks em aberto', value: resumo.abertas },
          { label: 'Tasks atrasadas', value: resumo.atrasadas, cor: resumo.atrasadas ? 'var(--red)' : undefined },
          { label: 'Contratos vencendo', value: resumo.vencendo, cor: resumo.vencendo ? 'var(--amber)' : undefined },
          {
            label: 'Entregue do combinado no mês',
            value: pctEntregas == null ? '—' : `${pctEntregas}%`,
            cor: pctEntregas >= 100 ? 'var(--green)' : undefined,
          },
        ]}
      />

      {filtrados.length === 0
        ? <Empty msg={CLIENTE_FORA[statusFilter]
          ? `Nenhum cliente ${CLIENTE_FORA[statusFilter].label.toLowerCase()} ${csFilter === '__me__' ? 'na sua carteira' : 'nessa seleção'}.`
          : csFilter === '__me__' ? 'Nenhum cliente na sua carteira com esse filtro.' : 'Nenhum cliente com esse filtro.'} />
        : (
          <div style={GRID}>
            {filtrados.map(it => (
              <CarteiraCard
                key={it.client.id}
                item={it}
                theme={theme}
                mostraCs={mostraCs}
                onOpen={() => onOpenClient(it.client)}
                onTasks={() => setTasksDe(it.client.id)}
                onOpenFicha={onOpenFicha ? () => onOpenFicha(it.client) : undefined}
                onAvaliar={onAvaliarSaude ? () => onAvaliarSaude(it.client) : undefined}
              />
            ))}
          </div>
        )}

      {gaveta && (
        <TasksGaveta
          item={gaveta}
          hoje={hoje}
          onClose={() => setTasksDe(null)}
          onOpenTask={(id) => { setTasksDe(null); onOpenTask(id); }}
        />
      )}
    </div>
  );
}

function CarteiraCard({ item, theme, mostraCs, onOpen, onTasks, onOpenFicha, onAvaliar }) {
  const { client, stage, fora, abertas, atrasadas, aprovacao, pendencias, aviso, prazo } = item;
  const tiktok = temTiktokShop(client);
  const contato = client.contrato?.contactName || client.contactName;
  const av = AVISO[aviso.tipo] || AVISO.ok;

  // Equipe: um avatar por pessoa, com a cor do setor no tema atual. A CS
  // só entra quando a seleção mistura carteiras (todas / sem CS).
  const equipe = Object.entries(client.responsibles || {})
    .filter(([sid]) => mostraCs || sid !== 'cs')
    .flatMap(([sid, v]) => asArray(v).map(nome => ({
      sid, nome,
      cor: sectorTheme(sid, theme).color,
      dica: `${SECTORS[sid]?.label || sid} · ${nome}`,
    })));
  const visiveis = equipe.slice(0, MAX_AVATARES);
  const resto = equipe.slice(MAX_AVATARES);

  // Segunda ação: entrada abre o fluxo; cadastro incompleto puxa para
  // completar; o resto vai para contrato e entregas.
  const acao = EM_ENTRADA.includes(stage) && !fora
    ? { label: 'Abrir fluxo', Icone: ArrowRight, destaque: true, onClick: onOpen }
    : onOpenFicha
      ? (pendencias.length
        ? { label: 'Completar cadastro', Icone: ClipboardCheck, destaque: true, onClick: onOpenFicha }
        : { label: 'Contrato e entregas', Icone: ClipboardCheck, destaque: false, onClick: onOpenFicha })
      : { label: 'Ver cliente', Icone: ArrowRight, destaque: false, onClick: onOpen };

  return (
    // TikTok Shop ganha o contorno da marca; o resto do card é igual.
    <div style={{ ...S.card, ...(tiktok ? bordaTiktok('var(--bg2)') : null), ...(fora === 'encerrado' ? { opacity: 0.85 } : null) }}>

      {/* 1 · Identificação + selo */}
      <div style={S.topo}>
        <button type="button" onClick={onOpen} style={S.identidade} title={client.name}>
          <Sigla size={36} style={{ borderRadius: 10, fontSize: 12, fontWeight: 600, fontFamily: 'var(--f)' }}>{siglaDe(client.name)}</Sigla>
          <span style={{ minWidth: 0, flex: 1 }}>
            <span style={S.nome}>{client.name}</span>
            <span style={S.sub}>
              {tiktok && <SeloTiktokShop altura={13} />}
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{contato || 'Sem contato no cadastro'}</span>
            </span>
          </span>
        </button>
        <Selo item={item} onAvaliar={onAvaliar} />
      </div>

      {/* 2 · Aviso */}
      <div title={aviso.texto} style={{ ...S.aviso, color: av.cor, background: av.fundo }}>
        <av.Icone size={13} style={{ flexShrink: 0 }} />
        <span style={S.reticencias}>{aviso.texto}</span>
      </div>

      {/* 3 · Tasks */}
      <div style={S.contas}>
        {[
          { n: abertas.length, label: 'abertas', cor: 'var(--text)' },
          { n: atrasadas.length, label: 'atrasadas', cor: 'var(--red)' },
          { n: aprovacao, label: 'em aprovação', cor: 'var(--amber)' },
        ].map((k, i) => (
          <div key={k.label} style={{ padding: '7px 10px', borderLeft: i ? '1px solid var(--border)' : 'none', minWidth: 0 }}>
            <b style={{ display: 'block', fontFamily: 'var(--fm)', fontSize: 15, fontWeight: 600, lineHeight: 1.2, color: k.n ? k.cor : 'var(--dim)' }}>{k.n}</b>
            <small style={{ display: 'block', fontSize: 11, color: 'var(--muted)', marginTop: 1, whiteSpace: 'nowrap' }}>{k.label}</small>
          </div>
        ))}
      </div>

      {/* 4 · Equipe e contrato */}
      <div style={S.rodape}>
        <div style={{ display: 'flex', alignItems: 'center', paddingLeft: 4, minWidth: 0 }}>
          {equipe.length === 0 && <span style={{ marginLeft: -4, fontSize: 11, color: 'var(--muted)' }}>Equipe a definir</span>}
          {visiveis.map(p => (
            <span key={`${p.sid}-${p.nome}`} title={p.dica} style={{ ...S.avatar, borderColor: p.cor, color: p.cor }}>{siglaDe(p.nome)}</span>
          ))}
          {resto.length > 0 && (
            <span title={resto.map(p => p.dica).join('\n')} style={{ ...S.avatar, borderColor: 'var(--border-h)', color: 'var(--muted)' }}>+{resto.length}</span>
          )}
        </div>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontFamily: 'var(--fm)', color: prazo.cor, whiteSpace: 'nowrap' }}>
          <FileText size={12} /> {prazo.txt}
        </span>
      </div>

      {/* 5 · Ações */}
      <div style={S.acoes}>
        <button type="button" onClick={onTasks} disabled={!abertas.length} style={{ ...S.botao, color: abertas.length ? 'var(--muted)' : 'var(--dim)' }}>
          <ListChecks size={13} /> {abertas.length ? `Tasks (${abertas.length})` : 'Sem tasks'}
        </button>
        <button
          type="button"
          onClick={acao.onClick}
          style={{ ...S.botao, ...(acao.destaque ? { color: COLOR, background: 'var(--c-dim)', borderColor: 'var(--c-border)' } : null) }}
        >
          <acao.Icone size={13} /> {acao.label}
        </button>
      </div>
    </div>
  );
}

// Selo do canto: situação de quem saiu, etapa de quem está entrando ou
// a saúde do cliente (avaliação manual da CS) de quem está na base.
function Selo({ item, onAvaliar }) {
  const { stage, fora, manual } = item;
  if (fora) {
    const cfg = CLIENTE_FORA[fora];
    return <span style={{ ...S.selo, color: cfg.cor, background: cfg.fundo, borderColor: cfg.borda }}>{cfg.label}</span>;
  }
  if (stage !== 'live') {
    return (
      <span title={CLIENT_STAGES[stage]?.label} style={{ ...S.selo, color: COLOR, background: 'var(--c-dim)', borderColor: 'var(--c-border)' }}>
        {CLIENT_STAGES[stage]?.curto || CLIENT_STAGES[stage]?.label || stage}
      </span>
    );
  }
  const lv = manual.level ? HEALTH_LEVELS_4[manual.level] : null;
  if (!lv) {
    return onAvaliar
      ? <button type="button" onClick={onAvaliar} title="Ainda sem avaliação da CS — clique para avaliar" style={{ ...S.selo, color: 'var(--muted)', background: 'transparent', borderStyle: 'dashed', borderColor: 'var(--border-h)', cursor: 'pointer' }}>Avaliar</button>
      : <span style={{ ...S.selo, color: 'var(--muted)', background: 'transparent', borderStyle: 'dashed', borderColor: 'var(--border-h)' }}>Sem avaliação</span>;
  }
  return (
    <span title={manual.note || 'Saúde do cliente (avaliação da CS)'} style={{ ...S.selo, color: lv.cor, background: `color-mix(in srgb, ${lv.cor} 11%, transparent)` }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor' }} />
      {lv.label}
    </span>
  );
}

// Tasks em aberto do cliente, numa gaveta lateral (o card não estica).
const COR_STATUS = { todo: 'var(--dim)', doing: 'var(--blue)', approval: 'var(--amber)' };

function TasksGaveta({ item, hoje, onClose, onOpenTask }) {
  const { client, abertas, atrasadas } = item;
  return (
    <Gaveta onClose={onClose} label={`Tasks em aberto de ${client.name}`}>
      <div style={JANELA.h}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)' }}>{client.name}</p>
          <p style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 3 }}>
            {abertas.length} {plural(abertas.length, 'task em aberto', 'tasks em aberto')}
            {atrasadas.length > 0 && <span style={{ color: 'var(--red)' }}> · {atrasadas.length} {plural(atrasadas.length, 'atrasada', 'atrasadas')}</span>}
          </p>
        </div>
        <BotaoFechar onClick={onClose} />
      </div>
      <div style={{ ...JANELA.b, gap: 6 }}>
        {abertas.length === 0 && <p style={JANELA.aviso}>Nenhuma task em aberto.</p>}
        {abertas.map(t => {
          const col = TASK_COLUMNS.find(c => c.id === t.status);
          const atrasada = t.deadline && t.deadline < hoje;
          const prazo = t.deadline ? parseLocalDate(t.deadline) : null;
          return (
            <button key={t.id} type="button" onClick={() => onOpenTask(t.id)} style={S.taskRow}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', flexShrink: 0, background: COR_STATUS[t.status] || col?.color || 'var(--dim)' }} />
              <span style={{ minWidth: 0, flex: 1 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ ...S.reticencias, fontSize: 13, color: 'var(--text)', fontWeight: 500 }}>{t.name}</span>
                  {t.isRework && <span style={S.ajuste}>Ajuste</span>}
                </span>
                <span style={{ display: 'block', fontSize: 11.5, color: 'var(--muted)', marginTop: 2 }}>
                  {col?.label || t.status} · {t.responsibleName || '—'}
                </span>
              </span>
              <span style={{ fontSize: 11, fontFamily: 'var(--fm)', color: atrasada ? 'var(--red)' : 'var(--muted)', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 4 }}>
                {atrasada && <AlertTriangle size={11} />}
                {prazo ? prazo.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : 'sem prazo'}
              </span>
            </button>
          );
        })}
      </div>
    </Gaveta>
  );
}

const S = {
  input: {
    background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 9,
    padding: '9px 13px', color: 'var(--text)', fontSize: 13, outline: 'none', fontFamily: 'var(--f)',
  },
  inputActive: { borderColor: 'var(--c)', background: 'var(--c-dim)', fontWeight: 600 },
  chip: {
    height: 30, padding: '0 12px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer',
    border: '1px solid var(--border)', fontFamily: 'var(--f)',
  },
  card: {
    background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--r)', boxShadow: 'var(--shadow)',
    padding: '15px 16px', display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0,
  },
  topo: { display: 'flex', alignItems: 'center', gap: 10, height: 38 },
  identidade: {
    display: 'flex', alignItems: 'center', gap: 11, flex: 1, minWidth: 0, padding: 0,
    background: 'none', border: 'none', textAlign: 'left', cursor: 'pointer', color: 'var(--text)',
  },
  nome: { display: 'block', fontSize: 14.5, fontWeight: 600, lineHeight: 1.25, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  sub: { display: 'flex', alignItems: 'center', gap: 6, marginTop: 2, fontSize: 12, color: 'var(--muted)', whiteSpace: 'nowrap', overflow: 'hidden' },
  selo: {
    display: 'inline-flex', alignItems: 'center', gap: 5, height: 22, padding: '0 9px', borderRadius: 99,
    fontSize: 11, fontWeight: 500, whiteSpace: 'nowrap', flexShrink: 0, border: '1px solid transparent', fontFamily: 'var(--f)',
  },
  aviso: { display: 'flex', alignItems: 'center', gap: 7, height: 34, padding: '0 10px', borderRadius: 10, fontSize: 12, minWidth: 0 },
  reticencias: { minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  contas: { display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', borderRadius: 10, border: '1px solid var(--border)' },
  rodape: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, height: 26, marginTop: 'auto' },
  avatar: {
    width: 25, height: 25, marginLeft: -4, borderRadius: '50%', background: 'var(--bg2)', border: '1.5px solid',
    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9.5, fontWeight: 700, flexShrink: 0,
  },
  acoes: { display: 'flex', gap: 6, paddingTop: 12, borderTop: '1px solid var(--border)' },
  botao: {
    flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, height: 32,
    borderRadius: 9, background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--muted)',
    fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--f)', whiteSpace: 'nowrap',
  },
  taskRow: {
    display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left',
    padding: '10px 12px', borderRadius: 10, cursor: 'pointer',
    background: 'var(--bg3)', border: '1px solid var(--border)', fontFamily: 'var(--f)',
  },
  ajuste: {
    fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 6, flexShrink: 0,
    color: 'var(--purple)', background: 'var(--purple-dim)',
  },
};
