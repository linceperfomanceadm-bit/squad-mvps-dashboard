import {
  stageOf, contractState, naCarteira, WD_SERVICE_CONFIG, ID_VISUAL_CONFIG, HEALTH_STALE_DAYS,
  SETORES_ENTREGA_UNICA, TERMOS_ENTREGA_UNICA,
} from './firebase';
import { businessMsBetween } from './taskTime';
import { wdJobsOf, asArray, WD_ACTIVE_STATUSES } from './wdJobs';

/*
 * ENTREGAS DO CONTRATO — funções puras, sem Firestore.
 *
 * Formato no documento do cliente:
 *
 *   escopo: {
 *     versoes: [{ desde: 'AAAA-MM', itens: [{ id, sector, label, qtd, unica? }], por, em }],
 *     semRecorrencia: bool,   // cliente sem entrega mensal (só site, p.ex.)
 *   }
 *   entregas: {
 *     'AAAA-MM': {
 *       feito: { [itemId]: n },   // o que foi marcado no mês
 *       qtd:   { [itemId]: n },   // ajuste de quantidade só daquele mês
 *       log:   [{ tipo, item, delta, de, para, by, at }],
 *     },
 *   }
 *
 * Por que VERSÕES em vez de um escopo só: a mudança de escopo vale a
 * partir do próximo dia 1, e o histórico precisa mostrar o contrato
 * que valia em cada mês — inclusive nos meses em que ninguém marcou
 * nada (é justamente o caso que gera conflito contratual). Com as
 * versões, qualquer mês passado é reconstruído sem ter sido gravado.
 *
 * O id do item se mantém entre versões quando a CS só muda a
 * quantidade, então o que já foi marcado continua ligado a ele.
 *
 * ENTREGA ÚNICA MANUAL (`unica: true`, sempre qtd 1): coisa que se
 * entrega uma vez só mas não tem card em painel nenhum (ex.: Google
 * Meu Negócio). Fica pendente, 0 de 1, no mês corrente até alguém
 * marcar; conta 1 de 1 no mês em que foi marcada e some dos meses
 * seguintes. Não confundir com `ehEntregaUnica` — site e ID Visual,
 * que o painel de Web/Design conclui sozinho e nem entram no escopo.
 */

const pad2 = (n) => String(n).padStart(2, '0');
const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const MESES_LONGOS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

// ─── Calendário ───────────────────────────────────────────────
export const mesChave = (d = new Date()) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;

const partes = (chave) => {
  const [y, m] = String(chave || '').split('-').map(Number);
  return { y, m };
};

export const inicioDoMes = (chave) => {
  const { y, m } = partes(chave);
  return new Date(y, m - 1, 1, 0, 0, 0, 0);
};

// Primeiro instante do mês seguinte (limite aberto).
export const fimDoMes = (chave) => {
  const { y, m } = partes(chave);
  return new Date(y, m, 1, 0, 0, 0, 0);
};

export const somaMeses = (chave, n) => {
  const { y, m } = partes(chave);
  return mesChave(new Date(y, m - 1 + n, 1));
};

export const rotuloMes = (chave, longo = false) => {
  const { y, m } = partes(chave);
  if (!y || !m) return '—';
  return longo ? `${MESES_LONGOS[m - 1]} de ${y}` : `${MESES[m - 1]}/${y}`;
};

