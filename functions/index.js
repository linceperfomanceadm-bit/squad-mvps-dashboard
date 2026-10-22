/**
 * Cloud Functions — Squad MVPs Dashboard
 *
 * Acesso da equipe — sincronizarAcesso, migrarConta e
 * resetCollaboratorPassword. Quem é da equipe e quem é admin é decidido
 * AQUI, no servidor, e gravado como custom claims no token do Firebase
 * Auth: { acessoV, staff, admin, collabId, trocarSenha }. O navegador
 * só lê o token.
 *
 * Por que: até 22/out/2026 isso era decidido no front, com uma senha de
 * admin reserva no código e um índice (userIndex) gravado pelo próprio
 * usuário no login. O repositório é público e todo REACT_APP_* vai
 * compilado para o navegador, então qualquer pessoa conseguia entrar
 * como admin — e esta função confiava no userIndex para liberar a troca
 * de senha de qualquer colaborador. Não volte a confiar em nada que o
 * cliente grava para decidir permissão.
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

// loginId de volta a partir do e-mail sintético. null para e-mail de fora.
const loginDoEmail = (email) => {
  const sufixo = `@${AUTH_EMAIL_DOMAIN}`;
  const e = String(email || '').toLowerCase();
  return e.endsWith(sufixo) ? e.slice(0, -sufixo.length) : null;
};

// Comparação em tempo constante para não vazar segredo por tempo de
// resposta. Usada na chave da api e na senha legada da migração.
const chaveValida = (recebida, esperada) => {
  if (!recebida || !esperada) return false;
  const a = Buffer.from(String(recebida));
  const b = Buffer.from(String(esperada));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};

/* ═══════════════════════════════════════════════════════════════
 * Acesso da equipe
 * ═══════════════════════════════════════════════════════════════ */

// Versão do formato das claims. O front confere este número para saber
// se o token já passou por aqui; mude nos dois lados juntos
// (src/contexts/AuthContext.js).
const ACESSO_V = 1;

// Admin master: conta do Auth SEM doc em collaborators, que entra com
// este ID na tela de login. A conta já existe (nasceu no primeiro login
// dela) e nunca deve ser apagada no console do Firebase: o cadastro
// pelo navegador segue ligado (criação de colaborador e TV anônima
// dependem dele), então uma conta apagada poderia ser recriada por
// outra pessoa com o mesmo e-mail.
const ADMINS_MASTER = ['admin'];

// A senha do admin master ficou exposta no código até 22/out/2026.
// Senha definida antes disso é tratada como vazada e a troca vira
// obrigatória no próximo login (claim trocarSenha, que o front mostra
// na mesma tela do primeiro acesso). O Auth atualiza
// tokensValidAfterTime toda vez que a senha muda, então o servidor
// confere a troca sem depender do que o navegador diz.
const SENHA_MASTER_VALIDA_DESDE = Date.parse('2026-10-22T00:00:00-03:00');

const SEM_ACESSO = Object.freeze({
  staff: false, admin: false, collabId: null, sector: null, trocarSenha: false,
});

// Decide o acesso de uma conta do Auth a partir de dados do servidor.
// O vínculo com o colaborador é só pelo authUid: ligar pelo loginId do
// e-mail deixaria qualquer um que criasse a conta antes do colaborador
// assumir o perfil dele. Conta sem vínculo se resolve pela migrarConta
// (senha legada conferida aqui) ou pelo reset de senha do admin.
async function calcularAcesso(db, userRecord) {
  const q = await db
    .collection('collaborators')
    .where('authUid', '==', userRecord.uid)
    .limit(1)
    .get();

  if (!q.empty) {
    const d = q.docs[0];
    const c = d.data();
    // Desativado no admin perde o acesso de verdade. Doc antigo, sem o
    // campo, conta como ativo.
    if (c.active === false) return SEM_ACESSO;
    return {
      staff: true,
      admin: c.isAdmin === true,
      collabId: d.id,
      sector: c.sector || null,
      trocarSenha: false,
    };
  }

  const login = loginDoEmail(userRecord.email);
  if (login && ADMINS_MASTER.includes(login)) {
    // NaN (campo ausente) também cai em troca obrigatória.
    const trocadaEm = Date.parse(userRecord.tokensValidAfterTime || '');
    return {
      staff: true,
      admin: true,
      collabId: null,
      sector: null,
      trocarSenha: !(trocadaEm >= SENHA_MASTER_VALIDA_DESDE),
    };
  }

  return SEM_ACESSO;
}

