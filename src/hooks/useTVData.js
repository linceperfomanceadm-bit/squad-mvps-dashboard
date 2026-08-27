import { useState, useEffect, useMemo, useRef } from 'react';
import { collection, query, where, onSnapshot, doc } from 'firebase/firestore';
import { onAuthStateChanged, signInAnonymously } from 'firebase/auth';
import { differenceInDays, isSameDay, startOfWeek, subWeeks, isAfter } from 'date-fns';
import { db, auth } from '../lib/firebase';
import { computeOpsHealth, resolveClientHealth, HEALTH_ORDER_4 } from './useClientHealth';

/*
 * useTVData — alimenta o painel de parede (/tv).
 *
 * REGRA DE OURO: só dado OPERACIONAL. Nada de R$, metas de venda ou
 * números do comercial — a TV fica à vista de cliente e visitante.
 *
 * Três decisões importantes aqui:
 *
 * 1. LOGIN ANÔNIMO. A rota /tv não tem tela de login, mas o Firestore
 *    exige autenticação. O painel se autentica sozinho como usuário
 *    anônimo. Se já houver alguém logado no navegador (um admin abrindo
 *    /tv, por exemplo), reaproveita a sessão em vez de criar outra.
 *
 * 2. CONSULTAS LIMITADAS. A TV fica ligada o dia inteiro; escutar a
 *    coleção `tasks` inteira faria o custo crescer junto com o histórico.
 *    São dois listeners de escopo fechado: o que está em aberto e o que
 *    foi concluído nas duas últimas semanas. Nenhum usa orderBy, então
 *    não precisa de índice composto no Firestore.
 *
 * 3. SOMENTE LEITURA. O painel nunca escreve. Mesmo com bug, não há como
 *    corromper task, cliente ou qualquer documento.
 */

// Setores que entram na carga de produção. CS e Comercial ficam fora:
// não geram task de produção e poluiriam o gráfico com barras vazias.
export const PRODUCTION_SECTORS = ['socialmedia', 'webdesign', 'videomaker', 'design', 'trafego'];

// Mínimo de entregas na semana para concorrer a um selo percentual.
// Sem isso, quem entregou 1 task limpa apareceria com 100% de
// aproveitamento e ganharia de quem fez 11 de 11.
const MIN_ENTREGAS_SELO = 3;
const MIN_ENTREGAS_VELOCIDADE = 2;

const OPEN_STATUSES = ['todo', 'doing', 'approval'];

// ─── Utilidades ────────────────────────────────────────────────
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

