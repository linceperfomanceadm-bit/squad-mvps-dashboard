import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import {
  ChevronLeft, ChevronRight, X, Maximize2, Minimize2, LayoutGrid, FileDown,
} from 'lucide-react';
import { varsDaMarca } from '../../../../lib/docs/marca';
import { blocosDoDeck } from './DocPreview';
import '../../../../styles/lince-docs.css';

// ─────────────────────────────────────────────────────────────
// Lince Docs — MODO APRESENTAÇÃO
//
// Apresentar o deck para o cliente dentro do próprio app, sem passar
// pelo PDF. O PDF continua existindo (botão na barra), mas numa
// reunião ele pesa: abre outro programa, rola em vez de trocar de
// página e perde a navegação por teclado.
//
// COMO FICA LEVE: todos os slides são montados de uma vez, empilhados
// no mesmo lugar, e só a opacidade muda. Assim a capa, o logo e as
// fontes já estão decodificados quando o slide aparece — trocar de
// página é só um fade, sem piscar imagem carregando.
//
// Os slides usam `cqw` (ver lince-docs.css), então escalam sozinhos
// para qualquer tela. A única coisa que muda aqui é tirar o
// `max-width: 1280px` do slide, que na pré-visualização faz sentido e
// numa TV 4K deixaria o slide pequeno no meio da tela.
//
// Teclado: → ↓ Espaço PageDown avançam · ← ↑ PageUp voltam ·
// Home/End · G abre a grade · F tela cheia · Esc sai.
// ─────────────────────────────────────────────────────────────

const OCIOSO_MS = 2600;

const CSS = `
.lince-presenter .lince-deck { display: block; gap: 0; }
.lince-presenter .lince-deck .slide { max-width: none; }
.lince-presenter .lince-deck .slide.transbordo { outline: none; }
.lince-presenter-thumb .lince-deck { display: block; gap: 0; }
.lince-presenter-thumb .lince-deck .slide { max-width: none; }
.lince-presenter-thumb .lince-deck .slide.transbordo { outline: none; }
`;

// A Fullscreen API devolve promessa e recusa quando o navegador não
// deixa (iframe, iOS). Não é erro: a apresentação segue na janela.
const semErro = (p) => { if (p && typeof p.catch === 'function') p.catch(() => {}); };

const comNumero = (html, n) => html.replace('<span class="pg"></span>', `<span class="pg">${n}</span>`);