// Grava o acesso como claims no token e devolve se algo mudou (o front
// força a renovação do token só nesse caso).
async function gravarAcesso(db, userRecord, acesso) {
  const claims = {
    acessoV: ACESSO_V,
    staff: acesso.staff,
    admin: acesso.admin,
    collabId: acesso.collabId,
    trocarSenha: acesso.trocarSenha,
  };
  const atuais = userRecord.customClaims || {};
  const mudou =
    Object.keys(claims).some(k => atuais[k] !== claims[k]) ||
    Object.keys(atuais).some(k => !(k in claims));
  if (mudou) await admin.auth().setCustomUserClaims(userRecord.uid, claims);

  // userIndex virou espelho escrito só pelo servidor, para quem ainda lê
  // por ele. O front não grava mais; enquanto as regras do Firestore não
  // travarem a escrita, nada aqui confia no que está lá.
  const idx = db.collection('userIndex').doc(userRecord.uid);
  if (acesso.staff) {
    await idx.set(
      { collabId: acesso.collabId, isAdmin: acesso.admin, sector: acesso.sector },
      { merge: true }
    );
  } else {
    await idx.delete();
  }
  return mudou;
}

// Chamada pelo front a cada login e a cada abertura do app.
exports.sincronizarAcesso = onCall({ maxInstances: 5 }, async (request) => {
  const { auth } = request;
  if (!auth) {
    throw new HttpsError('unauthenticated', 'Faça login para continuar.');
  }
  // Sessão anônima é do Painel de TV e do link de aprovação.
  if (auth.token.firebase && auth.token.firebase.sign_in_provider === 'anonymous') {
    return { ...SEM_ACESSO, mudou: false };
  }

  const db = admin.firestore();
  try {
    const userRecord = await admin.auth().getUser(auth.uid);
    const acesso = await calcularAcesso(db, userRecord);
    const mudou = await gravarAcesso(db, userRecord, acesso);
    return { ...acesso, mudou };
  } catch (e) {
    console.error('sincronizarAcesso:', e);
    throw new HttpsError('internal', 'Falha ao conferir o acesso.');
  }
});

/*
 * migrarConta — colaborador criado antes do Auth, com a senha ainda em
 * texto no doc. Antes o navegador lia essa senha do Firestore e criava
 * a conta; agora a conferência e a criação acontecem aqui. Chamada sem
 * login, pela tela de entrada.
 *
 * Se a conta do Auth já existir com o doc ainda guardando a senha
 * legada, ela foi criada por uma migração que parou no meio — ou por
 * outra pessoa que se adiantou. Como a senha legada acabou de ser
 * conferida aqui, ela vira a senha da conta e as sessões antigas caem.
 */
exports.migrarConta = onCall({ maxInstances: 2 }, async (request) => {
  const data = request.data || {};
  const loginId = typeof data.loginId === 'string' ? data.loginId.trim() : '';
  const password = typeof data.password === 'string' ? data.password : '';
  if (!loginId || !password) {
    throw new HttpsError('invalid-argument', 'Informe ID e senha.');
  }

  // Mesma mensagem para ID inexistente, senha errada e conta já
  // migrada: a tela de login não serve para descobrir IDs.
  const incorreto = { ok: false, erro: 'ID ou senha incorretos.' };
  const db = admin.firestore();

  let ref;
  let c;
  try {
    const q = await db
      .collection('collaborators')
      .where('loginId', '==', loginId)
      .limit(1)
      .get();
    if (q.empty) return incorreto;
    ref = q.docs[0].ref;
    c = q.docs[0].data();
  } catch (e) {
    console.error('migrarConta:', e);
    throw new HttpsError('internal', 'Falha no login. Tente novamente.');
  }

  if (c.active === false) return { ok: false, erro: 'Conta desativada.' };
  if (typeof c.password !== 'string' || !c.password) return incorreto;
  if (!chaveValida(password, c.password)) return incorreto;
  if (password.length < 6) {
    return {
      ok: false,
      erro: 'Sua senha antiga é curta demais para o novo sistema (mín. 6). Peça um reset ao admin.',
    };
  }

  try {
    const email = loginIdToEmail(c.loginId);
    let userRecord;
    try {
      const existente = await admin.auth().getUserByEmail(email);
      await admin.auth().updateUser(existente.uid, { password });
      await admin.auth().revokeRefreshTokens(existente.uid);
      userRecord = await admin.auth().getUser(existente.uid);
    } catch (e) {
      if (e.code !== 'auth/user-not-found') throw e;
      userRecord = await admin.auth().createUser({ email, password });
    }

    await ref.update({
      authUid: userRecord.uid,
      authMigrated: true,
      password: admin.firestore.FieldValue.delete(),
    });
    await gravarAcesso(db, userRecord, await calcularAcesso(db, userRecord));
    return { ok: true };
  } catch (e) {
    console.error('migrarConta:', e);
    throw new HttpsError('internal', 'Falha na migração da conta.');
  }
});

