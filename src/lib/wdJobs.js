import { WD_SERVICE_CONFIG, WD_ONBOARDING_DIAS, WD_PRAZO_ZERADO_EM, WD_PONTOS } from './firebase';

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
// Serviço sem responsável próprio vale o responsável de Web do
// cliente (`responsibles.webdesign`): é o caso do principal legado,
// que nunca teve `wd.responsibles`, e do serviço cujo responsável saiu
// do app — assim ele segue para quem o líder indicar no lugar, em vez
// de ficar sem dono e sumir de todas as carteiras.
export function wdJobsOf(client) {
  if (!client) return [];
  const doCliente = asArray(client.responsibles?.webdesign);
  const donos = (v) => (asArray(v).length ? asArray(v) : doCliente);
  const list = [];
  if (client.wd?.status) {
    list.push({ ...client.wd, id: 'main', responsibles: donos(client.wd.responsibles) });
  }
  (client.wdJobs || []).forEach(j => {
    if (j?.id && j.status) list.push({ ...j, responsibles: donos(j.responsibles) });
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

// ─── Pausa do projeto ─────────────────────────────────────────
// Projeto parado por causa do cliente (material que não chega,
// aprovação que não sai) não pode contar contra o web designer. Mas,
// como o prazo vale ponto, a pausa só existe depois que o LÍDER aceita
// a justificativa — senão qualquer um pausaria para não atrasar.
//
// `job.pausa` é a pausa corrente, uma só por vez:
//   { estado: 'pendente', motivo, pedidoPor, pedidoEm }   aguardando o líder
//   { estado: 'ativa', ..., aprovadoPor, aprovadoEm, desde } valendo
// `job.pausas[]` é o histórico: pausas encerradas (`estado:
// 'encerrada'`, com `desde`/`ate`) e pedidos recusados (`estado:
// 'recusada'`, que nunca descontam tempo).
//
// A pausa aprovada começa no PEDIDO (`desde = pedidoEm`): o líder
// confirmou que o projeto estava parado desde ali, e a demora dele
// para responder não pode virar atraso de quem pediu.
const DIA_MS = 86400000;
const msDe = (iso) => {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? null : t;
};

export const wdPausaAtiva = (job) => (job?.pausa?.estado === 'ativa' ? job.pausa : null);
export const wdPausaPendente = (job) => (job?.pausa?.estado === 'pendente' ? job.pausa : null);

// Tempo pausado (aprovado) dentro da janela [de, ate].
export function wdMsPausado(job, de, ate) {
  const trechos = asArray(job?.pausas)
    .filter(p => p && p.estado !== 'recusada')
    .map(p => [msDe(p.desde), msDe(p.ate)]);
  const ativa = wdPausaAtiva(job);
  if (ativa) trechos.push([msDe(ativa.desde), ate]);
  return trechos.reduce((soma, [ini, fim]) => {
    if (ini == null || fim == null) return soma;
    return soma + Math.max(0, Math.min(fim, ate) - Math.max(ini, de));
  }, 0);
}

// ─── Relógio do serviço ───────────────────────────────────────
// Um relógio só para card, visão geral, entregas da CS e pontuação.
// Prazos em dias CORRIDOS (é o prazo combinado com o cliente: 7 dias de
// onboarding, `WD_SERVICE_CONFIG[service].days` de produção) — por isso
// não usa o motor de horário comercial do taskTime. O que muda em
// relação ao lembrete antigo:
//  - nada começa antes de `WD_PRAZO_ZERADO_EM` (contagens zeradas);
//  - o tempo de pausa aprovada é descontado e o relógio congela
//    enquanto a pausa está ativa.
// Devolve null para serviço fora de onboarding/produção ou sem data.
export function wdRelogio(client, job, agora = Date.now()) {
  const status = job?.status;
  let bruto; let dias;
  if (status === 'onboarding') {
    bruto = wdOnboardingStart(client, job);
    dias = WD_ONBOARDING_DIAS;
  } else if (status === 'production') {
    bruto = job.productionStartedAt;
    dias = WD_SERVICE_CONFIG[job.service]?.days || 30;
  } else {
    return null;
  }
  const ini0 = msDe(bruto);
  if (ini0 == null) return null;
  // Call de onboarding marcada para o futuro: o prazo nem começou.
  if (status === 'onboarding' && ini0 > agora) {
    return { status, dias, aguardandoCall: true, callEm: bruto };
  }
  const ini = Math.max(ini0, msDe(WD_PRAZO_ZERADO_EM) || 0);
  const pausadoMs = wdMsPausado(job, ini, agora);
  const decorridoMs = Math.max(0, agora - ini - pausadoMs);
  const restanteMs = dias * DIA_MS - decorridoMs;
  return {
    status,
    dias,
    aguardandoCall: false,
    inicio: new Date(ini).toISOString(),
    zerado: ini > ini0,
    pausado: !!wdPausaAtiva(job),
    pausadoMs,
    decorridoMs,
    restanteMs,
    atrasado: restanteMs < 0,
    // Data-limite projetada: anda para frente a cada pausa aprovada.
    prazo: new Date(ini + dias * DIA_MS + pausadoMs),
  };
}

// Onboarding estourado. Call marcada para o futuro não conta.
export function wdOnboardingLate(client, job) {
  if (job?.status !== 'onboarding') return false;
  return !!wdRelogio(client, job)?.atrasado;
}

export function wdProducaoLate(job) {
  if (job?.status !== 'production') return false;
  return !!wdRelogio(null, job)?.atrasado;
}

// ─── Pontuação ────────────────────────────────────────────────
// Regras (WD_PONTOS em firebase.js):
//  - item do checklist marcado: 1 ponto para quem marcou
//    (`checkedBy`, gravado desde nov/2026 — marcação antiga sem autor
//    não pontua), no mês em que foi marcado;
//  - projeto concluído (produção → finalizado ou recorrência): 5 pontos
//    no prazo, 2 fora, para CADA responsável do serviço naquele
//    momento. O resultado fica carimbado em `conclusao` na hora — o
//    "no prazo" não é recalculado depois.
// Nada anterior a `WD_PRAZO_ZERADO_EM` pontua.
//
// Os pontos são derivados do estado do serviço, não de um extrato
// gravado: desmarcar um item tira o ponto. Para "Reativar" não apagar
// os pontos já ganhos, o ciclo anterior (checklist + conclusão) é
// arquivado em `job.ciclos[]` antes de zerar o serviço.
const pad2 = (n) => String(n).padStart(2, '0');
export const wdMesChave = (d = new Date()) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;

// Carimbo da conclusão: chamado no momento em que o serviço sai da
// produção para finalizado/recorrência.
export function wdConclusao(job, byName, agora = Date.now()) {
  const r = wdRelogio(null, { ...job, status: 'production' }, agora);
  const noPrazo = r ? r.restanteMs >= 0 : true;
  return {
    em: new Date(agora).toISOString(),
    noPrazo,
    pts: noPrazo ? WD_PONTOS.noPrazo : WD_PONTOS.foraDoPrazo,
    responsaveis: asArray(job?.responsibles),
    por: byName || null,
  };
}

// Placar do mês: { [nome]: { name, pontos, checks, noPrazo, foraDoPrazo } }.
// `clients` pode incluir inativos — ponto ganho não some porque o
// cliente saiu depois.
export function wdPlacarDoMes(clients, mes = wdMesChave()) {
  const corte = msDe(WD_PRAZO_ZERADO_EM) || 0;
  const placar = {};
  const de = (nome) => {
    if (!placar[nome]) placar[nome] = { name: nome, pontos: 0, checks: 0, noPrazo: 0, foraDoPrazo: 0 };
    return placar[nome];
  };
  const valeNoMes = (iso) => {
    const t = msDe(iso);
    return t != null && t >= corte && wdMesChave(new Date(t)) === mes;
  };
  (clients || []).forEach(c => {
    wdJobsOf(c).forEach(job => {
      [...asArray(job.ciclos), job].forEach(ciclo => {
        asArray(ciclo.checklist).forEach(item => {
          if (item?.checked && item.checkedBy && valeNoMes(item.checkedAt)) {
            const p = de(item.checkedBy);
            p.checks += 1;
            p.pontos += WD_PONTOS.check;
          }
        });
        const fim = ciclo.conclusao;
        if (fim && valeNoMes(fim.em)) {
          asArray(fim.responsaveis).forEach(nome => {
            const p = de(nome);
            p.pontos += fim.pts || 0;
            if (fim.noPrazo) p.noPrazo += 1; else p.foraDoPrazo += 1;
          });
        }
      });
    });
  });
  return placar;
}

// Placar em lista, do maior para o menor. Empate: mais projetos no
// prazo, depois mais checks.
export function wdRanking(clients, mes) {
  return Object.values(wdPlacarDoMes(clients, mes))
    .filter(p => p.pontos > 0)
    .sort((a, b) => (b.pontos - a.pontos) || (b.noPrazo - a.noPrazo) || (b.checks - a.checks));
}
