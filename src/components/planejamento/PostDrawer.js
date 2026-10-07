import React, { useState, useEffect, useRef } from 'react';
import { ImagePlus, Trash2, X } from 'lucide-react';
import { POST_FORMATOS, POST_STATUS } from '../../lib/firebase';
import {
  statusDoPost, statusEfetivo, rotuloStatus, podeEditar, comentarioDoPost,
  diasNoMes, dataCurta, nomeDoMes,
} from '../../lib/planejamento';
import { Gaveta, BotaoFechar, Pill, Sigla, Midia, FMT_ICONE, JANELA, BTN } from './kit';

// ─────────────────────────────────────────────────────────────
// Gaveta de edição do post (Planejamentos)
//
// O texto salva sozinho (debounce) enquanto a social digita; a arte
// sobe na hora em que o arquivo é escolhido. Post com o cliente ou
// aprovado abre só para leitura — o cliente aprovou aquele conteúdo.
// ─────────────────────────────────────────────────────────────

const CAMPOS = ['fmt', 'data', 'hora', 'titulo', 'legenda', 'ideia'];
const pick = (p) => CAMPOS.reduce((o, k) => ({ ...o, [k]: p?.[k] ?? '' }), {});
const igual = (a, b) => CAMPOS.every((k) => (a[k] ?? '') === (b[k] ?? ''));
const LEGENDA_MAX = 2200;

