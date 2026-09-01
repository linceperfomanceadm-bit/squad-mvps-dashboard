/*
 * calendarLink — link "Adicionar à agenda" do Google.
 *
 * POR QUE NÃO É AUTOMÁTICO: criar o evento sozinho, sem clique, exige
 * a API do Google Calendar. Isso só é viável com Google Workspace de
 * domínio próprio (service account com delegação) ou com OAuth por
 * usuário. A agenda da agência hoje é uma conta Gmail comum, e os
 * colaboradores não têm e-mail real cadastrado no app — os dois
 * caminhos estão fechados.
 *
 * O que dá para fazer sem nada disso é este link: abre o Google
 * Agenda com título, data, duração, descrição e link da call já
 * preenchidos. Quem agendou confirma em um clique e o evento entra na
 * agenda da agência.
 *
 * Para trocar por integração de verdade no futuro, basta substituir
 * quem chama `googleCalendarUrl` por uma Cloud Function — o resto do
 * app não precisa mudar.
 */

const DEFAULT_DURATION_MIN = 60;

// O Google espera UTC no formato compacto: 20260904T140000Z
const stamp = (date) => {
  const pad = (n) => String(n).padStart(2, '0');
  return (
    `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}` +
    `T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`
  );
};

export function googleCalendarUrl({ title, start, durationMinutes = DEFAULT_DURATION_MIN, description = '', location = '' }) {
  if (!start) return null;
  const from = start instanceof Date ? start : new Date(start);
  if (isNaN(from.getTime())) return null;
  const to = new Date(from.getTime() + durationMinutes * 60000);

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: title || 'Reunião',
    dates: `${stamp(from)}/${stamp(to)}`,
  });
  if (description) params.set('details', description);
  if (location) params.set('location', location);

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

// Atalho para as calls de cliente, que sempre têm o mesmo formato.
export function clientCallCalendarUrl({ kind, client, at, meetLink, participants = [] }) {
  const nome = client?.name || 'Cliente';
  const titulo = kind === 'kickoff'
    ? `Kick Off — ${nome}`
    : `Onboarding — ${nome}`;

  const linhas = [];
  if (kind === 'kickoff') {
    linhas.push('Call de Kick Off entre CS Comercial e CS Operacional.');
  } else {
    linhas.push('Call de onboarding com o time responsável pelo cliente.');
  }
  if (participants.length) linhas.push(`Participantes: ${participants.join(', ')}`);
  if (client?.contrato?.contactName) linhas.push(`Contato do cliente: ${client.contrato.contactName}`);
  if (meetLink) linhas.push(`Link da call: ${meetLink}`);

  return googleCalendarUrl({
    title: titulo,
    start: at,
    description: linhas.join('\n'),
    location: meetLink || '',
  });
}
