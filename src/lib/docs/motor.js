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
// itálico apagado. Vale só para o rascunho do editor: apresentação e
// PDF passam por `blocosFinais`, que tira o marcador e o que ficou
// vazio com ele. Nenhum campo é obrigatório para o slide sair.
export const v = (val, ph) => (val && String(val).trim())
  ? esc(val).replace(/\n/g, '<br>')
  : `<span class="ph">[${esc(ph)}]</span>`;

export const lista = (a) => (Array.isArray(a) ? a : []);

// ─── Versão final: sem marcação de campo vazio ────────────────
// A regra 3.1 (campo vazio aparece entre colchetes) existe para o
// RASCUNHO — é o que faz a pessoa ver o buraco enquanto preenche.
// No que vai para o cliente, PDF e apresentação, ela vira o oposto:
// ninguém deve ler "[frase de recorte]" numa reunião.
//
// Então aqui o HTML pronto passa por uma limpeza: tira os marcadores,
// e depois tira o que ficou sem conteúdo por causa deles — item de
// lista, linha de tabela, card, fecho. Tabela que perdeu todas as
// linhas sai inteira; slide que ficou só com título sai do deck
// (`limparSlide` devolve string vazia, e quem chama descarta).
//
// Feito no HTML, e não no catálogo, de propósito: assim vale para
// todos os documentos e para os slides extras, sem obrigar cada
// `render` a conhecer duas versões de si mesmo.
//
// Duas marcas que o `render` pode usar para ajudar a limpeza:
//   `.so-com-valor` — o elemento só existe com o valor dentro dele.
//     Serve para rótulo que fica solto quando o campo está vazio
//     ("Base de cálculo adotada:", "antes —", "O que prova ...").
//   `.fixo` — texto que o catálogo escreve sozinho (legenda, card
//     explicativo). Aparece quando o slide tem conteúdo, mas não
//     segura sozinho um slide que ninguém preencheu.

// Decoração não conta como conteúdo: numeração do card, rótulo do
// fecho, etiqueta de funil, número da página e o logo.
const DECORACAO = '.num, .rot, .tag, .pg, .logo, .bar';

const temConteudo = (el, ignorar = '') => {
  const copia = el.cloneNode(true);
  copia.querySelectorAll(ignorar ? `${DECORACAO}, ${ignorar}` : DECORACAO).forEach((d) => d.remove());
  // Pontuação e separador não são conteúdo: um item que sobrou só
  // com o ponto final da frase é lixo de template, não informação.
  const texto = copia.textContent.replace(/[\s·|—–.,;:]/g, '');
  return texto.length > 0 || !!copia.querySelector('img');
};

// Card e fecho não vivem de título fixo: um card que sobrou só com
// "O que aconteceu" é uma caixa vazia com nome bonito. Mas título que
// a pessoa escreveu é conteúdo — pilar só com o nome, brecha só com o
// título, peça sem descrição: tudo isso aparece. Por isso só o `<h3>`
// marcado como `.fixo` no catálogo é ignorado. Antes todo `<h3>` era,
// e um card com o nome preenchido sumia por falta da descrição.
const temCorpo = (el) => temConteudo(el, 'h3.fixo');

