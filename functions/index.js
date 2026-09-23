/**
 * Cloud Functions — Squad MVPs Dashboard
 *
 * resetCollaboratorPassword: redefine a senha de um colaborador no
 * Firebase Auth. Só pode ser chamada por um admin autenticado. A senha
 * real vive no Auth; aqui apenas a sobrescrevemos com uma provisória e
 * marcamos firstAccess:true no doc para forçar a troca no próximo login.
 *
 * Por que precisa de backend: alterar a senha de OUTRO usuário exige o
 * Admin SDK (privilégio de servidor). O front-end não pode fazer isso.
 *
 * api: leitura de clientes e tarefas para outros apps internos,
 * protegida por chave. Detalhes no bloco dela, no fim do arquivo.
 */

const crypto = require('crypto');
const { onCall, onRequest, HttpsError } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const admin = require('firebase-admin');

admin.initializeApp();

const AUTH_EMAIL_DOMAIN = 'squadmvps.interno';
const loginIdToEmail = (loginId) =>
  `${String(loginId).trim().toLowerCase()}@${AUTH_EMAIL_DOMAIN}`;

exports.resetCollaboratorPassword = onCall(async (request) => {
  const { auth, data } = request;

  // 1. Precisa estar autenticado.
  if (!auth) {
    throw new HttpsError('unauthenticated', 'Faça login para continuar.');
  }

  // 2. Quem chama precisa ser admin. Confere no doc do próprio chamador.
  //    O uid do chamador é vinculado ao doc via authUid (ou é o admin
  //    master, marcado em userIndex).
  const db = admin.firestore();
  let isAdmin = false;

  try {
    // Caminho 1: índice rápido por uid.
    const idxSnap = await db.collection('userIndex').doc(auth.uid).get();
    if (idxSnap.exists && idxSnap.data().isAdmin === true) {
      isAdmin = true;
    }
    // Caminho 2 (fallback): busca o doc do colaborador por authUid.
    if (!isAdmin) {
      const q = await db
        .collection('collaborators')
        .where('authUid', '==', auth.uid)
        .limit(1)
        .get();
      if (!q.empty && q.docs[0].data().isAdmin === true) {
        isAdmin = true;
      }
    }
  } catch (e) {
    throw new HttpsError('internal', 'Falha ao verificar permissões.');
  }

  if (!isAdmin) {
    throw new HttpsError(
      'permission-denied',
      'Apenas administradores podem redefinir senhas.'
    );
  }

  // 3. Valida os dados recebidos.
  const collaboratorId = data && data.collaboratorId;
  const newPassword = data && data.newPassword;

  if (!collaboratorId || typeof collaboratorId !== 'string') {
    throw new HttpsError('invalid-argument', 'Colaborador não informado.');
  }
  if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 6) {
    throw new HttpsError(
      'invalid-argument',
      'A senha provisória deve ter pelo menos 6 caracteres.'
    );
  }

  // 4. Carrega o doc do colaborador alvo.
  const targetRef = db.collection('collaborators').doc(collaboratorId);
  const targetSnap = await targetRef.get();
  if (!targetSnap.exists) {
    throw new HttpsError('not-found', 'Colaborador não encontrado.');
  }
  const target = targetSnap.data();

  // 5. Descobre o usuário no Auth. Preferimos o authUid; se não houver
  //    (ou estiver dessincronizado), resolvemos pelo email sintético.
  const email = loginIdToEmail(target.loginId);
  let authUser = null;

  try {
    if (target.authUid) {
      authUser = await admin.auth().getUser(target.authUid);
    }
  } catch (e) {
    // authUid inválido/obsoleto — cai para busca por email abaixo.
    authUser = null;
  }

  if (!authUser) {
    try {
      authUser = await admin.auth().getUserByEmail(email);
    } catch (e) {
      authUser = null;
    }
  }

  try {
    if (authUser) {
      // 6a. Conta existe no Auth → só troca a senha.
      await admin.auth().updateUser(authUser.uid, { password: newPassword });
    } else {
      // 6b. Conta não existe no Auth (nunca migrou) → cria com a senha
      //     provisória, já vinculada ao email do colaborador.
      const created = await admin.auth().createUser({
        email,
        password: newPassword,
      });
      authUser = created;
    }

    // 7. Sincroniza o doc: vincula o uid correto, marca troca no 1º acesso
    //    e limpa qualquer senha antiga em texto puro que ainda exista.
    await targetRef.update({
      authUid: authUser.uid,
      authMigrated: true,
      firstAccess: true,
      password: admin.firestore.FieldValue.delete(),
    });

    // 8. Mantém o índice coerente.
    await db.collection('userIndex').doc(authUser.uid).set(
      {
        collabId: collaboratorId,
        isAdmin: target.isAdmin === true,
        sector: target.sector || null,
      },
      { merge: true }
    );

    return { success: true };
  } catch (e) {
    throw new HttpsError('internal', 'Falha ao redefinir a senha no Auth.');
  }
});