export const novoIdItem = () => `it_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

// ─── Escopo ───────────────────────────────────────────────────
export const versoesDoEscopo = (c) => {
  const v = Array.isArray(c?.escopo?.versoes) ? c.escopo.versoes : [];
  return [...v].filter(x => x && x.desde).sort((a, b) => a.desde.localeCompare(b.desde));
};

// Versão que vale no mês informado (a mais recente com desde <= mês).
export const escopoVigente = (c, mes = mesChave()) => {
  const vs = versoesDoEscopo(c).filter(v => v.desde <= mes);
  return vs.length ? vs[vs.length - 1] : null;
};

// Mudança já cadastrada que só vale a partir de um mês futuro.
export const escopoAgendado = (c, mes = mesChave()) => versoesDoEscopo(c).find(v => v.desde > mes) || null;

// Versão que o formulário de edição deve abrir: a agendada, se houver
// (é a que ainda pode mudar), senão a vigente.
export const escopoParaEditar = (c) => escopoAgendado(c) || escopoVigente(c) || null;

export const temEscopoDefinido = (c) => versoesDoEscopo(c).length > 0 || c?.escopo?.semRecorrencia === true;

// Mês a partir do qual um escopo salvo agora passa a valer. Primeiro
// escopo do cliente vale já (é o caso do cliente antigo sendo
// completado); mudança de escopo existente vale no próximo dia 1.
export const inicioNovaVersao = (c, agora = new Date()) => (
  versoesDoEscopo(c).length ? somaMeses(mesChave(agora), 1) : mesChave(agora)
);

// Correções que valem JÁ, mesmo com o escopo esperando o próximo dia 1.
//
// A regra do "próximo dia 1" protege o combinado do mês (quantidades,
// entregas novas ou removidas). Trocar o setor de quem marca, corrigir
// o nome ou dizer que um item de 1 por mês é entrega única não muda o
// combinado — e esperar o mês virar deixava o item no setor errado,
// sem ninguém conseguir marcar. Então, para os itens que continuam no
// escopo (mesmo id), setor, nome e "única" (só se já era 1 por mês)
// passam também para o mês em andamento.
//
// O histórico não muda: se a versão vigente começou num mês passado,
// a correção entra como uma versão nova a partir do mês atual, com as
// mesmas quantidades. Devolve { versoes, corrigiu }.
const semUnica = ({ unica, ...resto }) => resto;
const comUnica = (it, unica) => (unica ? { ...semUnica(it), unica: true } : semUnica(it));

export function aplicarCorrecoesNoMes(versoes, itensNovos, mes = mesChave(), por = null) {
  const ordenadas = [...(versoes || [])].filter(v => v && v.desde).sort((a, b) => a.desde.localeCompare(b.desde));
  const vigentes = ordenadas.filter(v => v.desde <= mes);
  const vig = vigentes[vigentes.length - 1];
  if (!vig) return { versoes: ordenadas, corrigiu: false };

  const novos = new Map((itensNovos || []).map(it => [it.id, it]));
  let corrigiu = false;
  const itens = (vig.itens || []).map(it => {
    const n = novos.get(it.id);
    if (!n) return it;
    const unica = num(it.qtd) === 1 ? n.unica === true : it.unica === true;
    if (n.sector === it.sector && n.label === it.label && unica === (it.unica === true)) return it;
    corrigiu = true;
    return comUnica({ ...it, sector: n.sector, label: n.label }, unica);
  });
  if (!corrigiu) return { versoes: ordenadas, corrigiu: false };

  const corrigida = vig.desde === mes
    ? { ...vig, itens }
    : { desde: mes, itens, por: por || null, em: new Date().toISOString(), correcao: true };
  const resto = ordenadas.filter(v => v !== vig || vig.desde !== mes);
  return {
    versoes: [...resto, corrigida].sort((a, b) => a.desde.localeCompare(b.desde)),
    corrigiu: true,
  };
}

// Item de escopo que na verdade é serviço único (site, ID Visual) —
// regra em SETORES_ENTREGA_UNICA / TERMOS_ENTREGA_UNICA (firebase.js).
// Nome comparado sem acento e sem caixa: o escopo é texto livre.
const semAcento = (t) => String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
export function ehEntregaUnica(item) {
  if (!item) return false;
  if (SETORES_ENTREGA_UNICA.includes(item.sector)) return true;
  const nome = semAcento(item.label);
  return TERMOS_ENTREGA_UNICA.some(t => nome.includes(t));
}

// ─── Entregas de um mês ───────────────────────────────────────
// Mês em que a entrega única manual foi marcada (o primeiro com
// marcação), ou null se ainda está pendente.
export function mesDaEntregaUnica(c, itemId) {
  const meses = Object.keys(c?.entregas || {}).sort();
  return meses.find(m => num(c.entregas[m]?.feito?.[itemId]) > 0) || null;
}

// Lista de itens do mês com quantidade combinada e quantidade feita.
// Serviço único cadastrado no escopo por engano (ou antes da regra)
// fica de fora: a entrega dele vem do painel, em `entregasUnicasDoMes`.
// Entrega única manual segue a regra do cabeçalho: pendente só no mês
// corrente (meses passados não guardam que ela estava pendente) e
// 1 de 1 no mês em que foi marcada. Ajuste do mês não se aplica a ela.
export function entregasDoMes(c, mes = mesChave()) {
  const versao = escopoVigente(c, mes);
  if (!versao) return [];
  const reg = c?.entregas?.[mes] || {};
  return (versao.itens || [])
    .filter(it => !ehEntregaUnica(it))
    .map(it => {
      if (it.unica === true) {
        const feitaEm = mesDaEntregaUnica(c, it.id);
        if (feitaEm ? feitaEm !== mes : mes !== mesChave()) return null;
        return { ...it, qtd: 1, qtdContrato: 1, ajustado: false, feito: feitaEm ? 1 : 0 };
      }
      const ajuste = reg.qtd?.[it.id];
      const qtd = ajuste != null ? num(ajuste) : num(it.qtd);
      return {
        ...it,
        qtd,
        qtdContrato: num(it.qtd),
        ajustado: ajuste != null && num(ajuste) !== num(it.qtd),
        feito: num(reg.feito?.[it.id]),
      };
    })
    .filter(it => it && (it.qtd > 0 || it.feito > 0));
}

// Quanto do mês (em tempo ÚTIL) já passou: 0 a 1.
export function fracaoDoMes(mes, agora = new Date()) {
  const atual = mesChave(agora);
  if (mes < atual) return 1;
  if (mes > atual) return 0;
  const ini = inicioDoMes(mes);
  const total = businessMsBetween(ini, fimDoMes(mes));
  if (!total) return 1;
  return Math.min(1, businessMsBetween(ini, agora) / total);
}

// Item concluído no mês: feito alcançou o combinado.
//
// Não existe "atrasado" nem "abaixo do ritmo" (decisão de set/2026).
// O ritmo esperado dividia o combinado igualmente pelo mês útil, mas o
// planejamento de cada cliente tem o seu próprio calendário (3 artes
// por semana, um lote no fim do mês...). A conta padrão acusava atraso
// de quem estava seguindo o planejamento. O acompanhamento é só o
// contador e a barra; o julgamento fica com quem conhece o cliente.
export const itemConcluido = (item) => item.qtd > 0 && item.feito >= item.qtd;

// Aderência do mês: entregue (limitado ao combinado) / combinado.
// Entregar a mais num item não compensa o que faltou em outro.
export function resumoMes(itens) {
  const combinado = itens.reduce((s, it) => s + it.qtd, 0);
  const entregue = itens.reduce((s, it) => s + Math.min(it.feito, it.qtd), 0);
  return {
    combinado,
    entregue,
    pct: combinado ? Math.round((entregue / combinado) * 100) : null,
  };
}

// Cor da aderência. Enquanto o mês corre ela é neutra — 40% no dia 10
// não diz nada sem o planejamento do cliente. Verde ao completar; com
// o mês fechado, a régua de sempre (âmbar de 70% a 99%, vermelho
// abaixo), porque aí o número é o resultado final.
export function tomAderencia(pct, mes = mesChave(), agora = new Date()) {
  if (pct == null) return undefined;
  if (pct >= 100) return 'good';
  if (mes >= mesChave(agora)) return undefined;
  return pct >= 70 ? 'warn' : 'bad';
}

// Resumo de um mês fechou 100%? (lista do admin, painel de quem produz)
export const mesConcluido = (resumo) => resumo.combinado > 0 && resumo.entregue >= resumo.combinado;

// Meses fechados que têm escopo vigente, do mais recente ao mais
// antigo. Para no mês de encerramento do contrato, se houver.
export function historicoMeses(c, agora = new Date(), limite = 24) {
  const vs = versoesDoEscopo(c);
  if (!vs.length) return [];
  const primeiro = vs[0].desde;
  const contrato = contractState(c);
  const ultimoAberto = contrato.status === 'closed' && contrato.closedAt
    ? mesChave(new Date(contrato.closedAt))
    : mesChave(agora);
  const lista = [];
  let m = somaMeses(mesChave(agora), -1);
  while (m >= primeiro && lista.length < limite) {
    if (m <= ultimoAberto) {
      const itens = entregasDoMes(c, m);
      if (itens.length) lista.push({ mes: m, itens, resumo: resumoMes(itens) });
    }
    m = somaMeses(m, -1);
  }
  return lista;
}

// Cliente que está acompanhando entregas no mês: ativo na base, com
// contrato não encerrado e escopo vigente com item.
export function acompanhaEntregas(c, mes = mesChave()) {
  if (!c || c.active === false || stageOf(c) !== 'live') return false;
  if (contractState(c).status === 'closed') return false;
  return entregasDoMes(c, mes).length > 0;
}

// Meses em que ainda dá para marcar. Além do mês atual, o anterior
// continua aberto até o dia 5: quem entregou no dia 30 e só lembrou de
// marcar no dia 1 não perde a entrega.
export const DIAS_TOLERANCIA_MES_ANTERIOR = 5;
export function mesesEditaveis(agora = new Date()) {
  const atual = mesChave(agora);
  return agora.getDate() <= DIAS_TOLERANCIA_MES_ANTERIOR ? [atual, somaMeses(atual, -1)] : [atual];
}

// Itens de um setor (para o painel de quem produz).
export const entregasDoSetor = (c, sector, mes = mesChave()) => (
  entregasDoMes(c, mes).filter(it => it.sector === sector)
);

// ─── Checklist mensal do Social Media ─────────────────────────
// Marcos de `SM_MARCOS_MENSAIS` marcados no mês: { [id]: { by, at } }.
// Cliente antigo não tem `smMensal` — volta vazio.
export const marcosDoMes = (c, mes = mesChave()) => {
  const reg = c?.smMensal?.[mes];
  return reg && typeof reg === 'object' ? reg : {};
};

// ─── Entregas únicas (site, ID Visual) ────────────────────────
// Não têm checklist novo: leem o que os painéis de Web e Design já
// controlam. Prazo com a mesma regra do card do Web: 7 dias no
// onboarding, `days` do serviço na produção. Regra de negócio em
// SETORES_ENTREGA_UNICA (firebase.js).
const WD_FASE = {
  onboarding: 'Onboarding',
  production: 'Produção',
  inactive: 'Parado',
  recurrence: 'Concluído · em recorrência',
  finished: 'Concluído',
};
const CONCLUIDO = ['finished', 'recurrence'];

function prazoDe(status, inicio, dias) {
  if (!inicio || !dias) return null;
  const d = new Date(inicio);
  if (Number.isNaN(d.getTime())) return null;
  if (status === 'onboarding' && d > new Date()) return null; // call ainda não aconteceu
  return new Date(d.getTime() + dias * 86400000);
}

export function entregasUnicas(c) {
  if (!c) return [];
  const lista = wdJobsOf(c).map(job => {
    const cfg = WD_SERVICE_CONFIG[job.service] || {};
    const check = Array.isArray(job.checklist) ? job.checklist : [];
    const inicio = job.status === 'onboarding'
      ? (c.kickoff?.at || job.onboardingStartedAt)
      : job.productionStartedAt;
    const prazo = CONCLUIDO.includes(job.status) ? null
      : prazoDe(job.status, inicio, job.status === 'onboarding' ? 7 : (cfg.days || 30));
    return {
      id: `wd_${job.id}`,
      sector: 'webdesign',
      label: cfg.label || job.service || 'Site',
      status: job.status,
      fase: WD_FASE[job.status] || job.status || '—',
      concluido: CONCLUIDO.includes(job.status),
      checklist: { feito: check.filter(i => i?.checked).length, total: check.length },
      prazo,
      atrasado: !!prazo && prazo < new Date(),
      concluidoEm: job.finishedAt || null,
      responsaveis: asArray(job.responsibles),
    };
  });

  if (c.idv?.status) {
    const check = Array.isArray(c.idv.checklist) ? c.idv.checklist : [];
    const status = c.idv.status;
    const inicio = status === 'onboarding'
      ? (c.kickoff?.at || c.idv.onboardingStartedAt)
      : c.idv.productionStartedAt;
    const prazo = CONCLUIDO.includes(status) ? null
      : prazoDe(status, inicio, status === 'onboarding' ? (ID_VISUAL_CONFIG.onboardingDays || 7) : ID_VISUAL_CONFIG.days);
    lista.push({
      id: 'idv',
      sector: 'design',
      label: ID_VISUAL_CONFIG.label,
      status,
      fase: WD_FASE[status] || status,
      concluido: CONCLUIDO.includes(status),
      checklist: { feito: check.filter(i => i?.checked).length, total: check.length },
      prazo,
      atrasado: !!prazo && prazo < new Date(),
      concluidoEm: c.idv.finishedAt || null,
      responsaveis: asArray(c.idv.responsible),
    });
  }
  return lista;
}

// Entregas únicas que contam num mês, no formato das recorrentes
// ({ qtd: 1, feito: 0 | 1 }) para somar no mesmo resumo:
//   · finalizada DENTRO do mês → 1 de 1, naquele mês e só nele;
//   · em onboarding ou produção → 0 de 1, só no mês corrente (a
//     entrega é esperada agora; meses passados não guardam o estado
//     que o card tinha, então lá conta só o que foi finalizado);
//   · parada (Inativo) não conta — o serviço está suspenso;
//   · finalizada sem data (legado anterior ao `finishedAt`) não conta
//     em mês nenhum, porque não dá para saber quando foi.
// Web segue o filtro do painel do Web (cliente liberado, `active`);
// ID Visual segue a carteira do Design (`naCarteira`).
// `sector` filtra o setor e `dono` o responsável (null = todos).
export function entregasUnicasDoMes(c, mes = mesChave(), { sector = null, dono = null } = {}) {
  if (!c || !naCarteira(c)) return [];
  const ini = inicioDoMes(mes);
  const fim = fimDoMes(mes);
  const corrente = mes === mesChave();
  return entregasUnicas(c)
    .filter(u => !sector || u.sector === sector)
    .filter(u => u.sector !== 'webdesign' || c.active !== false)
    .filter(u => !dono || u.responsaveis.includes(dono))
    .map(u => {
      if (u.concluido) {
        const em = u.concluidoEm ? new Date(u.concluidoEm) : null;
        if (!em || Number.isNaN(em.getTime()) || em < ini || em >= fim) return null;
        return { ...u, unica: true, qtd: 1, feito: 1, concluidoEm: em };
      }
      if (!corrente || !WD_ACTIVE_STATUSES.includes(u.status)) return null;
      return { ...u, unica: true, qtd: 1, feito: 0 };
    })
    .filter(Boolean);
}

// ─── Pendências de cadastro ───────────────────────────────────
// Só clientes que já estão (ou estão entrando) na base. O que falta
// aqui não trava nada: é o selo que a CS usa para completar a base.
export function cadastroPendencias(c) {
  if (!c) return [];
  const contrato = c.contrato || {};
  const faltas = [];
  // Contrato e briefing (arquivos) são opcionais: não contam como falta.
  if (!contractState(c).baseMonths) faltas.push('prazo');
  const servicos = contrato.servicos || c.services || [];
  if (!Array.isArray(servicos) || servicos.length === 0) faltas.push('servicos');
  if (!temEscopoDefinido(c)) faltas.push('escopo');
  return faltas;
}

export const cadastroCompleto = (c) => cadastroPendencias(c).length === 0;

// ─── Saúde manual desatualizada ───────────────────────────────
// Sem avaliação, ou avaliação mais velha que HEALTH_STALE_DAYS.
export function saudeDesatualizada(c, agora = new Date()) {
  const at = c?.clientHealth?.at;
  if (!c?.clientHealth?.level || !at) return true;
  const dias = (agora.getTime() - new Date(at).getTime()) / 86400000;
  return dias > HEALTH_STALE_DAYS;
}
