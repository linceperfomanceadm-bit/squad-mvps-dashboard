import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Check, MessageSquare, Send, Undo2, Sun, Moon, Layers, Eye } from 'lucide-react';
import { POST_FORMATOS } from '../lib/firebase';
import { useAprovacaoPublica } from '../hooks/useAprovacaoPublica';
import { useTheme, useBrandLogo, useSectorTheme } from '../contexts/ThemeContext';
import { useToast } from '../components/shared/Toast';
import {
  postsOrdenados, statusDoPost, estaAprovado, comentarioDoPost, semanaDoMes,
  dataCurta, nomeDoMes, diasNoMes,
} from '../lib/planejamento';
import { FMT_ICONE, Midia, BTN, JANELA } from '../components/planejamento/kit';

// ─────────────────────────────────────────────────────────────
// Página pública de aprovação — /aprovar/:token
//
// O cliente abre pelo WhatsApp, quase sempre no celular: coluna única,
// botões grandes, barra fixa embaixo. Sem login (ver
// useAprovacaoPublica). Mostra só o que a social já enviou; rascunho
// não aparece. Nada de valores, contrato ou dado interno aqui.
// ─────────────────────────────────────────────────────────────

const pad2 = (n) => String(n).padStart(2, '0');

export default function AprovacaoPage() {
  const { token } = useParams();
  useSectorTheme('admin'); // cor da marca, não a de um setor
  const { theme, toggle } = useTheme();
  const logo = useBrandLogo();
  const { toast } = useToast();
  const { plano, estado, previa, responder, aprovarVarios, desfazer } = useAprovacaoPublica(token);
  const [ajustando, setAjustando] = useState(null);
  const [texto, setTexto] = useState('');
  const [concluido, setConcluido] = useState(false);
  const [busy, setBusy] = useState(false);

  const topo = (
    <div style={S.topo}>
      <img src={logo} alt="Lince Performance" style={{ height: 26, width: 'auto' }} />
      <button type="button" onClick={toggle} aria-label="Alternar tema claro e escuro" style={S.ico}>
        {theme === 'light' ? <Moon size={17} /> : <Sun size={17} />}
      </button>
    </div>
  );

  if (estado !== 'ok' || !plano) {
    return (
      <div style={S.pagina}>
        <div style={S.coluna}>
          {topo}
          {estado === 'carregando' ? (
            <div style={{ display: 'grid', placeItems: 'center', height: '50vh' }}><div className="spinner" style={{ width: 32, height: 32 }} /></div>
          ) : (
            <div className="ui-card" style={{ textAlign: 'center', padding: '40px 24px' }}>
              <h1 style={{ fontSize: 20, fontWeight: 500 }}>{estado === 'inexistente' ? 'Link não encontrado' : 'Não foi possível abrir'}</h1>
              <p style={{ color: 'var(--muted)', fontSize: 13.5, marginTop: 8, lineHeight: 1.55 }}>
                {estado === 'inexistente'
                  ? 'Este planejamento não existe mais ou o link está incompleto. Peça um link novo para a sua social media.'
                  : 'Confira a internet e recarregue a página.'}
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  const ps = postsOrdenados(plano).filter((p) => p.rodada > 0).map((p) => ({ p, st: statusDoPost(p, plano) }));
  const pend = ps.filter((x) => x.st === 'cliente');
  const ok = ps.filter((x) => estaAprovado(x.st));
  const aj = ps.filter((x) => x.st === 'ajuste');
  const quem = String(plano.ultimoEnvioPor || plano.criadoPor || '').split(' ')[0] || 'A social media';

  const rodar = async (fn) => {
    setBusy(true);
    const res = await fn();
    setBusy(false);
    if (!res.success) toast(res.error, 'e');
    return res;
  };

  const enviarAjuste = async (post) => {
    const t = texto.trim();
    if (!t) { toast('Escreva o que precisa mudar antes de enviar.', 'e'); return; }
    const res = await rodar(() => responder(post, 'ajuste', t));
    if (res.success) { setAjustando(null); setTexto(''); }
  };

  if (concluido) {
    return (
      <div style={S.pagina}>
        <div style={S.coluna}>
          {topo}
          <div className="ui-card fade-up" style={S.done}>
            <span style={S.doneIc}><Check size={26} strokeWidth={2.2} /></span>
            <h1 style={{ fontSize: 22, fontWeight: 500 }}>Respostas enviadas</h1>
            <p style={{ color: 'var(--muted)', lineHeight: 1.55, maxWidth: '44ch', fontSize: 14 }}>
              {quem} já recebeu: {ok.length} {ok.length === 1 ? 'aprovado' : 'aprovados'} e {aj.length} com ajuste.{' '}
              {aj.length ? 'Quando os ajustes ficarem prontos, os posts voltam para este mesmo link.' : 'Se algo novo entrar no planejamento, ele aparece neste mesmo link.'}
            </p>
            <button type="button" className="ui-btn" onClick={() => setConcluido(false)}>Rever o planejamento</button>
          </div>
        </div>
      </div>
    );
  }

  // Agrupa por semana do mês ("Semana de 05 a 11 de outubro").
  const semanas = [];
  ps.forEach((x) => {
    const w = semanaDoMes(x.p.data);
    const g = semanas.find((s) => s.w === w);
    if (g) g.itens.push(x); else semanas.push({ w, itens: [x] });
  });
  const [y, m] = plano.mes.split('-').map(Number);
  const offset = new Date(y, m - 1, 1).getDay();
  const rotuloSemana = (w) => {
    const ini = Math.max(1, w * 7 - offset + 1);
    const fim = Math.min(diasNoMes(plano.mes), (w + 1) * 7 - offset);
    return `Semana de ${pad2(ini)} a ${pad2(fim)} de ${nomeDoMes(plano.mes)}`;
  };

  return (
    <div style={{ ...S.pagina, paddingBottom: 150 }}>
      <div style={S.coluna}>
        {topo}

        {previa && (
          <div style={S.previa}>
            <Eye size={15} style={{ flexShrink: 0 }} />
            <span>Prévia da equipe: você está logado no painel, então nada que clicar aqui é enviado. O cliente abre este mesmo link sem login.</span>
          </div>
        )}

        <div>
          <h1 style={S.h1}>Planejamento de {nomeDoMes(plano.mes)} · {plano.clientName}</h1>
          <p style={S.lead}>Preparado por {quem}. Aprove cada post ou peça um ajuste: {quem === 'A social media' ? 'ela' : quem} recebe na hora.</p>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <span style={S.sum}><b style={S.sumN}>{pend.length}</b>para aprovar</span>
          <span style={S.sum}><b style={{ ...S.sumN, color: 'var(--green)' }}>{ok.length}</b>{ok.length === 1 ? 'aprovado' : 'aprovados'}</span>
          <span style={S.sum}><b style={{ ...S.sumN, color: 'var(--purple)' }}>{aj.length}</b>com ajuste</span>
        </div>

        {!ps.length && <div className="ui-card" style={{ textAlign: 'center', padding: 32, color: 'var(--muted)' }}>Nada para aprovar por enquanto.</div>}

        {semanas.map(({ w, itens }) => (
          <React.Fragment key={w}>
            <div style={S.semana}>{rotuloSemana(w)}</div>
            {itens.map(({ p, st }) => {
              const fmt = POST_FORMATOS[p.fmt] || POST_FORMATOS.feed;
              const Ic = FMT_ICONE[p.fmt] || FMT_ICONE.feed;
              const midias = p.midias || [];
              const aprovado = estaAprovado(st);
              let acoes;
              if (ajustando === p.id) {
                acoes = (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }}>
                    <label style={JANELA.lab} htmlFor={`aj-${p.id}`}>O que precisa mudar?</label>
                    <textarea id={`aj-${p.id}`} autoFocus rows={3} value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Ex.: trocar a foto da capa, ajustar o horário na legenda" style={{ ...JANELA.fld, resize: 'vertical', lineHeight: 1.45, fontSize: 14 }} />
                    <div style={S.acoes}>
                      <button type="button" className="ui-btn" style={BTN.ajuste} disabled={busy} onClick={() => enviarAjuste(p)}><Send size={14} />Enviar pedido de ajuste</button>
                      <button type="button" className="ui-btn" style={BTN.fantasma} onClick={() => setAjustando(null)}>Cancelar</button>
                    </div>
                  </div>
                );
              } else if (aprovado) {
                acoes = (
                  <>
                    <span style={S.okPill}><Check size={12} strokeWidth={2.6} />Aprovado</span>
                    {st === 'aprovado' && <button type="button" className="ui-btn" style={{ ...BTN.fantasma, ...BTN.peq }} disabled={busy} onClick={() => rodar(() => desfazer(p))}><Undo2 size={13} />Desfazer</button>}
                  </>
                );
              } else if (st === 'ajuste') {
                acoes = (
                  <>
                    <div style={{ ...JANELA.comentario, width: '100%' }}>
                      <b style={{ color: 'var(--purple)', fontWeight: 600, fontSize: 11, display: 'block', marginBottom: 2 }}>Seu pedido de ajuste</b>
                      {comentarioDoPost(p, plano)}
                    </div>
                    <button type="button" className="ui-btn" style={{ ...BTN.fantasma, ...BTN.peq }} disabled={busy} onClick={() => rodar(() => desfazer(p))}><Undo2 size={13} />Cancelar pedido</button>
                  </>
                );
              } else {
                acoes = (
                  <>
                    <button type="button" className="ui-btn" style={{ ...BTN.ok, height: 40, padding: '0 18px' }} disabled={busy} onClick={() => rodar(() => responder(p, 'aprovado'))}><Check size={15} strokeWidth={2.4} />Aprovar</button>
                    <button type="button" className="ui-btn" style={{ ...BTN.ajuste, height: 40, padding: '0 18px' }} onClick={() => { setAjustando(p.id); setTexto(''); }}><MessageSquare size={15} />Pedir ajuste</button>
                  </>
                );
              }
              const story = p.fmt === 'story';
              return (
                <article key={p.id} className="ui-card" style={{ ...S.post, opacity: aprovado ? 0.92 : 1 }}>
                  {midias.length ? (
                    <div style={{ ...S.prev, padding: 0, ...(story ? S.prevStory : null) }}>
                      <div style={S.gal}>
                        {midias.map((x, i) => (
                          <div key={x.path || i} style={S.galItem}><Midia m={x} controls={x.tipo === 'video'} style={{ objectFit: 'cover' }} /></div>
                        ))}
                      </div>
                      {midias.length > 1 && <span style={S.qtd}><Layers size={12} />{midias.length} · arraste</span>}
                    </div>
                  ) : (
                    <div style={{ ...S.prev, ...(story ? S.prevStory : null) }}>
                      <Ic size={26} strokeWidth={1.6} />
                      <span>{fmt.label}<br />arte em produção</span>
                    </div>
                  )}
                  <div style={S.corpo}>
                    <div style={S.meta}>
                      <span style={{ fontFamily: 'var(--fm)', color: 'var(--text)' }}>{dataCurta(p.data)} · {p.hora}</span>
                      <span>·</span><span>{fmt.label}</span>
                    </div>
                    <div style={{ fontSize: 16, fontWeight: 600 }}>{p.titulo || 'Sem título'}</div>
                    {p.legenda && <div style={{ fontSize: 13.5, lineHeight: 1.6, whiteSpace: 'pre-line' }}>{p.legenda}</div>}
                    {p.ideia && <div style={{ fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.55 }}><b style={{ fontWeight: 600, color: 'var(--text)' }}>A ideia: </b>{p.ideia}</div>}
                    <div style={S.acoes}>{acoes}</div>
                  </div>
                </article>
              );
            })}
          </React.Fragment>
        ))}
      </div>

      <div style={S.barra}>
        <div style={S.barraIn}>
          <span style={{ fontSize: 13, color: 'var(--muted)' }}>
            {pend.length ? `${pend.length} ${pend.length === 1 ? 'post esperando' : 'posts esperando'} sua resposta` : 'Você respondeu tudo.'}
          </span>
          <span style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {pend.length > 1 && <button type="button" className="ui-btn" disabled={busy} onClick={() => rodar(() => aprovarVarios(pend.map((x) => x.p)))}>Aprovar todos</button>}
            <button type="button" className="ui-btn primary" disabled={pend.length > 0} onClick={() => { setConcluido(true); window.scrollTo(0, 0); }}>Concluir</button>
          </span>
        </div>
      </div>
    </div>
  );
}

const S = {
  pagina: { minHeight: '100vh', padding: '28px 16px 60px', background: 'var(--bg)', color: 'var(--text)' },
  coluna: { maxWidth: 720, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 },
  topo: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  ico: { width: 36, height: 36, borderRadius: 99, display: 'grid', placeItems: 'center', background: 'transparent', border: '1px solid var(--border)', color: 'var(--muted)' },
  previa: { display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 12.5, lineHeight: 1.5, padding: '10px 12px', borderRadius: 12, background: 'var(--blue-dim)', border: '1px solid var(--blue-b)', color: 'var(--text)' },
  h1: { fontSize: 26, fontWeight: 500, lineHeight: 1.2, letterSpacing: '-.01em' },
  lead: { margin: '8px 0 0', color: 'var(--muted)', fontSize: 14, lineHeight: 1.55, maxWidth: '60ch' },
  sum: { fontSize: 12.5, padding: '6px 12px', borderRadius: 99, background: 'var(--bg2)', border: '1px solid var(--border)' },
  sumN: { fontFamily: 'var(--fm)', marginRight: 4 },
  semana: { fontFamily: 'var(--fm)', fontSize: 11, letterSpacing: '.1em', color: 'var(--muted)', textTransform: 'uppercase', marginTop: 8 },
  post: { display: 'flex', gap: 16, flexWrap: 'wrap', padding: 16 },
  prev: { position: 'relative', flex: '1 1 150px', maxWidth: 280, aspectRatio: '4 / 5', borderRadius: 12, background: 'var(--bg3)', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, color: 'var(--muted)', fontSize: 11, textAlign: 'center', padding: 10, overflow: 'hidden' },
  prevStory: { aspectRatio: '9 / 16', flexBasis: 110, maxWidth: 180 },
  gal: { display: 'flex', overflowX: 'auto', scrollSnapType: 'x mandatory', width: '100%', height: '100%' },
  galItem: { flex: '0 0 100%', scrollSnapAlign: 'start', width: '100%', height: '100%' },
  qtd: { position: 'absolute', right: 8, top: 8, display: 'inline-flex', alignItems: 'center', gap: 4, fontFamily: 'var(--fm)', fontSize: 10.5, padding: '3px 8px', borderRadius: 99, background: 'rgba(10,10,12,.62)', color: '#fff' },
  corpo: { flex: '1 1 260px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 10 },
  meta: { display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', fontSize: 12, color: 'var(--muted)' },
  acoes: { display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginTop: 4 },
  okPill: { display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 500, padding: '4px 10px', borderRadius: 99, color: 'var(--green)', border: '1px solid var(--green-b)', background: 'var(--green-dim)' },
  barra: { position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 40, padding: '12px 16px calc(16px + env(safe-area-inset-bottom, 0px))', background: 'linear-gradient(to top, var(--bg) 70%, transparent)' },
  barraIn: { maxWidth: 720, margin: '0 auto', display: 'flex', gap: 10, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', padding: '12px 14px', borderRadius: 16, background: 'var(--bg2)', border: '1px solid var(--border-h)', boxShadow: 'var(--shadow)' },
  done: { textAlign: 'center', padding: '40px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 },
  doneIc: { width: 56, height: 56, borderRadius: '50%', display: 'grid', placeItems: 'center', color: 'var(--green)', background: 'var(--green-dim)' },
};
