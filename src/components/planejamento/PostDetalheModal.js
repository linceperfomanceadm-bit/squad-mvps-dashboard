import React, { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { POST_STATUS, POST_ETAPAS_ORDEM, POST_FORMATOS, VIDEO_STATUS } from '../../lib/firebase';
import { asArray } from '../../lib/wdJobs';
import {
  statusDoPost, statusEfetivo, statusDoVideo, prazoVideo, comentarioDoPost,
  dataCurta, nomeDoMes, hojeISO, linkAprovacao,
} from '../../lib/planejamento';
import { Janela, BotaoFechar, Sigla, siglaDe, Dot, Midia, JANELA } from './kit';
import { copiarTexto } from './PlanejamentoEditor';

// ─────────────────────────────────────────────────────────────
// Detalhe do post, aberto pelo calendário e pelas visões gerais.
//
// Depois que o cliente aprova, quem anda com o post é a equipe, à mão:
// a social marca produção e publicação; o videomaker marca o vídeo
// entregue. Nada aqui mexe em Entregas do Mês nem no Mural — esses
// continuam sendo marcados pela social (decisão out/2026).
// ─────────────────────────────────────────────────────────────

const ddmm = (iso) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : '—');

export default function PostDetalheModal({ plano, post, cliente, modo, marcacoes = [], me, acoes, toast, onClose, onAbrirPlanejamento }) {
  const [busy, setBusy] = useState(false);
  const vm = modo === 'vm';
  const st = statusDoPost(post, plano);
  const atrasado = statusEfetivo(post, plano) === 'atrasado';
  const comentario = comentarioDoPost(post, plano);
  const hoje = hojeISO();
  const social = asArray(cliente?.responsibles?.socialmedia).join(', ') || '—';
  const videomaker = asArray(cliente?.responsibles?.videomaker).join(', ');

  const idx = POST_ETAPAS_ORDEM.indexOf(st === 'ajuste' ? 'cliente' : st);
  const passos = POST_ETAPAS_ORDEM.map((k, i) => {
    const lbl = i === idx && st === 'ajuste' ? 'Ajuste pedido' : POST_STATUS[k].label;
    const cor = i === idx && st === 'ajuste' ? 'var(--purple)' : POST_STATUS[k].cor === 'var(--dim)' ? 'var(--text)' : POST_STATUS[k].cor;
    if (i < idx) return <span key={k} style={{ ...S.st, ...S.stFeito }}><Check size={12} strokeWidth={2.6} />&nbsp;{lbl}</span>;
    if (i === idx) return <span key={k} style={{ ...S.st, color: cor, borderStyle: 'solid', borderColor: `color-mix(in srgb, ${cor} 45%, transparent)`, background: `color-mix(in srgb, ${cor} 12%, transparent)`, fontWeight: 600 }}>{lbl}</span>;
    return <span key={k} style={S.st}>{lbl}</span>;
  });

  const rodar = async (fn, msg) => {
    setBusy(true);
    const res = await fn();
    setBusy(false);
    if (res.success) toast(msg); else toast(res.error, 'e');
  };
  const etapa = (e, msg) => rodar(() => acoes.setEtapa(plano.id, post.id, e, me), msg);
  const video = (v, msg) => rodar(() => acoes.marcarVideo(plano.id, post.id, v, me), msg);

  let acoesUI = null;
  if (vm) {
    const vs = statusDoVideo(post, plano);
    acoesUI = vs === 'aguarda'
      ? <span style={{ fontSize: 12, color: 'var(--muted)' }}>Espere o cliente aprovar antes de gravar.</span>
      : post.videoEntregue
        ? <button type="button" className="ui-btn" disabled={busy} onClick={() => video(false, 'Entrega desfeita.')}>Desfazer entrega</button>
        : st === 'publicado'
          ? <span style={{ fontSize: 12, color: 'var(--muted)' }}>O post já foi publicado.</span>
          : <button type="button" className="ui-btn primary" disabled={busy} onClick={() => video(true, 'Vídeo marcado como entregue. A Social já vê no calendário.')}><Check size={15} strokeWidth={2.4} />Marcar vídeo entregue</button>;
  } else {
    const B = {
      rascunho: <button type="button" className="ui-btn primary" onClick={() => onAbrirPlanejamento(plano.id, post.id)}>Abrir no planejamento</button>,
      cliente: <button type="button" className="ui-btn" onClick={() => copiarTexto(linkAprovacao(plano.id), toast)}><Copy size={14} />Copiar link do cliente</button>,
      ajuste: <button type="button" className="ui-btn primary" onClick={() => onAbrirPlanejamento(plano.id, post.id)}>Corrigir no planejamento</button>,
      aprovado: <button type="button" className="ui-btn primary" disabled={busy} onClick={() => etapa('producao', 'Post em produção.')}>Iniciar produção</button>,
      producao: (
        <>
          <button type="button" className="ui-btn" disabled={busy} onClick={() => etapa(null, 'Voltou para Aprovado.')}>Voltar</button>
          <button type="button" className="ui-btn primary" disabled={busy} onClick={() => etapa('publicado', 'Post marcado como publicado.')}>Marcar publicado</button>
        </>
      ),
      publicado: <button type="button" className="ui-btn" disabled={busy} onClick={() => etapa('producao', 'Publicação desfeita.')}>Desfazer publicação</button>,
    };
    acoesUI = B[st];
  }

  // Captação mais recente marcada para o cliente até a data do post.
  let blocoVideo = null;
  if (post.fmt === 'reel' && (videomaker || vm)) {
    const cap = marcacoes
      .filter((m) => m.tipo === 'cap' && m.clientId === plano.clientId && m.data <= post.data)
      .sort((a, b) => b.data.localeCompare(a.data))[0];
    const vs = statusDoVideo(post, plano);
    blocoVideo = (
      <div>
        <div style={JANELA.lab}>Vídeo{videomaker ? ` · ${videomaker}` : ''}</div>
        <div style={{ border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
          <div style={S.vLinha}>
            <Dot def={cap ? { cor: 'var(--c)' } : { cor: 'var(--dim)', oco: true }} />
            {cap ? `Captação ${cap.data < hoje ? 'feita em' : 'marcada para'} ${ddmm(cap.data)} · ${cap.hora}` : 'Captação ainda não marcada'}
          </div>
          <div style={{ ...S.vLinha, borderTop: '1px solid var(--border)' }}>
            <Dot def={VIDEO_STATUS[vs]} />{VIDEO_STATUS[vs].label} · prazo {ddmm(prazoVideo(post))}
          </div>
        </div>
      </div>
    );
  }

  const enviadoEm = plano.enviadoEm ? new Date(plano.enviadoEm).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : null;

  return (
    <Janela onClose={onClose} label={post.titulo || 'Post'}>
      <div style={JANELA.h}>
        <Sigla size={44}>{siglaDe(plano.clientName)}</Sigla>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11.5, color: 'var(--muted)', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <span>{plano.clientName}</span><span>·</span>
            <span style={{ fontFamily: 'var(--fm)' }}>{POST_FORMATOS[post.fmt]?.tag}</span><span>·</span>
            <span style={{ fontFamily: 'var(--fm)' }}>publica {dataCurta(post.data)} · {post.hora}</span>
          </div>
          <h2 style={{ fontSize: 20, fontWeight: 500, marginTop: 6 }}>{post.titulo || 'Sem tema'}</h2>
          <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 6 }}>
            Planejamento de {nomeDoMes(plano.mes)}{enviadoEm ? ` · enviado ao cliente em ${enviadoEm}` : ' · ainda não enviado'}
          </div>
        </div>
        <BotaoFechar onClick={onClose} />
      </div>

      <div style={JANELA.b}>
        {(post.midias || []).length > 0 && (
          <div style={S.thumbs}>
            {post.midias.map((m, i) => <div key={m.path || i} style={S.thumb}><Midia m={m} controls={m.tipo === 'video'} /></div>)}
          </div>
        )}
        <div>
          <div style={JANELA.lab}>Status{atrasado && <> · <span style={{ color: 'var(--red)' }}>atrasado</span></>}</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{passos}</div>
        </div>
        {comentario && (
          <div style={JANELA.comentario}>
            <b style={{ color: 'var(--purple)', fontWeight: 600, fontSize: 11, display: 'block', marginBottom: 2 }}>Comentário do cliente</b>
            {comentario}
          </div>
        )}
        <div style={JANELA.dois}>
          <div><div style={JANELA.lab}>Legenda</div><div style={JANELA.ro}>{post.legenda || '—'}</div></div>
          <div><div style={JANELA.lab}>Ideia e roteiro</div><div style={JANELA.ro}>{post.ideia || '—'}</div></div>
        </div>
        {blocoVideo}
      </div>

      <div style={JANELA.f}>
        <span style={{ fontSize: 11.5, color: 'var(--muted)', flex: 1, minWidth: 160 }}>
          {vm ? `Você vê este reel porque é o Videomaker de ${plano.clientName}.` : `Social Media: ${social}`}
        </span>
        {acoesUI}
      </div>
    </Janela>
  );
}

const S = {
  st: { display: 'inline-flex', alignItems: 'center', height: 28, padding: '0 11px', borderRadius: 99, fontSize: 11.5, border: '1px dashed var(--border-h)', color: 'var(--muted)' },
  stFeito: { borderStyle: 'solid', borderColor: 'transparent', background: 'var(--soft)', color: 'var(--text)' },
  thumbs: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: 8 },
  thumb: { position: 'relative', aspectRatio: '4 / 5', borderRadius: 10, overflow: 'hidden', background: 'var(--bg3)', border: '1px solid var(--border)' },
  vLinha: { display: 'flex', gap: 9, alignItems: 'center', padding: '10px 12px', fontSize: 12.5 },
};
