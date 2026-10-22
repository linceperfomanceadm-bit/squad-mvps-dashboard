import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { collection, query, where, getDocs, getDoc, doc } from 'firebase/firestore';
// Gravações passam pela trava contra loop (lib/gravacoes.js).
import { updateDoc } from '../lib/gravacoes';
import {
  signInWithEmailAndPassword,
  updatePassword,
  signOut,
  onAuthStateChanged,
} from 'firebase/auth';
import { httpsCallable } from 'firebase/functions';
import { db, auth, functions, loginIdToEmail } from '../lib/firebase';

const AuthContext = createContext(null);

/*
 * ─── Modelo de autenticação ──────────────────────────────────
 * Login por loginId + senha, convertido para email sintético
 * (loginId@squadmvps.interno) no Firebase Auth.
 *
 * QUEM É QUEM É DECIDIDO NO SERVIDOR. A Cloud Function
 * sincronizarAcesso confere o colaborador vinculado ao uid (ou o admin
 * master) e grava o resultado como custom claims no token:
 * { acessoV, staff, admin, collabId, trocarSenha }. Este arquivo só lê
 * o token. Até 22/out/2026 o admin era decidido aqui, com uma senha
 * reserva no código — e o repositório é público. Não volte a decidir
 * acesso no front nem a escrever credencial aqui: guarda de tela é UX,
 * a barreira são o token e as regras do Firestore.
 *
 * Token que já passou pela função com acesso abre o app na hora, e a
 * conferência roda em segundo plano (o admin trocou o papel, desativou
 * a conta). Token que nunca passou, ou que estava sem acesso, espera a
 * função.
 *
 * PLANO B — functions fora do ar. Em 22/out/2026 o projeto estava sem
 * cobrança ativa (plano Spark) e o Google não deixa publicar nem rodar
 * Cloud Functions assim. Enquanto isso, o acesso sai das mesmas regras
 * que o servidor usaria, lidas aqui (só UX — a barreira são as regras
 * do Firestore e a senha): colaborador pelo doc vinculado ao authUid,
 * admin master pelo e-mail da conta, com a troca obrigatória da senha
 * exposta conferida pela data da última troca no próprio Auth. Quando
 * as functions voltarem, o token assume sozinho.
 *
 * MIGRAÇÃO LAZY: colaboradores criados antes do Auth ainda guardam a
 * senha em texto no Firestore. A conferência dessa senha e a criação da
 * conta no Auth acontecem na função migrarConta, nunca no navegador.
 *
 * O perfil (sector, name, leaderOf...) continua no doc Firestore,
 * vinculado pelo authUid. O doc do Auth NÃO guarda senha.
 */

// Espelhos de functions/index.js — mudam juntos.
const ACESSO_V = 1;
const ADMINS_MASTER = ['admin'];
// Senha do admin master definida antes disto é tratada como vazada.
const SENHA_MASTER_VALIDA_DESDE = Date.parse('2026-10-22T00:00:00-03:00');

const chamarSincronizar = httpsCallable(functions, 'sincronizarAcesso');
const chamarMigrar = httpsCallable(functions, 'migrarConta');

// Garante que uma operação do Firestore nunca pendure a cadeia de login.
// Se passar do tempo, rejeita para o chamador tratar (em vez de travar).
function withTimeout(promise, ms = 6000, label = 'firestore') {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(`timeout:${label}`)), ms)),
  ]);
}

// ── Perfil ───────────────────────────────────────────────────

// isAdmin vem de quem chamou: o token (servidor) ou, no plano B, o doc.
function perfilDoColaborador(id, c, uid, isAdmin) {
  return {
    id,
    authUid: uid,
    name: c.name,
    loginId: c.loginId,
    sector: c.sector,
    // Função dentro do CS: 'comercial' | 'operacional'.
    // Colaboradores antigos, sem o campo, caem em 'operacional'.
    csRole: c.sector === 'cs' ? (c.csRole || 'operacional') : null,
    // Setores que esta pessoa lidera. Independente de `sector`: dá
    // para liderar um setor diferente do próprio, e mais de um.
    // É o que libera a indicação de responsáveis no onboarding.
    leaderOf: Array.isArray(c.leaderOf) ? c.leaderOf : [],
    role: isAdmin ? 'admin' : 'collaborator',
    isAdmin,
    firstAccess: c.firstAccess || false,
  };
}

