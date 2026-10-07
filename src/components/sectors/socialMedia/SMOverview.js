import React, { useState } from 'react';
import { AlertTriangle, Eye, MessageSquare, Plus } from 'lucide-react';
import { POST_STATUS, POST_FORMATOS } from '../../../lib/firebase';
import { DOC_STATUS } from '../../../hooks/useDocuments';
import { isTaskOverdue } from '../../../hooks/useClientHealth';
import { mesChave, somaMeses, rotuloMes } from '../../../lib/entregas';
import {
  itensDosPlanos, statusDoPost, statusEfetivo, rotuloStatus, statusDoPlano, contaAprovados,
  comentarioDoPost, mesDoISO, hojeISO, dataLonga, dataCurta, nomeDoMes, PLANO_STATUS,
} from '../../../lib/planejamento';
import { KpiFiltro, Linha, Pill, Sigla, MiniCalendario, Dot } from '../../planejamento/kit';

// ─────────────────────────────────────────────────────────────
// Visão Geral da Social Media
//
// Desde out/2026 o centro é o calendário de conteúdo: o que atrasou, o
// que está com o cliente no link de aprovação e o que ele pediu para
// ajustar. Os KPIs filtram a lista logo abaixo. Documentos, tasks e
// clientes sem base de cálculo continuam aqui, na coluna lateral e
// no fim da página.
// ─────────────────────────────────────────────────────────────

const saudacao = () => {
  const h = new Date().getHours();
  return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
};

