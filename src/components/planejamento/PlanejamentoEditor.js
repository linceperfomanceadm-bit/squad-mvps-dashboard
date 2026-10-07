import React, { useState } from 'react';
import { ArrowLeft, Copy, Eye, Send, Plus, Layers, Clapperboard, Trash2 } from 'lucide-react';
import { POST_FORMATOS, POST_STATUS } from '../../lib/firebase';
import {
  statusDoPost, statusEfetivo, rotuloStatus, statusDoPlano, contaAprovados, postsOrdenados,
  comentarioDoPost, podeEditar, linkAprovacao, nomeDoMes, PLANO_STATUS,
} from '../../lib/planejamento';
import { Pill, Dot, Sigla, siglaDe, Midia, FMT_ICONE, Janela, BotaoFechar, JANELA, BTN } from './kit';
import PostDrawer from './PostDrawer';

// ─────────────────────────────────────────────────────────────
// Editor do planejamento: grade numerada de posts (como o protótipo
// validado), prévia do feed, link do cliente e a barra de envio.
// ─────────────────────────────────────────────────────────────

const GRUPOS = {
  tudo:  { label: 'Tudo',    f: () => true },
  feed:  { label: 'Posts',   f: (p) => p.fmt === 'feed' || p.fmt === 'car' },
  reel:  { label: 'Reels',   f: (p) => p.fmt === 'reel' },
  story: { label: 'Stories', f: (p) => p.fmt === 'story' },
};

export async function copiarTexto(texto, toast) {
  try {
    await navigator.clipboard.writeText(texto);
    toast('Link copiado.');
  } catch (_) {
    window.prompt('Copie o link:', texto);
  }
}