async function lerClaims(fbUser, forcar = false) {
  const r = await fbUser.getIdTokenResult(forcar);
  return (r && r.claims) || {};
}

async function perfilPelasClaims(fbUser, claims) {
  if (claims.staff !== true) throw new Error('sem-acesso');

  if (claims.collabId) {
    const snap = await withTimeout(getDoc(doc(db, 'collaborators', claims.collabId)), 6000, 'perfil');
    if (!snap.exists()) throw new Error('sem-acesso');
    return perfilDoColaborador(snap.id, snap.data(), fbUser.uid, claims.admin === true);
  }

  if (claims.admin === true) return perfilAdminMaster(fbUser, claims.trocarSenha === true);

  throw new Error('sem-acesso');
}

// Admin master: conta do Auth sem doc em collaborators. A senha antiga
// dele ficou exposta no código; trocarSenha reaproveita a tela de
// primeiro acesso para obrigar a troca uma vez.
function perfilAdminMaster(fbUser, trocarSenha) {
  return {
    id: fbUser.uid,
    authUid: fbUser.uid,
    name: 'Admin',
    loginId: (fbUser.email || '').split('@')[0],
    sector: null,
    csRole: null,
    role: 'superadmin',
    isAdmin: true,
    leaderOf: [],
    firstAccess: trocarSenha,
  };
}

const ehAdminMaster = (fbUser) => {
  const email = String(fbUser.email || '').toLowerCase();
  return ADMINS_MASTER.some(id => loginIdToEmail(id) === email);
};

// Data da última troca de senha da própria conta, pela API pública do
// Auth (a mesma consulta que o SDK faz no reload). Na falha devolve 0,
// e a troca é exigida — melhor pedir uma vez a mais do que deixar a
// senha exposta valendo.
async function senhaTrocadaEm(fbUser) {
  try {
    const idToken = await fbUser.getIdToken();
    const chave = encodeURIComponent(auth.app.options.apiKey || '');
    const res = await withTimeout(fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${chave}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idToken }) },
    ), 6000, 'lookup');
    const dados = await res.json();
    const conta = dados && Array.isArray(dados.users) ? dados.users[0] : null;
    return Number(conta && conta.passwordUpdatedAt) || 0;
  } catch {
    return 0;
  }
}

// Plano B quando a função não responde e o token nunca passou por ela
// (ver o topo do arquivo).
async function perfilLegado(fbUser) {
  if (ehAdminMaster(fbUser)) {
    return perfilAdminMaster(fbUser, (await senhaTrocadaEm(fbUser)) < SENHA_MASTER_VALIDA_DESDE);
  }

  let snap;
  try {
    snap = await withTimeout(
      getDocs(query(collection(db, 'collaborators'), where('authUid', '==', fbUser.uid))),
      6000,
      'legado',
    );
  } catch {
    throw new Error('sem-validacao');
  }
  // Consulta respondeu e não há colaborador ligado a esta conta.
  if (snap.empty) throw new Error('sem-acesso');
  const d = snap.docs[0];
  const c = d.data();
  if (c.active === false) throw new Error('sem-acesso');
  return perfilDoColaborador(d.id, c, fbUser.uid, c.isAdmin === true);
}

// Confere no servidor sem segurar a tela. Se o acesso mudou, entrega o
// perfil novo; se o servidor tirou o acesso, entrega null.
function conferirNoFundo(fbUser, aoMudar) {
  chamarSincronizar()
    .then(async (res) => {
      if (!res || !res.data || !res.data.mudou) return;
      esquecerCarregamento();
      try {
        aoMudar(await perfilPelasClaims(fbUser, await lerClaims(fbUser, true)));
      } catch (e) {
        if (e && e.message === 'sem-acesso') aoMudar(null);
      }
    })
    .catch(() => {});
}