export default function SMOverview({ me, myClients, myDocs, myTasks, planos, onNavigate, onAbrirPost, onAbrirPlano, onAbrirCalendario }) {
  const [filtro, setFiltro] = useState('cliente');
  const agora = new Date();
  const hoje = hojeISO();
  const mes = mesChave();
  const proximo = somaMeses(mes, 1);

  const itens = itensDosPlanos(planos);
  const comSt = itens.map((it) => ({ ...it, st: statusDoPost(it.post, it.plano), ef: statusEfetivo(it.post, it.plano, agora) }));
  const doMes = comSt.filter(({ post }) => mesDoISO(post.data) === mes);
  const atrasados = comSt.filter((x) => x.ef === 'atrasado');
  const comCliente = comSt.filter((x) => x.st === 'cliente');
  const ajustes = comSt.filter((x) => x.st === 'ajuste');
  const deHoje = comSt.filter(({ post }) => post.data === hoje);
  const publicados = doMes.filter((x) => x.st === 'publicado').length;

  const FILTROS = {
    atrasado: { label: 'Atrasados', lista: atrasados },
    cliente: { label: 'Com o cliente', lista: comCliente },
    ajuste: { label: 'Ajustes pedidos pelo cliente', lista: ajustes },
  };
  const fl = FILTROS[filtro] || FILTROS.cliente;

  // Rotina fora do conteúdo (o que a visão geral antiga media).
  const docsAbertos = myDocs.filter((d) => d.status === 'rascunho' || d.status === 'revisao');
  const tasksAbertas = myTasks.filter((t) => t.status !== 'done');
  const tasksAtrasadas = tasksAbertas.filter((t) => isTaskOverdue(t, agora)).length;
  const tasksAprovacao = myTasks.filter((t) => t.status === 'approval').length;
  const semBase = myClients.filter((c) => !c.sm?.baseCalculo);

  const primeiroNome = String(me || '').split(' ')[0];
  const contaFmt = (f) => {
    const l = doMes.filter(({ post }) => f(post));
    return { feitos: l.filter((x) => x.st === 'publicado').length, total: l.length };
  };
  const stats = [
    ['posts de feed', contaFmt((p) => p.fmt === 'feed' || p.fmt === 'car')],
    ['reels', contaFmt((p) => p.fmt === 'reel')],
    ['stories', contaFmt((p) => p.fmt === 'story')],
  ];

  return (
    <div className="fade-up">
      <div style={{ marginBottom: 18 }}>
        <h1 style={S.h1}>{saudacao()}{primeiroNome ? `, ${primeiroNome}` : ''}</h1>
        <p style={S.sub}>
          {dataLonga(hoje)} · {deHoje.length} {deHoje.length === 1 ? 'publicação sai' : 'publicações saem'} hoje · {comCliente.length + ajustes.length} {comCliente.length + ajustes.length === 1 ? 'post esperando' : 'posts esperando'} resposta de cliente.
        </p>
      </div>

      <div style={S.cols}>
        <div style={S.main}>
          <div style={S.kpis}>
            <KpiFiltro label="Atrasados" nota="A data já passou" valor={atrasados.length} unidade="posts" cor="var(--red)" Icon={AlertTriangle} on={filtro === 'atrasado'} onClick={() => setFiltro('atrasado')} />
            <KpiFiltro label="Com o cliente" nota="Aguardando aprovação no link" valor={comCliente.length} unidade="posts" cor="var(--amber)" Icon={Eye} on={filtro === 'cliente'} onClick={() => setFiltro('cliente')} />
            <KpiFiltro label="Ajustes pedidos" nota="O cliente comentou" valor={ajustes.length} unidade="posts" cor="var(--purple)" Icon={MessageSquare} on={filtro === 'ajuste'} onClick={() => setFiltro('ajuste')} />
            <KpiFiltro label={`Publicados em ${nomeDoMes(mes)}`} nota={`De ${doMes.length} no planejamento`} valor={publicados} unidade={`/ ${doMes.length}`} cor="var(--green)" ring={doMes.length ? publicados / doMes.length : 0} />
          </div>

          <div className="ui-card" style={{ padding: '14px 10px 8px' }}>
            <div style={S.cardH}><b style={S.cardT}>{fl.label}</b><span style={S.cardS}>clique para abrir o post</span></div>
            {fl.lista.map(({ plano, post, st }, i) => {
              const coment = comentarioDoPost(post, plano);
              return (
                <Linha
                  key={post.id}
                  primeira={i === 0}
                  onClick={() => onAbrirPost(plano.id, post.id)}
                  left={<Sigla>{POST_FORMATOS[post.fmt]?.tag}</Sigla>}
                  title={post.titulo || 'Sem tema'}
                  sub={`${plano.clientName}${coment ? ` · “${coment}”` : ''}`}
                  right={(
                    <>
                      <Pill def={POST_STATUS[st]} />
                      <span style={{ ...S.data, color: post.data < hoje ? 'var(--red)' : 'var(--muted)' }}>{dataCurta(post.data)}</span>
                    </>
                  )}
                />
              );
            })}
            {!fl.lista.length && <p style={S.vazio}>Nada aqui.</p>}
          </div>

          <div className="ui-card" style={{ padding: '14px 10px 8px' }}>
            <div style={S.cardH}>
              <b style={S.cardT}>Planejamentos de {nomeDoMes(proximo)}</b>
              <button type="button" style={S.lnk} onClick={() => onNavigate('planejamentos')}>Ver todos</button>
            </div>
            {myClients.map((c, i) => {
              const pl = planos.find((p) => p.clientId === c.id && p.mes === proximo);
              const n = (pl?.posts || []).length;
              return (
                <Linha
                  key={c.id}
                  primeira={i === 0}
                  title={c.name}
                  sub={pl ? `${contaAprovados(pl)} de ${n} posts aprovados` : 'Ainda não criado'}
                  right={pl ? (
                    <>
                      <Pill def={PLANO_STATUS[statusDoPlano(pl)]} />
                      <button type="button" className="ui-btn" style={S.btnP} onClick={() => onAbrirPlano(pl.id)}>Abrir</button>
                    </>
                  ) : (
                    <button type="button" className="ui-btn" style={S.btnP} onClick={() => onNavigate('planejamentos')}><Plus size={14} strokeWidth={2.2} />Criar</button>
                  )}
                />
              );
            })}
            {!myClients.length && <p style={S.vazio}>Nenhum cliente na carteira.</p>}
          </div>

          {docsAbertos.length > 0 && (
            <div className="ui-card" style={{ padding: '14px 10px 8px' }}>
              <div style={S.cardH}>
                <b style={S.cardT}>Documentos em aberto</b>
                <button type="button" style={S.lnk} onClick={() => onNavigate('documentos')}>Ver todos</button>
              </div>
              {docsAbertos.slice(0, 6).map((d, i) => {
                const st = DOC_STATUS[d.status] || DOC_STATUS.rascunho;
                return (
                  <Linha
                    key={d.id}
                    primeira={i === 0}
                    onClick={() => onNavigate('documentos')}
                    title={d.clientName || 'Sem cliente'}
                    sub={d.updatedByName ? `última edição por ${d.updatedByName}` : 'sem edições'}
                    right={<span style={{ ...S.docChip, color: st.color, borderColor: `color-mix(in srgb, ${st.color} 27%, transparent)` }}>{st.label}</span>}
                  />
                );
              })}
            </div>
          )}

          {semBase.length > 0 && (
            <div className="ui-card" style={{ borderColor: 'var(--amber-b)', background: 'var(--amber-dim)' }}>
              <b style={{ ...S.cardT, color: 'var(--amber)', display: 'block', marginBottom: 8 }}>Clientes sem base de cálculo</b>
              <p style={{ fontSize: 12.5, color: 'var(--text)', lineHeight: 1.55, marginBottom: 10 }}>
                Sem a base travada, o engajamento de um mês não pode ser comparado com o do mês
                anterior. Ela é definida na pré-estratégia e vale para todos os relatórios seguintes.
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {semBase.map((c) => <span key={c.id} style={S.tag}>{c.name}</span>)}
              </div>
            </div>
          )}
        </div>

        <div style={S.side}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
            {stats.map(([rot, { feitos, total }]) => (
              <div key={rot} className="ui-card" style={{ padding: 12, borderRadius: 14 }}>
                <div style={{ fontSize: 18, fontWeight: 500, lineHeight: 1 }}>{feitos}<span style={{ fontFamily: 'var(--fm)', fontSize: 11, color: 'var(--muted)', fontWeight: 400 }}> /{total}</span></div>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 6 }}>{rot}</div>
              </div>
            ))}
          </div>

          <div className="ui-card" style={{ padding: 16 }}>
            <div style={{ ...S.cardH, padding: '0 0 8px' }}>
              <b style={S.cardT}>{rotuloMes(mes, true).replace(' de ', ' ')}</b>
              <button type="button" style={S.lnk} onClick={() => onAbrirCalendario(hoje)}>Abrir calendário</button>
            </div>
            <MiniCalendario
              mes={mes}
              hoje={hoje}
              contar={(iso) => comSt.filter(({ post }) => post.data === iso).length}
              estado={(iso) => {
                const l = comSt.filter(({ post }) => post.data === iso);
                if (!l.length) return null;
                return l.every((x) => x.st === 'publicado') ? 'ok' : 'ruim';
              }}
              onDia={onAbrirCalendario}
              legenda={(
                <>
                  <span style={S.leg}><Dot def={{ cor: 'var(--green)' }} />Tudo publicado</span>
                  <span style={S.leg}><Dot def={{ cor: 'var(--red)' }} />Atrasou</span>
                  <span style={S.leg}><Dot def={{ cor: 'var(--c)' }} />Hoje</span>
                  <span style={S.leg}><Dot def={{ cor: 'var(--muted)' }} size={4} />Tem post</span>
                </>
              )}
            />
          </div>

          <div className="ui-card" style={{ padding: '16px 10px 8px' }}>
            <div style={S.cardH}><b style={S.cardT}>Publicações de hoje</b><span style={{ ...S.cardS, fontFamily: 'var(--fm)' }}>{deHoje.length}</span></div>
            {deHoje.map(({ plano, post, ef }, i) => {
              const def = POST_STATUS[ef];
              return (
                <Linha
                  key={post.id}
                  primeira={i === 0}
                  onClick={() => onAbrirPost(plano.id, post.id)}
                  left={<Sigla style={{ color: def.cor, background: `color-mix(in srgb, ${def.cor} 12%, transparent)`, borderColor: `color-mix(in srgb, ${def.cor} 30%, transparent)` }}>{POST_FORMATOS[post.fmt]?.tag}</Sigla>}
                  title={post.titulo || 'Sem tema'}
                  sub={`${plano.clientName} · ${rotuloStatus(post, plano, agora)}`}
                />
              );
            })}
            {!deHoje.length && <p style={S.vazio}>Nada sai hoje.</p>}
          </div>

          <div className="ui-card" style={{ padding: '16px 10px 8px' }}>
            <div style={S.cardH}><b style={S.cardT}>Rotina</b></div>
            <Linha primeira onClick={() => onNavigate('mural')} left={<Sigla>CLI</Sigla>} title="Clientes na carteira" right={<b style={S.num}>{myClients.length}</b>} />
            <Linha onClick={() => onNavigate('documentos')} left={<Sigla>DOC</Sigla>} title="Documentos em produção" right={<b style={S.num}>{docsAbertos.length}</b>} />
            <Linha onClick={() => onNavigate('kanban')} left={<Sigla>TASK</Sigla>} title="Tasks em aprovação" right={<b style={{ ...S.num, color: tasksAprovacao ? 'var(--amber)' : 'var(--text)' }}>{tasksAprovacao}</b>} />
            <Linha onClick={() => onNavigate('kanban')} left={<Sigla>TASK</Sigla>} title="Tasks atrasadas" right={<b style={{ ...S.num, color: tasksAtrasadas ? 'var(--red)' : 'var(--text)' }}>{tasksAtrasadas}</b>} />
          </div>
        </div>
      </div>
    </div>
  );
}

