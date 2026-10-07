import { POST_FORMATOS, POST_STATUS, VIDEO_PRAZO_DIAS_UTEIS, APROVACAO_PATH } from './firebase';
import { BUSINESS_DAY, parseLocalDate, endOfLocalDay } from './taskTime';
import { mesChave } from './entregas';

/*
 * PLANEJAMENTO DE CONTEÚDO — funções puras, sem Firestore.
 *
 * Formato do documento `planejamentos/{token}`:
 *
 *   {
 *     clientId, clientName, mes: 'AAAA-MM',
 *     rodada: n,                 // quantas vezes a social já enviou
 *     enviadoEm: ISO | null,     // primeiro envio
 *     ultimoEnvioEm: ISO | null,
 *     posts: [{
 *       id, fmt, data: 'AAAA-MM-DD', hora: 'HH:mm',
 *       titulo, legenda, ideia,
 *       midias: [{ url, path, tipo: 'image' | 'video', nome }],
 *       rodada: n,               // rodada em que foi enviado (0 = rascunho)
 *       etapa: null | 'producao' | 'publicado',   // manual, da social
 *       videoEntregue: bool,     // manual, do videomaker
 *     }],
 *     respostas: { [postId]: { st: 'aprovado' | 'ajuste', comentario, rodada, em } },
 *     respondidoEm,
 *   }
 *
 * Por que a RODADA: quando a social corrige um post e reenvia, ele
 * ganha a rodada nova. A resposta antiga do cliente continua gravada,
 * mas não vale mais (a rodada não bate) — o post volta para "Com o
 * cliente" sem ninguém precisar apagar nada. E o cliente, que só pode
 * escrever em `respostas`, nunca toca no conteúdo dos posts.
 */

const pad2 = (n) => String(n).padStart(2, '0');

export const isoDia = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
export const hojeISO = () => isoDia(new Date());
export const mesDoISO = (iso) => String(iso || '').slice(0, 7);

const SEM_CURTA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const SEM_LONGA = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
const MESES_MIN = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

// "qua, 07/10"
export const dataCurta = (iso) => {
  const d = parseLocalDate(iso);
  if (!d) return '—';
  return `${SEM_CURTA[d.getDay()]}, ${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}`;
};
// "Quarta, 07 de outubro"
export const dataLonga = (iso) => {
  const d = parseLocalDate(iso);
  if (!d) return '—';
  return `${SEM_LONGA[d.getDay()]}, ${pad2(d.getDate())} de ${MESES_MIN[d.getMonth()]}`;
};
export const nomeDoMes = (chave) => {
  const m = Number(String(chave || '').split('-')[1]);
  return MESES_MIN[m - 1] || '';
};
export const diasNoMes = (chave) => {
  const [y, m] = String(chave || '').split('-').map(Number);
  return new Date(y, m, 0).getDate();
};

// ─── Status do post ──────────────────────────────────────────
// Derivado, nunca gravado (ver bloco em lib/firebase.js).
export function statusDoPost(post, plano) {
  if (!post?.rodada) return 'rascunho';
  const r = plano?.respostas?.[post.id];
  if (!r || r.rodada !== post.rodada) return 'cliente';
  if (r.st === 'ajuste') return 'ajuste';
  if (post.etapa === 'publicado') return 'publicado';
  if (post.etapa === 'producao') return 'producao';
  return 'aprovado';
}

export const APROVADOS = ['aprovado', 'producao', 'publicado'];
export const estaAprovado = (st) => APROVADOS.includes(st);

// O dia de publicação passou (fim do dia) e não foi publicado.
export function postAtrasado(post, st, agora = new Date()) {
  if (st === 'publicado') return false;
  const fim = endOfLocalDay(post?.data);
  return !!fim && fim < agora;
}

// Status que o calendário mostra: atraso tem prioridade visual.
export const statusEfetivo = (post, plano, agora = new Date()) => {
  const st = statusDoPost(post, plano);
  return postAtrasado(post, st, agora) ? 'atrasado' : st;
};

// "Atrasado · com o cliente"
export const rotuloStatus = (post, plano, agora = new Date()) => {
  const st = statusDoPost(post, plano);
  if (postAtrasado(post, st, agora)) return `Atrasado · ${POST_STATUS[st].label.toLowerCase()}`;
  return POST_STATUS[st].label;
};

// Comentário do cliente que vale para a rodada atual do post.
export const comentarioDoPost = (post, plano) => {
  const r = plano?.respostas?.[post?.id];
  return r && r.rodada === post?.rodada && r.st === 'ajuste' ? (r.comentario || '') : '';
};

export const podeEditar = (st) => st === 'rascunho' || st === 'ajuste';

// ─── Status do planejamento ──────────────────────────────────
export const PLANO_STATUS = {
  rascunho: { id: 'rascunho', label: 'Rascunho · não enviado', cor: 'var(--dim)', oco: true },
  ajuste:   { id: 'ajuste',   label: 'Cliente pediu ajuste',   cor: 'var(--purple)' },
  cliente:  { id: 'cliente',  label: 'Aguardando o cliente',   cor: 'var(--amber)' },
  parcial:  { id: 'parcial',  label: 'Posts novos sem enviar', cor: 'var(--dim)', oco: true },
  aprovado: { id: 'aprovado', label: 'Aprovado pelo cliente',  cor: 'var(--green)' },
  vazio:    { id: 'vazio',    label: 'Sem posts',              cor: 'var(--dim)', oco: true },
};

