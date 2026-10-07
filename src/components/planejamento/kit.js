import React, { useEffect } from 'react';
import ReactDOM from 'react-dom';
import { Image, Layers, Clapperboard, Smartphone, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { rotuloMes } from '../../lib/entregas';
import { gradeDoMes } from '../../lib/planejamento';

// ─────────────────────────────────────────────────────────────
// Kit do Planejamento e do Calendário de conteúdo
//
// Peças repetidas entre Planejamentos, Calendário (social e
// videomaker), as duas Visões Gerais e a página do cliente. Tudo
// neutro; a cor do painel entra por --c / --grad e a de status vem
// de POST_STATUS / VIDEO_STATUS (sempre semântica).
//
// Ponto "oco" (contorno sem preenchimento) = ainda não andou: rascunho,
// aprovado esperando produção, vídeo aguardando o cliente.
// ─────────────────────────────────────────────────────────────

export const FMT_ICONE = { feed: Image, car: Layers, reel: Clapperboard, story: Smartphone };

const mix = (cor, pct) => `color-mix(in srgb, ${cor} ${pct}%, transparent)`;

export function Dot({ def, size = 7, style }) {
  const cor = def?.cor || 'var(--dim)';
  return (
    <i style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0, display: 'inline-block',
      background: def?.oco ? 'transparent' : cor, boxShadow: `inset 0 0 0 1.5px ${cor}`, ...style,
    }} />
  );
}

export function Pill({ def, label, style }) {
  const cor = def?.cor || 'var(--dim)';
  return (
    <span style={{ ...S.pill, color: cor === 'var(--dim)' ? 'var(--muted)' : cor, borderColor: mix(cor, 30), ...style }}>
      <Dot def={def} />{label || def?.label}
    </span>
  );
}

// Iniciais do cliente para os quadradinhos ("Café Aurora" → CA).
export const siglaDe = (nome) => {
  const partes = String(nome || '').trim().split(/\s+/).filter((p) => p.length > 2 || /^[A-Z0-9]/.test(p));
  const letras = (partes.length > 1 ? partes.slice(0, 2).map((p) => p[0]) : [String(nome || '?').slice(0, 2)]).join('');
  return letras.toUpperCase();
};

export function Sigla({ children, size = 40, style }) {
  return <span style={{ ...S.box, width: size, height: size, ...style }}>{children}</span>;
}

// Linha clicável de lista (título + subtítulo + lado direito).
export function Linha({ left, title, sub, extra, right, onClick, primeira }) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag type={onClick ? 'button' : undefined} onClick={onClick} style={{ ...S.linha, borderTopColor: primeira ? 'transparent' : 'var(--border)', cursor: onClick ? 'pointer' : 'default' }}>
      {left}
      <span style={{ minWidth: 0, flex: 1 }}>
        <span style={S.linhaT}>{title}</span>
        {sub && <span style={S.linhaS}>{sub}</span>}
        {extra && <span style={{ display: 'block', marginTop: 7 }}>{extra}</span>}
      </span>
      {right}
    </Tag>
  );
}

