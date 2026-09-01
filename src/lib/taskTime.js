/*
 * taskTime — motor de tempo do Kanban.
 *
 * Tudo aqui é calculado em TEMPO ÚTIL: segunda a sexta, das 09h00 às
 * 18h48. Fim de semana, madrugada e feriado não contam. Isso vale
 * tanto para "quanto tempo a task ficou com o Fulano" quanto para o
 * congelamento do prazo.
 *
 * Duas responsabilidades:
 *
 *  1. taskTimeStats(task) — varre a timeline e devolve quanto tempo
 *     cada pessoa segurou a task, separando execução, retrabalho e
 *     aprovação. É a fonte da tela de conclusão e do Extrato.
 *
 *  2. deadlineState(task) — devolve o estado do prazo levando em conta
 *     o congelamento. Task em aprovação não acumula atraso: o relógio
 *     para no instante do envio e o tempo parado (`pausedMs`) é
 *     devolvido ao prazo se a task voltar para ajuste.
 *
 * Para mudar o expediente, mexa só em BUSINESS_DAY abaixo.
 */

export const BUSINESS_DAY = {
  startHour: 9,
  startMinute: 0,
  endHour: 18,
  endMinute: 48,
  // 1 = segunda ... 5 = sexta (getDay do JS: 0 = domingo)
  workdays: [1, 2, 3, 4, 5],
};

const MS_PER_MIN = 60000;

// Minutos úteis em um dia cheio — 09h00 às 18h48 = 588 min.
export const BUSINESS_MINUTES_PER_DAY =
  (BUSINESS_DAY.endHour * 60 + BUSINESS_DAY.endMinute) -
  (BUSINESS_DAY.startHour * 60 + BUSINESS_DAY.startMinute);

export const BUSINESS_MS_PER_DAY = BUSINESS_MINUTES_PER_DAY * MS_PER_MIN;

// Guarda contra loop infinito em data corrompida (≈11 anos de dias).
const MAX_DAY_STEPS = 4000;

const toDate = (v) => {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(v);
  return isNaN(d.getTime()) ? null : d;
};

const isWorkday = (d) => BUSINESS_DAY.workdays.includes(d.getDay());

const dayStartOf = (d) => {
  const x = new Date(d);
  x.setHours(BUSINESS_DAY.startHour, BUSINESS_DAY.startMinute, 0, 0);
  return x;
};

const dayEndOf = (d) => {
  const x = new Date(d);
  x.setHours(BUSINESS_DAY.endHour, BUSINESS_DAY.endMinute, 0, 0);
  return x;
};

const nextDayStart = (d) => {
  const x = new Date(d);
  x.setDate(x.getDate() + 1);
  x.setHours(BUSINESS_DAY.startHour, BUSINESS_DAY.startMinute, 0, 0);
  return x;
};

// Interpreta "YYYY-MM-DD" no fuso LOCAL. new Date("YYYY-MM-DD") lê como
// meia-noite UTC e volta um dia em quem está a oeste de Greenwich.
export function parseLocalDate(str) {
  if (!str) return null;
  if (str instanceof Date) return str;
  const [y, m, d] = String(str).split('-').map(Number);
  if (!y || !m || !d) return toDate(str);
  return new Date(y, m - 1, d);
}