export function statusDoPlano(plano) {
  const sts = (plano?.posts || []).map((p) => statusDoPost(p, plano));
  if (!sts.length) return 'vazio';
  if (!plano.rodada) return 'rascunho';
  if (sts.includes('ajuste')) return 'ajuste';
  if (sts.includes('cliente')) return 'cliente';
  if (sts.includes('rascunho')) return 'parcial';
  return 'aprovado';
}

export const contaAprovados = (plano) =>
  (plano?.posts || []).filter((p) => estaAprovado(statusDoPost(p, plano))).length;

export const postsOrdenados = (plano) =>
  [...(plano?.posts || [])].sort((a, b) => `${a.data} ${a.hora}`.localeCompare(`${b.data} ${b.hora}`));

// ─── Vídeo (visão do Videomaker) ─────────────────────────────
// Volta N dias úteis (expediente de taskTime) a partir da data.
export function voltaDiasUteis(iso, n) {
  const d = parseLocalDate(iso);
  if (!d) return null;
  const x = new Date(d);
  let falta = n;
  let guarda = 0;
  while (falta > 0 && guarda++ < 60) {
    x.setDate(x.getDate() - 1);
    if (BUSINESS_DAY.workdays.includes(x.getDay())) falta -= 1;
  }
  return isoDia(x);
}

export const prazoVideo = (post) => voltaDiasUteis(post?.data, VIDEO_PRAZO_DIAS_UTEIS);

export function statusDoVideo(post, plano, agora = new Date()) {
  const st = statusDoPost(post, plano);
  if (!estaAprovado(st)) return 'aguarda';
  if (post.videoEntregue || st === 'publicado') return 'entregue';
  const prazo = prazoVideo(post);
  const hoje = isoDia(agora);
  const amanha = isoDia(new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() + 1));
  if (prazo < hoje) return 'atrasado';
  if (prazo <= amanha) return 'perto';
  return 'produzir';
}

// ─── Grade do calendário (domingo primeiro) ──────────────────
// Devolve semanas completas; dia fora do mês é null.
export function gradeDoMes(chave) {
  const [y, m] = String(chave || '').split('-').map(Number);
  if (!y || !m) return [];
  const offset = new Date(y, m - 1, 1).getDay();
  const total = new Date(y, m, 0).getDate();
  const celulas = Math.ceil((offset + total) / 7) * 7;
  return Array.from({ length: celulas }, (_, i) => {
    const dia = i - offset + 1;
    return dia >= 1 && dia <= total ? `${y}-${pad2(m)}-${pad2(dia)}` : null;
  });
}

// Semanas do mês para agrupar a página do cliente.
export const semanaDoMes = (iso) => {
  const d = parseLocalDate(iso);
  if (!d) return 0;
  const offset = new Date(d.getFullYear(), d.getMonth(), 1).getDay();
  return Math.floor((offset + d.getDate() - 1) / 7);
};

// ─── Post novo ───────────────────────────────────────────────
export const novoIdPost = () => `p_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

// Próxima data sugerida: 3 dias depois do último post, sem passar do mês.
export function dataSugerida(plano) {
  const ps = postsOrdenados(plano);
  const chave = plano?.mes || mesChave();
  const ultimo = ps.length ? Number(ps[ps.length - 1].data.slice(8, 10)) : 0;
  const dia = Math.min(diasNoMes(chave), ultimo ? ultimo + 3 : 2);
  return `${chave}-${pad2(dia)}`;
}

export const postVazio = (plano, fmt = 'feed') => ({
  id: novoIdPost(),
  fmt: POST_FORMATOS[fmt] ? fmt : 'feed',
  data: dataSugerida(plano),
  hora: '18:00',
  titulo: '',
  legenda: '',
  ideia: '',
  midias: [],
  rodada: 0,
  etapa: null,
  videoEntregue: false,
});

// ─── Link público ────────────────────────────────────────────
// O id do documento é o token: 24 caracteres aleatórios do crypto.
const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
export function gerarToken(tam = 24) {
  const bytes = new Uint8Array(tam);
  window.crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => ALFABETO[b % ALFABETO.length]).join('');
}

export const linkAprovacao = (planoId) => `${window.location.origin}${APROVACAO_PATH}${planoId}`;

export const tipoDaMidia = (file) => (String(file?.type || '').startsWith('video/') ? 'video' : 'image');

// ─── Listas para calendário e visões gerais ──────────────────
// Achata os planejamentos em { plano, post }. O Videomaker só vê reel
// que já foi para o cliente (rascunho ainda pode mudar de formato).
export function itensDosPlanos(planos, { soReels = false } = {}) {
  const out = [];
  (planos || []).forEach((plano) => (plano.posts || []).forEach((post) => {
    if (!post?.data) return;
    if (soReels && (post.fmt !== 'reel' || !post.rodada)) return;
    out.push({ plano, post });
  }));
  return out.sort((a, b) => `${a.post.data} ${a.post.hora}`.localeCompare(`${b.post.data} ${b.post.hora}`));
}