// KPI clicável que filtra a lista abaixo. `ring` (0..1) troca o ícone
// por um anel de progresso.
export function KpiFiltro({ label, nota, valor, unidade, cor, Icon, ring, on, onClick }) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      aria-pressed={onClick ? !!on : undefined}
      className="ui-card"
      style={{ ...S.kpi, cursor: onClick ? 'pointer' : 'default', ...(on ? { borderColor: 'var(--c-border)', background: 'var(--c-dim)' } : null) }}
    >
      <span style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' }}>
        <span style={{ minWidth: 0 }}>
          <span style={{ display: 'block', fontSize: 14, fontWeight: 500 }}>{label}</span>
          {nota && <span style={{ display: 'block', fontSize: 11.5, color: 'var(--muted)', marginTop: 3 }}>{nota}</span>}
        </span>
        {ring != null ? (
          <svg width="44" height="44" viewBox="0 0 44 44" style={{ transform: 'rotate(-90deg)', flexShrink: 0 }} aria-hidden="true">
            <circle cx="22" cy="22" r="18" fill="none" stroke="var(--soft)" strokeWidth="4.5" />
            <circle cx="22" cy="22" r="18" fill="none" stroke={cor} strokeWidth="4.5" strokeLinecap="round" strokeDasharray="113.1" strokeDashoffset={(113.1 * (1 - Math.min(1, Math.max(0, ring)))).toFixed(1)} />
          </svg>
        ) : Icon ? (
          <span style={{ ...S.kIc, color: cor, background: mix(cor, 13) }}><Icon size={18} /></span>
        ) : null}
      </span>
      <span style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
        <b style={{ fontSize: 30, fontWeight: 500, letterSpacing: '-.02em', lineHeight: 1, color: cor }}>{valor}</b>
        {unidade && <span style={{ fontSize: 12, color: 'var(--muted)' }}>{unidade}</span>}
      </span>
    </Tag>
  );
}

export function Barra({ pct, cor = 'var(--green)', style }) {
  return (
    <span style={{ display: 'block', height: 5, borderRadius: 99, background: 'var(--soft)', overflow: 'hidden', ...style }}>
      <i style={{ display: 'block', height: '100%', width: `${Math.round(Math.min(1, Math.max(0, pct)) * 100)}%`, borderRadius: 99, background: cor }} />
    </span>
  );
}

export function MesNav({ mes, onChange }) {
  const passo = (n) => {
    const [y, m] = mes.split('-').map(Number);
    const d = new Date(y, m - 1 + n, 1);
    onChange(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  };
  const longo = rotuloMes(mes, true).replace(' de ', ' ');
  return (
    <div style={S.mesNav}>
      <button type="button" style={S.mesBtn} onClick={() => passo(-1)} aria-label="Mês anterior"><ChevronLeft size={15} /></button>
      <span style={{ fontFamily: 'var(--fm)', fontSize: 13, fontWeight: 500, padding: '0 6px', minWidth: 120, textAlign: 'center' }}>{longo}</span>
      <button type="button" style={S.mesBtn} onClick={() => passo(1)} aria-label="Próximo mês"><ChevronRight size={15} /></button>
    </div>
  );
}

export function ChipsClientes({ clientes, valor, onChange, style }) {
  const lista = [{ id: 'todos', name: 'Todos os clientes' }, ...clientes];
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, ...style }}>
      {lista.map((c) => {
        const on = valor === c.id;
        return (
          <button key={c.id} type="button" aria-pressed={on} onClick={() => onChange(c.id)} style={{ ...S.chip, ...(on ? S.chipOn : null) }}>
            {c.name}
          </button>
        );
      })}
    </div>
  );
}

// Calendário "clean" das visões gerais. `contar(iso)` diz se o dia tem
// algo; `estado(iso)` pinta dia passado: 'ok' tudo publicado, 'ruim' atrasou.
export function MiniCalendario({ mes, hoje, contar, estado, onDia, legenda }) {
  const grade = gradeDoMes(mes);
  return (
    <div>
      <div style={S.miniG}>
        {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((s, i) => <span key={i} style={S.miniWd}>{s}</span>)}
        {grade.map((iso, i) => {
          if (!iso) return <span key={i} />;
          const n = contar ? contar(iso) : 0;
          const st = iso < hoje && estado ? estado(iso) : null;
          const ehHoje = iso === hoje;
          const fundo = ehHoje ? 'var(--grad)' : st === 'ok' ? 'var(--green)' : st === 'ruim' ? 'var(--red)' : 'transparent';
          const cheio = ehHoje || st;
          return (
            <button
              key={iso}
              type="button"
              onClick={() => onDia && onDia(iso)}
              aria-label={`Dia ${Number(iso.slice(8))}, ${n} ${n === 1 ? 'item' : 'itens'}`}
              style={{ ...S.md, background: fundo, color: ehHoje ? 'var(--on)' : st ? 'var(--bg)' : 'var(--muted)', boxShadow: ehHoje ? '0 6px 16px -6px color-mix(in srgb, var(--c) 70%, transparent)' : 'none' }}
            >
              <span>{Number(iso.slice(8))}</span>
              <i style={{ width: 4, height: 4, borderRadius: '50%', background: n && !cheio ? 'var(--muted)' : 'transparent' }} />
            </button>
          );
        })}
      </div>
      {legenda && <div style={{ ...S.legenda, borderTop: 0, marginTop: 10, paddingTop: 0, fontSize: 11 }}>{legenda}</div>}
    </div>
  );
}