export default function DocPresenter({
  doc, dados, opcionais, extras, titulo, inicio = 0, onClose, onSalvarPDF,
}) {
  const blocos = useMemo(
    () => blocosDoDeck(doc, dados, opcionais, extras),
    [doc, dados, opcionais, extras],
  );
  const total = blocos.length;

  const [atual, setAtual] = useState(() => Math.min(Math.max(inicio, 0), Math.max(total - 1, 0)));
  const [grade, setGrade] = useState(false);
  const [telaCheia, setTelaCheia] = useState(false);
  const [controles, setControles] = useState(true);

  const raiz = useRef(null);
  const ocioso = useRef(null);
  const toque = useRef(null);

  const irPara = useCallback((i) => {
    setAtual(Math.min(Math.max(i, 0), Math.max(total - 1, 0)));
  }, [total]);

  const proximo = useCallback(() => setAtual(i => Math.min(i + 1, Math.max(total - 1, 0))), [total]);
  const anterior = useCallback(() => setAtual(i => Math.max(i - 1, 0)), []);

  // Barra some quando o mouse para — o cliente vê só o slide.
  const acordar = useCallback(() => {
    setControles(true);
    clearTimeout(ocioso.current);
    ocioso.current = setTimeout(() => setControles(false), OCIOSO_MS);
  }, []);

  const alternarTelaCheia = useCallback(() => {
    if (document.fullscreenElement) semErro(document.exitFullscreen?.());
    else semErro(raiz.current?.requestFullscreen?.());
  }, []);

  // Entra em tela cheia ao abrir (o clique no botão "Apresentar" é o
  // gesto do usuário que o navegador exige) e trava a rolagem da página.
  useEffect(() => {
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    semErro(raiz.current?.requestFullscreen?.());
    const aoMudar = () => setTelaCheia(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', aoMudar);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener('fullscreenchange', aoMudar);
      clearTimeout(ocioso.current);
      if (document.fullscreenElement) semErro(document.exitFullscreen?.());
    };
  }, []);

  useEffect(() => { acordar(); }, [acordar]);

  // O documento pode perder slides enquanto está aberto (seção
  // opcional desligada em outra aba) — não deixa o índice sobrar.
  useEffect(() => {
    if (atual > total - 1) setAtual(Math.max(total - 1, 0));
  }, [atual, total]);

  useEffect(() => {
    const tecla = (e) => {
      if (e.target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;
      const k = e.key;
      // Depois de clicar num botão da barra o foco fica nele, e Espaço/
      // Enter disparariam o botão E a navegação — pulando dois slides.
      if (e.target?.tagName === 'BUTTON' && (k === ' ' || k === 'Enter')) e.target.blur();
      if (k === 'Escape') {
        e.preventDefault();
        if (grade) setGrade(false);
        else onClose();
        return;
      }
      if (k === 'g' || k === 'G') { setGrade(v => !v); return; }
      if (k === 'f' || k === 'F') { alternarTelaCheia(); return; }
      if (grade) return;
      if (['ArrowRight', 'ArrowDown', 'PageDown', ' ', 'Enter'].includes(k)) { e.preventDefault(); proximo(); }
      else if (['ArrowLeft', 'ArrowUp', 'PageUp', 'Backspace'].includes(k)) { e.preventDefault(); anterior(); }
      else if (k === 'Home') { e.preventDefault(); irPara(0); }
      else if (k === 'End') { e.preventDefault(); irPara(total - 1); }
    };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, [grade, onClose, alternarTelaCheia, proximo, anterior, irPara, total]);

  // Clique no terço esquerdo volta, no resto avança — como controle
  // de apresentação. Arrastar no celular/tablet também troca.
  const cliqueNoPalco = (e) => {
    const box = e.currentTarget.getBoundingClientRect();
    if (e.clientX - box.left < box.width / 3) anterior();
    else proximo();
  };

  const inicioToque = (e) => { toque.current = e.touches[0]?.clientX ?? null; };
  const fimToque = (e) => {
    if (toque.current == null) return;
    const dx = (e.changedTouches[0]?.clientX ?? toque.current) - toque.current;
    toque.current = null;
    if (Math.abs(dx) < 40) return;
    if (dx < 0) proximo(); else anterior();
  };

  const marca = varsDaMarca();

  const conteudo = (
    <div
      ref={raiz}
      className="lince-presenter"
      style={{ ...S.raiz, cursor: controles || grade ? 'default' : 'none' }}
      onMouseMove={acordar}
      onTouchStart={inicioToque}
      onTouchEnd={fimToque}
    >
      <style>{CSS}</style>

      {/* Progresso */}
      <div style={S.trilho}>
        <div style={{ ...S.progresso, width: total ? `${((atual + 1) / total) * 100}%` : 0 }} />
      </div>

      {/* Palco */}
      <div style={S.palcoArea}>
        {total === 0 ? (
          <p style={{ color: '#b6b6c8', fontSize: 14 }}>Este documento ainda não tem slides.</p>
        ) : (
          <div
            className="lince-deck"
            style={{ ...marca, ...S.palco }}
            onClick={grade ? undefined : cliqueNoPalco}
          >
            {blocos.map((b, i) => (
              <div
                key={`${b.id}-${i}`}
                aria-hidden={i !== atual}
                style={{
                  ...S.camada,
                  opacity: i === atual ? 1 : 0,
                  visibility: Math.abs(i - atual) <= 1 || i === atual ? 'visible' : 'hidden',
                  zIndex: i === atual ? 2 : 1,
                }}
                dangerouslySetInnerHTML={{ __html: comNumero(b.html, i + 1) }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Barra de controle */}
      <div style={{ ...S.barra, opacity: controles || grade ? 1 : 0, pointerEvents: controles || grade ? 'auto' : 'none' }}>
        <div style={S.barraEsq}>
          <p style={S.titulo}>{titulo}</p>
          {blocos[atual]?.nome && <p style={S.secao}>{blocos[atual].nome}</p>}
        </div>

        <div style={S.barraMeio}>
          <button type="button" style={S.botao} onClick={anterior} disabled={atual === 0} title="Anterior (←)">
            <ChevronLeft size={18} />
          </button>
          <span style={S.contador}>{total ? atual + 1 : 0} / {total}</span>
          <button type="button" style={S.botao} onClick={proximo} disabled={atual >= total - 1} title="Próximo (→)">
            <ChevronRight size={18} />
          </button>
        </div>

        <div style={S.barraDir}>
          <button type="button" style={{ ...S.botao, ...(grade ? S.botaoOn : {}) }} onClick={() => setGrade(v => !v)} title="Todos os slides (G)">
            <LayoutGrid size={16} />
          </button>
          <button type="button" style={S.botao} onClick={alternarTelaCheia} title="Tela cheia (F)">
            {telaCheia ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>
          {onSalvarPDF && (
            <button type="button" style={S.botaoTexto} onClick={onSalvarPDF} title="Gerar o PDF do documento">
              <FileDown size={15} /> Salvar PDF
            </button>
          )}
          <button type="button" style={S.botao} onClick={onClose} title="Sair (Esc)">
            <X size={17} />
          </button>
        </div>
      </div>

      {/* Grade de slides para pular direto a um ponto da conversa */}
      {grade && (
        <div style={S.grade} onClick={() => setGrade(false)}>
          <div style={S.gradeInner} onClick={e => e.stopPropagation()}>
            {blocos.map((b, i) => (
              <button
                key={`g-${b.id}-${i}`}
                type="button"
                onClick={() => { irPara(i); setGrade(false); }}
                style={{ ...S.thumb, ...(i === atual ? S.thumbOn : {}) }}
              >
                <div className="lince-presenter-thumb" style={{ width: '100%', pointerEvents: 'none' }}>
                  <div className="lince-deck" style={marca} dangerouslySetInnerHTML={{ __html: comNumero(b.html, i + 1) }} />
                </div>
                <span style={S.thumbLegenda}>
                  <strong style={{ color: i === atual ? '#EE3363' : '#eaeaf5', fontFamily: 'var(--fm)' }}>{String(i + 1).padStart(2, '0')}</strong>
                  {' '}{b.nome}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  return ReactDOM.createPortal(conteudo, document.body);
}

const S = {
  raiz: {
    position: 'fixed', inset: 0, zIndex: 3000, background: '#050509',
    display: 'flex', flexDirection: 'column', userSelect: 'none',
  },
  trilho: { position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'rgba(255,255,255,.06)', zIndex: 5 },
  progresso: { height: '100%', background: '#EE3363', boxShadow: '0 0 10px rgba(238,51,99,.6)', transition: 'width .3s ease' },
  palcoArea: { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 0, overflow: 'hidden' },
  // Maior 16:9 que cabe na tela, nas duas direções.
  palco: {
    position: 'relative', width: 'min(100vw, calc(100vh * 16 / 9))', aspectRatio: '16 / 9',
    cursor: 'inherit',
  },
  camada: { position: 'absolute', inset: 0, transition: 'opacity .32s ease' },
  barra: {
    position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 6,
    display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: 16,
    padding: '26px 22px 16px',
    background: 'linear-gradient(to top, rgba(5,5,9,.92), rgba(5,5,9,.55) 60%, transparent)',
    transition: 'opacity .3s ease', fontFamily: 'var(--f)',
  },
  barraEsq: { minWidth: 0 },
  barraMeio: { display: 'flex', alignItems: 'center', gap: 10 },
  barraDir: { display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end' },
  titulo: { fontSize: 13, fontWeight: 600, color: '#eaeaf5', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  secao: { fontSize: 11, color: '#8a8aa3', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  contador: { fontFamily: 'var(--fm)', fontSize: 13, color: '#eaeaf5', minWidth: 64, textAlign: 'center' },
  botao: {
    width: 36, height: 36, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'rgba(255,255,255,.07)', border: '1px solid rgba(255,255,255,.12)', color: '#eaeaf5', cursor: 'pointer',
    backdropFilter: 'blur(8px)',
  },
  botaoOn: { background: 'rgba(238,51,99,.18)', border: '1px solid rgba(238,51,99,.5)', color: '#EE3363' },
  botaoTexto: {
    height: 36, borderRadius: 10, display: 'flex', alignItems: 'center', gap: 7, padding: '0 14px',
    background: '#EE3363', border: 'none', color: '#fff', fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
  },
  grade: {
    position: 'absolute', inset: 0, zIndex: 10, background: 'rgba(5,5,9,.94)', backdropFilter: 'blur(6px)',
    overflowY: 'auto', padding: '40px 32px 110px',
  },
  gradeInner: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 18,
    maxWidth: 1400, margin: '0 auto',
  },
  thumb: {
    background: 'transparent', border: '2px solid rgba(255,255,255,.08)', borderRadius: 10, padding: 0,
    overflow: 'hidden', cursor: 'pointer', textAlign: 'left', display: 'flex', flexDirection: 'column',
  },
  thumbOn: { border: '2px solid #EE3363', boxShadow: '0 0 0 3px rgba(238,51,99,.18)' },
  thumbLegenda: {
    fontSize: 11.5, color: '#8a8aa3', padding: '8px 10px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
    background: 'rgba(255,255,255,.03)', fontFamily: 'var(--f)',
  },
};
