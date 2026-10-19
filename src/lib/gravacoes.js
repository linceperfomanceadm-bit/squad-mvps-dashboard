import {
  addDoc as _addDoc,
  setDoc as _setDoc,
  updateDoc as _updateDoc,
  deleteDoc as _deleteDoc,
  runTransaction as _runTransaction,
  writeBatch as _writeBatch,
} from 'firebase/firestore';

/*
 * Trava de gravações — toda escrita no Firestore passa por aqui.
 *
 * Por que existe: em 15/out/2026 um loop no editor do Lince Docs fez
 * uma única aba gravar ~146 vezes por segundo. Em poucas horas ele
 * queimou as 20 mil gravações diárias do plano gratuito do Firebase e
 * o app inteiro parou (Kanban, serviços, solicitações) até a cota
 * zerar de madrugada. Bug de loop sempre pode voltar em código novo;
 * esta trava garante que, se voltar, o estrago fica preso numa aba.
 *
 * Como funciona: cada aba conta as próprias gravações em duas janelas.
 * Passou de qualquer limite, a aba para de gravar até ser recarregada
 * e mostra o aviso (TravaGravacoesAviso). As outras abas e as outras
 * pessoas seguem normais.
 *
 * Os limites ficam muito acima do uso humano: quem digita ou clica
 * grava no máximo uma vez a cada um ou dois segundos (os editores já
 * esperam a pessoa parar de digitar antes de gravar). Um loop passa
 * disso em menos de um segundo (janela curta) ou, se for um loop
 * lento, em poucos minutos (janela longa).
 *
 * Use estas funções no lugar das do 'firebase/firestore'. Mesma
 * assinatura e mesmo retorno; ao travar, devolvem uma Promise
 * rejeitada (nunca lançam direto), então os `.catch()` e os
 * try/catch que já existem continuam valendo.
 */

// Referência: o time inteiro grava algumas centenas de vezes por DIA.
// O limite por aba fica dezenas de vezes acima do pior uso humano e
// muito abaixo da cota diária (20 mil no plano gratuito).
const LIMITES = [
  { janelaMs: 10 * 1000, max: 60 },          // rajada: 6/s por 10s
  { janelaMs: 10 * 60 * 1000, max: 900 },    // loop médio: 1,5/s por 10 min
  { janelaMs: 60 * 60 * 1000, max: 1500 },   // loop lento: 1 a cada 2,4s por 1h
];

export const EVENTO_TRAVA = 'lince:gravacoes-travadas';

const MENSAGEM =
  'Esta aba fez gravações demais em pouco tempo e foi pausada por segurança. Recarregue a página para continuar.';

const registro = []; // horários (ms) das gravações recentes desta aba
let travada = false;

function erroDeTrava() {
  const err = new Error(MENSAGEM);
  err.code = 'gravacoes-travadas';
  return err;
}

function travar(motivo) {
  travada = true;
  // O stack mostra no console qual tela disparou o loop — é a pista
  // para corrigir o bug de verdade.
  // eslint-disable-next-line no-console
  console.error(`[trava de gravações] aba pausada: ${motivo}`, new Error('origem').stack);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(EVENTO_TRAVA, { detail: { motivo } }));
  }
}

// Registra uma gravação; devolve false se a aba está (ou acabou de ficar) travada.
function liberar() {
  if (travada) return false;
  const agora = Date.now();
  registro.push(agora);
  const maiorJanela = LIMITES[LIMITES.length - 1].janelaMs;
  while (registro.length && agora - registro[0] > maiorJanela) registro.shift();

  for (const { janelaMs, max } of LIMITES) {
    let n = 0;
    for (let i = registro.length - 1; i >= 0 && agora - registro[i] <= janelaMs; i -= 1) n += 1;
    if (n > max) {
      travar(`${n} gravações em ${Math.round(janelaMs / 1000)}s (limite ${max})`);
      return false;
    }
  }
  return true;
}

const guardar = (fn) => (...args) => (liberar() ? fn(...args) : Promise.reject(erroDeTrava()));

export const addDoc = guardar(_addDoc);
export const setDoc = guardar(_setDoc);
export const updateDoc = guardar(_updateDoc);
export const deleteDoc = guardar(_deleteDoc);
export const runTransaction = guardar(_runTransaction);

// O lote conta como uma gravação no `commit` — é a chamada que um
// loop repetiria. Montar o lote (set/update/delete) não grava nada.
export function writeBatch(...args) {
  const lote = _writeBatch(...args);
  const commitOriginal = lote.commit.bind(lote);
  lote.commit = () => (liberar() ? commitOriginal() : Promise.reject(erroDeTrava()));
  return lote;
}

export const gravacoesTravadas = () => travada;
