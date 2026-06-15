import { differenceInDays } from 'date-fns';

/*
 * Saúde do cliente — farol misto.
 *
 * Parte AUTOMÁTICA: derivada das tasks do cliente (atrasos e refações).
 * Parte MANUAL: o CS pode sobrepor com um risco percebido, guardado em
 * client.healthOverride = { level: 'green'|'yellow'|'red', note, by, at }.
 * O override, quando existe, prevalece sobre o automático.
 *
 * Níveis: 'green' (saudável) | 'yellow' (atenção) | 'red' (risco).
 */

export const HEALTH_LEVELS = {
  green:  { label: 'Saudável', color: '#22c55e', emoji: '🟢' },
  yellow: { label: 'Atenção',  color: '#f59e0b', emoji: '🟡' },
  red:    { label: 'Risco',    color: '#ef4444', emoji: '🔴' },
};

// Calcula a saúde automática de um cliente a partir das suas tasks.
export function computeAutoHealth(clientId, tasks) {
  const clientTasks = tasks.filter(t => t.clientId === clientId);
  const now = new Date();

  const active = clientTasks.filter(t => t.status !== 'done');
  const overdue = active.filter(t => t.deadline && differenceInDays(now, new Date(t.deadline)) > 0);
  const reworks = active.filter(t => t.isRework);

  let level = 'green';
  const reasons = [];

  if (overdue.length > 0) {
    level = 'red';
    reasons.push(`${overdue.length} task${overdue.length > 1 ? 's' : ''} atrasada${overdue.length > 1 ? 's' : ''}`);
  }
  if (reworks.length >= 2) {
    level = 'red';
    reasons.push(`${reworks.length} refações em aberto`);
  } else if (reworks.length === 1 && level !== 'red') {
    level = 'yellow';
    reasons.push('1 refação em aberto');
  }
  if (level === 'green' && active.length >= 6) {
    level = 'yellow';
    reasons.push(`${active.length} tasks ativas acumuladas`);
  }
  if (reasons.length === 0) reasons.push('Sem atrasos ou refações');

  return {
    level,
    reasons,
    stats: { active: active.length, overdue: overdue.length, reworks: reworks.length, total: clientTasks.length },
  };
}

// Saúde efetiva: override manual prevalece sobre o automático.
export function resolveHealth(client, tasks) {
  const auto = computeAutoHealth(client.id, tasks);
  const override = client.healthOverride;
  if (override && override.level) {
    return { ...auto, level: override.level, overridden: true, override };
  }
  return { ...auto, overridden: false };
}

// Ordena por gravidade (vermelho primeiro).
export const HEALTH_ORDER = { red: 0, yellow: 1, green: 2 };