export function limparSlide(html) {
  if (!html || typeof DOMParser === 'undefined') return html;
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');
  const slide = doc.body.firstElementChild;
  if (!slide) return html;

  // 0 · rótulo que depende de um valor vazio sai com ele. Precisa vir
  //     antes do passo 1, enquanto o marcador ainda denuncia o vazio.
  slide.querySelectorAll('.so-com-valor').forEach((el) => {
    if (el.querySelector('.ph')) el.remove();
  });

  // 1 · fora os marcadores de campo vazio
  slide.querySelectorAll('.ph, .tag.vazio').forEach((el) => el.remove());

  // 2 · fora o que ficou vazio. Do mais interno para o mais externo,
  //     senão um card sobreviveria por causa de um <p> que ainda vai
  //     ser removido no passo seguinte.
  ['li', 'td', 'p', 'h3', 'tr', '.card', '.fecho'].forEach((sel) => {
    slide.querySelectorAll(sel).forEach((el) => {
      // Célula vazia não some sozinha: ela quebraria a linha da
      // tabela. Quem decide é a linha inteira, logo abaixo.
      if (el.tagName === 'TD') return;
      const cheio = (sel === '.card' || sel === '.fecho') ? temCorpo(el) : temConteudo(el);
      if (!cheio) el.remove();
    });
  });

  // 3 · tabela sem nenhuma linha preenchida não tem por que existir
  slide.querySelectorAll('table').forEach((t) => {
    if (!t.querySelector('tbody tr')) t.remove();
  });

  // 4 · as barras de peso dos pilares são desenhadas fora dos cards;
  //     sobra uma barra para cada pilar que acabou de sair. Barra e
  //     card carregam o mesmo `data-linha`, então sai exatamente a
  //     barra do pilar vazio — antes cortava as últimas, e com um
  //     pilar vazio no meio sobrava a barra errada.
  const barras = slide.querySelector('.pesos');
  if (barras) {
    const cards = Array.from(slide.querySelectorAll('.grid .card'));
    const vivos = new Set(cards.map((c) => c.getAttribute('data-linha')).filter((x) => x !== null));
    if (vivos.size) {
      Array.from(barras.children).forEach((b) => {
        if (!vivos.has(b.getAttribute('data-linha'))) b.remove();
      });
    } else {
      Array.from(barras.children).slice(cards.length).forEach((b) => b.remove());
    }
    if (!barras.children.length) barras.remove();
  }

  // 4b · no fluxo, as setas ficam entre os cards. Card que saiu deixa
  //      seta sobrando no começo, no fim ou duas seguidas.
  slide.querySelectorAll('.fluxo').forEach((fluxo) => {
    let anteriorEraCard = false;
    Array.from(fluxo.children).forEach((el) => {
      if (el.classList.contains('seta')) {
        if (!anteriorEraCard) el.remove();
        else anteriorEraCard = false;
      } else {
        anteriorEraCard = true;
      }
    });
    const ultimo = fluxo.lastElementChild;
    if (ultimo && ultimo.classList.contains('seta')) ultimo.remove();
    if (!fluxo.children.length) fluxo.remove();
  });

  // 5 · slide sem nada preenchido não entra — texto `.fixo` do
  //     catálogo não conta. Capa e encerramento são exceção: vivem de
  //     texto fixo e fecham o deck.
  const fixo = slide.classList.contains('capa') || slide.classList.contains('fechamento');
  const vivo = slide.cloneNode(true);
  vivo.querySelectorAll('.fixo').forEach((el) => el.remove());
  const restou = ['p', 'li', 'tr', '.card', '.fecho']
    .some((sel) => Array.from(vivo.querySelectorAll(sel))
      .some((el) => ((sel === '.card' || sel === '.fecho') ? temCorpo(el) : temConteudo(el))));
  if (!fixo && !restou) return '';

  return slide.outerHTML;
}

// Aplica `limparSlide` numa lista de blocos e descarta os que saíram.
export const blocosFinais = (blocos) => lista(blocos)
  .map((b) => ({ ...b, html: limparSlide(b.html) }))
  .filter((b) => b.html);

// ─── Versão final: linha que só tem o padrão não foi preenchida ──
// A regra 3.11 pré-preenche colunas (nome da métrica, direção, etapa
// do funil, formato). No rascunho isso ajuda; na versão final, uma
// linha que só tem o que veio pronto é linha que ninguém preencheu —
// e aparecia no slide como "Alcance" sem número nenhum.
//
// Coluna com `padrao` é rótulo: sozinha não faz a linha contar. A
// linha entra quando alguma coluna sem padrão tem valor. Linha vazia
// vira `{}` no mesmo lugar (e não sai do array) porque a posição
// importa: é ela que numera card e escolhe o destaque de cada camada.
export function dadosDaVersaoFinal(doc, dados) {
  if (!doc || !doc.secoes) return dados || {};
  const saida = { ...(dados || {}) };
  doc.secoes.forEach((sec) => sec.campos.forEach((c) => {
    if (c.tipo !== 'lista' || !Array.isArray(saida[c.id])) return;
    const contam = c.cols.filter((col) => !Array.isArray(col.padrao));
    if (contam.length === c.cols.length) return; // lista sem padrão: nada a fazer
    saida[c.id] = saida[c.id].map((linha) => {
      const preenchida = linha && contam.some((col) => linha[col.id] && String(linha[col.id]).trim());
      return preenchida ? linha : {};
    });
  }));
  return saida;
}

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

