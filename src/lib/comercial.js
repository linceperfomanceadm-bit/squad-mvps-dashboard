import { stageOf, contractState } from './firebase';
import { businessMsBetween, BUSINESS_MS_PER_DAY } from './taskTime';
import { mesChave, inicioDoMes, fimDoMes, fracaoDoMes } from './entregas';

/*
 * Números do comercial (Hunters) — funções puras, usadas pela TV da
 * sala comercial e pelo painel de lançamentos. Nada aqui lê Firestore.
 *
 * Entradas: `config` (app_config/comercial), `dadosMes`
 * (app_config/comercial_AAAA-MM) e `clients` (para carteira, contratos
 * e churn registrado pela CS).
 */

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
// Nome do SDR vira chave de mapa no Firestore. Ponto e alguns símbolos
// quebram o caminho do campo, então são trocados por "_".
export const chaveSdr = (nome) => String(nome || '').replace(/[.~*/[\]`]/g, '_');
const norm = (s) => String(s || '').trim().toLowerCase();

const toDate = (v) => {
  if (!v) return null;
  if (typeof v?.toDate === 'function') return v.toDate();
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
};

const noMes = (v, mes) => {
  const d = toDate(v);
  return !!d && mesChave(d) === mes;
};

// Dias úteis que ainda sobram no mês, contando o de hoje se o
// expediente não acabou. Arredonda para cima: meio dia é um dia.
export function diasUteisRestantes(mes, agora = new Date()) {
  if (mes !== mesChave(agora)) return mes > mesChave(agora) ? null : 0;
  const ms = businessMsBetween(agora, fimDoMes(mes));
  return Math.ceil(ms / BUSINESS_MS_PER_DAY);
}

export function resumoComercial({ config = {}, dadosMes = {}, clients = [], mes = mesChave(), agora = new Date() }) {
  const vendas = (Array.isArray(dadosMes.vendas) ? dadosMes.vendas : [])
    .filter(v => v && num(v.valor) > 0)
    .sort((a, b) => String(b.at || '').localeCompare(String(a.at || '')));
  const meta = num(dadosMes.meta);
  const vendido = vendas.reduce((s, v) => s + num(v.valor), 0);
  const nVendas = vendas.length;
  const faltam = Math.max(0, meta - vendido);
  const diasRestantes = diasUteisRestantes(mes, agora);
  const esperadoHoje = meta * fracaoDoMes(mes, agora);

  // ── Ranking de Closers (time cadastrado + quem aparece em venda) ──
  const nomesCloser = new Set([...(config.closers || []), ...vendas.map(v => v.closer)].filter(Boolean));
  const closers = [...nomesCloser].map(nome => {
    const minhas = vendas.filter(v => v.closer === nome);
    const valor = minhas.reduce((s, v) => s + num(v.valor), 0);
    return { nome, valor, qtd: minhas.length, ticket: minhas.length ? valor / minhas.length : 0 };
  }).sort((a, b) => b.valor - a.valor || b.qtd - a.qtd || a.nome.localeCompare(b.nome));

  // ── Ranking de SDRs ──────────────────────────────────────────
  const sdrMap = dadosMes.sdr || {};
  const sdrs = (config.sdrs || []).filter(Boolean).map(nome => {
    const d = sdrMap[chaveSdr(nome)] || {};
    const agendados = num(d.agendados);
    const realizados = num(d.realizados);
    const noShow = num(d.noShow);
    const base = realizados + noShow;
    return { nome, agendados, realizados, noShow, comparecimento: base ? Math.round((realizados / base) * 100) : null };
  }).sort((a, b) => b.agendados - a.agendados || b.realizados - a.realizados || a.nome.localeCompare(b.nome));

  const agendados = sdrs.reduce((s, x) => s + x.agendados, 0);
  const realizados = sdrs.reduce((s, x) => s + x.realizados, 0);
  const noShows = sdrs.reduce((s, x) => s + x.noShow, 0);
  const leads = num(dadosMes.leads);
  const taxa = (a, b) => (b ? Math.round((a / b) * 100) : null);

  // ── Carteira (automático, dos clientes do app) ───────────────
  const ativos = clients.filter(c => c.active !== false && stageOf(c) === 'live');
  const emEntrada = clients.filter(c => ['kickoff', 'staffing', 'onboarding'].includes(stageOf(c)));
  const entraramNoMes = clients.filter(c => noMes(c.kickoff?.confirmedAt, mes));

  // ── Sinal vermelho ───────────────────────────────────────────
  // Churn = o que o líder lançou + contratos encerrados pela CS no mês.
  // Mesmo cliente nos dois conta uma vez (o lançamento manual traz o valor).
  const manual = (Array.isArray(dadosMes.churn) ? dadosMes.churn : []).filter(Boolean);
  const nomesManual = new Set(manual.map(c => norm(c.cliente)));
  const automatico = clients
    .filter(c => contractState(c).status === 'closed' && noMes(c.contract?.closedAt, mes))
    .filter(c => !nomesManual.has(norm(c.name)))
    .map(c => ({ id: `auto_${c.id}`, cliente: c.name, valorMensal: 0, motivo: c.contract?.closeReason || '', auto: true }));
  const churn = [...manual, ...automatico];
  const mrrPerdido = manual.reduce((s, c) => s + num(c.valorMensal), 0);

  const vencendo = ativos
    .map(c => ({ c, st: contractState(c) }))
    .filter(x => ['ending', 'expired'].includes(x.st.status))
    .sort((a, b) => num(a.st.daysLeft) - num(b.st.daysLeft))
    .map(({ c, st }) => ({ id: c.id, nome: c.name, dias: st.daysLeft }));

  const emRisco = ativos
    .filter(c => ['red', 'orange'].includes(c.clientHealth?.level))
    .map(c => ({ id: c.id, nome: c.name, nivel: c.clientHealth.level }));

  // ── Curva do mês (acumulado por dia, para o gráfico) ─────────
  const ini = inicioDoMes(mes);
  const diasNoMes = new Date(ini.getFullYear(), ini.getMonth() + 1, 0).getDate();
  const hojeDia = mes === mesChave(agora) ? agora.getDate() : (mes < mesChave(agora) ? diasNoMes : 0);
  const porDia = Array.from({ length: diasNoMes }, () => 0);
  vendas.forEach(v => {
    const d = v.data ? new Date(`${v.data}T12:00:00`) : toDate(v.at);
    if (d && mesChave(d) === mes) porDia[d.getDate() - 1] += num(v.valor);
  });
  let acc = 0;
  const acumulado = porDia.map((v, i) => { acc += v; return i < hojeDia ? acc : null; });

  return {
    mes,
    meta,
    vendido,
    nVendas,
    ticket: nVendas ? vendido / nVendas : 0,
    pct: meta ? Math.round((vendido / meta) * 100) : null,
    faltam,
    diasRestantes,
    porDiaUtil: diasRestantes ? faltam / diasRestantes : null,
    esperadoHoje,
    noRitmo: vendido >= esperadoHoje,
    fracao: fracaoDoMes(mes, agora),
    closers,
    sdrs,
    funil: {
      leads, agendados, realizados, vendas: nVendas,
      taxaAgendamento: taxa(agendados, leads),
      taxaComparecimento: taxa(realizados, realizados + noShows),
      taxaFechamento: taxa(nVendas, realizados),
    },
    noShows,
    vendasRecentes: vendas.slice(0, 7),
    carteira: { ativos: ativos.length, emEntrada: emEntrada.length, entraramNoMes: entraramNoMes.length },
    churn,
    mrrPerdido,
    vencendo,
    emRisco,
    curva: { acumulado, diasNoMes },
  };
}