const S = {
  h1: { fontSize: 21, fontWeight: 500, color: 'var(--text)', letterSpacing: '-.01em' },
  sub: { fontSize: 13, color: 'var(--muted)', marginTop: 4 },
  cols: { display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'flex-start' },
  main: { flex: '999 1 620px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 14 },
  side: { flex: '1 1 300px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 14 },
  kpis: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14 },
  cardH: { display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, padding: '2px 10px 6px' },
  cardT: { fontSize: 14, fontWeight: 500, color: 'var(--text)' },
  cardS: { fontSize: 11, color: 'var(--muted)' },
  lnk: { background: 'none', border: 0, padding: 0, color: 'var(--muted)', fontSize: 11.5 },
  vazio: { margin: '6px 10px 12px', color: 'var(--muted)', fontSize: 12.5 },
  data: { width: 96, textAlign: 'right', fontSize: 11, flexShrink: 0, fontFamily: 'var(--fm)' },
  btnP: { height: 30, padding: '0 11px', fontSize: 12 },
  leg: { display: 'inline-flex', alignItems: 'center', gap: 6 },
  num: { fontFamily: 'var(--fm)', fontSize: 13, fontWeight: 500, color: 'var(--text)' },
  docChip: { fontSize: 9.5, fontWeight: 600, letterSpacing: '.07em', textTransform: 'uppercase', border: '1px solid', borderRadius: 100, padding: '3px 8px', flexShrink: 0 },
  tag: { fontSize: 11.5, color: 'var(--text)', background: 'var(--soft)', border: '1px solid var(--border)', borderRadius: 100, padding: '4px 11px' },
};
