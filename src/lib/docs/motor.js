// ─────────────────────────────────────────────────────────────
// Lince Docs — MOTOR
// Funções genéricas usadas por todos os documentos do catálogo.
// Nada aqui conhece um documento específico: quem define campos e
// slides é `catalogo.js`. Adicionar um documento novo não deve exigir
// tocar neste arquivo.
// ─────────────────────────────────────────────────────────────

// Escapa o texto do usuário antes de entrar no HTML do slide.
export const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]
));

// REGRA 3.1 — campo vazio nunca é invisível.
// Sem valor, o slide mostra o nome do que falta entre colchetes, em
// itálico apagado. Continua marcado no PDF, de propósito.
export const v = (val, ph) => (val && String(val).trim())
  ? esc(val).replace(/\n/g, '<br>')
  : `<span class="ph">[${esc(ph)}]</span>`;

export const lista = (a) => (Array.isArray(a) ? a : []);

export const num = (x, fallback) => {
  const n = parseFloat(x);
  return isNaN(n) ? fallback : n;
};

// Lê número digitado por humano: aceita 12.400, 0,48, R$ 14,20 e 52%.
// O ponto só é separador de milhar quando agrupa de três em três.
export const n2 = (x) => {
  if (x === undefined || x === null) return NaN;
  let t = String(x).trim().replace(/[^0-9.,-]/g, '');
  if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(t)) t = t.replace(/\./g, '');
  t = t.replace(',', '.');
  return (t === '' || t === '-') ? NaN : parseFloat(t);
};

// Variação mês a mês. `dir` declara se cair é bom (CPL, skip rate).
// REGRA da parte 8: alta é branca, queda é rosa. Sem verde e vermelho.
export function delta(ant, atual, dir) {
  const a = n2(ant), b = n2(atual);
  if (isNaN(b)) return '';
  if (isNaN(a)) return '<span class="delta novo">novo</span>';
  if (a === 0) return '<span class="delta novo">—</span>';
  const p = (b - a) / Math.abs(a) * 100;
  if (Math.abs(p) < 0.5) return '<span class="delta estavel">estável</span>';
  const bom = (dir === '↓ melhor') ? p < 0 : p > 0;
  const fmt = (p > 0 ? '+' : '') + (Math.abs(p) >= 10 ? Math.round(p) : p.toFixed(1)) + '%';
  return `<span class="delta ${bom ? 'alta' : 'queda'}">${p > 0 ? '▲' : '▼'} ${fmt}</span>`;
}

// ─── Montagem do deck ─────────────────────────────────────────
// Junta os slides fixos do documento com os slides extras, cada um
// na posição declarada em `depois`.
export function montarDeck(doc, dados, opcionais, extras, LAYOUTS) {
  // Documento em construção não tem render — o catálogo mostra o card
  // apagado, mas nada deve tentar montar um deck a partir dele.
  if (!doc || typeof doc.render !== 'function') return '';
  const blocos = doc.render(dados || {}, opcionais || {});
  return blocos.map((b) => b.html + lista(extras)
    .filter((e) => e.depois === b.id)
    .map((e) => (LAYOUTS[e.layout] ? LAYOUTS[e.layout].render(e.d || {}) : ''))
    .join('')).join('');
}

// Pontos de inserção disponíveis para os slides extras.
// O encerramento fica de fora: nada entra depois do "Obrigado".
export function pontosDeInsercao(doc) {
  if (!doc || typeof doc.render !== 'function') return [];
  return doc.render({}, {}).filter((b) => b.id !== 'fim').map((b) => ({ id: b.id, nome: b.nome }));
}

// ─── REGRA 3.3 — balanço do funil ─────────────────────────────
// Soma peças e pesos por etapa. Apoio interno: nunca entra no PDF.
const ETAPAS = [['T', 'Topo'], ['M', 'Meio'], ['F', 'Fundo']];

export function balancoFunil(dados) {
  const pecas = lista(dados?.mockup).filter((r) => r && r.fn);
  const pilares = lista(dados?.pilares).filter((r) => r && r.f);

  const etapas = ETAPAS.map(([curto, longo]) => ({
    nome: longo,
    pecas: pecas.filter((r) => r.fn === curto).length,
    peso: pilares.filter((r) => r.f === longo).reduce((acc, r) => acc + num(r.p, 0), 0),
  }));

  const vazias = etapas.filter((e) => !e.pecas && !e.peso).map((e) => e.nome);
  return { etapas, vazias, semDados: vazias.length === 3 };
}

// ─── REGRA 3.4 — o documento fecha o círculo ──────────────────
// A seção 01 nomeia um gargalo; a seção 07 entrega o fluxo que o
// elimina. A verificação é semântica e o app não tem como ter
// certeza — por isso devolve uma sugestão, e quem decide é a pessoa.
const IRRELEVANTES = new Set([
  'para', 'como', 'esse', 'essa', 'este', 'esta', 'isso', 'pelo', 'pela', 'mais',
  'menos', 'muito', 'ainda', 'sobre', 'entre', 'quando', 'porque', 'sempre',
  'nunca', 'todos', 'todas', 'cada', 'onde', 'depois', 'antes', 'nosso', 'nossa',
  'cliente', 'conteudo', 'perfil', 'marca', 'mesmo', 'sendo', 'apenas',
]);

const palavrasChave = (texto) => {
  const limpo = String(texto || '').toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ');
  return [...new Set(limpo.split(/\s+/).filter((p) => p.length > 4 && !IRRELEVANTES.has(p)))];
};

export function checarGargalo(dados) {
  const gargalo = dados?.gargalo, resultado = dados?.resultado;
  if (!gargalo?.trim() || !resultado?.trim()) return { aplicavel: false, ok: true };
  const chaves = palavrasChave(gargalo);
  if (!chaves.length) return { aplicavel: false, ok: true };
  const alvo = String(resultado).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const encontradas = chaves.filter((p) => alvo.includes(p));
  return { aplicavel: true, ok: encontradas.length > 0, encontradas };
}

// ─── REGRA 3.7 — períodos comparados precisam ser equivalentes ──
// Um mês de 31 dias contra uma janela de 28 não é comparação.
const dias = (inicio, fim) => {
  if (!inicio || !fim) return null;
  const a = new Date(`${inicio}T00:00:00`), b = new Date(`${fim}T00:00:00`);
  if (isNaN(a) || isNaN(b)) return null;
  return Math.round((b - a) / 86400000) + 1;
};

export function checarPeriodos(meta) {
  const atual = dias(meta?.periodoInicio, meta?.periodoFim);
  const anterior = dias(meta?.comparadoInicio, meta?.comparadoFim);
  if (atual === null || anterior === null) return { aplicavel: false, ok: true };
  const diff = Math.abs(atual - anterior);
  return { aplicavel: true, ok: diff <= 3, atual, anterior, diff };
}

// ─── REGRA 3.5 — pendências ───────────────────────────────────
// As marcações do agente viram itens riscáveis. Pendência em aberto
// entra no aviso antes de gerar o PDF. Nunca imprime.
export const pendenciasAbertas = (pendencias) => lista(pendencias).filter((p) => !p.ok).length;

// Converte o texto colado (uma pendência por linha) em itens,
// preservando o que já foi marcado como resolvido.
export function pendenciasDoTexto(texto, anteriores) {
  const marcadas = Object.fromEntries(lista(anteriores).map((p) => [p.t, p.ok]));
  return String(texto || '').split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((t) => ({ t, ok: !!marcadas[t] }));
}
