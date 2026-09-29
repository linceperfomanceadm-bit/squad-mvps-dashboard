import { stageOf, naCarteira } from './firebase';
import { asArray } from './wdJobs';

/*
 * RESPONSÁVEIS DO CLIENTE — funções puras, sem Firestore.
 *
 * Quem cuida de cada cliente é gravado pelo NOME, não pelo id do
 * colaborador, em vários blocos do documento:
 *
 *   responsibles: { [setor]: [nomes] }   (string nos docs antigos)
 *   wd.responsibles / wdJobs[].responsibles   (serviços de site)
 *   idv.responsible                           (dono do ID Visual)
 *
 * Por isso excluir um colaborador não tira o nome dos clientes: o
 * nome continua lá, invisível na tela de edição (que só lista quem
 * existe) e ninguém consegue desmarcar. As funções daqui encontram
 * esses nomes e dizem o que precisa mudar em cada cliente para tirá-los.
 *
 * VAGA: quando a saída de alguém deixa um setor sem ninguém, o cliente
 * ganha `vagas[setor] = { saiu, desde, por }`. É o que coloca o
 * cliente na lista do líder do setor para indicar outra pessoa. A vaga
 * só conta enquanto o setor continua vazio — preencheu, some sozinha,
 * sem precisar apagar nada.
 */

// Todos os nomes que o cliente carrega como responsável, em qualquer bloco.
export function nomesDoCliente(c) {
  const nomes = new Set();
  const add = (v) => asArray(v).forEach(n => { if (n) nomes.add(n); });
  Object.values(c?.responsibles || {}).forEach(add);
  add(c?.wd?.responsibles);
  (Array.isArray(c?.wdJobs) ? c.wdJobs : []).forEach(j => add(j?.responsibles));
  add(c?.idv?.responsible);
  return nomes;
}

// Nomes presos em clientes que não existem mais como colaborador, com
// os clientes onde cada um aparece. Inativo NÃO entra: ele ainda existe
// e pode voltar. Sem a lista de colaboradores carregada, não acusa
// nada — senão todo nome pareceria de ex-colaborador.
export function exColaboradores(clients, collaborators) {
  if (!Array.isArray(collaborators) || !collaborators.length) return [];
  const existentes = new Set(collaborators.map(c => c.name).filter(Boolean));
  const mapa = {};
  (clients || []).forEach(c => {
    nomesDoCliente(c).forEach(nome => {
      if (existentes.has(nome)) return;
      if (!mapa[nome]) mapa[nome] = [];
      mapa[nome].push(c);
    });
  });
  return Object.entries(mapa)
    .map(([nome, clientes]) => ({ nome, clientes }))
    .sort((a, b) => b.clientes.length - a.clientes.length || a.nome.localeCompare(b.nome, 'pt-BR'));
}

/*
 * O que muda num cliente para tirar os `nomes` de todos os blocos.
 * Devolve `set` (caminho → valor), `apagar` (caminhos a remover) e
 * `mudou`. Quem grava é o hook, que traduz `apagar` em deleteField().
 *
 *   · setor que fica vazio abre VAGA (ver acima);
 *   · serviço de site que fica sem ninguém volta a seguir o
 *     responsável de Web do cliente (regra de `wdJobsOf`);
 *   · ID Visual passa para o próximo designer do cliente, mantendo
 *     status e prazo; sem designer, fica sem dono até o líder indicar.
 */
export function planoSemNomes(c, nomes, { at, by } = {}) {
  const set = {};
  const apagar = [];
  const sai = (n) => nomes.has(n);
  const fica = (v) => asArray(v).filter(n => !sai(n));

  let designFinal = asArray(c?.responsibles?.design);
  Object.entries(c?.responsibles || {}).forEach(([sid, v]) => {
    const antes = asArray(v);
    const depois = fica(antes);
    if (depois.length === antes.length) return;
    set[`responsibles.${sid}`] = depois;
    if (sid === 'design') designFinal = depois;
    if (!depois.length) {
      set[`vagas.${sid}`] = { saiu: antes.filter(sai), desde: at || null, por: by || null };
    }
  });

  if (c?.wd && c.wd.responsibles !== undefined) {
    const antes = asArray(c.wd.responsibles);
    const depois = fica(antes);
    if (depois.length !== antes.length) {
      if (depois.length) set['wd.responsibles'] = depois;
      else apagar.push('wd.responsibles');
    }
  }

  if (Array.isArray(c?.wdJobs)) {
    let mexeu = false;
    const jobs = c.wdJobs.map(j => {
      if (!j || j.responsibles === undefined) return j;
      const antes = asArray(j.responsibles);
      const depois = fica(antes);
      if (depois.length === antes.length) return j;
      mexeu = true;
      return { ...j, responsibles: depois };
    });
    if (mexeu) set.wdJobs = jobs;
  }

  if (c?.idv?.responsible && sai(c.idv.responsible)) {
    set['idv.responsible'] = designFinal[0] || null;
    set['idv.reassignedAt'] = at || null;
    set['idv.reassignedBy'] = by || null;
    set['idv.reassignedFrom'] = c.idv.responsible;
  }

  return { set, apagar, mudou: Object.keys(set).length > 0 || apagar.length > 0 };
}

// Setores do cliente que ficaram sem ninguém porque a pessoa saiu.
// Staffing fica de fora: lá o quadro incompleto já aparece em
// "Aguardando sua indicação".
export function vagasAbertas(c) {
  if (!c || !naCarteira(c) || stageOf(c) === 'staffing') return [];
  return Object.entries(c.vagas || {})
    .filter(([sid, v]) => v && !asArray(c.responsibles?.[sid]).length)
    .map(([sid, v]) => ({ sector: sid, saiu: asArray(v.saiu), desde: v.desde || null }));
}
