import { useState, useEffect, useMemo, useRef } from 'react';
import { collection, query, where, onSnapshot, doc } from 'firebase/firestore';
import { onAuthStateChanged, signInAnonymously } from 'firebase/auth';
import { differenceInDays, isSameDay, startOfWeek, subWeeks, startOfMonth, isAfter } from 'date-fns';
import { db, auth } from '../lib/firebase';
import { computeOpsHealth, resolveClientHealth, HEALTH_ORDER_4 } from './useClientHealth';

/*
 * useTVData — alimenta o painel de parede (/tv).
 *
 * REGRA DE OURO: só dado OPERACIONAL. Nada de R$, metas de venda ou
 * números do comercial — a TV fica à vista de cliente e visitante.
 *
 * Decisões:
 *
 * 1. LOGIN ANÔNIMO. A rota /tv não tem tela de login. O painel se
 *    autentica sozinho como anônimo; se já houver alguém logado no
 *    navegador, reaproveita a sessão.
 *
 * 2. CONSULTAS LIMITADAS. Dois listeners de escopo fechado em `tasks`:
 *    o que está em aberto e o que foi concluído desde o começo do mês
 *    (ou da semana passada, o que vier antes). Sem orderBy — não precisa
 *    de índice composto.
 *
 * 3. SOMENTE LEITURA. O painel nunca escreve.
 *
 * 4. MÉTRICA DE HONRA POR SQUAD. Na cena de Destaques, cada squad é
 *    comparado só consigo mesmo, numa métrica escolhida no admin. Nunca
 *    há ranking entre squads — o que faz um social media ser bom é
 *    diferente do que faz um web designer ser bom.
 */

// Setores que entram na produção. CS e Comercial ficam fora.
export const PRODUCTION_SECTORS = ['socialmedia', 'webdesign', 'videomaker', 'design', 'trafego'];

// Métricas de honra disponíveis no admin.
export const HONOR_METRIC_OPTIONS = [
  { id: 'entregas',   label: 'Entregas',              desc: 'Quem mais concluiu na semana. Justo quando o fluxo do squad é alto e parecido entre as pessoas.' },
  { id: 'primeira',   label: 'Aprovação de primeira', desc: 'Maior taxa de entregas sem retorno. Bom onde refazer custa caro.' },
  { id: 'prazo',      label: 'No prazo',              desc: 'Maior taxa de entregas dentro do deadline. Bom onde a data é crítica.' },
  { id: 'velocidade', label: 'Entrega mais rápida',   desc: 'Menor tempo do início à conclusão. Bom para demandas curtas e recorrentes.' },
  { id: 'cobertura',  label: 'Cobertura',             desc: 'Mais clientes distintos atendidos na semana. Bom onde constância por cliente importa.' },
  { id: 'constancia', label: 'Constância',            desc: 'Mais dias úteis com pelo menos uma entrega. Bom para rotinas diárias.' },
];

export const DEFAULT_HONOR_METRICS = {
  socialmedia: 'cobertura',
  webdesign: 'prazo',
  videomaker: 'primeira',
  design: 'entregas',
  trafego: 'constancia',
};

// Mínimo de entregas para concorrer a uma métrica percentual — sem
// isso, 1 de 1 vira 100% e ganha de 11 de 11.
const MIN_PERCENTUAL = 3;
const MIN_VELOCIDADE = 2;

const OPEN_STATUSES = ['todo', 'doing', 'approval'];

// ─── Utilidades ────────────────────────────────────────────────
const pad2 = (n) => String(n).padStart(2, '0');
const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);

const ymd = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const diaSemana = (d) => (d.getDay() + 6) % 7; // 0 = segunda … 6 = domingo

