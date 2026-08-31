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
          nome: `${layout.nome}`,
          html: layout.render(e.d || {}),
          extra: true,
        });
      }
    });
  });
  return saida;
}

export default function DocPreview({
  doc, dados, opcionais, extras, secaoAtiva, onTransbordo, imprimindo = false,
}) {
  const refs = useRef([]);
  const blocos = useMemo(
    () => blocosDoDeck(doc, dados, opcionais, extras),
    [doc, dados, opcionais, extras],
  );

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
        const passou = el.scrollHeight > el.clientHeight + 2;
        el.classList.toggle('transbordo', passou);
        if (passou) estourados += 1;
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
    if (imprimindo || !secaoAtiva) return;
    const i = blocos.findIndex((b) => b.nome === secaoAtiva);
    if (i < 0) return;
    const el = refs.current[i] && refs.current[i].querySelector('.slide');
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [secaoAtiva, blocos, imprimindo]);

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
            __html: b.html.replace('<span class="pg"></span>', `<span class="pg">${i + 1}</span>`),
          }}
        />
      ))}
    </div>
  );
}