/* ═══════════════════════════════════════════════════════════════
 * api — leitura de clientes e tarefas para outros apps da Lince
 *
 * Por que existe: outros sistemas internos precisam enxergar o Kanban
 * e a carteira sem ganhar acesso ao nosso Firestore. A função lê pelo
 * Admin SDK (que ignora as regras) e devolve só uma lista fechada de
 * campos, então o outro app nunca depende das nossas regras nem vê o
 * documento cru.
 *
 * Rotas (sempre GET, sempre com o header x-api-key):
 *   /clientes   clientes na base, com escopo e entregas do mês
 *               ?mes=AAAA-MM              mês do escopo (padrão: atual)
 *               ?incluirEncerrados=1      traz contratos encerrados
 *   /tarefas    tarefas do Kanban
 *               ?clienteId=ID             histórico inteiro do cliente
 *               ?setor=design             setor responsável
 *               ?status=todo,doing        colunas (todo, doing, approval, done)
 *               ?desde=AAAA-MM-DD         concluídas a partir dessa data
 *                                         (padrão: início do mês)
 *
 * Fica de fora DE PROPÓSITO: valores, CPF/CNPJ, arquivo de contrato,
 * briefing, anexos, contato do cliente, comentários, timeline e a
 * ordem pessoal do Kanban. Campo novo só entra aqui por decisão
 * explícita — a lista branca é a proteção.
 *
 * Sem CORS de propósito: é chamada servidor→servidor. Se o outro app
 * chamasse direto do navegador, a chave iria junto no bundle.
 *
 * A chave é o segredo SQUAD_API_KEY do Firebase, nunca o código.
 * ═══════════════════════════════════════════════════════════════ */

const SQUAD_API_KEY = defineSecret('SQUAD_API_KEY');

// Espelho do front. As functions são publicadas à parte e não
// enxergam src/, então estas regras foram copiadas de lá — se mudarem
// em src/lib/firebase.js, src/lib/entregas.js ou src/lib/wdJobs.js,
// mude aqui também.
const OPEN_STATUSES = ['todo', 'doing', 'approval'];
const TASK_STATUSES = [...OPEN_STATUSES, 'done'];
const CONTRACT_ALERT_DAYS = 30;

const asArray = (v) => (Array.isArray(v) ? v : v ? [v] : []);
const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

// Mesmo critério de stageOf(): cliente sem stage conta como live e o
// fluxo antigo de uma call só (kickoff.pending) cai em onboarding.
const stageOf = (c) => {
  if (!c) return 'live';
  if (c.stage === 'staffing') return 'staffing';
  if (c.stage === 'kickoff') return 'kickoff';
  if (c.stage === 'onboarding') return 'onboarding';
  if (c.kickoff && c.kickoff.pending) return 'onboarding';
  return 'live';
};

// createdAt é Timestamp nos docs novos e string nos antigos.
const toDate = (v) => {
  if (!v) return null;
  if (typeof v.toDate === 'function') return v.toDate();
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
};
const toIso = (v) => {
  const d = toDate(v);
  return d ? d.toISOString() : null;
};

// O servidor roda em UTC; o mês da agência é o de São Paulo. Sem isso,
// entre 21h e meia-noite do último dia o escopo já pularia de mês.
const mesChaveSP = (d = new Date()) => {
  const p = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit',
  }).formatToParts(d);
  const y = p.find(x => x.type === 'year').value;
  const m = p.find(x => x.type === 'month').value;
  return `${y}-${m}`;
};
// Brasil sem horário de verão desde 2019: -03:00 fixo.
const inicioDoDiaSP = (dataAAAAMMDD) => new Date(`${dataAAAAMMDD}T00:00:00-03:00`).toISOString();

const addMonths = (date, months) => {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return null;
  const dia = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + Number(months || 0));
  const ultimoDia = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(dia, ultimoDia));
  return d;
};

