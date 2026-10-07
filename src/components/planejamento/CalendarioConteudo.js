import React, { useState } from 'react';
import { Plus, CalendarRange } from 'lucide-react';
import { POST_STATUS, VIDEO_STATUS, POST_FORMATOS, MARCACAO_TIPOS } from '../../lib/firebase';
import { asArray } from '../../lib/wdJobs';
import {
  gradeDoMes, hojeISO, mesDoISO, dataLonga, nomeDoMes, itensDosPlanos,
  statusEfetivo, rotuloStatus, statusDoVideo, statusDoPost, estaAprovado,
} from '../../lib/planejamento';
import { PageHeader } from '../shared/ui';
import { Pill, Dot, Sigla, siglaDe, Linha, Barra, MesNav, ChipsClientes, LEGENDA } from './kit';

// ─────────────────────────────────────────────────────────────
// Calendário de conteúdo — o mesmo para Social Media e Videomaker.
//
//  • Social: todos os posts dos planejamentos dela, do rascunho ao
//    publicado. O status muda sozinho quando o cliente responde no link.
//  • Videomaker: só os reels dos clientes em que ele está escalado,
//    depois de enviados ao cliente, mais as marcações manuais dele.
// ─────────────────────────────────────────────────────────────

const SEM = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];
const MAX_CHIPS = 3;

