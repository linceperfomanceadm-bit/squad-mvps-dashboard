import { useState, useEffect, useRef, useCallback } from 'react';
import { SECTORS, STAFFING_ALERT_DAYS, stageOf } from '../lib/firebase';

/*
 * useDesktopNotifications — notificação nativa do navegador.
 *
 * ALCANCE, SEM ILUSÃO: isto usa a Notification API, não Web Push. A
 * notificação aparece no desktop mesmo com o navegador minimizado,
 * mas só enquanto o app estiver aberto em ALGUMA aba. Com o navegador
 * fechado não chega nada — para isso seria preciso service worker +
 * FCM + Cloud Function, que é um bloco à parte.
 *
 * BASELINE: no primeiro snapshot o hook apenas fotografa o estado
 * atual e não dispara nada. Sem isso, todo F5 viraria uma avalanche de
 * notificações de coisas antigas. A partir daí, só transições contam.
 *
 * O QUE NOTIFICA (decidido com a agência):
 *   · Reporte da CS endereçado a você
 *   · Task atribuída a você
 *   · Task devolvida para ajuste na sua mão
 *   · Call de Kick Off ou Onboarding agendada em cliente seu
 *   · Cobrança de staffing parado (admin e líder do setor travado)
 */

const STORAGE_KEY = 'squadmvps.notify.enabled';
const ALERT_LOG_KEY = 'squadmvps.notify.staffingLog';

export const notificationsSupported = () =>
  typeof window !== 'undefined' && 'Notification' in window;

export const notificationPermission = () =>
  notificationsSupported() ? Notification.permission : 'unsupported';

const asArray = (v) => (Array.isArray(v) ? v : v ? [v] : []);

// Cobrança de staffing é diária, não a cada render: guarda a data do
// último aviso por cliente para não repetir no mesmo dia.
const readAlertLog = () => {
  try { return JSON.parse(localStorage.getItem(ALERT_LOG_KEY) || '{}'); }
  catch { return {}; }
};
const writeAlertLog = (log) => {
  try { localStorage.setItem(ALERT_LOG_KEY, JSON.stringify(log)); } catch { /* quota cheia, ignora */ }
};