// Recorte de contractState(): só prazo e situação, nada financeiro.
const contratoDe = (c) => {
  const contract = c.contract || {};
  const addedMonths = num(contract.addedMonths);
  const baseMonths = num(
    contract.baseMonths
    ?? (c.contrato && c.contrato.contractMonths)
    ?? c.contractMonths
  );
  const meses = baseMonths + addedMonths || null;
  const startAt = toDate(
    contract.startAt
    || (c.kickoff && c.kickoff.confirmedAt)
    || (c.kickoffCall && c.kickoffCall.confirmedAt)
    || c.createdAt
  );
  const inicio = startAt ? startAt.toISOString() : null;

  if (contract.status === 'closed') {
    return { situacao: 'encerrado', meses, inicio, fim: null, encerradoEm: toIso(contract.closedAt) };
  }
  if (!baseMonths || !startAt) {
    return { situacao: 'sem_prazo', meses, inicio, fim: null, encerradoEm: null };
  }
  const endAt = addMonths(startAt, baseMonths + addedMonths);
  const diasRestantes = Math.ceil((endAt.getTime() - Date.now()) / 86400000);
  const situacao = diasRestantes < 0 ? 'vencido' : (diasRestantes <= CONTRACT_ALERT_DAYS ? 'vencendo' : 'ativo');
  return { situacao, meses, inicio, fim: endAt.toISOString(), encerradoEm: null };
};

// Mesma regra de escopoVigente() + entregasDoMes(): vale a versão mais
// recente com desde <= mês; o ajuste do mês (qtd) sobrepõe o contrato.
const escopoDoMes = (c, mes) => {
  const versoes = (Array.isArray(c.escopo && c.escopo.versoes) ? c.escopo.versoes : [])
    .filter(v => v && v.desde && v.desde <= mes)
    .sort((a, b) => a.desde.localeCompare(b.desde));
  const versao = versoes.length ? versoes[versoes.length - 1] : null;
  const reg = (c.entregas && c.entregas[mes]) || {};

  const itens = (versao && Array.isArray(versao.itens) ? versao.itens : [])
    .map(it => {
      const ajuste = reg.qtd ? reg.qtd[it.id] : undefined;
      const qtd = ajuste != null ? num(ajuste) : num(it.qtd);
      return {
        id: it.id,
        setor: it.sector || null,
        item: it.label || '',
        qtd,
        qtdContrato: num(it.qtd),
        ajustadoNoMes: ajuste != null && num(ajuste) !== num(it.qtd),
        feito: num(reg.feito ? reg.feito[it.id] : 0),
      };
    })
    .filter(it => it.qtd > 0 || it.feito > 0);

  const totaisPorSetor = {};
  itens.forEach(it => {
    const k = it.setor || 'sem_setor';
    if (!totaisPorSetor[k]) totaisPorSetor[k] = { qtd: 0, feito: 0 };
    totaisPorSetor[k].qtd += it.qtd;
    totaisPorSetor[k].feito += it.feito;
  });

  return {
    definido: !!versao || (c.escopo && c.escopo.semRecorrencia === true) || false,
    semRecorrencia: !!(c.escopo && c.escopo.semRecorrencia === true),
    itens,
    totaisPorSetor,
  };
};

const clientePublico = (c, mes) => {
  const responsaveis = {};
  Object.entries(c.responsibles || {}).forEach(([setor, v]) => {
    const nomes = asArray(v).filter(Boolean);
    if (nomes.length) responsaveis[setor] = nomes;
  });
  const servicos = asArray((c.contrato && c.contrato.servicos) || c.services)
    .filter(sv => sv && sv.id)
    .map(sv => ({ id: sv.id, label: sv.label || sv.id }));

  return {
    id: c.id,
    nome: c.name || '',
    estagio: stageOf(c),
    responsaveis,
    servicos,
    contrato: contratoDe(c),
    escopo: escopoDoMes(c, mes),
  };
};

const tarefaPublica = (t) => ({
  id: t.id,
  nome: t.name || '',
  clienteId: t.clientId || null,
  clienteNome: t.clientName || '',
  status: t.status || 'todo',
  prioridade: t.priority || null,
  prazo: typeof t.deadline === 'string' ? (t.deadline || null) : toIso(t.deadline),
  setor: t.responsibleSector || null,
  responsaveis: asArray(t.responsibleNames).length
    ? asArray(t.responsibleNames)
    : asArray(t.responsibleName),
  solicitadoPor: t.requestedBy || null,
  setorSolicitante: t.requestedBySector || null,
  refacao: t.isRework === true,
  refacoes: num(t.reworkCount),
  criadaEm: toIso(t.createdAt),
  entregueEm: toIso(t.deliveredAt),
  concluidaEm: toIso(t.completedAt),
});

