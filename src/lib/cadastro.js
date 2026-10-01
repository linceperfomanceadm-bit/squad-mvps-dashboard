import { SALE_SERVICES, normalizaLink, linkValido, contractState } from './firebase';
import { escopoParaEditar, ehEntregaUnica, mesChave } from './entregas';
import { asArray } from './wdJobs';

/*
 * CADASTRO DO CLIENTE — funções puras do formulário único
 * (components/cadastro/ClienteForm.js).
 *
 * Um formulário só para três portas, que antes eram quatro telas:
 *   · CS cadastra cliente novo   → nasce em `kickoff`, segue o fluxo
 *   · admin cadastra cliente novo → mesmos dados obrigatórios, mas
 *                                   nasce direto na base (`live`),
 *                                   pulando só Kick Off e onboarding
 *   · CS, líder e admin editam    → completar cliente antigo ou corrigir
 *
 * Aqui ficam o estado inicial, a validação e a montagem do que vai
 * para o Firestore, para que criar e editar gravem o mesmo formato.
 *
 * DADOS SENSÍVEIS (CPF, CNPJ, valor e pagamento) são "só escrita" na
 * edição: o formulário nunca devolve o que está gravado, só diz se já
 * foi preenchido. Quem precisa trocar digita o novo valor por cima.
 * É a regra de sempre — contrato, CPF/CNPJ e valores não aparecem em
 * tela nenhuma do app.
 */

export const UFS = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'];

const txt = (v) => String(v ?? '').trim();

// "4.500,00" ou "4500" → 4500.
export const parseValor = (v) => parseFloat(String(v ?? '').replace(/\./g, '').replace(',', '.')) || 0;

const toInputDate = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

// "AAAA-MM-DD" vira meio-dia local, para não voltar um dia em fuso
// negativo (mesma regra do saveCadastro).
export const dataDoInput = (v) => {
  const s = txt(v);
  if (!s) return null;
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d, 12, 0, 0).toISOString();
};

export const linhaEndereco = (e = {}) => [
  [txt(e.logradouro), txt(e.numero)].filter(Boolean).join(', '),
  txt(e.complemento),
  txt(e.bairro),
  [txt(e.cidade), txt(e.uf)].filter(Boolean).join('/'),
  txt(e.cep) ? `CEP ${txt(e.cep)}` : '',
].filter(Boolean).join(' - ');

const ENDERECO_VAZIO = { cep: '', logradouro: '', numero: '', complemento: '', bairro: '', cidade: '', uf: '' };
const FINANCEIRO_VAZIO = {
  saleTotal: '', paymentMethod: '', paymentType: 'avista',
  installments: '', installmentValue: '', customInstallment: false, customPlan: '',
};

// ─── Estado inicial ───────────────────────────────────────────
export function formVazio() {
  return {
    name: '',
    personType: 'pj',
    razaoSocial: '',
    tradeName: '',
    cnpj: '',
    contactName: '',
    contactCpf: '',
    contactPhone: '',
    contactEmail: '',
    endereco: { ...ENDERECO_VAZIO },
    servicos: {},          // { [serviceId]: 'o que foi vendido' }
    sectors: [],           // setores envolvidos (só no cadastro novo)
    csResponsible: '',     // CS do cliente (cadastro novo da CS)
    wdService: '',
    hasIdVisual: false,
    contractMonths: '',
    contractStart: '',
    financeiro: { ...FINANCEIRO_VAZIO },
    briefing: '',
    driveUrl: '',
    observations: '',
    itens: [],             // escopo: [{ id, sector, label, qtd, unica }]
    semRecorrencia: false,
    responsibles: {},      // equipe (só admin)
  };
}