// ─── REGRA 3.11 — valores padrão das listas ───────────────────
// Semeia os `padrao` declarados nas colunas. Só preenche célula que
// nunca foi tocada (undefined): célula apagada pela pessoa fica ''
// e é respeitada. Devolve o mesmo objeto quando não há o que semear,
// para quem chama saber se precisa gravar.
export function semearPadroes(doc, dados) {
  if (!doc || !doc.secoes) return dados || {};
  let novo = null;
  doc.secoes.forEach((sec) => sec.campos.forEach((c) => {
    if (c.tipo !== 'lista') return;
    c.cols.filter((col) => Array.isArray(col.padrao)).forEach((col) => {
      col.padrao.forEach((valor, i) => {
        if (i >= c.linhas || !valor) return;
        const base = novo || dados || {};
        const linha = lista(base[c.id])[i];
        if (linha && linha[col.id] !== undefined) return;
        if (!novo) novo = { ...(dados || {}) };
        const linhas = [...lista(novo[c.id])];
        for (let k = 0; k < c.linhas; k += 1) linhas[k] = linhas[k] || {};
        linhas[i] = { ...linhas[i], [col.id]: valor };
        novo[c.id] = linhas;
      });
    });
  }));
  return novo || dados || {};
}

// Seções opcionais que nascem desligadas (`iniciaDesligada`).
// Usado só na criação: documento antigo mantém o que já tinha.
export function opcionaisIniciais(doc) {
  if (!doc || !doc.secoes) return {};
  return Object.fromEntries(
    doc.secoes.filter((s) => s.opcional && s.iniciaDesligada).map((s) => [s.t, false]),
  );
}

// ─── REGRA 3.10 — modo essencial ──────────────────────────────
// O que o formulário mostra em cada nível. Esconde, nunca apaga:
// o dado continua no documento e no slide.
export const colunasVisiveis = (campo, essencial) => (
  essencial ? campo.cols.filter((c) => !c.extra) : campo.cols
);

export const linhasVisiveis = (campo, essencial) => (
  essencial && campo.linhasEss ? Math.min(campo.linhasEss, campo.linhas) : campo.linhas
);

export const campoVisivel = (campo, essencial) => !(essencial && campo.extra);

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

// ─── Estrutura do deck: ordem e slides removidos ──────────────
// Cada documento pode reordenar e tirar slides, sem tocar no
// catálogo. Fica gravado no próprio documento, por id de slide:
//   `ordem`     — ids na ordem escolhida (só os do meio)
//   `removidos` — ids que saíram do documento
// Documento antigo não tem nenhum dos dois e abre na ordem do
// catálogo, sem nada removido.
//
// Capa e encerramento não andam nem saem: a capa é a identidade do
// documento e o "Obrigado" fecha o deck. Os ids são convenção de
// todos os documentos do catálogo.
export const SLIDE_INICIO = 'capa';
export const SLIDE_FIM = 'fim';
export const slideTravado = (id) => id === SLIDE_INICIO || id === SLIDE_FIM;

// Ordem final dos slides do meio. Slide que não está na ordem salva
// (documento novo no catálogo, ou ordem gravada antes de ele existir)
// entra logo depois do vizinho que vinha antes dele no catálogo, em
// vez de cair no fim do deck.
export function ordemEfetiva(idsDoCatalogo, ordem) {
  const meio = lista(idsDoCatalogo).filter((id) => !slideTravado(id));
  const saida = lista(ordem).filter((id, i, arr) => meio.includes(id) && arr.indexOf(id) === i);
  meio.forEach((id, i) => {
    if (saida.includes(id)) return;
    const vizinho = meio.slice(0, i).reverse().find((x) => saida.includes(x));
    saida.splice(vizinho ? saida.indexOf(vizinho) + 1 : 0, 0, id);
  });
  return saida;
}

// Aplica a ordem a uma lista de blocos `{ id, ... }`: capa primeiro,
// encerramento por último, o resto como a pessoa arrumou.
export function ordenarSlides(blocos, ordem) {
  const todos = lista(blocos);
  const ids = ordemEfetiva(todos.map((b) => b.id), ordem);
  return [
    ...todos.filter((b) => b.id === SLIDE_INICIO),
    ...ids.map((id) => todos.find((b) => b.id === id)).filter(Boolean),
    ...todos.filter((b) => b.id === SLIDE_FIM),
  ];
}

// Pontos de inserção disponíveis para os slides extras, na ordem do
// documento. O encerramento fica de fora: nada entra depois do
// "Obrigado". Slide removido continua na lista, marcado — um extra
// preso a ele entra no lugar onde ele estaria.
export function pontosDeInsercao(doc, estrutura) {
  if (!doc || typeof doc.render !== 'function') return [];
  const removidos = lista(estrutura?.removidos);
  return ordenarSlides(doc.render({}, {}), estrutura?.ordem)
    .filter((b) => b.id !== SLIDE_FIM)
    .map((b) => ({ id: b.id, nome: removidos.includes(b.id) ? `${b.nome} (removido)` : b.nome }));
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