// Comparação em tempo constante para não vazar a chave por tempo de resposta.
const chaveValida = (recebida, esperada) => {
  if (!recebida || !esperada) return false;
  const a = Buffer.from(String(recebida));
  const b = Buffer.from(String(esperada));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};

const erro = (res, code, message) => res.status(code).json({ erro: message });

async function listarClientes(req, res, db) {
  const mes = String(req.query.mes || '') || mesChaveSP();
  if (!/^\d{4}-\d{2}$/.test(mes)) return erro(res, 400, 'Parâmetro "mes" deve ser AAAA-MM.');
  const incluirEncerrados = req.query.incluirEncerrados === '1';

  const snap = await db.collection('clients').get();
  const clientes = snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    // Até a call de onboarding ser agendada o cliente grava active:false
    // e fica fora das visões gerais — aqui também.
    .filter(c => c.active !== false)
    .filter(c => incluirEncerrados || !(c.contract && c.contract.status === 'closed'))
    .map(c => clientePublico(c, mes))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));

  return res.json({ geradoEm: new Date().toISOString(), mes, total: clientes.length, clientes });
}

async function listarTarefas(req, res, db) {
  const clienteId = String(req.query.clienteId || '').trim();
  const setor = String(req.query.setor || '').trim();
  const status = String(req.query.status || '').split(',').map(s => s.trim()).filter(Boolean);
  const desde = String(req.query.desde || '').trim();

  if (status.some(s => !TASK_STATUSES.includes(s))) {
    return erro(res, 400, `Parâmetro "status" aceita: ${TASK_STATUSES.join(', ')}.`);
  }
  if (desde && !/^\d{4}-\d{2}-\d{2}$/.test(desde)) {
    return erro(res, 400, 'Parâmetro "desde" deve ser AAAA-MM-DD.');
  }
  const corteConcluidas = inicioDoDiaSP(desde || `${mesChaveSP()}-01`);

  let brutas;
  if (clienteId) {
    // Filtro de igualdade num campo só: índice automático, sem composto.
    const snap = await db.collection('tasks').where('clientId', '==', clienteId).get();
    brutas = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } else {
    // Mesmos dois recortes da TV (abertas + concluídas desde o corte),
    // para a coleção inteira nunca ser lida e nenhum índice composto
    // ser exigido.
    const [abertas, concluidas] = await Promise.all([
      db.collection('tasks').where('status', 'in', OPEN_STATUSES).get(),
      db.collection('tasks').where('completedAt', '>=', corteConcluidas).get(),
    ]);
    const porId = new Map();
    [...abertas.docs, ...concluidas.docs].forEach(d => porId.set(d.id, { id: d.id, ...d.data() }));
    brutas = [...porId.values()];
  }

  const tarefas = brutas
    // Concluída sem data (legado) só entra no histórico por cliente.
    .filter(t => t.status !== 'done' || (clienteId && !desde) || (toIso(t.completedAt) || '') >= corteConcluidas)
    .filter(t => !setor || t.responsibleSector === setor)
    .filter(t => !status.length || status.includes(t.status || 'todo'))
    .map(tarefaPublica)
    .sort((a, b) => (b.criadaEm || '').localeCompare(a.criadaEm || ''));

  return res.json({ geradoEm: new Date().toISOString(), total: tarefas.length, tarefas });
}

exports.api = onRequest(
  { secrets: [SQUAD_API_KEY], cors: false, maxInstances: 2 },
  async (req, res) => {
    res.set('Cache-Control', 'no-store');

    if (req.method !== 'GET') return erro(res, 405, 'Somente GET.');
    if (!chaveValida(req.get('x-api-key'), SQUAD_API_KEY.value())) {
      return erro(res, 401, 'Chave de API ausente ou inválida.');
    }

    const rota = String(req.path || '/').replace(/\/+$/, '') || '/';
    try {
      const db = admin.firestore();
      if (rota === '/clientes') return await listarClientes(req, res, db);
      if (rota === '/tarefas') return await listarTarefas(req, res, db);
      return erro(res, 404, 'Rota não encontrada. Use /clientes ou /tarefas.');
    } catch (e) {
      console.error('api:', e);
      return erro(res, 500, 'Falha ao consultar os dados.');
    }
  }
);