export function useDesktopNotifications({ tasks = [], requests = [], clients = [], user }) {
  const [permission, setPermission] = useState(notificationPermission());
  const [enabled, setEnabled] = useState(() => {
    try { return localStorage.getItem(STORAGE_KEY) !== 'off'; } catch { return true; }
  });

  const me = user?.name || null;
  const isAdmin = !!user?.isAdmin;
  const myLeaderSectors = asArray(user?.leaderOf);

  // Fotografias do estado anterior, por coleção.
  const baseTasks = useRef(null);
  const baseRequests = useRef(null);
  const baseClients = useRef(null);

  const canNotify = enabled && permission === 'granted' && !!me;

  const fire = useCallback((title, body, tag) => {
    if (!canNotify) return;
    try {
      const n = new Notification(title, {
        body,
        tag,
        icon: '/logos/admin.png',
        badge: '/logos/admin.png',
      });
      n.onclick = () => { window.focus(); n.close(); };
    } catch { /* navegador recusou, não trava o app */ }
  }, [canNotify]);

  const request = useCallback(async () => {
    if (!notificationsSupported()) return 'unsupported';
    const result = await Notification.requestPermission();
    setPermission(result);
    if (result === 'granted') {
      setEnabled(true);
      try { localStorage.setItem(STORAGE_KEY, 'on'); } catch { /* ignora */ }
      try {
        new Notification('Notificações ativadas', {
          body: 'Você será avisado de solicitações da CS, tasks e calls agendadas.',
          tag: 'squadmvps-welcome',
        });
      } catch { /* ignora */ }
    }
    return result;
  }, []);

  const toggle = useCallback(() => {
    setEnabled(prev => {
      const next = !prev;
      try { localStorage.setItem(STORAGE_KEY, next ? 'on' : 'off'); } catch { /* ignora */ }
      return next;
    });
  }, []);

  // ── Reporte da CS ────────────────────────────────────────────
  useEffect(() => {
    if (!me) return;
    const snapshot = new Map(requests.map(r => [r.id, r.status]));

    if (baseRequests.current === null) { baseRequests.current = snapshot; return; }
    const before = baseRequests.current;
    baseRequests.current = snapshot;
    if (!canNotify) return;

    requests.forEach(r => {
      if (r.toName !== me) return;
      if (r.status !== 'open') return;
      if (before.has(r.id)) return; // já existia, não é novidade
      fire(
        'Nova solicitação da CS',
        `${r.subject || 'Solicitação'} · ${r.clientName || 'sem cliente'}`,
        `request-${r.id}`
      );
    });
  }, [requests, me, canNotify, fire]);

  // ── Tasks: atribuição e devolução para ajuste ────────────────
  useEffect(() => {
    if (!me) return;
    const snapshot = new Map(tasks.map(t => [t.id, {
      status: t.status,
      isRework: !!t.isRework,
      reworkCount: t.reworkCount || 0,
      mine: asArray(t.responsibleNames).includes(me) || t.responsibleName === me,
    }]));

    if (baseTasks.current === null) { baseTasks.current = snapshot; return; }
    const before = baseTasks.current;
    baseTasks.current = snapshot;
    if (!canNotify) return;

    tasks.forEach(t => {
      const now = snapshot.get(t.id);
      const was = before.get(t.id);
      if (!now?.mine) return;
      if (t.status === 'done') return;

      // Devolução para ajuste: contador de ajustes subiu e caiu na
      // minha mão. Checado antes da atribuição para não disparar dois
      // avisos da mesma mudança.
      if (was && now.reworkCount > was.reworkCount) {
        fire(
          'Task devolvida para ajuste',
          `${t.name} · ${t.clientName || ''}`.trim(),
          `task-rework-${t.id}-${now.reworkCount}`
        );
        return;
      }

      // Atribuição: task nova minha, ou que passou a ser minha.
      const virouMinha = !was || !was.mine;
      if (virouMinha) {
        fire(
          t.status === 'approval' ? 'Task aguardando sua aprovação' : 'Nova task para você',
          `${t.name} · ${t.clientName || ''}`.trim(),
          `task-assign-${t.id}`
        );
      }
    });
  }, [tasks, me, canNotify, fire]);

  // ── Calls agendadas e cobrança de staffing ───────────────────
  useEffect(() => {
    if (!me) return;
    const snapshot = new Map(clients.map(c => [c.id, {
      kickoffAt: c.kickoffCall?.at || null,
      onboardingAt: c.kickoff?.at || null,
    }]));

    if (baseClients.current === null) { baseClients.current = snapshot; return; }
    const before = baseClients.current;
    baseClients.current = snapshot;
    if (!canNotify) return;

    const souDoTime = (c) =>
      Object.values(c.responsibles || {}).some(v => asArray(v).includes(me));

    clients.forEach(c => {
      const now = snapshot.get(c.id);
      const was = before.get(c.id);
      if (!was) return;

      // Kick Off: interessa à CS e ao admin.
      if (now.kickoffAt && now.kickoffAt !== was.kickoffAt && (isAdmin || user?.sector === 'cs')) {
        fire(
          'Call de Kick Off agendada',
          `${c.name} · ${new Date(now.kickoffAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}`,
          `kickoff-${c.id}-${now.kickoffAt}`
        );
      }

      // Onboarding: interessa a quem é responsável pelo cliente.
      if (now.onboardingAt && now.onboardingAt !== was.onboardingAt && (isAdmin || souDoTime(c))) {
        fire(
          'Call de onboarding agendada',
          `${c.name} · ${new Date(now.onboardingAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}`,
          `onboarding-${c.id}-${now.onboardingAt}`
        );
      }
    });

    // Cobrança do staffing parado. Só admin e líder do setor travado
    // recebem, e no máximo uma vez por dia por cliente.
    if (!isAdmin && myLeaderSectors.length === 0) return;
    const hoje = new Date().toISOString().slice(0, 10);
    const log = readAlertLog();
    let mudou = false;

    clients.forEach(c => {
      if (stageOf(c) !== 'staffing') return;
      const startedAt = c.staffing?.startedAt;
      if (!startedAt) return;
      const dias = Math.floor((Date.now() - new Date(startedAt).getTime()) / 86400000);
      if (dias < STAFFING_ALERT_DAYS) return;

      const exigidos = c.staffing?.sectors || [];
      const pendentes = exigidos.filter(sid => !asArray(c.responsibles?.[sid]).length);
      if (!pendentes.length) return;

      const meusPendentes = isAdmin ? pendentes : pendentes.filter(s => myLeaderSectors.includes(s));
      if (!meusPendentes.length) return;

      if (log[c.id] === hoje) return;
      log[c.id] = hoje;
      mudou = true;

      const nomes = meusPendentes.map(s => SECTORS[s]?.label || s).join(', ');
      fire(
        `Cliente parado há ${dias} dias`,
        `${c.name} aguarda responsável em: ${nomes}`,
        `staffing-${c.id}-${hoje}`
      );
    });

    if (mudou) writeAlertLog(log);
  }, [clients, me, canNotify, fire, isAdmin, user, myLeaderSectors]);

  return {
    permission,
    enabled,
    supported: notificationsSupported(),
    active: canNotify,
    request,
    toggle,
  };
}
