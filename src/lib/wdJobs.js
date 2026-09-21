// ─── WebDesign · serviços por cliente ─────────────────────────
// O bloco `wd` do cliente é o serviço principal (legado, um só).
// Serviços contratados depois por um cliente que já está na casa
// ficam em `wdJobs[]`, no mesmo doc — nada de cliente duplicado.
//
// Cada serviço tem status, prazo, checklist e responsáveis próprios.
// O id do serviço principal é sempre 'main'.

export const asArray = (v) => (Array.isArray(v) ? v : v ? [v] : []);

// Status que contam como "em andamento" no WebDesign.
export const WD_ACTIVE_STATUSES = ['onboarding', 'production'];

// Lista normalizada de serviços de Web de um cliente.
// No principal legado sem `wd.responsibles`, vale o responsável de
// Web do cliente (`responsibles.webdesign`), como sempre foi.
export function wdJobsOf(client) {
  if (!client) return [];
  const list = [];
  if (client.wd?.status) {
    list.push({
      ...client.wd,
      id: 'main',
      responsibles: client.wd.responsibles !== undefined
        ? asArray(client.wd.responsibles)
        : asArray(client.responsibles?.webdesign),
    });
  }
  (client.wdJobs || []).forEach(j => {
    if (j?.id && j.status) list.push({ ...j, responsibles: asArray(j.responsibles) });
  });
  return list;
}

// Um card por serviço: { key, client, job }.
export function wdCardsOf(clients) {
  return (clients || []).flatMap(c => wdJobsOf(c).map(job => ({ key: `${c.id}_${job.id}`, client: c, job })));
}

// ─── Prazo de onboarding do Web ───────────────────────────────
// Antes o relógio do onboarding partia de `onboardingStartedAt`, que
// é gravado quando o serviço é CRIADO — no cadastro do cliente. Com o
// Kick Off e o staffing no meio, o card ficava "atrasado" antes mesmo
// da call de onboarding existir. O prazo anda junto com a CS: conta a
// partir da call de onboarding agendada (`client.kickoff.at` — o nome
// `kickoff` é legado, é a call 2, ver useClients). Mesma regra do ID
// Visual (IdVisualBoard).
//
// Vale a data MAIS RECENTE entre as duas: serviço aberto depois da
// call (cliente antigo da casa) conta a partir da abertura, e não de
// uma call de meses atrás.
export function wdOnboardingStart(client, job) {
  const datas = [job?.onboardingStartedAt, client?.kickoff?.at]
    .filter(Boolean)
    .map(d => new Date(d))
    .filter(d => !Number.isNaN(d.getTime()));
  if (!datas.length) return null;
  return new Date(Math.max(...datas.map(d => d.getTime()))).toISOString();
}

// Onboarding estourado (mais de `dias` desde o início do prazo). Call
// marcada para o futuro não conta: o prazo nem começou.
export function wdOnboardingLate(client, job, dias = 7) {
  if (job?.status !== 'onboarding') return false;
  const inicio = wdOnboardingStart(client, job);
  if (!inicio) return false;
  return (Date.now() - new Date(inicio).getTime()) / 86400000 > dias;
}