export default function PlanejamentoEditor({ plano, me, acoes, toast, onVoltar, postInicial }) {
  const [aba, setAba] = useState('tudo');
  const [aberto, setAberto] = useState(postInicial || null);
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);

  const ps = postsOrdenados(plano);
  const numero = {};
  ps.forEach((p, i) => { numero[p.id] = String(i + 1).padStart(2, '0'); });
  const sts = ps.map((p) => statusDoPost(p, plano));
  const pendentes = sts.filter(podeEditar).length;
  const temAjuste = sts.includes('ajuste');
  const semArte = ps.filter((p) => !(p.midias || []).length).length;
  const stPlano = statusDoPlano(plano);
  const ap = contaAprovados(plano);
  const link = linkAprovacao(plano.id);
  const postAberto = ps.find((p) => p.id === aberto);

  const novoPost = async () => {
    const fmt = aba === 'reel' ? 'reel' : aba === 'story' ? 'story' : 'feed';
    const res = await acoes.adicionarPost(plano.id, fmt);
    if (res.success) setAberto(res.postId);
    else toast(res.error, 'e');
  };

  const enviar = async () => {
    setEnviando(true);
    const res = await acoes.enviarParaAprovacao(plano.id, me);
    setEnviando(false);
    if (!res.success) { toast(res.error, 'e'); return; }
    toast(`${res.n} ${res.n === 1 ? 'post enviado' : 'posts enviados'} para ${plano.clientName} aprovar.`);
    setEnviado(true);
  };

  const excluirPlano = async () => {
    if (!window.confirm(`Excluir o planejamento de ${nomeDoMes(plano.mes)} de ${plano.clientName}? O link do cliente para de funcionar.`)) return;
    const res = await acoes.excluirPlano(plano);
    if (res.success) { toast('Planejamento excluído.'); onVoltar(); }
    else toast(res.error, 'e');
  };

  const lista = ps.filter(GRUPOS[aba]?.f || GRUPOS.tudo.f);

  return (
    <div className="fade-up">
      <button type="button" onClick={onVoltar} style={S.voltar}><ArrowLeft size={14} />Planejamentos</button>

      <div style={S.topo}>
        <Sigla size={46} style={{ borderRadius: '50%', fontSize: 13, color: 'var(--c)' }}>{siglaDe(plano.clientName)}</Sigla>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>Planejamento de {nomeDoMes(plano.mes)} {plano.mes.slice(0, 4)}</div>
          <h1 style={S.h1}>{plano.clientName}</h1>
        </div>
        <Pill def={PLANO_STATUS[stPlano]} />
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ color: 'var(--muted)', fontSize: 12.5 }}>{ap} de {ps.length} aprovados</span>
          <button type="button" className="ui-btn" style={{ ...BTN.fantasma, ...BTN.peq }} onClick={excluirPlano} title="Excluir planejamento"><Trash2 size={13} />Excluir</button>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {plano.rodada > 0 ? (
          <div style={S.linkbox}>
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>Link de aprovação · sem login</span>
            <code style={S.code}>{link}</code>
            <button type="button" className="ui-btn" style={BTN.peq} onClick={() => copiarTexto(link, toast)}><Copy size={14} />Copiar</button>
            <a className="ui-btn" style={{ ...BTN.peq, textDecoration: 'none' }} href={link} target="_blank" rel="noreferrer"><Eye size={14} />Ver como o cliente</a>
          </div>
        ) : (
          <p style={{ fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.5, maxWidth: '72ch' }}>
            Clique num post para escrever a legenda e subir a arte. Ele já aparece no seu calendário como Rascunho; o cliente só vê quando você enviar.
          </p>
        )}

        <div role="tablist" style={S.tabs}>
          {Object.entries(GRUPOS).map(([k, g]) => (
            <button key={k} type="button" role="tab" aria-selected={aba === k} onClick={() => setAba(k)} style={{ ...S.tab, ...(aba === k ? S.tabOn : null) }}>
              {g.label}<span style={S.tabN}>{ps.filter(g.f).length}</span>
            </button>
          ))}
          <button type="button" role="tab" aria-selected={aba === 'previa'} onClick={() => setAba('previa')} style={{ ...S.tab, ...(aba === 'previa' ? S.tabOn : null) }}>Prévia do feed</button>
        </div>

        {aba === 'previa' ? (
          <div className="ui-card" style={{ maxWidth: 420 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '4px 4px 14px' }}>
              <Sigla size={52} style={{ borderRadius: '50%', fontSize: 13, color: 'var(--c)' }}>{siglaDe(plano.clientName)}</Sigla>
              <div>
                <div style={{ fontWeight: 600 }}>{String(plano.clientName || '').toLowerCase().replace(/[^a-z0-9]+/g, '')}</div>
                <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 2 }}>Como o feed vai ficar em {nomeDoMes(plano.mes)}, do mais novo para o mais antigo</div>
              </div>
            </div>
            <div style={S.feedG}>
              {ps.filter((p) => p.fmt !== 'story').reverse().map((p) => {
                const Ic = FMT_ICONE[p.fmt];
                return (
                  <button key={p.id} type="button" onClick={() => setAberto(p.id)} style={S.feedItem} aria-label={p.titulo || 'Sem tema'}>
                    {(p.midias || []).length ? <Midia m={p.midias[0]} /> : <Ic size={22} strokeWidth={1.6} />}
                    {p.fmt === 'reel' && <span style={S.feedOv}><Clapperboard size={15} /></span>}
                    {p.fmt === 'car' && <span style={S.feedOv}><Layers size={15} /></span>}
                    <Dot def={POST_STATUS[statusEfetivo(p, plano)]} style={{ position: 'absolute', left: 6, bottom: 6, outline: '2px solid rgba(0,0,0,.35)' }} />
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <div style={S.grade}>
            {lista.map((p) => {
              const ef = statusEfetivo(p, plano);
              const Ic = FMT_ICONE[p.fmt] || FMT_ICONE.feed;
              const ms = p.midias || [];
              const coment = comentarioDoPost(p, plano);
              return (
                <button key={p.id} type="button" onClick={() => setAberto(p.id)} style={S.pcard}>
                  <span style={S.pmedia}>
                    {ms.length ? <Midia m={ms[0]} /> : (
                      <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, fontSize: 11.5 }}>
                        <Ic size={28} strokeWidth={1.5} /><span>Sem arte ainda</span>
                      </span>
                    )}
                    <span style={S.pnum}>{numero[p.id]}</span>
                    {ms.length > 1 && <span style={S.pqtd}><Layers size={12} />{ms.length}</span>}
                    {ms.length === 1 && ms[0].tipo === 'video' && <span style={S.pqtd}><Clapperboard size={12} />vídeo</span>}
                  </span>
                  <span style={{ padding: '0 4px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <span style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
                      <b style={S.ptit}>{p.titulo || 'Sem tema'}</b>
                      <span style={S.ftag}><Ic size={12} />{POST_FORMATOS[p.fmt]?.label}</span>
                    </span>
                    {coment && <span style={{ fontSize: 11.5, color: 'var(--purple)', lineHeight: 1.4 }}>“{coment}”</span>}
                    <span style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
                      <Pill def={POST_STATUS[ef]} label={rotuloStatus(p, plano)} />
                      <span style={{ fontFamily: 'var(--fm)', fontSize: 11, color: 'var(--muted)' }}>{p.data.slice(8)}/{p.data.slice(5, 7)}, {String(p.hora || '').replace(':00', 'h')}</span>
                    </span>
                  </span>
                </button>
              );
            })}
            <button type="button" onClick={novoPost} style={S.novo}>
              <span style={S.novoIc}><Plus size={20} strokeWidth={2.2} /></span>
              Novo {aba === 'reel' ? 'reel' : aba === 'story' ? 'story' : 'post'}
            </button>
          </div>
        )}
      </div>

      <div style={S.barra}>
        <span style={{ fontSize: 12.5, color: 'var(--muted)', flex: 1, minWidth: 180 }}>
          {ps.length} {ps.length === 1 ? 'post' : 'posts'} · {ps.filter((p) => p.fmt === 'reel').length} reels
          {ps.length ? (semArte ? ` · ${semArte} sem arte (o cliente vê só o texto)` : ' · todos com arte') : ''}
        </span>
        {pendentes ? (
          <button type="button" className="ui-btn primary" disabled={enviando} onClick={enviar}>
            <Send size={15} />
            {enviando ? 'Enviando…'
              : temAjuste ? `Reenviar ${pendentes} ${pendentes === 1 ? 'post corrigido' : 'posts corrigidos'}`
              : plano.rodada ? `Enviar ${pendentes} ${pendentes === 1 ? 'post novo' : 'posts novos'}`
              : 'Enviar para aprovação'}
          </button>
        ) : (
          <span style={{ fontSize: 12.5, color: 'var(--muted)' }}>
            {stPlano === 'aprovado' ? 'Tudo aprovado. Os posts já estão no calendário como Aprovado.' : ps.length ? 'Nada novo para enviar. O cliente está analisando.' : 'Crie o primeiro post.'}
          </span>
        )}
      </div>

      {postAberto && (
        <PostDrawer
          plano={plano}
          post={postAberto}
          numero={numero[postAberto.id]}
          onClose={() => setAberto(null)}
          salvarCampos={acoes.salvarCampos}
          adicionarMidias={acoes.adicionarMidias}
          removerMidia={acoes.removerMidia}
          removerPost={acoes.removerPost}
          toast={toast}
        />
      )}

      {enviado && (
        <Janela onClose={() => setEnviado(false)} largura={460} label="Link de aprovação">
          <div style={JANELA.h}>
            <span style={S.okIc}><Send size={18} /></span>
            <div style={{ flex: 1 }}>
              <h2 style={{ fontSize: 18, fontWeight: 500 }}>Planejamento enviado</h2>
              <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 4, lineHeight: 1.5 }}>Mande este link para {plano.clientName} pelo WhatsApp. Não precisa de login.</div>
            </div>
            <BotaoFechar onClick={() => setEnviado(false)} />
          </div>
          <div style={JANELA.b}>
            <div style={S.linkbox}>
              <code style={S.code}>{link}</code>
              <button type="button" className="ui-btn" style={BTN.peq} onClick={() => copiarTexto(link, toast)}><Copy size={14} />Copiar</button>
            </div>
            <p style={{ fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.5 }}>Cada resposta do cliente muda o status no seu calendário e no do Videomaker na mesma hora. Entregas do Mês e o checklist do Mural continuam sendo marcados por você.</p>
          </div>
          <div style={{ ...JANELA.f, justifyContent: 'flex-end' }}>
            <button type="button" className="ui-btn" onClick={() => setEnviado(false)}>Fechar</button>
            <a className="ui-btn primary" style={{ textDecoration: 'none' }} href={link} target="_blank" rel="noreferrer"><Eye size={15} />Abrir como o cliente</a>
          </div>
        </Janela>
      )}
    </div>
  );
}

