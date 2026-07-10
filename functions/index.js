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
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
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