/*
 * resetCollaboratorPassword — redefine a senha de um colaborador no
 * Firebase Auth. A senha real vive no Auth; aqui apenas a sobrescrevemos
 * com uma provisória e marcamos firstAccess:true no doc para forçar a
 * troca no próximo login.
 *
 * Por que precisa de backend: alterar a senha de OUTRO usuário exige o
 * Admin SDK (privilégio de servidor). O front-end não pode fazer isso.
 */
exports.resetCollaboratorPassword = onCall(async (request) => {
  const { auth, data } = request;

  // 1. Precisa estar autenticado.
  if (!auth) {
    throw new HttpsError('unauthenticated', 'Faça login para continuar.');
  }

  // 2. Quem chama precisa ser admin — conferido agora, nos dados do
  //    servidor, e não no token nem no userIndex: um admin que acabou de
  //    perder o papel já não consegue usar esta função.
  const db = admin.firestore();
  let quemChama;
  try {
    quemChama = await calcularAcesso(db, await admin.auth().getUser(auth.uid));
  } catch (e) {
    throw new HttpsError('internal', 'Falha ao verificar permissões.');
  }

  if (!quemChama.admin) {
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
      authUser = await admin.auth().createUser({
        email,
        password: newPassword,
      });
    }

    // 7. Sincroniza o doc: vincula o uid correto, marca troca no 1º acesso
    //    e limpa qualquer senha antiga em texto puro que ainda exista.
    await targetRef.update({
      authUid: authUser.uid,
      authMigrated: true,
      firstAccess: true,
      password: admin.firestore.FieldValue.delete(),
    });

    // 8. Atualiza o token e o índice do colaborador com o vínculo novo.
    const atualizado = await admin.auth().getUser(authUser.uid);
    await gravarAcesso(db, atualizado, await calcularAcesso(db, atualizado));

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
// Entrega única (`unica`) aparece pendente só no mês corrente e 1 de 1
// no mês em que foi marcada; nos outros meses fica de fora.
const mesDaEntregaUnica = (c, itemId) => Object.keys(c.entregas || {}).sort()
  .find(m => num(c.entregas[m] && c.entregas[m].feito ? c.entregas[m].feito[itemId] : 0) > 0) || null;

const escopoDoMes = (c, mes) => {
  const versoes = (Array.isArray(c.escopo && c.escopo.versoes) ? c.escopo.versoes : [])
    .filter(v => v && v.desde && v.desde <= mes)
    .sort((a, b) => a.desde.localeCompare(b.desde));
  const versao = versoes.length ? versoes[versoes.length - 1] : null;
  const reg = (c.entregas && c.entregas[mes]) || {};

  const itens = (versao && Array.isArray(versao.itens) ? versao.itens : [])
    .map(it => {
      if (it.unica === true) {
        const feitaEm = mesDaEntregaUnica(c, it.id);
        if (feitaEm ? feitaEm !== mes : mes !== mesChaveSP()) return null;
        return {
          id: it.id, setor: it.sector || null, item: it.label || '', unica: true,
          qtd: 1, qtdContrato: 1, ajustadoNoMes: false, feito: feitaEm ? 1 : 0,
        };
      }
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
    .filter(it => it && (it.qtd > 0 || it.feito > 0));

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