const S = {
  voltar: { display: 'inline-flex', alignItems: 'center', gap: 6, border: 0, background: 'none', color: 'var(--muted)', fontSize: 12.5, padding: 0, marginBottom: 10 },
  topo: { display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16, flexWrap: 'wrap' },
  h1: { fontSize: 22, fontWeight: 500, letterSpacing: '-.01em', marginTop: 2, color: 'var(--text)' },
  linkbox: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', padding: '12px 14px', borderRadius: 14, background: 'var(--surface)', border: '1px solid var(--border)' },
  code: { flex: '1 1 220px', minWidth: 0, fontFamily: 'var(--fm)', fontSize: 12, padding: '8px 12px', borderRadius: 99, background: 'var(--bg3)', border: '1px solid var(--border)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', userSelect: 'all', color: 'var(--text)' },
  tabs: { display: 'inline-flex', gap: 2, padding: 4, borderRadius: 99, background: 'var(--bg2)', border: '1px solid var(--border)', maxWidth: '100%', overflowX: 'auto', alignSelf: 'flex-start' },
  tab: { height: 34, padding: '0 14px', borderRadius: 99, border: 0, background: 'transparent', color: 'var(--muted)', fontSize: 12.5, fontWeight: 500, whiteSpace: 'nowrap' },
  tabOn: { background: 'var(--grad)', color: 'var(--on)' },
  tabN: { fontFamily: 'var(--fm)', fontSize: 10.5, opacity: 0.75, marginLeft: 4 },
  grade: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: 14 },
  pcard: { display: 'flex', flexDirection: 'column', gap: 10, padding: '8px 8px 12px', textAlign: 'left', color: 'var(--text)', borderRadius: 'var(--r)', background: 'var(--bg2)', border: '1px solid var(--border)', boxShadow: 'var(--shadow)', minWidth: 0, fontFamily: 'var(--f)' },
  pmedia: { position: 'relative', aspectRatio: '4 / 5', borderRadius: 12, overflow: 'hidden', background: 'var(--bg3)', display: 'grid', placeItems: 'center', color: 'var(--muted)' },
  pnum: { position: 'absolute', left: 8, top: 8, fontFamily: 'var(--fm)', fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 99, background: 'rgba(255,255,255,.88)', color: '#15151a' },
  pqtd: { position: 'absolute', right: 8, top: 8, display: 'inline-flex', alignItems: 'center', gap: 4, fontFamily: 'var(--fm)', fontSize: 10.5, padding: '3px 8px', borderRadius: 99, background: 'rgba(10,10,12,.62)', color: '#fff' },
  ptit: { fontSize: 13.5, fontWeight: 600, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  ftag: { display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 500, padding: '3px 8px', borderRadius: 99, background: 'var(--soft)', flexShrink: 0 },
  novo: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, minHeight: 300, borderRadius: 'var(--r)', border: '1px dashed var(--border-h)', background: 'transparent', color: 'var(--muted)', fontSize: 13, fontWeight: 500, fontFamily: 'var(--f)' },
  novoIc: { width: 40, height: 40, borderRadius: '50%', display: 'grid', placeItems: 'center', background: 'var(--c-dim)', color: 'var(--c)' },
  feedG: { display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 3 },
  feedItem: { position: 'relative', aspectRatio: '4 / 5', border: 0, padding: 0, borderRadius: 4, overflow: 'hidden', background: 'var(--bg3)', color: 'var(--muted)', display: 'grid', placeItems: 'center' },
  feedOv: { position: 'absolute', right: 6, top: 6, color: '#fff', filter: 'drop-shadow(0 1px 2px rgba(0,0,0,.6))' },
  barra: { position: 'sticky', bottom: 16, marginTop: 14, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: '12px 14px', borderRadius: 16, background: 'var(--bg2)', border: '1px solid var(--border-h)', boxShadow: '0 16px 40px -20px rgba(0,0,0,.6)', zIndex: 5 },
  okIc: { width: 40, height: 40, borderRadius: '50%', display: 'grid', placeItems: 'center', flexShrink: 0, color: 'var(--green)', background: 'var(--green-dim)' },
};