export default function CalendarioConteudo({
  modo, clientes, planos, marcacoes = [], inicial,
  onAbrirPost, onAbrirMarcacao, onNovaMarcacao, onIrPlanejamentos,
}) {
  const vm = modo === 'vm';
  const hoje = hojeISO();
  const [mes, setMes] = useState(mesDoISO(inicial || hoje));
  const [dia, setDia] = useState(inicial || hoje);
  const [cli, setCli] = useState('todos');
  const [tipo, setTipo] = useState('todos'); // vm: todos | reels | marcas

  const mudaMes = (m) => { setMes(m); setDia(m === mesDoISO(hoje) ? hoje : `${m}-01`); };

  const todos = itensDosPlanos(planos, { soReels: vm });
  const doMes = todos.filter(({ plano, post }) => mesDoISO(post.data) === mes && (cli === 'todos' || plano.clientId === cli));
  const posts = vm && tipo === 'marcas' ? [] : doMes;
  const marcas = vm && tipo !== 'reels'
    ? marcacoes.filter((m) => mesDoISO(m.data) === mes && (cli === 'todos' || m.clientId === cli))
    : [];
  const um = cli !== 'todos';
  const nomeSocial = (clientId) => asArray(clientes.find((c) => c.id === clientId)?.responsibles?.socialmedia).join(', ') || '—';

  const defPost = ({ plano, post }) => (vm ? VIDEO_STATUS[statusDoVideo(post, plano)] : POST_STATUS[statusEfetivo(post, plano)]);
  const feito = ({ plano, post }) => (vm ? statusDoVideo(post, plano) === 'entregue' : statusDoPost(post, plano) === 'publicado');

  const chipPost = (it) => (
    <button key={it.post.id} type="button" onClick={() => onAbrirPost(it.plano.id, it.post.id)} style={S.chip} title={it.post.titulo || 'Sem tema'}>
      <Dot def={defPost(it)} />
      <span style={S.tg}>{um ? POST_FORMATOS[it.post.fmt]?.tag : siglaDe(it.plano.clientName)}</span>
      <span style={{ ...S.tt, color: feito(it) ? 'var(--muted)' : 'var(--text)' }}>{it.post.titulo || 'Sem tema'}</span>
    </button>
  );
  const chipMarca = (m) => (
    <button key={m.id} type="button" onClick={() => onAbrirMarcacao(m)} style={{ ...S.chip, background: 'var(--c-dim)', borderColor: 'var(--c-border)' }}>
      <Dot def={{ cor: 'var(--c)' }} />
      <span style={{ ...S.tg, color: 'var(--c)' }}>{MARCACAO_TIPOS[m.tipo]?.tag}</span>
      <span style={S.tt}>{m.clientName && !um ? `${siglaDe(m.clientName)} · ` : ''}{m.hora}</span>
    </button>
  );

  const doDia = (iso) => [
    ...marcas.filter((m) => m.data === iso).sort((a, b) => String(a.hora).localeCompare(String(b.hora))).map(chipMarca),
    ...posts.filter(({ post }) => post.data === iso).map(chipPost),
  ];

  const legenda = vm ? (
    <>
      <span style={S.legItem}><span style={S.legTag}>CAPT</span>Sua marcação</span>
      {['aguarda', 'produzir', 'perto', 'entregue', 'atrasado'].map((k) => <span key={k} style={S.legItem}><Dot def={VIDEO_STATUS[k]} />{VIDEO_STATUS[k].label}</span>)}
    </>
  ) : ['rascunho', 'cliente', 'ajuste', 'aprovado', 'producao', 'publicado', 'atrasado'].map((k) => (
    <span key={k} style={S.legItem}><Dot def={POST_STATUS[k]} />{POST_STATUS[k].label}</span>
  ));

  // Painel do dia selecionado
  const marcasDia = marcas.filter((m) => m.data === dia);
  const postsDia = posts.filter(({ post }) => post.data === dia);

  // Resumo por cliente no mês
  const resumo = clientes.map((c) => {
    const ps = todos.filter(({ plano, post }) => plano.clientId === c.id && mesDoISO(post.data) === mes);
    const ok = vm
      ? ps.filter(({ plano, post }) => statusDoVideo(post, plano) !== 'aguarda').length
      : ps.filter(({ plano, post }) => estaAprovado(statusDoPost(post, plano))).length;
    return { c, total: ps.length, ok };
  });

  return (
    <div className="fade-up">
      <PageHeader
        title="Calendário"
        sub={vm ? 'Reels dos clientes em que você é o Videomaker, nas datas que as Socials planejaram' : 'Todos os posts dos seus planejamentos, do rascunho ao publicado'}
        right={(
          <>
            {vm
              ? <button type="button" className="ui-btn primary" onClick={() => onNovaMarcacao(dia)}><Plus size={15} strokeWidth={2.2} />Nova marcação</button>
              : <button type="button" className="ui-btn" onClick={onIrPlanejamentos}><CalendarRange size={15} />Planejamentos</button>}
            <MesNav mes={mes} onChange={mudaMes} />
          </>
        )}
      />

      <ChipsClientes clientes={clientes} valor={cli} onChange={setCli} style={{ marginBottom: 10 }} />
      {vm ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', marginBottom: 16 }}>
          <span style={{ fontSize: 11.5, color: 'var(--muted)', marginRight: 4 }}>Mostrar</span>
          {[['todos', 'Tudo'], ['reels', 'Só reels'], ['marcas', 'Só minhas marcações']].map(([k, l]) => (
            <button key={k} type="button" className={`ui-btn small${tipo === k ? ' on' : ''}`} aria-pressed={tipo === k} onClick={() => setTipo(k)}>{l}</button>
          ))}
        </div>
      ) : <div style={{ height: 6 }} />}

      <div style={S.cols}>
        <div className="ui-card" style={{ flex: '999 1 640px', padding: 16 }}>
          <div style={{ overflowX: 'auto' }}>
            <div style={{ minWidth: 620 }}>
              <div style={S.semana}>{SEM.map((s) => <div key={s} style={S.wd}>{s}</div>)}</div>
              <div style={S.semana}>
                {gradeDoMes(mes).map((iso, i) => {
                  if (!iso) return <div key={`v${i}`} style={{ ...S.cell, background: 'transparent', borderColor: 'transparent' }} />;
                  const chips = doDia(iso);
                  const sel = iso === dia;
                  const ehHoje = iso === hoje;
                  return (
                    <div key={iso} style={{ ...S.cell, ...(sel ? { background: 'var(--c-dim)', borderColor: 'var(--c-border)' } : null) }}>
                      <button type="button" onClick={() => setDia(iso)} aria-label={`Ver ${dataLonga(iso)}`} style={{ ...S.dn, ...(ehHoje ? { background: 'var(--grad)', color: 'var(--on)' } : null) }}>
                        {Number(iso.slice(8))}
                      </button>
                      {chips.slice(0, MAX_CHIPS)}
                      {chips.length > MAX_CHIPS && (
                        <button type="button" onClick={() => setDia(iso)} style={S.mais}>+{chips.length - MAX_CHIPS} no dia</button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
          <div style={LEGENDA}>{legenda}</div>
        </div>

        <div style={S.side}>
          <div className="ui-card" style={{ padding: '16px 10px 8px' }}>
            <div style={S.cardH}><b style={S.cardT}>{dataLonga(dia)}{dia === hoje ? ' · hoje' : ''}</b></div>
            {marcasDia.map((m, i) => (
              <Linha
                key={m.id}
                primeira={i === 0}
                onClick={() => onAbrirMarcacao(m)}
                left={<Sigla style={{ background: 'var(--c-dim)', borderColor: 'var(--c-border)', color: 'var(--c)' }}>{MARCACAO_TIPOS[m.tipo]?.tag}</Sigla>}
                title={`${MARCACAO_TIPOS[m.tipo]?.label}${m.clientName ? ` · ${m.clientName}` : ' · interno'}`}
                sub={`${m.hora} · ${m.obs || 'Sem observação'}`}
              />
            ))}
            {postsDia.map((it, i) => (
              <Linha
                key={it.post.id}
                primeira={!marcasDia.length && i === 0}
                onClick={() => onAbrirPost(it.plano.id, it.post.id)}
                left={<Sigla>{siglaDe(it.plano.clientName)}</Sigla>}
                title={it.post.titulo || 'Sem tema'}
                sub={vm ? `${it.plano.clientName} · publica neste dia · Social: ${nomeSocial(it.plano.clientId)}` : `${it.plano.clientName} · ${POST_FORMATOS[it.post.fmt]?.label}`}
                extra={<Pill def={defPost(it)} label={vm ? undefined : rotuloStatus(it.post, it.plano)} />}
              />
            ))}
            {!marcasDia.length && !postsDia.length && <p style={S.vazio}>Nada neste dia.</p>}
          </div>

          <div className="ui-card">
            <div style={{ ...S.cardH, padding: '0 0 8px' }}>
              <b style={S.cardT}>{vm ? 'Reels aprovados por cliente' : 'Aprovados pelo cliente'}</b>
              <span style={{ fontSize: 11, color: 'var(--muted)' }}>{nomeDoMes(mes)}</span>
            </div>
            {resumo.map(({ c, total, ok }) => (
              <div key={c.id} style={{ padding: '9px 0', borderTop: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                  <button type="button" onClick={() => setCli(c.id)} style={S.lnk}>{c.name}</button>
                  {total
                    ? <span style={{ fontFamily: 'var(--fm)', fontSize: 11.5, color: 'var(--muted)' }}><span style={{ color: 'var(--text)' }}>{ok}</span>/{total}</span>
                    : <span style={{ fontSize: 11, color: 'var(--muted)' }}>{vm ? 'sem reels' : 'sem planejamento'}</span>}
                </div>
                {vm && <div style={{ fontSize: 10.5, color: 'var(--muted)', marginTop: 2 }}>Social: {nomeSocial(c.id)}</div>}
                {total > 0 && <Barra pct={ok / total} style={{ marginTop: 7 }} />}
              </div>
            ))}
            {!resumo.length && <p style={S.vazio}>Nenhum cliente na carteira.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

const S = {
  cols: { display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'flex-start' },
  side: { flex: '1 1 300px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 14 },
  semana: { display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 6 },
  wd: { fontFamily: 'var(--fm)', fontSize: 10, letterSpacing: '.1em', color: 'var(--muted)', padding: '0 4px 6px' },
  cell: { display: 'flex', flexDirection: 'column', gap: 4, minHeight: 120, padding: '6px 6px 8px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--bg2)', minWidth: 0 },
  dn: { width: 26, height: 26, borderRadius: '50%', border: 0, background: 'transparent', color: 'var(--muted)', fontFamily: 'var(--fm)', fontSize: 11, padding: 0 },
  chip: { display: 'flex', alignItems: 'center', gap: 5, minWidth: 0, width: '100%', padding: '3px 6px', borderRadius: 7, fontSize: 11, textAlign: 'left', background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)', fontFamily: 'var(--f)' },
  tg: { fontFamily: 'var(--fm)', fontSize: 9.5, color: 'var(--muted)', flexShrink: 0 },
  tt: { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  mais: { background: 'none', border: 0, padding: '0 0 0 4px', color: 'var(--muted)', fontSize: 10.5, textAlign: 'left' },
  legItem: { display: 'inline-flex', alignItems: 'center', gap: 6 },
  legTag: { fontFamily: 'var(--fm)', fontSize: 9.5, padding: '1px 5px', borderRadius: 5, background: 'var(--c-dim)', border: '1px solid var(--c-border)', color: 'var(--c)' },
  cardH: { display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, padding: '0 10px 4px' },
  cardT: { fontSize: 14, fontWeight: 500 },
  vazio: { margin: '10px', fontSize: 12.5, color: 'var(--muted)' },
  lnk: { background: 'none', border: 0, padding: 0, color: 'var(--text)', fontSize: 12.5, textAlign: 'left', fontFamily: 'var(--f)' },
};