export function Midia({ m, controls, style }) {
  if (!m?.url) return null;
  const base = { width: '100%', height: '100%', objectFit: 'cover', display: 'block', ...style };
  return m.tipo === 'video'
    ? <video src={m.url} muted={!controls} controls={!!controls} playsInline preload="metadata" style={base} />
    : <img src={m.url} alt="" loading="lazy" style={base} />;
}

// Fecha com Esc. Usado pela janela e pela gaveta.
function useEsc(onClose) {
  useEffect(() => {
    const fn = (e) => { if (e.key === 'Escape' && onClose) onClose(); };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, [onClose]);
}

// Janela centralizada (portal). Conteúdo usa JANELA.h / .b / .f.
export function Janela({ onClose, largura = 760, label, children }) {
  useEsc(onClose);
  return ReactDOM.createPortal(
    <div onClick={onClose} style={S.scrim}>
      <div role="dialog" aria-modal="true" aria-label={label} onClick={(e) => e.stopPropagation()} className="fade-up" style={{ ...S.janela, maxWidth: largura }}>
        {children}
      </div>
    </div>,
    document.body,
  );
}

// Gaveta lateral (portal) — edição do post.
export function Gaveta({ onClose, label, children }) {
  useEsc(onClose);
  return ReactDOM.createPortal(
    <div onClick={onClose} style={{ ...S.scrim, justifyContent: 'flex-end', alignItems: 'stretch', padding: 0 }}>
      <aside role="dialog" aria-modal="true" aria-label={label} onClick={(e) => e.stopPropagation()} className="fade-in" style={S.gaveta}>
        {children}
      </aside>
    </div>,
    document.body,
  );
}

export function BotaoFechar({ onClick }) {
  return <button type="button" onClick={onClick} aria-label="Fechar" style={S.fechar}><X size={16} /></button>;
}

// Estilos das partes da janela/gaveta, exportados para as telas.
export const JANELA = {
  h: { display: 'flex', alignItems: 'flex-start', gap: 14, padding: '20px 22px 16px', borderBottom: '1px solid var(--border)' },
  b: { padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 16 },
  f: { display: 'flex', alignItems: 'center', gap: 8, padding: '14px 22px', borderTop: '1px solid var(--border)', flexWrap: 'wrap' },
  lab: { display: 'block', fontSize: 11, color: 'var(--muted)', marginBottom: 5 },
  fld: { width: '100%', background: 'var(--bg3)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 10, padding: '9px 11px', fontSize: 13, outline: 'none', fontFamily: 'var(--f)' },
  ro: { fontSize: 13, lineHeight: 1.5, color: 'var(--text)', whiteSpace: 'pre-line' },
  dois: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10 },
  comentario: { padding: '10px 12px', borderRadius: 10, background: 'var(--purple-dim)', border: '1px solid var(--purple-b)', fontSize: 12.5, lineHeight: 1.5, color: 'var(--text)' },
  aviso: { fontSize: 12.5, color: 'var(--muted)', padding: '10px 12px', borderRadius: 10, background: 'var(--surface)', border: '1px solid var(--border)', lineHeight: 1.5 },
};

// Botões derivados do .ui-btn (cor só onde é ação semântica).
export const BTN = {
  perigo: { color: 'var(--red)', borderColor: 'var(--red-dim)', background: 'transparent' },
  ajuste: { color: 'var(--purple)', borderColor: 'var(--purple-b)', background: 'var(--purple-dim)' },
  // Texto sobre o verde: --bg inverte junto com o tema (ver BTN_GREEN).
  ok: { color: 'var(--bg)', borderColor: 'transparent', background: 'var(--green)' },
  fantasma: { background: 'transparent', color: 'var(--muted)' },
  peq: { height: 30, padding: '0 11px', fontSize: 12 },
};

export const LEGENDA = { display: 'flex', flexWrap: 'wrap', gap: 14, marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--border)', fontSize: 11.5, color: 'var(--muted)' };

const S = {
  pill: { display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 10.5, fontWeight: 500, padding: '3px 9px', borderRadius: 99, whiteSpace: 'nowrap', border: '1px solid', flexShrink: 0 },
  box: { borderRadius: 12, flexShrink: 0, display: 'grid', placeItems: 'center', background: 'var(--bg3)', border: '1px solid var(--border-h)', fontFamily: 'var(--fm)', fontSize: 9.5, color: 'var(--muted)' },
  linha: { display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '11px 10px', border: 0, borderTop: '1px solid var(--border)', background: 'none', color: 'var(--text)', textAlign: 'left', borderRadius: 10, fontFamily: 'var(--f)' },
  linhaT: { fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block' },
  linhaS: { fontSize: 11.5, color: 'var(--muted)', marginTop: 2, display: 'block' },
  kpi: { display: 'flex', flexDirection: 'column', gap: 12, textAlign: 'left', width: '100%', color: 'var(--text)', fontFamily: 'var(--f)' },
  kIc: { width: 40, height: 40, borderRadius: '50%', display: 'grid', placeItems: 'center', flexShrink: 0 },
  mesNav: { display: 'flex', alignItems: 'center', gap: 4, height: 38, padding: '0 4px', borderRadius: 99, background: 'var(--bg2)', border: '1px solid var(--border)', color: 'var(--text)' },
  mesBtn: { width: 30, height: 30, borderRadius: 99, display: 'grid', placeItems: 'center', background: 'transparent', border: 0, color: 'var(--muted)' },
  chip: { height: 34, padding: '0 14px', borderRadius: 99, fontSize: 12.5, fontWeight: 500, border: '1px solid var(--border-h)', background: 'var(--bg2)', color: 'var(--muted)' },
  chipOn: { background: 'var(--grad)', color: 'var(--on)', borderColor: 'transparent' },
  miniG: { display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 4, textAlign: 'center' },
  miniWd: { fontFamily: 'var(--fm)', fontSize: 10, color: 'var(--muted)', padding: '2px 0' },
  md: { margin: '0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, width: 34, height: 34, maxWidth: '100%', borderRadius: '50%', border: 0, fontFamily: 'var(--fm)', fontSize: 11, padding: 0 },
  legenda: LEGENDA,
  scrim: { position: 'fixed', inset: 0, zIndex: 99990, background: 'rgba(0,0,0,.55)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px 16px' },
  janela: { width: '100%', maxHeight: 'calc(100vh - 40px)', overflowY: 'auto', background: 'var(--bg2)', border: '1px solid var(--border-h)', borderRadius: 22, boxShadow: '0 30px 80px -30px rgba(0,0,0,.6)', color: 'var(--text)' },
  gaveta: { width: 'min(580px, 100%)', height: '100%', overflowY: 'auto', background: 'var(--bg2)', borderLeft: '1px solid var(--border-h)', display: 'flex', flexDirection: 'column', color: 'var(--text)' },
  fechar: { width: 36, height: 36, borderRadius: 99, display: 'grid', placeItems: 'center', background: 'transparent', border: '1px solid transparent', color: 'var(--muted)', flexShrink: 0 },
};