async function montarPerfil(fbUser, aoMudar) {
  const claims = await lerClaims(fbUser);

  if (claims.acessoV === ACESSO_V && claims.staff === true) {
    const perfil = await perfilPelasClaims(fbUser, claims);
    conferirNoFundo(fbUser, aoMudar);
    return perfil;
  }

  try {
    await withTimeout(chamarSincronizar(), 12000, 'acesso');
  } catch {
    // Token já conferido antes e sem acesso: sem o servidor não há como
    // saber se mudou. Nunca conferido: plano B pelo doc.
    if (claims.acessoV === ACESSO_V) throw new Error('sem-validacao');
    return perfilLegado(fbUser);
  }
  return perfilPelasClaims(fbUser, await lerClaims(fbUser, true));
}

// Login e onAuthStateChanged disparam juntos para a mesma conta: os dois
// recebem a mesma promessa e a função roda uma vez só.
const REUSO_MS = 10000;
let carregamento = null;

function esquecerCarregamento() { carregamento = null; }

function carregarPerfil(fbUser, aoMudar) {
  if (carregamento && carregamento.uid === fbUser.uid && Date.now() - carregamento.em < REUSO_MS) {
    return carregamento.promise;
  }
  const promise = montarPerfil(fbUser, aoMudar);
  const atual = { uid: fbUser.uid, em: Date.now(), promise };
  carregamento = atual;
  // Falha não fica guardada: a próxima tentativa recomeça do zero.
  promise.catch(() => { if (carregamento === atual) carregamento = null; });
  return promise;
}

async function perfilDaSessao(aoMudar) {
  const fbUser = auth.currentUser;
  if (!fbUser) return { erro: 'sem-validacao' };
  try {
    return { profile: await carregarPerfil(fbUser, aoMudar) };
  } catch (e) {
    return { erro: e && e.message === 'sem-acesso' ? 'sem-acesso' : 'sem-validacao' };
  }
}

// ── Entrada ──────────────────────────────────────────────────

const ERROS_LOGIN = {
  'auth/wrong-password': 'Senha incorreta.',
  'auth/too-many-requests': 'Muitas tentativas. Aguarde alguns minutos.',
};

async function entrar(email, password) {
  try {
    await signInWithEmailAndPassword(auth, email, password);
    return { success: true };
  } catch (err) {
    return { success: false, code: err.code, error: ERROS_LOGIN[err.code] || 'Falha no login. Tente novamente.' };
  }
}

async function migrarContaAntiga(loginId, password) {
  try {
    const res = await withTimeout(chamarMigrar({ loginId: loginId.trim(), password }), 15000, 'migrar');
    const d = (res && res.data) || {};
    return d.ok ? { success: true } : { success: false, error: d.erro || 'ID ou senha incorretos.' };
  } catch {
    return { success: false, error: 'Falha no login. Tente novamente.' };
  }
}