export default function PostDrawer({ plano, post, numero, onClose, salvarCampos, adicionarMidias, removerMidia, removerPost, toast }) {
  const st = statusDoPost(post, plano);
  const edita = podeEditar(st);
  const ef = statusEfetivo(post, plano);
  const def = POST_STATUS[ef];
  const comentario = comentarioDoPost(post, plano);

  const [rasc, setRasc] = useState(() => pick(post));
  const [salvo, setSalvo] = useState(true);
  const [progresso, setProgresso] = useState(null);
  const [sobre, setSobre] = useState(false);
  const inputRef = useRef(null);
  const pendente = useRef(null);

  // Salvamento com debounce; o que ficar pendente é gravado ao fechar.
  useEffect(() => {
    if (!edita || igual(rasc, pick(post))) { setSalvo(true); return undefined; }
    setSalvo(false);
    pendente.current = rasc;
    const t = setTimeout(async () => {
      pendente.current = null;
      const res = await salvarCampos(plano.id, post.id, rasc);
      if (!res.success) toast(res.error, 'e');
      setSalvo(true);
    }, 700);
    return () => clearTimeout(t);
    // `post` muda a cada snapshot; o que importa é o rascunho local.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rasc]);

  const fechar = () => {
    if (pendente.current) salvarCampos(plano.id, post.id, pendente.current);
    onClose();
  };

  const set = (k) => (e) => setRasc((r) => ({ ...r, [k]: e.target.value }));
  const fmt = POST_FORMATOS[rasc.fmt] || POST_FORMATOS.feed;
  const midias = post.midias || [];
  const multi = fmt.maxMidias > 1;
  const podeMais = edita && (multi ? midias.length < fmt.maxMidias : true);

  const subir = async (files) => {
    if (!files?.length || progresso != null) return;
    const lista = Array.from(files).slice(0, multi ? fmt.maxMidias - midias.length : 1);
    if (!lista.length) { toast(`O ${fmt.label.toLowerCase()} aceita até ${fmt.maxMidias} arquivos.`, 'e'); return; }
    // O formato pode ter mudado e ainda não ter sido gravado.
    if (pendente.current) { await salvarCampos(plano.id, post.id, pendente.current); pendente.current = null; }
    setProgresso(0);
    const res = await adicionarMidias(plano.id, post.id, lista, setProgresso);
    setProgresso(null);
    if (!res.success) toast(res.error, 'e');
  };

  const excluir = async () => {
    if (!window.confirm('Excluir este post do planejamento?')) return;
    pendente.current = null;
    const res = await removerPost(plano.id, post.id);
    if (res.success) { toast('Post removido do planejamento.'); onClose(); }
    else toast(res.error, 'e');
  };

  const dias = Array.from({ length: diasNoMes(plano.mes) }, (_, i) => `${plano.mes}-${String(i + 1).padStart(2, '0')}`);

  return (
    <Gaveta onClose={fechar} label={`Editar post ${numero}`}>
      <div style={{ ...JANELA.h, position: 'sticky', top: 0, background: 'var(--bg2)', zIndex: 2 }}>
        <Sigla size={44} style={{ fontSize: 11, color: 'var(--text)' }}>{numero}</Sigla>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>{plano.clientName} · {nomeDoMes(plano.mes)}</div>
          <h2 style={S.h2}>{rasc.titulo || 'Novo post'}</h2>
          <div style={{ marginTop: 8 }}><Pill def={def} label={rotuloStatus(post, plano)} /></div>
        </div>
        <BotaoFechar onClick={fechar} />
      </div>

      <div style={JANELA.b}>
        {st === 'ajuste' && (
          <div style={JANELA.comentario}>
            <b style={S.comentT}>O cliente pediu ajuste</b>
            {comentario || 'Sem comentário.'}
            <div style={{ marginTop: 6, color: 'var(--muted)', fontSize: 11.5 }}>Corrija aqui e use “Reenviar” na barra do planejamento.</div>
          </div>
        )}
        {!edita && (
          <div style={JANELA.aviso}>
            {st === 'cliente' ? 'Este post está com o cliente. Ele fica travado até a resposta.' : 'Aprovado pelo cliente. Para mudar o conteúdo, combine com ele antes.'}
          </div>
        )}

        {edita ? (
          <>
            <div>
              <span style={JANELA.lab}>Formato</span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {Object.values(POST_FORMATOS).map((f) => {
                  const Ic = FMT_ICONE[f.id];
                  const on = rasc.fmt === f.id;
                  return (
                    <button key={f.id} type="button" aria-pressed={on} onClick={() => setRasc((r) => ({ ...r, fmt: f.id }))} style={{ ...S.seg, ...(on ? S.segOn : null) }}>
                      <Ic size={15} />{f.label}
                    </button>
                  );
                })}
              </div>
              {midias.length > fmt.maxMidias && <p style={{ fontSize: 11.5, color: 'var(--amber)', marginTop: 6 }}>Só a primeira arte fica ao trocar para {fmt.label.toLowerCase()}.</p>}
            </div>
            <div style={JANELA.dois}>
              <label>
                <span style={JANELA.lab}>Data de publicação</span>
                <select value={rasc.data} onChange={set('data')} style={{ width: '100%' }}>
                  {dias.map((d) => <option key={d} value={d}>{dataCurta(d)}</option>)}
                </select>
              </label>
              <label>
                <span style={JANELA.lab}>Horário</span>
                <input type="time" value={rasc.hora} onChange={set('hora')} style={{ ...JANELA.fld, colorScheme: 'dark light' }} />
              </label>
            </div>
            <label>
              <span style={JANELA.lab}>Tema</span>
              <input value={rasc.titulo} onChange={set('titulo')} placeholder="Ex.: Bastidores da torra" style={JANELA.fld} maxLength={120} />
            </label>
          </>
        ) : (
          <div style={JANELA.dois}>
            <div><div style={JANELA.lab}>Formato</div><div style={JANELA.ro}>{fmt.label}</div></div>
            <div><div style={JANELA.lab}>Publicação</div><div style={{ ...JANELA.ro, fontFamily: 'var(--fm)' }}>{dataCurta(post.data)} · {post.hora}</div></div>
          </div>
        )}

        <div>
          <span style={JANELA.lab}>Arte</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {midias.length > 0 && (
              <div style={S.thumbs}>
                {midias.map((m, i) => (
                  <div key={m.path || i} style={S.thumb}>
                    <Midia m={m} />
                    {multi && <span style={S.pnum}>{i + 1}</span>}
                    {edita && (
                      <button type="button" aria-label={`Remover arquivo ${i + 1}`} style={S.thumbX} onClick={async () => {
                        const res = await removerMidia(plano.id, post.id, m.path);
                        if (!res.success) toast(res.error, 'e');
                      }}><X size={13} strokeWidth={2.4} /></button>
                    )}
                  </div>
                ))}
              </div>
            )}
            {podeMais && (
              <label
                onDragOver={(e) => { e.preventDefault(); setSobre(true); }}
                onDragLeave={() => setSobre(false)}
                onDrop={(e) => { e.preventDefault(); setSobre(false); subir(e.dataTransfer.files); }}
                style={{ ...S.drop, ...(sobre ? S.dropOn : null), cursor: progresso != null ? 'progress' : 'pointer' }}
              >
                {progresso != null ? (
                  <>
                    <div className="spinner" />
                    <span>Subindo… {Math.round(progresso * 100)}%</span>
                  </>
                ) : (
                  <>
                    <ImagePlus size={22} strokeWidth={1.7} />
                    <span><b style={{ color: 'var(--text)', fontWeight: 500 }}>{midias.length && multi ? 'Adicionar mais' : midias.length ? 'Trocar arte' : 'Subir arte'}</b> ou arraste o arquivo aqui</span>
                    <span style={{ fontSize: 11 }}>{fmt.dica}</span>
                  </>
                )}
                <input ref={inputRef} type="file" accept={fmt.aceita} multiple={multi} hidden onChange={(e) => { subir(e.target.files); e.target.value = ''; }} disabled={progresso != null} />
              </label>
            )}
            {!edita && !midias.length && <div style={{ ...JANELA.ro, color: 'var(--muted)' }}>Sem arte.</div>}
          </div>
        </div>

        {edita ? (
          <>
            <label>
              <span style={JANELA.lab}>Legenda</span>
              <textarea rows={5} value={rasc.legenda} onChange={set('legenda')} maxLength={LEGENDA_MAX} placeholder="Texto que vai no post, com hashtags se tiver" style={{ ...JANELA.fld, resize: 'vertical', lineHeight: 1.45 }} />
              <div style={S.cnt}>{(rasc.legenda || '').length.toLocaleString('pt-BR')} / 2.200</div>
            </label>
            <label>
              <span style={JANELA.lab}>Ideia e roteiro <span style={{ color: 'var(--dim)' }}>· o cliente também vê</span></span>
              <textarea rows={3} value={rasc.ideia} onChange={set('ideia')} placeholder="O que a arte ou o vídeo mostra" style={{ ...JANELA.fld, resize: 'vertical', lineHeight: 1.45 }} />
            </label>
          </>
        ) : (
          <>
            <div><div style={JANELA.lab}>Legenda</div><div style={JANELA.ro}>{post.legenda || '—'}</div></div>
            <div><div style={JANELA.lab}>Ideia e roteiro</div><div style={JANELA.ro}>{post.ideia || '—'}</div></div>
          </>
        )}
      </div>

      <div style={{ ...JANELA.f, position: 'sticky', bottom: 0, background: 'var(--bg2)', marginTop: 'auto' }}>
        {edita && (
          <button type="button" className="ui-btn" style={BTN.perigo} onClick={excluir}><Trash2 size={14} />Excluir post</button>
        )}
        <span style={{ flex: 1, fontSize: 11.5, color: 'var(--muted)', textAlign: 'right' }}>{edita ? (salvo ? 'Salvo' : 'Salvando…') : ''}</span>
        <button type="button" className="ui-btn primary" onClick={fechar}>{edita ? 'Pronto' : 'Fechar'}</button>
      </div>
    </Gaveta>
  );
}

const S = {
  h2: { fontSize: 18, fontWeight: 500, marginTop: 3, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  comentT: { color: 'var(--purple)', fontWeight: 600, fontSize: 11, display: 'block', marginBottom: 2 },
  seg: { display: 'inline-flex', alignItems: 'center', gap: 6, height: 36, padding: '0 13px', borderRadius: 10, border: '1px solid var(--border-h)', background: 'var(--bg3)', color: 'var(--muted)', fontSize: 12.5, fontWeight: 500 },
  segOn: { background: 'var(--c-dim)', borderColor: 'var(--c-border)', color: 'var(--text)' },
  thumbs: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(96px, 1fr))', gap: 8 },
  thumb: { position: 'relative', aspectRatio: '4 / 5', borderRadius: 10, overflow: 'hidden', background: 'var(--bg3)', border: '1px solid var(--border)' },
  pnum: { position: 'absolute', left: 6, top: 6, fontFamily: 'var(--fm)', fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 99, background: 'rgba(255,255,255,.88)', color: '#15151a' },
  thumbX: { position: 'absolute', right: 6, top: 6, width: 26, height: 26, borderRadius: '50%', border: 0, background: 'rgba(10,10,12,.7)', color: '#fff', display: 'grid', placeItems: 'center', padding: 0 },
  drop: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '22px 16px', borderRadius: 14, border: '1.5px dashed var(--border-h)', background: 'var(--surface)', color: 'var(--muted)', fontSize: 12.5, textAlign: 'center' },
  dropOn: { borderColor: 'var(--c-border)', background: 'var(--c-dim)', color: 'var(--text)' },
  cnt: { fontFamily: 'var(--fm)', fontSize: 10.5, color: 'var(--muted)', textAlign: 'right', marginTop: 4 },
};
