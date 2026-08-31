import React, { useEffect, useRef, useMemo } from 'react';
import { LAYOUTS } from '../../../../lib/docs/layouts';
import { varsDaMarca } from '../../../../lib/docs/marca';

// ─────────────────────────────────────────────────────────────
// Lince Docs — PRÉ-VISUALIZAÇÃO
//
// Renderiza o deck slide a slide, em vez de uma string só, porque
// três coisas dependem de ter cada slide como elemento próprio:
// medir o transbordo, numerar as páginas e rolar até a seção que
// está sendo preenchida.
//
// O HTML vem do catálogo e já passa por `esc()` — o texto do usuário
// nunca chega cru até aqui.
// ─────────────────────────────────────────────────────────────

// Monta a lista de blocos: os slides fixos do documento com os
// extras encaixados logo depois do slide escolhido.
export function blocosDoDeck(doc, dados, opcionais, extras) {
  if (!doc || typeof doc.render !== 'function') return [];
  const fixos = doc.render(dados || {}, opcionais || {});
  const saida = [];
  fixos.forEach((b) => {
    saida.push({ ...b, extra: false });
    (extras || []).filter((e) => e.depois === b.id).forEach((e, i) => {
      const layout = LAYOUTS[e.layout];
      if (layout) {
        saida.push({
          id: `${e.id || `${b.id}-extra-${i}`}`,
          nome: layout.nome,
          html: layout.render(e.d || {}),
          extra: true,
          pai: b.nome,
        });
      }
    });
  });
  return saida;
}

// O `scrollHeight` do slide não serve para detectar transbordo: a
// marca d'água do lince fica de propósito para fora da caixa
// (`bottom:-14cqw`) e contaria como conteúdo que passou da página.
// Então medimos só o que está no fluxo — texto, cards e tabelas —
// ignorando numeração, logo e decoração posicionadas.
function textoSobrando(el) {
  const estilo = window.getComputedStyle(el);
  const limite = el.clientHeight - parseFloat(estilo.paddingBottom || 0);
  return Array.from(el.children).some((filho) => {
    if (window.getComputedStyle(filho).position === 'absolute') return false;
    return filho.offsetTop + filho.offsetHeight > limite + 2;
  });
}

export default function DocPreview({
  doc, dados, opcionais, extras, secaoAtiva, onTransbordo,
  imprimindo = false, apenasSecao = false,
}) {
  const refs = useRef([]);
  const todos = useMemo(
    () => blocosDoDeck(doc, dados, opcionais, extras),
    [doc, dados, opcionais, extras],
  );

  // Mostrar só os slides da seção aberta troca aproximação por
  // correspondência exata: o que está à direita é o que o campo à
  // esquerda produz. O deck inteiro continua a um clique.
  const blocos = useMemo(() => {
    if (!apenasSecao || !secaoAtiva) return todos;
    const doSetor = todos.filter((b) => b.nome === secaoAtiva || b.pai === secaoAtiva);
    return doSetor.length ? doSetor : todos;
  }, [todos, apenasSecao, secaoAtiva]);

  // A numeração é sempre a do documento inteiro, mesmo filtrando:
  // slide 7 tem que continuar sendo o 7.
  const numero = (b) => todos.findIndex((x) => x === b) + 1;

  // Detector de transbordo: o slide tem altura fixa, então conteúdo
  // que passa da página é conteúdo que seria cortado na impressão.
  // Marca com contorno rosa — que some no PDF, via @media print.
  useEffect(() => {
    if (imprimindo) return undefined;
    const medir = () => {
      let estourados = 0;
      refs.current.forEach((wrap) => {
        // O ref fica no invólucro, que é `display:contents` e não tem
        // caixa própria. Quem tem altura fixa é o `.slide` de dentro.
        const el = wrap && wrap.querySelector('.slide');
        if (!el) return;
        el.classList.toggle('transbordo', textoSobrando(el));
        if (el.classList.contains('transbordo')) estourados += 1;
      });
      if (onTransbordo) onTransbordo(estourados);
    };
    // Uma volta no laço de eventos para o layout assentar antes de medir.
    const t = setTimeout(medir, 60);
    window.addEventListener('resize', medir);
    return () => { clearTimeout(t); window.removeEventListener('resize', medir); };
  }, [blocos, imprimindo, onTransbordo]);

  // O deck acompanha a seção que está sendo preenchida. O nome do
  // slide bate com o título da seção no catálogo; sem correspondência,
  // fica onde está em vez de pular para o começo.
  useEffect(() => {
    if (imprimindo || apenasSecao || !secaoAtiva) return;
    const i = blocos.findIndex((b) => b.nome === secaoAtiva);
    if (i < 0) return;
    const el = refs.current[i] && refs.current[i].querySelector('.slide');
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [secaoAtiva, blocos, imprimindo, apenasSecao]);

  if (!doc) return null;

  return (
    <div className="lince-deck" style={varsDaMarca()}>
      {blocos.map((b, i) => (
        <div
          key={`${b.id}-${i}`}
          ref={(el) => { refs.current[i] = el; }}
          className="slide-wrap"
          style={{ width: '100%', display: 'contents' }}
          dangerouslySetInnerHTML={{
            __html: b.html.replace('<span class="pg"></span>', `<span class="pg">${numero(b)}</span>`),
          }}
        />
      ))}
    </div>
  );
}