// Cliente existente → formulário. Campos sensíveis voltam vazios; o
// que diz se já existem é `sensiveis`.
export function formDoCliente(c) {
  const ct = c.contrato || {};
  const servicos = asArray(ct.servicos || c.services).filter(sv => sv && sv.id);
  const versao = escopoParaEditar(c);
  const end = ct.endereco || {};
  return {
    ...formVazio(),
    name: c.name || '',
    personType: ct.personType || 'pj',
    razaoSocial: ct.razaoSocial || '',
    tradeName: ct.tradeName || ct.companyName || '',
    contactName: ct.contactName || c.contactName || '',
    contactPhone: ct.contactPhone || c.contactPhone || '',
    contactEmail: ct.contactEmail || c.contactEmail || '',
    endereco: { ...ENDERECO_VAZIO, ...Object.fromEntries(Object.keys(ENDERECO_VAZIO).map(k => [k, end[k] || ''])) },
    servicos: Object.fromEntries(servicos.map(sv => [sv.id, sv.desc || ''])),
    contractMonths: contractState(c).baseMonths ? String(contractState(c).baseMonths) : '',
    contractStart: toInputDate(c.contract?.startAt),
    briefing: ct.briefing || c.briefing || '',
    driveUrl: ct.driveUrl || '',
    observations: ct.observations || c.observations || '',
    // Site e ID Visual cadastrados como mensais (antes da regra de
    // serviço único) não abrem: a próxima versão do escopo já nasce
    // sem eles.
    itens: (versao?.itens || []).filter(it => !ehEntregaUnica(it))
      .map(it => ({ ...it, qtd: String(it.qtd), unica: it.unica === true })),
    semRecorrencia: c.escopo?.semRecorrencia === true,
    responsibles: Object.fromEntries(Object.entries(c.responsibles || {}).map(([k, v]) => [k, asArray(v)])),
  };
}

// O que de sensível o cliente já tem gravado (sem expor o valor).
export function sensiveisDoCliente(c) {
  const ct = c.contrato || {};
  return {
    cnpj: !!txt(ct.cnpj || c.cnpj),
    contactCpf: !!txt(ct.contactCpf),
    financeiro: !!(Number(ct.saleTotal || c.saleTotal) > 0 || ct.pagamento),
    endereco: txt(ct.address || c.address),
  };
}

// ─── Financeiro ───────────────────────────────────────────────
export function contaFinanceiro(fin) {
  const total = parseValor(fin.saleTotal);
  const parcelas = parseInt(fin.installments, 10) || 0;
  const parcela = parseValor(fin.installmentValue);
  const soma = parcelas * parcela;
  const confere = fin.customInstallment || fin.paymentType === 'avista' || Math.abs(soma - total) < 0.01;
  return { total, parcelas, parcela, soma, confere };
}

export function financeiroValido(fin) {
  const { total, parcelas, parcela, confere } = contaFinanceiro(fin);
  if (!(total > 0) || !fin.paymentMethod) return false;
  if (fin.paymentType === 'avista') return true;
  return fin.customInstallment ? !!txt(fin.customPlan) : (parcelas > 0 && parcela > 0 && confere);
}

export function montarPagamento(fin) {
  const { parcelas, parcela } = contaFinanceiro(fin);
  if (fin.paymentType === 'avista') return { type: 'avista', method: fin.paymentMethod };
  return fin.customInstallment
    ? { type: 'prazo', method: fin.paymentMethod, custom: true, plan: txt(fin.customPlan) }
    : { type: 'prazo', method: fin.paymentMethod, installments: parcelas, installmentValue: parcela };
}

// ─── Escopo ───────────────────────────────────────────────────
export const itensDoEscopo = (itens) => itens
  .map(it => ({ ...it, label: txt(it.label), qtd: it.unica ? 1 : Math.round(Number(it.qtd) || 0) }))
  .filter(it => it.label || it.qtd);

export function erroDoEscopo(itens) {
  if (itens.some(it => !it.label || it.qtd <= 0)) return 'Cada entrega precisa de nome e quantidade maior que zero.';
  const unica = itens.find(ehEntregaUnica);
  if (unica) return `"${unica.label}" é site ou ID Visual: conta sozinho quando o serviço é finalizado no painel, não entra nas entregas.`;
  return '';
}

export const listaServicos = (servicos) => Object.entries(servicos).map(([id, desc]) => ({
  id, desc: txt(desc), label: SALE_SERVICES.find(s => s.id === id)?.label || id,
}));

