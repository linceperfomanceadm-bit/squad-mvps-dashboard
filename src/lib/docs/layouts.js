// ─────────────────────────────────────────────────────────────
// Lince Docs — LAYOUTS DE SLIDE EXTRA
//
// REGRA 3.9 — slide extra tem layout, não liberdade.
// Cinco modelos prontos, sem editor livre. Campo de texto solto
// vira, em três meses, slide com fonte trocada e cor fora da
// paleta — que é o problema que o template existe para resolver.
// ─────────────────────────────────────────────────────────────

import { v, lista } from './motor';

export const LAYOUTS = {
  texto: {
    nome: 'Texto corrido + fechamento',
    campos: [
      { id: 'olho', rot: 'Etiqueta superior', tipo: 'texto', ph: 'Seção extra' },
      { id: 'titulo', rot: 'Título', tipo: 'texto', ph: 'Funil de conversão' },
      { id: 'p1', rot: 'Parágrafo 1', tipo: 'area' },
      { id: 'p2', rot: 'Parágrafo 2 (opcional)', tipo: 'area' },
      { id: 'rot', rot: 'Rótulo da caixa de fechamento', tipo: 'texto', ph: 'Em uma frase' },
      { id: 'fecho', rot: 'Texto da caixa', tipo: 'area' },
    ],
    render: (e) => `<section class="slide mascote-canto"><span class="pg"></span>
      <div class="eyebrow">${v(e.olho, 'etiqueta')}</div><h2>${v(e.titulo, 'título')}</h2><div class="bar"></div>
      <p style="max-width:88%">${v(e.p1, 'parágrafo')}</p>
      ${e.p2 ? `<p style="margin-top:1.2cqw;max-width:88%">${v(e.p2, '')}</p>` : ''}
      ${(e.rot || e.fecho) ? `<div class="fecho"><span class="rot">${v(e.rot, 'rótulo')}</span>
        <p>${v(e.fecho, 'texto de fechamento')}</p></div>` : ''}
      <div class="logo"></div></section>`,
  },

  cards: {
    nome: 'Três cards numerados',
    campos: [
      { id: 'olho', rot: 'Etiqueta superior', tipo: 'texto' },
      { id: 'titulo', rot: 'Título', tipo: 'texto' },
      { id: 'intro', rot: 'Texto de abertura', tipo: 'area' },
      {
        id: 'itens', rot: 'Cards', tipo: 'lista', linhas: 3,
        cols: [{ id: 't', rot: 'Título' }, { id: 'd', rot: 'Descrição' }],
      },
      { id: 'rot', rot: 'Rótulo da caixa (opcional)', tipo: 'texto' },
      { id: 'fecho', rot: 'Texto da caixa (opcional)', tipo: 'area' },
    ],
    render: (e) => `<section class="slide"><span class="pg"></span>
      <div class="eyebrow">${v(e.olho, 'etiqueta')}</div><h2>${v(e.titulo, 'título')}</h2><div class="bar"></div>
      ${e.intro ? `<p style="margin-bottom:1.8cqw">${v(e.intro, '')}</p>` : ''}
      <div class="grid g3">${lista(e.itens).map((r, i) => `<div class="card">
        <span class="num">${i + 1}</span><h3>${v(r.t, 'título')}</h3><p>${v(r.d, 'descrição')}</p></div>`).join('')}</div>
      ${(e.rot || e.fecho) ? `<div class="fecho"><span class="rot">${v(e.rot, 'rótulo')}</span>
        <p>${v(e.fecho, '')}</p></div>` : ''}
      <div class="logo"></div></section>`,
  },

  tabela: {
    nome: 'Tabela livre',
    campos: [
      { id: 'olho', rot: 'Etiqueta superior', tipo: 'texto' },
      { id: 'titulo', rot: 'Título', tipo: 'texto' },
      { id: 'intro', rot: 'Texto de abertura', tipo: 'area' },
      {
        id: 'cab', rot: 'Cabeçalho', tipo: 'lista', linhas: 1,
        cols: [{ id: 'a', rot: 'Coluna 1' }, { id: 'b', rot: 'Coluna 2' }, { id: 'c', rot: 'Coluna 3' }, { id: 'd', rot: 'Coluna 4' }],
      },
      {
        id: 'linhas', rot: 'Linhas', tipo: 'lista', linhas: 6,
        cols: [{ id: 'a', rot: 'Col 1' }, { id: 'b', rot: 'Col 2' }, { id: 'c', rot: 'Col 3' }, { id: 'd', rot: 'Col 4' }],
      },
    ],
    render: (e) => {
      const cab = lista(e.cab)[0] || {};
      const cols = ['a', 'b', 'c', 'd'].filter((k) => cab[k] && cab[k].trim());
      const usar = cols.length ? cols : ['a', 'b', 'c', 'd'];
      const linhas = lista(e.linhas).filter((r) => usar.some((k) => r[k] && r[k].trim()));
      return `<section class="slide"><span class="pg"></span>
        <div class="eyebrow">${v(e.olho, 'etiqueta')}</div><h2>${v(e.titulo, 'título')}</h2><div class="bar"></div>
        ${e.intro ? `<p style="margin-bottom:1.6cqw">${v(e.intro, '')}</p>` : ''}
        <table><thead><tr>${usar.map((k) => `<th>${v(cab[k], 'coluna')}</th>`).join('')}</tr></thead>
        <tbody>${(linhas.length ? linhas : [{}]).map((r) => `<tr>${usar.map((k) => `<td>${v(r[k], '—')}</td>`).join('')}</tr>`).join('')}</tbody></table>
        <div class="logo"></div></section>`;
    },
  },

  duas: {
    nome: 'Texto + card de destaque',
    campos: [
      { id: 'olho', rot: 'Etiqueta superior', tipo: 'texto' },
      { id: 'titulo', rot: 'Título', tipo: 'texto' },
      { id: 'texto', rot: 'Coluna de texto', tipo: 'area' },
      { id: 'cardTit', rot: 'Título do card', tipo: 'texto' },
      { id: 'itens', rot: 'Itens do card', tipo: 'lista', linhas: 4, cols: [{ id: 't', rot: 'Item' }] },
      { id: 'rot', rot: 'Rótulo da caixa (opcional)', tipo: 'texto' },
      { id: 'fecho', rot: 'Texto da caixa (opcional)', tipo: 'area' },
    ],
    render: (e) => `<section class="slide"><span class="pg"></span>
      <div class="eyebrow">${v(e.olho, 'etiqueta')}</div><h2>${v(e.titulo, 'título')}</h2><div class="bar"></div>
      <div class="grid g2" style="align-items:start">
        <div><p>${v(e.texto, 'texto')}</p></div>
        <div class="card claro"><h3>${v(e.cardTit, 'título do card')}</h3>
          <ul class="ast" style="margin-top:1cqw">${lista(e.itens).filter((r) => r.t && r.t.trim())
    .map((r) => `<li>${v(r.t, '')}</li>`).join('') || '<li><span class="ph">[itens]</span></li>'}</ul></div>
      </div>
      ${(e.rot || e.fecho) ? `<div class="fecho"><span class="rot">${v(e.rot, 'rótulo')}</span>
        <p>${v(e.fecho, '')}</p></div>` : ''}
      <div class="logo"></div></section>`,
  },

  divisor: {
    nome: 'Divisor de seção',
    campos: [
      { id: 'titulo', rot: 'Título grande', tipo: 'texto', ph: 'Parte 2' },
      { id: 'sub', rot: 'Subtítulo', tipo: 'area', ph: 'O que vem a seguir e por quê.' },
    ],
    render: (e) => `<section class="slide mascote-canto"><span class="pg"></span>
      <div style="margin:auto 0;max-width:70%">
        <h1 style="font-size:5.4cqw">${v(e.titulo, 'título')}</h1>
        <div class="bar"></div><p class="lede">${v(e.sub, 'subtítulo')}</p></div>
      <div class="logo"></div></section>`,
  },
};

export const LAYOUT_PADRAO = 'texto';
