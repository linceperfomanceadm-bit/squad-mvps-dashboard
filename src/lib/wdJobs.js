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