// Último instante do dia da data informada (23h59:59.999).
export function endOfLocalDay(str) {
  const d = parseLocalDate(str);
  if (!d) return null;
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

// ─── Tempo útil entre dois instantes ──────────────────────────
export function businessMsBetween(from, to) {
  const a = toDate(from);
  const b = toDate(to);
  if (!a || !b || b <= a) return 0;

  let total = 0;
  let cursor = new Date(a.getFullYear(), a.getMonth(), a.getDate());
  const lastDay = new Date(b.getFullYear(), b.getMonth(), b.getDate());
  let steps = 0;

  while (cursor <= lastDay && steps++ < MAX_DAY_STEPS) {
    if (isWorkday(cursor)) {
      const open = dayStartOf(cursor);
      const close = dayEndOf(cursor);
      const start = a > open ? a : open;
      const end = b < close ? b : close;
      if (end > start) total += end - start;
    }
    cursor = new Date(cursor);
    cursor.setDate(cursor.getDate() + 1);
  }
  return total;
}

// ─── Avança N ms ÚTEIS a partir de um instante ────────────────
// Usado para devolver ao prazo o tempo que ficou congelado.
export function addBusinessMs(from, ms) {
  const start = toDate(from);
  if (!start) return null;
  let rest = Number(ms) || 0;
  if (rest <= 0) return start;

  let cursor = new Date(start);
  let steps = 0;

  while (steps++ < MAX_DAY_STEPS) {
    const open = dayStartOf(cursor);
    const close = dayEndOf(cursor);

    if (!isWorkday(cursor) || cursor >= close) {
      cursor = nextDayStart(cursor);
      continue;
    }
    if (cursor < open) cursor = open;

    const available = close - cursor;
    if (rest <= available) return new Date(cursor.getTime() + rest);
    rest -= available;
    cursor = nextDayStart(cursor);
  }
  return cursor;
}

// ─── Formatação ───────────────────────────────────────────────
// Em tempo útil, "1d" = um expediente inteiro (588 min), não 24h.
export function formatBusinessDuration(ms) {
  const value = Number(ms) || 0;
  if (value < MS_PER_MIN) return '—';

  const totalMin = Math.round(value / MS_PER_MIN);
  if (totalMin < 60) return `${totalMin}min`;

  const days = Math.floor(totalMin / BUSINESS_MINUTES_PER_DAY);
  const restMin = totalMin - days * BUSINESS_MINUTES_PER_DAY;
  const hours = Math.floor(restMin / 60);
  const mins = restMin % 60;

  if (days > 0) return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
  return mins > 0 ? `${hours}h ${mins}min` : `${hours}h`;
}

// ─── Segmentos de posse da task ───────────────────────────────
// Só estes eventos trocam quem está com a task na mão. Comentário,
// mudança de prazo e troca de responsáveis extras NÃO cortam o
// intervalo — era esse o furo do cálculo antigo, que jogava fora o
// tempo restante toda vez que alguém mexia em algo no meio.
const OWNERSHIP_ACTIONS = ['created', 'started', 'sent_for_approval', 'rejected', 'completed'];

const segmentFor = (event) => {
  switch (event.action) {
    case 'created':
      return { owner: null, sector: null, kind: 'queue' };
    case 'started':
      return { owner: event.by || null, sector: event.sector || null, kind: 'work' };
    case 'sent_for_approval':
      return { owner: event.to || null, sector: null, kind: 'approval' };
    case 'rejected':
      return { owner: event.newResponsible || null, sector: null, kind: 'rework' };
    default:
      return null;
  }
};

/*
 * Estatística completa de tempo da task.
 *
 * Devolve:
 *   totalMs      — do nascimento até a conclusão (ou até agora)
 *   queueMs      — parada, sem ninguém ter iniciado
 *   workMs       — execução (primeira rodada)
 *   reworkMs     — execução depois de uma reprovação
 *   approvalMs   — na mão de quem aprova
 *   byPerson[]   — { name, workMs, reworkMs, approvalMs, totalMs }
 *   running      — true se a task ainda está correndo
 */
export function taskTimeStats(task, now = new Date()) {
  const empty = {
    totalMs: 0, queueMs: 0, workMs: 0, reworkMs: 0, approvalMs: 0,
    byPerson: [], running: false,
  };
  if (!task) return empty;

  const timeline = Array.isArray(task.timeline) ? task.timeline : [];
  const events = timeline
    .filter(e => e && OWNERSHIP_ACTIONS.includes(e.action) && e.at)
    .sort((a, b) => new Date(a.at) - new Date(b.at));

  if (!events.length) return empty;

  const done = task.status === 'done';
  const closeAt = done
    ? (toDate(task.completedAt) || toDate(events[events.length - 1].at) || now)
    : now;

  const people = new Map();
  const bump = (name, kind, ms) => {
    if (!name || ms <= 0) return;
    if (!people.has(name)) {
      people.set(name, { name, workMs: 0, reworkMs: 0, approvalMs: 0, totalMs: 0 });
    }
    const p = people.get(name);
    if (kind === 'work') p.workMs += ms;
    else if (kind === 'rework') p.reworkMs += ms;
    else if (kind === 'approval') p.approvalMs += ms;
    p.totalMs += ms;
  };

  const totals = { queue: 0, work: 0, rework: 0, approval: 0 };
  let reworkOpen = false;

  for (let i = 0; i < events.length; i++) {
    const event = events[i];
    if (event.action === 'completed') break;
    if (event.action === 'rejected') reworkOpen = true;

    const seg = segmentFor(event);
    if (!seg) continue;

    // Depois de uma reprovação, execução conta como retrabalho.
    const kind = (seg.kind === 'work' && reworkOpen) ? 'rework' : seg.kind;

    const from = toDate(event.at);
    const nextEvent = events[i + 1];
    const to = nextEvent ? toDate(nextEvent.at) : closeAt;
    if (!from || !to) continue;

    const ms = businessMsBetween(from, to);
    if (ms <= 0) continue;

    totals[kind] += ms;
    bump(seg.owner, kind, ms);
  }

  const byPerson = Array.from(people.values()).sort((a, b) => b.totalMs - a.totalMs);
  const firstAt = toDate(events[0].at);

  return {
    totalMs: firstAt ? businessMsBetween(firstAt, closeAt) : 0,
    queueMs: totals.queue,
    workMs: totals.work,
    reworkMs: totals.rework,
    approvalMs: totals.approval,
    byPerson,
    running: !done,
  };
}

// Lê a estatística gravada no doc quando a task foi concluída; se não
// existir (task antiga ou ainda em andamento), calcula na hora.
export function resolveTimeStats(task, now = new Date()) {
  if (task?.timeStats && typeof task.timeStats.totalMs === 'number') {
    return { ...task.timeStats, running: false };
  }
  return taskTimeStats(task, now);
}

// ─── Prazo ────────────────────────────────────────────────────

// Prazo efetivo = fim do dia da entrega + o tempo útil que ficou
// congelado em aprovação. Sem congelamento, é o prazo original.
export function effectiveDeadlineAt(task) {
  const base = endOfLocalDay(task?.deadline);
  if (!base) return null;
  const paused = Number(task?.pausedMs) || 0;
  return paused > 0 ? addBusinessMs(base, paused) : base;
}

// Quanto tempo útil esta task já passou parada em aprovação, somando
// o congelamento em curso (se estiver em aprovação agora).
export function currentPausedMs(task, now = new Date()) {
  const stored = Number(task?.pausedMs) || 0;
  if (task?.status !== 'approval') return stored;
  const since = toDate(task?.approvalStartedAt || task?.approvalAt);
  return since ? stored + businessMsBetween(since, now) : stored;
}

const DAY_MS = 86400000;

/*
 * Estado do prazo para a UI.
 *
 *   kind: 'done' | 'frozen' | 'late' | 'warn' | 'ontime'
 *
 * Regra central: quem responde pelo prazo é QUEM ENTREGA. Uma task
 * enviada para aprovação dentro do prazo nunca vira atraso do
 * colaborador, mesmo que o aprovador demore uma semana.
 */
export function deadlineState(task, now = new Date()) {
  const deadline = effectiveDeadlineAt(task);
  if (!deadline) return null;

  const onTime = task?.deliveredOnTime !== false;

  if (task?.status === 'done') {
    return {
      kind: 'done',
      frozen: false,
      color: onTime ? '#22c55e' : '#EE3363',
      badge: onTime ? 'ENTREGUE NO PRAZO' : 'ENTREGUE COM ATRASO',
      label: '',
      deadline,
    };
  }

  if (task?.status === 'approval') {
    return {
      kind: 'frozen',
      frozen: true,
      color: '#a78bfa',
      badge: 'PRAZO CONGELADO',
      label: task?.deliveredOnTime === false ? 'entregue com atraso' : 'entregue no prazo',
      deadline,
    };
  }

  const diffDays = Math.floor((now - deadline) / DAY_MS);

  if (now > deadline) {
    const late = Math.max(1, diffDays + 1);
    return {
      kind: 'late',
      frozen: false,
      color: '#EE3363',
      badge: 'ATRASADA',
      label: `${late}d de atraso`,
      deadline,
    };
  }

  const leftDays = Math.ceil((deadline - now) / DAY_MS);
  if (leftDays <= 1) {
    return {
      kind: 'warn',
      frozen: false,
      color: '#f59e0b',
      badge: 'URGENTE',
      label: leftDays <= 0 ? 'vence hoje' : 'vence amanhã',
      deadline,
    };
  }

  return {
    kind: 'ontime',
    frozen: false,
    color: '#8F97A0',
    badge: '',
    label: `${leftDays}d restantes`,
    deadline,
  };
}

// A entrega (envio para aprovação) aconteceu dentro do prazo?
export function isDeliveryOnTime(task, at = new Date()) {
  const deadline = effectiveDeadlineAt(task);
  if (!deadline) return true;
  return toDate(at) <= deadline;
}
