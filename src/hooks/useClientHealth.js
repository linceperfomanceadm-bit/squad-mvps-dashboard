import { differenceInDays } from 'date-fns';

/*
 * Saúde do cliente — agora são DOIS faróis independentes (fluxograma):
 *
 * 1. SAÚDE OPERACIONAL (automática): medida pelas tasks em aberto do
 *    cliente. Ninguém edita à mão.
 *      0 task em atraso  → Verde
 *      1 task em atraso  → Amarelo
 *      2 tasks em atraso → Laranja
 *      3+ tasks em atraso→ Vermelho
 *
 * 2. SAÚDE DO CLIENTE (manual): alimentada pela CS com base no
 *    relacionamento e nas pendências por parte do cliente. Vive em
 *    client.clientHealth = { level, note, by, at }.
 *
 * Os dois convivem: um não sobrepõe o outro. O painel de "Saúde
 * Crítica" considera vermelho em qualquer um dos dois.
 */

export const HEALTH_LEVELS_4 = {
  green:  { id: 'green',  label: 'Em dia',   color: '#22c55e', emoji: '🟢' },
  yellow: { id: 'yellow', label: 'Atenção',  color: '#f59e0b', emoji: '🟡' },
  orange: { id: 'orange', label: 'Alerta',   color: '#fb923c', emoji: '🟠' },
  red:    { id: 'red',    label: 'Crítico',  color: '#ef4444', emoji: '🔴' },
};

export const HEALTH_ORDER_4 = { red: 0, orange: 1, yellow: 2, green: 3 };

// Nível a partir do número de tasks atrasadas.
export function levelFromOverdue(overdue) {
  if (overdue >= 3) return 'red';
  if (overdue === 2) return 'orange';
  if (overdue === 1) return 'yellow';
  return 'green';
}

// ─── 1. Saúde Operacional (automática, por tasks) ──────────────
export function computeOpsHealth(clientId, tasks) {
  const clientTasks = (tasks || []).filter(t => t.clientId === clientId);
  const now = new Date();

  const active  = clientTasks.filter(t => t.status !== 'done');
  const overdue = active.filter(t => t.deadline && differenceInDays(now, new Date(t.deadline)) > 0);
  const reworks = active.filter(t => t.isRework);

  const level = levelFromOverdue(overdue.length);

  const reasons = [];
  if (overdue.length === 0) reasons.push('Nenhuma task em atraso');
  else reasons.push(`${overdue.length} task${overdue.length > 1 ? 's' : ''} em atraso`);
  if (reworks.length > 0) reasons.push(`${reworks.length} em ajuste/refação`);
  if (active.length === 0) reasons.push('Sem tasks ativas');

  return {
    level,
    reasons,
    overdueTasks: overdue,
    stats: {
      active: active.length,
      overdue: overdue.length,
      reworks: reworks.length,
      total: clientTasks.length,
    },
  };
}

// ─── 2. Saúde do Cliente (manual, alimentada pela CS) ──────────
export function resolveClientHealth(client) {
  const h = client?.clientHealth;
  if (h && h.level && HEALTH_LEVELS_4[h.level]) {
    return { level: h.level, note: h.note || '', by: h.by || null, at: h.at || null, set: true };
  }
  return { level: null, note: '', by: null, at: null, set: false };
}

// Cliente crítico = vermelho em qualquer um dos dois faróis.
export function isCritical(client, tasks) {
  const ops = computeOpsHealth(client.id, tasks);
  const manual = resolveClientHealth(client);
  return ops.level === 'red' || manual.level === 'red';
}

/* ─────────────────────────────────────────────────────────────
 * Compatibilidade com a versão anterior (3 níveis + override).
 * Mantido só para não quebrar telas antigas que ainda importem
 * daqui. O fluxo novo usa as funções acima.
 * ───────────────────────────────────────────────────────────── */
export const HEALTH_LEVELS = {
  green:  { label: 'Saudável', color: '#22c55e', emoji: '🟢' },
  yellow: { label: 'Atenção',  color: '#f59e0b', emoji: '🟡' },
  red:    { label: 'Risco',    color: '#ef4444', emoji: '🔴' },
};

export const HEALTH_ORDER = { red: 0, yellow: 1, green: 2 };

export function computeAutoHealth(clientId, tasks) {
  const r = computeOpsHealth(clientId, tasks);
  const level = r.level === 'orange' ? 'red' : r.level;
  return { level, reasons: r.reasons, stats: r.stats };
}

export function resolveHealth(client, tasks) {
  const auto = computeAutoHealth(client.id, tasks);
  const override = client.healthOverride;
  if (override && override.level) {
    return { ...auto, level: override.level, overridden: true, override };
  }
  return { ...auto, overridden: false };
}