// ─── Validação por etapa ──────────────────────────────────────
// `novo`: cadastro de cliente novo (tudo obrigatório).
// `admin`: cadastro feito pelo admin (nasce na base com a equipe).
// Na edição só valem as regras de formato, para não travar o
// cliente antigo que ainda está incompleto.
export function errosPorEtapa(f, { novo, admin, financeiroAberto }) {
  const e = { cliente: '', servicos: '', contrato: '', entregas: '', equipe: '' };
  const pj = f.personType === 'pj';
  const end = f.endereco;

  if (!txt(f.name)) e.cliente = 'Preencha o nome do cliente na base.';
  else if (novo) {
    const faltaEmpresa = pj && (!txt(f.razaoSocial) || !txt(f.cnpj));
    const faltaPessoa = !txt(f.contactName) || !txt(f.contactCpf) || !txt(f.contactPhone);
    const faltaEnd = ['cep', 'logradouro', 'numero', 'bairro', 'cidade', 'uf'].some(k => !txt(end[k]));
    if (faltaEmpresa || faltaPessoa || faltaEnd) {
      e.cliente = pj
        ? 'Preencha razão social, CNPJ, dados do representante e o endereço completo.'
        : 'Preencha os dados do contratante e o endereço completo.';
    }
  }

  const ids = Object.keys(f.servicos);
  if (novo) {
    if (!ids.length || ids.some(id => !txt(f.servicos[id]))) e.servicos = 'Marque ao menos um serviço e descreva o que foi vendido em cada um.';
    else if (!f.sectors.length) e.servicos = 'Escolha ao menos um setor envolvido.';
    else if (!admin && !f.csResponsible) e.servicos = 'Escolha a CS responsável pelo cliente.';
    else if (f.wdService && !f.sectors.includes('webdesign')) e.servicos = 'O serviço de WebDesign exige o setor WebDesign marcado.';
    else if (f.hasIdVisual && !f.sectors.includes('design')) e.servicos = 'O ID Visual exige o setor Design marcado.';
  }

  if (!linkValido(f.driveUrl)) e.contrato = 'O link do Drive não parece um endereço válido.';
  else if (novo) {
    if (!(Number(f.contractMonths) > 0)) e.contrato = 'Informe a duração do contrato.';
    else if (!financeiroValido(f.financeiro)) e.contrato = 'Preencha valor e forma de pagamento (as parcelas precisam bater com o total).';
    else if (!txt(f.briefing)) e.contrato = 'O briefing é obrigatório.';
  } else if (financeiroAberto && !financeiroValido(f.financeiro)) {
    e.contrato = 'Para substituir o financeiro, preencha valor e forma de pagamento.';
  }

  const itens = itensDoEscopo(f.itens);
  e.entregas = erroDoEscopo(itens);
  if (!e.entregas && novo && !itens.length && !f.semRecorrencia) {
    e.entregas = 'Cadastre as entregas do contrato ou marque que o cliente não tem entregas mensais.';
  }

  // Equipe só é obrigatória no cadastro novo do admin: na edição, um
  // cliente antigo sem CS não pode travar a correção do resto.
  if (admin && novo) {
    const resp = f.responsibles || {};
    const sem = ['cs', ...f.sectors].filter(s => !asArray(resp[s]).length);
    if (sem.length) e.equipe = 'Indique ao menos um responsável para a CS e para cada setor envolvido.';
  }
  return e;
}