const mediana = (arr) => {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

const fmtDuracao = (ms) => {
  const horas = ms / 3600000;
  if (horas < 1) return `${Math.max(1, Math.round(horas * 60))}min`;
  if (horas < 24) {
    const h = Math.floor(horas);
    const m = Math.round((horas - h) * 60);
    return `${h}h${String(m).padStart(2, '0')}`;
  }
  const d = Math.floor(horas / 24);
  return `${d}d ${Math.round(horas - d * 24)}h`;
};

const setorDe = (t) => t.deliveredBySector || t.responsibleSector;
const pessoaDe = (t) => t.deliveredBy || t.responsibleName;

// Agrupa entregas por pessoa com tudo que as métricas precisam.
function porPessoa(lista) {
  const mapa = {};
  lista.forEach(t => {
    const quem = pessoaDe(t);
    if (!quem) return;
    if (!mapa[quem]) {
      mapa[quem] = {
        name: quem, sector: setorDe(t),
        total: 0, limpas: 0, comPrazo: 0, noPrazo: 0, duracoes: [],
        clientes: new Set(), dias: new Set(),
      };
    }
    const p = mapa[quem];
    const fim = new Date(t.completedAt);
    p.total += 1;
    if (!t.reworkCount) p.limpas += 1;
    if (t.deadline) {
      p.comPrazo += 1;
      if (differenceInDays(fim, new Date(t.deadline)) <= 0) p.noPrazo += 1;
    }
    if (t.startedAt) {
      const ms = fim - new Date(t.startedAt);
      if (ms > 0) p.duracoes.push(ms);
    }
    if (t.clientId) p.clientes.add(t.clientId);
    const ds = diaSemana(fim);
    if (ds < 5) p.dias.add(ds);
  });
  return Object.values(mapa);
}

// Definição de cada métrica: elegibilidade, pontuação e formatação.
const METRICS = {
  entregas: {
    elegivel: p => p.total >= 1,
    score: p => p.total,
    value: p => pad2(p.total),
    caption: p => `${pct(p.limpas, p.total)}% aprovadas de primeira`,
  },
  primeira: {
    elegivel: p => p.total >= MIN_PERCENTUAL,
    score: p => pct(p.limpas, p.total) * 1000 + p.total,
    value: p => `${pct(p.limpas, p.total)}%`,
    caption: p => `${p.limpas} de ${p.total} sem retorno`,
  },
  prazo: {
    elegivel: p => p.comPrazo >= MIN_PERCENTUAL,
    score: p => pct(p.noPrazo, p.comPrazo) * 1000 + p.comPrazo,
    value: p => `${pct(p.noPrazo, p.comPrazo)}%`,
    caption: p => `${p.noPrazo} de ${p.comPrazo} no prazo`,
  },
  velocidade: {
    elegivel: p => p.duracoes.length >= MIN_VELOCIDADE,
    score: p => -mediana(p.duracoes),
    value: p => fmtDuracao(mediana(p.duracoes)),
    caption: () => 'do início à conclusão',
  },
  cobertura: {
    elegivel: p => p.clientes.size >= 1,
    score: p => p.clientes.size * 1000 + p.total,
    value: p => pad2(p.clientes.size),
    caption: p => `${p.clientes.size === 1 ? 'cliente atendido' : 'clientes atendidos'} na semana`,
  },
  constancia: {
    elegivel: p => p.dias.size >= 1,
    score: p => p.dias.size * 1000 + p.total,
    value: (p, ctx) => `${p.dias.size}/${ctx.diasUteisAteHoje}`,
    caption: () => 'dias úteis com entrega',
  },
};

export function useTVData() {
  const [openTasks, setOpenTasks] = useState([]);
  const [doneTasks, setDoneTasks] = useState([]);
  const [clients, setClients] = useState([]);
  const [config, setConfig] = useState({
    tvPaused: false,
    tvPauseMessage: '',
    tvLockScene: '',
    tvCelebrations: true,
    tvRadioUrl: '',
    tvRadioPlaying: false,
    tvRadioVolume: 50,
    tvVisitMode: false,
    tvHonorMetrics: DEFAULT_HONOR_METRICS,
  });

  const [authReady, setAuthReady] = useState(false);
  const [authError, setAuthError] = useState('');
  const [loadingOpen, setLoadingOpen] = useState(true);
  const [loadingDone, setLoadingDone] = useState(true);
  const [loadingClients, setLoadingClients] = useState(true);
  const [online, setOnline] = useState(true);
  const [celebration, setCelebration] = useState(null);

  const seenDoneRef = useRef(null);
  const reloadTokenRef = useRef(null);

  // Relógio interno usado dentro do cálculo (dependência real do memo):
  // task vira atrasada, o dia vira, "há 12 min" envelhece.
  const [nowTs, setNowTs] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNowTs(Date.now()), 60000);
    return () => clearInterval(id);
  }, []);

  // ── Autenticação anônima ─────────────────────────────────────
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      if (u) { setAuthReady(true); return; }
      signInAnonymously(auth).catch((err) => {
        setAuthError(err.code === 'auth/operation-not-allowed'
          ? 'Login anônimo desabilitado no Firebase.'
          : 'Falha ao autenticar o painel.');
        setAuthReady(false);
      });
    });
    return unsub;
  }, []);

  // ── Tasks em aberto ──────────────────────────────────────────
  useEffect(() => {
    if (!authReady) return undefined;
    const q = query(collection(db, 'tasks'), where('status', 'in', OPEN_STATUSES));
    return onSnapshot(q, snap => {
      setOpenTasks(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoadingOpen(false);
      setOnline(true);
    }, () => { setLoadingOpen(false); setOnline(false); });
  }, [authReady]);

  // ── Concluídas desde o começo do mês ou da semana passada ────
  // completedAt é string ISO, que ordena igual à ordem cronológica.
  useEffect(() => {
    if (!authReady) return undefined;
    const agora = new Date();
    const inicioMes = startOfMonth(agora);
    const semanaPassada = subWeeks(startOfWeek(agora, { weekStartsOn: 1 }), 1);
    const desde = (inicioMes < semanaPassada ? inicioMes : semanaPassada).toISOString();
    const q = query(collection(db, 'tasks'), where('completedAt', '>=', desde));
    return onSnapshot(q, snap => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(t => t.status === 'done');
      const ids = new Set(list.map(t => t.id));

      if (seenDoneRef.current === null) {
        seenDoneRef.current = ids;                 // primeira carga: só memoriza
      } else {
        const nova = list.find(t => !seenDoneRef.current.has(t.id));
        seenDoneRef.current = ids;
        if (nova) {
          setCelebration({
            key: `${nova.id}_${Date.now()}`,
            taskName: nova.name,
            clientName: nova.clientName,
            by: pessoaDe(nova) || 'Squad',
            sector: setorDe(nova),
            clean: !nova.reworkCount,
          });
        }
      }

      setDoneTasks(list);
      setLoadingDone(false);
      setOnline(true);
    }, () => { setLoadingDone(false); setOnline(false); });
  }, [authReady]);

  // ── Clientes ─────────────────────────────────────────────────
  useEffect(() => {
    if (!authReady) return undefined;
    return onSnapshot(collection(db, 'clients'), snap => {
      setClients(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoadingClients(false);
      setOnline(true);
    }, () => { setLoadingClients(false); setOnline(false); });
  }, [authReady]);

  // ── Config global (controles do admin) ───────────────────────
  useEffect(() => {
    if (!authReady) return undefined;
    return onSnapshot(doc(db, 'app_config', 'general'), snap => {
      const d = snap.exists() ? snap.data() : {};
      setConfig({
        tvPaused: d.tvPaused === true,
        tvPauseMessage: d.tvPauseMessage || '',
        tvLockScene: d.tvLockScene || '',
        tvCelebrations: d.tvCelebrations !== false,
        tvRadioUrl: d.tvRadioUrl || '',
        tvRadioPlaying: d.tvRadioPlaying === true,
        tvRadioVolume: typeof d.tvRadioVolume === 'number' ? d.tvRadioVolume : 50,
        tvVisitMode: d.tvVisitMode === true,
        tvHonorMetrics: { ...DEFAULT_HONOR_METRICS, ...(d.tvHonorMetrics || {}) },
      });

      const token = d.tvReloadToken || 0;
      if (reloadTokenRef.current === null) reloadTokenRef.current = token;
      else if (token > reloadTokenRef.current) window.location.reload();
    }, () => {
      // Falha ao ler a config NUNCA apaga a TV — segue rodando normal.
    });
  }, [authReady]);

  const dismissCelebration = () => setCelebration(null);

  // ── Métricas ─────────────────────────────────────────────────
  const data = useMemo(() => {
    const now = new Date(nowTs);
    const hojeStr = ymd(now);
    const inicioSemana = startOfWeek(now, { weekStartsOn: 1 });
    const inicioAnterior = subWeeks(inicioSemana, 1);
    const inicioMes = startOfMonth(now);
    const diasUteisAteHoje = Math.min(5, diaSemana(now) + 1);

    const atrasada = t => t.deadline && differenceInDays(now, new Date(t.deadline)) > 0;

    // ── Em aberto ─────────────────────────────────────────────
    const doing = openTasks.filter(t => t.status === 'doing');
    const approval = openTasks.filter(t => t.status === 'approval');
    const overdue = openTasks.filter(atrasada);
    const rework = openTasks.filter(t => t.isRework);

    const overdueList = overdue.map(t => ({
      id: t.id, name: t.name,
      clientName: t.clientName || 'Sem cliente',
      who: t.responsibleName || '—',
      sector: t.responsibleSector,
      days: differenceInDays(now, new Date(t.deadline)),
    })).sort((a, b) => b.days - a.days);

    const stuckApproval = approval
      .filter(t => t.approvalAt && differenceInDays(now, new Date(t.approvalAt)) >= 2)
      .map(t => ({
        id: t.id, name: t.name,
        clientName: t.clientName || 'Sem cliente',
        who: t.responsibleName || '—',
        sector: t.responsibleSector,
        days: differenceInDays(now, new Date(t.approvalAt)),
      })).sort((a, b) => b.days - a.days);

    const reworkList = rework.map(t => ({
      id: t.id, name: t.name,
      clientName: t.clientName || 'Sem cliente',
      who: t.responsibleName || '—',
      sector: t.responsibleSector,
      count: t.reworkCount || 1,
    })).sort((a, b) => b.count - a.count);

    const bySector = PRODUCTION_SECTORS.map(id => {
      const ativas = openTasks.filter(t => t.responsibleSector === id);
      return { id, active: ativas.length, overdue: ativas.filter(atrasada).length };
    }).sort((a, b) => b.active - a.active);
    const maxSectorLoad = Math.max(1, ...bySector.map(s => s.active));
    const heroSector = bySector[0] && bySector[0].active > 0 ? bySector[0].id : 'socialmedia';

    // ── Concluídas ────────────────────────────────────────────
    const doneToday = doneTasks.filter(t => isSameDay(new Date(t.completedAt), now));
    const semana = doneTasks.filter(t => isAfter(new Date(t.completedAt), inicioSemana));
    const anterior = doneTasks.filter(t => {
      const d = new Date(t.completedAt);
      return isAfter(d, inicioAnterior) && !isAfter(d, inicioSemana);
    });
    const mes = doneTasks.filter(t => isAfter(new Date(t.completedAt), inicioMes));

    // Ritmo: entregas por dia da semana (segunda…domingo). Dias que
    // ainda não chegaram ficam null para a linha parar no hoje.
    const porDia = (lista) => {
      const arr = [0, 0, 0, 0, 0, 0, 0];
      lista.forEach(t => { arr[diaSemana(new Date(t.completedAt))] += 1; });
      return arr;
    };
    const hojeIdx = diaSemana(now);
    const ritmoAtual = porDia(semana).map((v, i) => (i <= hojeIdx ? v : null));
    const ritmoAnterior = porDia(anterior);
    const acumulado = ritmoAtual.reduce((acc, v) => {
      if (v === null) { acc.push(null); return acc; }
      const prev = acc.length ? (acc[acc.length - 1] || 0) : 0;
      acc.push(prev + v);
      return acc;
    }, []);

    // Média diária desta semana, sem contar hoje. Se ainda não há dias
    // anteriores, usa a semana passada.
    const diasAnteriores = ritmoAtual.slice(0, hojeIdx).filter(v => v !== null);
    const somaAnt = diasAnteriores.reduce((a, b) => a + b, 0);
    const mediaDiaria = diasAnteriores.length
      ? Math.round(somaAnt / diasAnteriores.length)
      : Math.round(anterior.length / 5);

    const recentes = [...doneTasks]
      .sort((a, b) => (b.completedAt || '').localeCompare(a.completedAt || ''))
      .slice(0, 3)
      .map(t => ({
        id: t.id, name: t.name,
        clientName: t.clientName || '',
        by: pessoaDe(t) || 'Squad',
        sector: setorDe(t),
        clean: !t.reworkCount,
        completedAt: t.completedAt,
      }));

    const limpasSemana = semana.filter(t => !t.reworkCount).length;
    const comPrazoSemana = semana.filter(t => t.deadline);
    const noPrazoSemana = comPrazoSemana.filter(t =>
      differenceInDays(new Date(t.completedAt), new Date(t.deadline)) <= 0).length;

    const weekStats = {
      total: semana.length,
      cleanRate: pct(limpasSemana, semana.length),
      onTime: pct(noPrazoSemana, comPrazoSemana.length),
      clients: new Set(semana.map(t => t.clientId).filter(Boolean)).size,
    };

    // Recorde do mês: maior número de entregas num único dia.
    const porDiaMes = {};
    mes.forEach(t => { const k = ymd(new Date(t.completedAt)); porDiaMes[k] = (porDiaMes[k] || 0) + 1; });
    const recordeDia = Math.max(0, ...Object.values(porDiaMes));
    const monthStats = { total: mes.length, recordeDia };

    const contaPorSetor = (lista) => {
      const c = {};
      PRODUCTION_SECTORS.forEach(id => { c[id] = 0; });
      lista.forEach(t => { const s = setorDe(t); if (s in c) c[s] += 1; });
      return c;
    };
    const semanaPorSetor = contaPorSetor(semana);
    const mesPorSetor = contaPorSetor(mes);
    const atrasoPorSetor = contaPorSetor(overdue.map(t => ({ responsibleSector: t.responsibleSector })));

    const squadsSemana = PRODUCTION_SECTORS
      .map(id => ({ id, week: semanaPorSetor[id], month: mesPorSetor[id], overdue: atrasoPorSetor[id] }))
      .sort((a, b) => b.week - a.week);

    // ── Destaques: métrica de honra por squad ─────────────────
    const ctx = { diasUteisAteHoje };
    const highlights = PRODUCTION_SECTORS.map(id => {
      const metricId = METRICS[config.tvHonorMetrics[id]] ? config.tvHonorMetrics[id] : DEFAULT_HONOR_METRICS[id];
      const metric = METRICS[metricId];
      const opt = HONOR_METRIC_OPTIONS.find(o => o.id === metricId);
      const pessoas = porPessoa(semana.filter(t => setorDe(t) === id)).filter(metric.elegivel);
      const lider = pessoas.length
        ? pessoas.map(p => ({ p, s: metric.score(p) })).sort((a, b) => b.s - a.s)[0].p
        : null;
      return {
        sector: id,
        metricId,
        metricLabel: opt ? opt.label : metricId,
        name: lider ? lider.name : null,
        value: lider ? metric.value(lider, ctx) : '—',
        caption: lider ? metric.caption(lider, ctx) : 'sem entregas suficientes',
      };
    });

    // ── Saúde da carteira ─────────────────────────────────────
    const ativos = clients.filter(c => c.active !== false);
    const todasTasks = [...openTasks, ...doneTasks];
    const linhas = ativos.map(c => {
      const ops = computeOpsHealth(c.id, todasTasks);
      const manual = resolveClientHealth(c);
      const pior = (manual.level && HEALTH_ORDER_4[manual.level] < HEALTH_ORDER_4[ops.level])
        ? manual.level : ops.level;
      const atrasadas = (ops.overdueTasks || [])
        .map(t => ({ days: differenceInDays(now, new Date(t.deadline)), sector: t.responsibleSector }))
        .sort((a, b) => b.days - a.days);
      const ativasDoCliente = openTasks.find(t => t.clientId === c.id);
      return {
        id: c.id,
        name: c.name || 'Sem nome',
        level: pior,
        reason: (ops.reasons && ops.reasons[0]) || manual.note || 'atenção manual',
        cs: (c.responsibles && c.responsibles.cs) || null,
        daysLate: atrasadas.length ? atrasadas[0].days : 0,
        sector: atrasadas.length ? atrasadas[0].sector : (ativasDoCliente ? ativasDoCliente.responsibleSector : null),
      };
    });

    const healthCount = { green: 0, yellow: 0, orange: 0, red: 0 };
    linhas.forEach(r => { healthCount[r.level] = (healthCount[r.level] || 0) + 1; });
    const criticalClients = linhas
      .filter(r => r.level === 'red' || r.level === 'orange')
      .sort((a, b) => (HEALTH_ORDER_4[a.level] - HEALTH_ORDER_4[b.level]) || (b.daysLate - a.daysLate));

    const porCSMap = {};
    linhas.forEach(r => {
      const k = r.cs || 'Sem responsável';
      if (!porCSMap[k]) porCSMap[k] = { name: k, red: 0, orange: 0, yellow: 0, green: 0, total: 0 };
      porCSMap[k][r.level] += 1;
      porCSMap[k].total += 1;
    });
    const porCS = Object.values(porCSMap).sort((a, b) => (b.red + b.orange) - (a.red + a.orange) || b.total - a.total);

    return {
      hojeStr,
      counts: {
        doneToday: doneToday.length,
        doing: doing.length,
        approval: approval.length,
        overdue: overdue.length,
        rework: rework.length,
      },
      mediaDiaria,
      heroSector,
      bySector,
      maxSectorLoad,
      ritmoAtual,
      ritmoAnterior,
      acumulado,
      recentes,
      overdueList,
      stuckApproval,
      reworkList,
      maxLate: overdueList.length ? overdueList[0].days : 0,
      squadsSemana,
      weekStats,
      monthStats,
      highlights,
      healthCount,
      criticalClients,
      porCS,
      totalClients: ativos.length,
    };
  }, [openTasks, doneTasks, clients, nowTs, config.tvHonorMetrics]);

  return {
    ...data,
    ...config,
    nowTs,
    loading: !authReady || loadingOpen || loadingDone || loadingClients,
    authError,
    online,
    celebration: config.tvCelebrations ? celebration : null,
    dismissCelebration,
  };
}