async function entrarComMigracao(loginId, email, password) {
  const r = await entrar(email, password);
  if (r.success) return r;
  if (r.code !== 'auth/user-not-found' && r.code !== 'auth/invalid-credential') return r;
  // Pode ser conta anterior ao Auth: o servidor confere a senha legada
  // e cria a conta.
  const migrada = await migrarContaAntiga(loginId, password);
  if (!migrada.success) return migrada;
  return entrar(email, password);
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Resultado da conferência em segundo plano: perfil novo, ou null
  // quando o servidor tirou o acesso (desativado, removido).
  const aoMudar = useCallback((perfil) => {
    if (perfil) { setUser(perfil); return; }
    esquecerCarregamento();
    signOut(auth).catch(() => {});
    setUser(null);
  }, []);

  // Reidrata o perfil a partir do usuário autenticado no Auth.
  useEffect(() => {
    let settled = false;
    // Rede de segurança: se algo pendurar, não deixa o app preso no
    // spinner para sempre. Folga para a primeira chamada da função.
    const safety = setTimeout(() => { if (!settled) setLoading(false); }, 15000);

    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      // Sessão anônima é do Painel de TV e do link de aprovação, nunca
      // da equipe.
      if (!fbUser || fbUser.isAnonymous) {
        settled = true; clearTimeout(safety); setUser(null); setLoading(false);
        return;
      }
      try {
        setUser(await carregarPerfil(fbUser, aoMudar));
      } catch (e) {
        // Conta sem acesso não fica logada.
        if (e && e.message === 'sem-acesso') signOut(auth).catch(() => {});
        setUser(null);
      } finally {
        settled = true;
        clearTimeout(safety);
        setLoading(false);
      }
    });
    return () => { clearTimeout(safety); unsub(); };
  }, [aoMudar]);

  // ── Login unificado (setor é validado após autenticar) ───────
  const loginCollaborator = async (sectorId, loginId, password) => {
    const email = loginIdToEmail(loginId);

    const entrada = await entrarComMigracao(loginId, email, password);
    if (!entrada.success) return { success: false, error: entrada.error };

    let resultado = await perfilDaSessao(aoMudar);
    if (resultado.erro === 'sem-acesso') {
      // Conta no Auth sem vínculo com o doc: migração antiga que parou
      // no meio. O servidor confere a senha legada e refaz o vínculo.
      const migrada = await migrarContaAntiga(loginId, password);
      if (migrada.success) {
        esquecerCarregamento();
        const deNovo = await entrar(email, password);
        if (deNovo.success) resultado = await perfilDaSessao(aoMudar);
      }
    }

    if (!resultado.profile) {
      esquecerCarregamento();
      await signOut(auth).catch(() => {});
      return {
        success: false,
        error: resultado.erro === 'sem-acesso'
          ? 'Este ID não tem acesso liberado. Fale com o admin.'
          : 'Não foi possível validar seu acesso agora. Tente de novo em instantes.',
      };
    }

    const profile = resultado.profile;
    // Validação de setor (apenas UX — a trava real são as regras do
    // Firestore).
    if (!profile.isAdmin && sectorId && profile.sector !== sectorId) {
      esquecerCarregamento();
      await signOut(auth).catch(() => {});
      return { success: false, error: 'ID não pertence a este setor.' };
    }
    setUser(profile);
    return { success: true, firstAccess: profile.firstAccess };
  };

  // Admin login usa o mesmo fluxo; setor não é exigido.
  const loginAdmin = (loginId, password) => loginCollaborator(null, loginId, password);

  // ── Troca de senha no 1º acesso ──────────────────────────────
  const changePassword = async (newPassword) => {
    const fbUser = auth.currentUser;
    if (!fbUser) return { success: false, error: 'Sessão expirada. Entre novamente.' };
    try {
      await updatePassword(fbUser, newPassword);
      // Atualiza firstAccess no doc de perfil (se houver — admin
      // master não tem doc).
      if (user?.id && user.id !== fbUser.uid) {
        try { await updateDoc(doc(db, 'collaborators', user.id), { firstAccess: false }); } catch {}
      }
      setUser({ ...user, firstAccess: false });
      // Admin master: o servidor confere que a senha mudou e tira a
      // troca obrigatória do token.
      esquecerCarregamento();
      conferirNoFundo(fbUser, aoMudar);
      return { success: true };
    } catch (e) {
      if (e.code === 'auth/requires-recent-login') {
        return { success: false, error: 'Por segurança, entre novamente antes de trocar a senha.' };
      }
      return { success: false, error: 'Falha ao definir senha.' };
    }
  };

  const logout = async () => {
    esquecerCarregamento();
    try { await signOut(auth); } catch {}
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, loginCollaborator, loginAdmin, changePassword, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