// ─── Cliente novo → documento ─────────────────────────────────
export function montarClienteNovo(f, { admin, anexoContrato, me }) {
  const pj = f.personType === 'pj';
  const tradeName = txt(f.tradeName) || txt(f.name);
  const endereco = Object.fromEntries(Object.entries(f.endereco).map(([k, v]) => [k, txt(v)]));
  const address = linhaEndereco(endereco);
  const servicos = listaServicos(f.servicos);
  const { total } = contaFinanceiro(f.financeiro);
  const agora = new Date().toISOString();
  const itens = itensDoEscopo(f.itens).map(({ id, sector, label, qtd, unica }) => ({
    id, sector, label, qtd, ...(unica ? { unica: true } : {}),
  }));
  const callVazia = { pending: false, at: null, meetLink: '', scheduledBy: null, scheduledAt: null, confirmedAt: null, confirmedBy: null };

  // CS: só a CS entra definida; os líderes indicam o resto depois do
  // Kick Off. Admin: o quadro inteiro já vem preenchido.
  const responsibles = admin
    ? Object.fromEntries(Object.entries(f.responsibles || {}).map(([k, v]) => [k, asArray(v)]).filter(([, v]) => v.length))
    : { cs: [f.csResponsible] };
  const inicio = admin ? dataDoInput(f.contractStart) : null;

  return {
    name: txt(f.name),
    stage: admin ? 'live' : 'kickoff',
    responsibles,
    staffing: { sectors: f.sectors, startedAt: agora, by: me || null },
    wdService: f.wdService || null,
    // ID Visual pelo admin já nasce com o designer escolhido na equipe;
    // pela CS, o bloco `idv` nasce quando o líder de Design indicar.
    ...(admin && f.hasIdVisual ? { idVisualResponsible: asArray(responsibles.design)[0] || null } : {}),
    ...(inicio ? { contract: { startAt: inicio } } : {}),
    contrato: {
      personType: f.personType,
      hasIdVisual: f.hasIdVisual,
      wdService: f.wdService || null,
      razaoSocial: pj ? txt(f.razaoSocial) : '',
      tradeName,
      // `companyName` continua sendo o nome comercial — telas antigas
      // leem esse campo.
      companyName: tradeName,
      cnpj: pj ? txt(f.cnpj) : '',
      contactName: txt(f.contactName),
      contactCpf: txt(f.contactCpf),
      contactPhone: txt(f.contactPhone),
      contactEmail: txt(f.contactEmail),
      endereco,
      address,
      servicos,
      saleTotal: total,
      contractMonths: String(Math.round(Number(f.contractMonths) || 0)),
      pagamento: montarPagamento(f.financeiro),
      briefing: txt(f.briefing),
      driveUrl: normalizaLink(f.driveUrl),
      observations: txt(f.observations),
      anexoContrato: anexoContrato ? { ...anexoContrato, by: me || null, at: agora } : null,
    },
    // Espelhos no topo do doc: as telas antigas (drawer da CS, Brand
    // Hub) leem daqui.
    contactName: txt(f.contactName),
    contactPhone: txt(f.contactPhone),
    contactEmail: txt(f.contactEmail),
    cnpj: pj ? txt(f.cnpj) : '',
    address,
    saleTotal: total,
    contractMonths: String(Math.round(Number(f.contractMonths) || 0)),
    services: servicos,
    briefing: txt(f.briefing),
    observations: txt(f.observations),
    // Primeiro escopo do cliente: vale já no mês do cadastro.
    escopo: itens.length
      ? { versoes: [{ desde: mesChave(), itens, por: me || null, em: agora }], semRecorrencia: false }
      : { versoes: [], semRecorrencia: true },
    // Call 1 (Kick Off) e call 2 (Onboarding). Pela CS o Kick Off nasce
    // aberto (`addClient` marca `pending`); pelo admin as duas ficam
    // fechadas, porque o cliente já entra na base.
    kickoffCall: callVazia,
    kickoff: callVazia,
    clientHealth: null,
  };
}

// ─── Edição → patch do saveCadastro ───────────────────────────
// Só entra o que mudou em relação ao formulário inicial. Sensível só
// entra se alguém digitou algo novo.
export function dadosAlterados(f, ini, { financeiroAberto }) {
  const d = {};
  const mudou = (k) => txt(f[k]) !== txt(ini[k]);
  ['personType', 'razaoSocial', 'tradeName', 'contactName', 'contactPhone', 'contactEmail', 'briefing', 'observations', 'contractMonths', 'contractStart']
    .forEach(k => { if (mudou(k)) d[k] = f[k]; });
  if (normalizaLink(f.driveUrl) !== normalizaLink(ini.driveUrl)) d.driveUrl = f.driveUrl;
  if (txt(f.cnpj)) d.cnpj = f.cnpj;
  if (txt(f.contactCpf)) d.contactCpf = f.contactCpf;
  if (JSON.stringify(f.endereco) !== JSON.stringify(ini.endereco)) d.endereco = f.endereco;
  if (JSON.stringify(f.servicos) !== JSON.stringify(ini.servicos)) d.servicos = listaServicos(f.servicos);
  if (financeiroAberto) {
    d.saleTotal = contaFinanceiro(f.financeiro).total;
    d.pagamento = montarPagamento(f.financeiro);
  }
  return d;
}