export function useTVData() {
  const [openTasks, setOpenTasks] = useState([]);
  const [doneTasks, setDoneTasks] = useState([]);
  const [clients, setClients] = useState([]);
  const [config, setConfig] = useState({
    tvPaused: false,
    tvPauseMessage: '',
    tvLockScene: '',
    tvCelebrations: true,
  });

  const [authReady, setAuthReady] = useState(false);
  const [authError, setAuthError] = useState('');
  const [loadingOpen, setLoadingOpen] = useState(true);
  const [loadingDone, setLoadingDone] = useState(true);
  const [loadingClients, setLoadingClients] = useState(true);
  const [online, setOnline] = useState(true);
  const [celebration, setCelebration] = useState(null);

  const seenDoneRef = useRef(null);     // null = primeira carga
  const reloadTokenRef = useRef(null);  // null = primeira leitura da config
  // Relógio interno: o memo recalcula quando o minuto vira (task passa
  // a contar como atrasada, o dia muda). É usado dentro do cálculo,
  // então é uma dependência real e não um truque de invalidação.
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

  // ── Concluídas nas duas últimas semanas ──────────────────────
  // Duas semanas porque o selo "Virada da semana" compara com a anterior.
  // completedAt é string ISO, que ordena igual à ordem cronológica.
  useEffect(() => {
    if (!authReady) return undefined;
    const desde = subWeeks(startOfWeek(new Date(), { weekStartsOn: 1 }), 1).toISOString();
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
            by: nova.deliveredBy || nova.responsibleName || 'Squad',
            sector: nova.deliveredBySector || nova.responsibleSector,
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
        tvCelebrations: d.tvCelebrations !== false, // ausente = ligado
        tvRadioUrl: d.tvRadioUrl || '',
        tvRadioPlaying: d.tvRadioPlaying === true,
        tvRadioVolume: typeof d.tvRadioVolume === 'number' ? d.tvRadioVolume : 50,
      });

      // Recarregar remotamente: o admin grava um token novo e todas as
      // TVs recarregam sozinhas. A primeira leitura nunca recarrega.
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
    const tasks = openTasks;

    // Mesma regra de atraso do useClientHealth — mantém a TV coerente
    // com o farol de saúde dos painéis internos.
    const atrasada = t => t.deadline && differenceInDays(now, new Date(t.deadline)) > 0;

    const doing = tasks.filter(t => t.status === 'doing');
    const approval = tasks.filter(t => t.status === 'approval');
    const overdue = tasks.filter(atrasada);
    const rework = tasks.filter(t => t.isRework);
    const doneToday = doneTasks.filter(t => t.completedAt && isSameDay(new Date(t.completedAt), now));

    const overdueList = overdue.map(t => ({
      id: t.id,
      name: t.name,
      clientName: t.clientName || 'Sem cliente',
      who: t.responsibleName || '—',
      sector: t.responsibleSector,
      days: differenceInDays(now, new Date(t.deadline)),
    })).sort((a, b) => b.days - a.days);

    // Paradas em aprovação há 2+ dias — gargalo que ninguém enxerga sozinho.
    const stuckApproval = approval
      .filter(t => t.approvalAt && differenceInDays(now, new Date(t.approvalAt)) >= 2)
      .map(t => ({
        id: t.id,
        name: t.name,
        clientName: t.clientName || 'Sem cliente',
        who: t.responsibleName || '—',
        sector: t.responsibleSector,
        days: differenceInDays(now, new Date(t.approvalAt)),
      })).sort((a, b) => b.days - a.days);

    const reworkList = rework.map(t => ({
      id: t.id,
      name: t.name,
      clientName: t.clientName || 'Sem cliente',
      who: t.responsibleName || '—',
      sector: t.responsibleSector,
      count: t.reworkCount || 1,
    })).sort((a, b) => b.count - a.count);

    // Carga por setor de produção.
    const bySector = PRODUCTION_SECTORS.map(id => {
      const ativas = tasks.filter(t => t.responsibleSector === id);
      return { id, active: ativas.length, overdue: ativas.filter(atrasada).length };
    }).sort((a, b) => b.active - a.active);
    const maxSectorLoad = Math.max(1, ...bySector.map(s => s.active));

    // ── Semana atual e anterior ────────────────────────────────
    const inicioSemana = startOfWeek(now, { weekStartsOn: 1 });
    const inicioAnterior = subWeeks(inicioSemana, 1);
    const semana = doneTasks.filter(t => t.completedAt && isAfter(new Date(t.completedAt), inicioSemana));
    const anterior = doneTasks.filter(t => t.completedAt
      && isAfter(new Date(t.completedAt), inicioAnterior)
      && !isAfter(new Date(t.completedAt), inicioSemana));

    const porPessoa = (lista) => {
      const mapa = {};
      lista.forEach(t => {
        const quem = t.deliveredBy || t.responsibleName;
        if (!quem) return;
        if (!mapa[quem]) {
          mapa[quem] = {
            name: quem,
            sector: t.deliveredBySector || t.responsibleSector,
            total: 0, limpas: 0, noPrazo: 0, alteracoes: 0, duracoes: [],
          };
        }
        const p = mapa[quem];
        p.total += 1;
        if (!t.reworkCount) p.limpas += 1;
        p.alteracoes += (t.reworkCount || 0);
        if (t.deadline && differenceInDays(new Date(t.completedAt), new Date(t.deadline)) <= 0) p.noPrazo += 1;
        if (t.startedAt) {
          const ms = new Date(t.completedAt) - new Date(t.startedAt);
          if (ms > 0) p.duracoes.push(ms);
        }
      });
      return Object.values(mapa);
    };

    const pessoas = porPessoa(semana);
    const pessoasAnterior = porPessoa(anterior);

    const melhor = (candidatos, pontuar) => {
      if (!candidatos.length) return null;
      return candidatos.map(p => ({ p, s: pontuar(p) })).sort((a, b) => b.s - a.s)[0].p;
    };

    const elegiveis = pessoas.filter(p => p.total >= MIN_ENTREGAS_SELO);

    // Selo 1 — Zero atraso: quem tem prazo em todas e não estourou nenhum.
    const zeroAtraso = melhor(elegiveis.filter(p => p.noPrazo === p.total), p => p.total);
    // Selo 2 — Aprovação de primeira: maior taxa sem retorno.
    const primeira = melhor(elegiveis, p => (p.limpas / p.total) * 1000 + p.total);
    // Selo 3 — Menos alterações: menor média de voltas por entrega.
    const menosAlt = melhor(elegiveis, p => -(p.alteracoes / p.total) * 1000 + p.total);
    // Selo 4 — Entrega mais rápida: menor mediana início→conclusão.
    const maisRapida = melhor(
      pessoas.filter(p => p.duracoes.length >= MIN_ENTREGAS_VELOCIDADE),
      p => -mediana(p.duracoes)
    );
    // Selo 5 — Virada da semana: maior crescimento sobre a semana anterior.
    const baseAnterior = (nome) => {
      const a = pessoasAnterior.find(x => x.name === nome);
      return a ? a.total : 0;
    };
    const virada = melhor(elegiveis, p => {
      const base = baseAnterior(p.name);
      return base ? ((p.total - base) / base) * 1000 : p.total * 10;
    });
    const viradaNovo = virada ? baseAnterior(virada.name) === 0 : false;

    const selo = (badge, icon, accent, pessoa, valor, legenda) => ({
      badge, icon, accent,
      name: pessoa ? pessoa.name : null,
      sector: pessoa ? pessoa.sector : null,
      value: pessoa ? valor : '—',
      caption: pessoa ? legenda : 'sem dados suficientes',
    });

    const dd = n => String(n).padStart(2, '0');
    const highlights = [
      selo('Zero atraso', 'target', '#38bdf8', zeroAtraso,
        zeroAtraso ? `${dd(zeroAtraso.total)}/${dd(zeroAtraso.total)}` : '',
        'todas dentro do prazo'),
      selo('Aprovação de primeira', 'badge', '#22c55e', primeira,
        primeira ? `${Math.round((primeira.limpas / primeira.total) * 100)}%` : '',
        primeira ? `${primeira.limpas} de ${primeira.total} sem retorno` : ''),
      selo('Menos alterações', 'rotate', '#a78bfa', menosAlt,
        menosAlt ? (menosAlt.alteracoes / menosAlt.total).toFixed(1).replace('.', ',') : '',
        'alterações por entrega'),
      selo('Entrega mais rápida', 'zap', '#f5a623', maisRapida,
        maisRapida ? fmtDuracao(mediana(maisRapida.duracoes)) : '',
        'do início à conclusão'),
      selo('Virada da semana', 'trend', '#EE3363', virada,
        virada ? (viradaNovo ? dd(virada.total)
          : `+${Math.round(((virada.total - baseAnterior(virada.name)) / baseAnterior(virada.name)) * 100)}%`) : '',
        viradaNovo ? 'estreou na semana' : 'vs. semana passada'),
    ];

    const limpasSemana = semana.filter(t => !t.reworkCount).length;
    const comPrazoSemana = semana.filter(t => t.deadline);
    const noPrazoSemana = comPrazoSemana.filter(t =>
      differenceInDays(new Date(t.completedAt), new Date(t.deadline)) <= 0).length;

    const weekStats = {
      total: semana.length,
      cleanRate: semana.length ? Math.round((limpasSemana / semana.length) * 100) : 0,
      onTime: comPrazoSemana.length ? Math.round((noPrazoSemana / comPrazoSemana.length) * 100) : 0,
      clients: new Set(semana.map(t => t.clientId).filter(Boolean)).size,
    };

    // ── Saúde da carteira ──────────────────────────────────────
    // c.active !== false: documentos legados não têm o campo.
    const ativos = clients.filter(c => c.active !== false);
    const todasTasks = [...openTasks, ...doneTasks];
    const linhas = ativos.map(c => {
      const ops = computeOpsHealth(c.id, todasTasks);
      const manual = resolveClientHealth(c);
      const pior = (manual.level && HEALTH_ORDER_4[manual.level] < HEALTH_ORDER_4[ops.level])
        ? manual.level : ops.level;
      return {
        id: c.id,
        name: c.name || 'Sem nome',
        level: pior,
        reason: (ops.reasons && ops.reasons[0]) || manual.note || 'atenção manual',
        cs: (c.responsibles && c.responsibles.cs) || null,
      };
    });

    const healthCount = { green: 0, yellow: 0, orange: 0, red: 0 };
    linhas.forEach(r => { healthCount[r.level] = (healthCount[r.level] || 0) + 1; });
    const criticalClients = linhas
      .filter(r => r.level === 'red' || r.level === 'orange')
      .sort((a, b) => HEALTH_ORDER_4[a.level] - HEALTH_ORDER_4[b.level]);

    return {
      counts: {
        doneToday: doneToday.length,
        doing: doing.length,
        approval: approval.length,
        overdue: overdue.length,
        rework: rework.length,
      },
      overdueList,
      stuckApproval,
      reworkList,
      maxLate: overdueList.length ? overdueList[0].days : 0,
      bySector,
      maxSectorLoad,
      highlights,
      weekStats,
      healthCount,
      criticalClients,
      totalClients: ativos.length,
    };
  }, [openTasks, doneTasks, clients, nowTs]);

  return {
    ...data,
    ...config,
    loading: !authReady || loadingOpen || loadingDone || loadingClients,
    authError,
    online,
    celebration: config.tvCelebrations ? celebration : null,
    dismissCelebration,
  };
}
