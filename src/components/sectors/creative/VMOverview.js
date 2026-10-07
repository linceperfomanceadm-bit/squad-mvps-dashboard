import React from 'react';
import { Clapperboard, CalendarDays, AlertTriangle, Check, Plus } from 'lucide-react';
import { POST_STATUS, VIDEO_STATUS, MARCACAO_TIPOS } from '../../../lib/firebase';
import { asArray } from '../../../lib/wdJobs';
import { isTaskOverdue } from '../../../hooks/useClientHealth';
import { mesChave, rotuloMes } from '../../../lib/entregas';
import {
  itensDosPlanos, statusDoPost, statusDoVideo, prazoVideo, mesDoISO, hojeISO,
  dataLonga, dataCurta, nomeDoMes,
} from '../../../lib/planejamento';
import { KpiFiltro, Linha, Pill, Sigla, siglaDe, MiniCalendario, Dot } from '../../planejamento/kit';

// ─────────────────────────────────────────────────────────────
// Visão Geral do Videomaker
//
// Nasceu da dor do time: "não sei o que tenho para produzir no mês".
// A fila sai dos planejamentos das Socials — só reels dos clientes em
// que a pessoa está escalada — ordenada pelo prazo do vídeo
// (VIDEO_PRAZO_DIAS_UTEIS antes da publicação). Reel que o cliente
// ainda não aprovou aparece separado, em "Chegando".
// ─────────────────────────────────────────────────────────────

const saudacao = () => {
  const h = new Date().getHours();
  return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
};
const ddmm = (iso) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : '—');

export default function VMOverview({ me, clientes, planos, marcacoes, myTasks, onNavigate, onAbrirPost, onAbrirMarcacao, onNovaMarcacao, onAbrirCalendario }) {
  const agora = new Date();
  const hoje = hojeISO();
  const mes = mesChave();

  const reels = itensDosPlanos(planos, { soReels: true }).map((it) => ({ ...it, vs: statusDoVideo(it.post, it.plano, agora) }));
  const porPrazo = (a, b) => String(prazoVideo(a.post)).localeCompare(String(prazoVideo(b.post)));
  const fila = reels.filter((x) => ['produzir', 'perto', 'atrasado'].includes(x.vs)).sort(porPrazo);
  const aguardando = reels.filter((x) => x.vs === 'aguarda');
  const atrasados = reels.filter((x) => x.vs === 'atrasado');
  const entregues = reels.filter((x) => x.vs === 'entregue' && mesDoISO(x.post.data) === mes).length;
  const futuras = marcacoes.filter((m) => m.data >= hoje).sort((a, b) => `${a.data} ${a.hora}`.localeCompare(`${b.data} ${b.hora}`));
  const captacoes = futuras.filter((m) => m.tipo === 'cap');
  const social = (clientId) => asArray(clientes.find((c) => c.id === clientId)?.responsibles?.socialmedia).join(', ') || '—';

  const tasksAprovacao = myTasks.filter((t) => t.status === 'approval' && t.responsibleName === me).length;
  const tasksAtrasadas = myTasks.filter((t) => t.status !== 'done' && isTaskOverdue(t, agora)).length;

  const visiveis = reels.filter((x) => x.vs !== 'aguarda');
  const primeiroNome = String(me || '').split(' ')[0];

  return (
    <div className="fade-up">
      <div style={{ marginBottom: 18, display: 'flex', gap: 14, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div>
          <h1 style={S.h1}>{saudacao()}{primeiroNome ? `, ${primeiroNome}` : ''}</h1>
          <p style={S.sub}>
            {dataLonga(hoje)} · {fila.length} {fila.length === 1 ? 'vídeo aprovado' : 'vídeos aprovados'} para produzir · {aguardando.length} esperando o cliente aprovar.
          </p>
        </div>
        <button type="button" className="ui-btn primary" style={{ marginLeft: 'auto' }} onClick={() => onNovaMarcacao(hoje)}><Plus size={15} strokeWidth={2.2} />Nova marcação</button>
      </div>

      <div style={S.cols}>
        <div style={S.main}>
          <div style={S.kpis}>
            <KpiFiltro label="Para produzir" nota="Aprovados pelos clientes" valor={fila.length} unidade="reels" cor="var(--blue)" Icon={Clapperboard} />
            <KpiFiltro label="Captações marcadas" nota="De hoje em diante" valor={captacoes.length} unidade="na agenda" cor="var(--c)" Icon={CalendarDays} />
            <KpiFiltro label="Vídeos atrasados" nota="Prazo de entrega passou" valor={atrasados.length} unidade="reels" cor={atrasados.length ? 'var(--red)' : 'var(--text)'} Icon={AlertTriangle} />
            <KpiFiltro label={`Entregues em ${nomeDoMes(mes)}`} nota="Vídeos editados enviados" valor={entregues} unidade="reels" cor="var(--green)" Icon={Check} />
          </div>

          <div className="ui-card" style={{ padding: '14px 10px 8px' }}>
            <div style={S.cardH}><b style={S.cardT}>Fila de produção</b><span style={S.cardS}>por prazo de entrega</span></div>
            {fila.slice(0, 8).map(({ plano, post, vs }, i) => (
              <Linha
                key={post.id}
                primeira={i === 0}
                onClick={() => onAbrirPost(plano.id, post.id)}
                left={<Sigla>{siglaDe(plano.clientName)}</Sigla>}
                title={post.titulo || 'Sem tema'}
                sub={`${plano.clientName} · publica ${dataCurta(post.data)} · Social: ${social(plano.clientId)}`}
                right={(
                  <>
                    <Pill def={VIDEO_STATUS[vs]} />
                    <span style={{ ...S.data, color: VIDEO_STATUS[vs].cor }}>até {ddmm(prazoVideo(post))}</span>
                  </>
                )}
              />
            ))}
            {!fila.length && <p style={S.vazio}>Nenhum vídeo aprovado esperando você.</p>}
            {fila.length > 8 && <button type="button" style={{ ...S.lnk, margin: '6px 10px 8px' }} onClick={() => onAbrirCalendario(hoje)}>Ver os outros {fila.length - 8} no calendário</button>}
          </div>

          {aguardando.length > 0 && (
            <div className="ui-card" style={{ padding: '14px 10px 8px' }}>
              <div style={S.cardH}><b style={S.cardT}>Chegando · esperando aprovação do cliente</b><span style={S.cardS}>ainda não produzir</span></div>
              {aguardando.map(({ plano, post }, i) => (
                <Linha
                  key={post.id}
                  primeira={i === 0}
                  onClick={() => onAbrirPost(plano.id, post.id)}
                  left={<Sigla>{siglaDe(plano.clientName)}</Sigla>}
                  title={post.titulo || 'Sem tema'}
                  sub={`${plano.clientName} · ${dataCurta(post.data)}`}
                  right={<Pill def={POST_STATUS[statusDoPost(post, plano)]} />}
                />
              ))}
            </div>
          )}
        </div>

        <div style={S.side}>
          <div className="ui-card" style={{ padding: 16 }}>
            <div style={{ ...S.cardH, padding: '0 0 8px' }}>
              <b style={S.cardT}>{rotuloMes(mes, true).replace(' de ', ' ')}</b>
              <button type="button" style={S.lnk} onClick={() => onAbrirCalendario(hoje)}>Abrir calendário</button>
            </div>
            <MiniCalendario
              mes={mes}
              hoje={hoje}
              contar={(iso) => visiveis.filter(({ post }) => post.data === iso).length + marcacoes.filter((m) => m.data === iso).length}
              onDia={onAbrirCalendario}
              legenda={(
                <>
                  <span style={S.leg}><Dot def={{ cor: 'var(--c)' }} />Hoje</span>
                  <span style={S.leg}><Dot def={{ cor: 'var(--muted)' }} size={4} />Reel ou marcação</span>
                </>
              )}
            />
          </div>

          <div className="ui-card" style={{ padding: '16px 10px 8px' }}>
            <div style={S.cardH}><b style={S.cardT}>Próximas marcações</b><span style={{ ...S.cardS, fontFamily: 'var(--fm)' }}>{captacoes.length} {captacoes.length === 1 ? 'captação' : 'captações'}</span></div>
            {futuras.slice(0, 5).map((m, i) => (
              <Linha
                key={m.id}
                primeira={i === 0}
                onClick={() => onAbrirMarcacao(m)}
                left={(
                  <span style={S.diaBox}>
                    <span style={{ display: 'block', fontFamily: 'var(--fm)', fontSize: 14, fontWeight: 500 }}>{m.data.slice(8, 10)}</span>
                    <span style={{ display: 'block', fontFamily: 'var(--fm)', fontSize: 9, color: 'var(--muted)' }}>{dataCurta(m.data).slice(0, 3).toUpperCase()}</span>
                  </span>
                )}
                title={`${MARCACAO_TIPOS[m.tipo]?.label || 'Marcação'}${m.clientName ? ` · ${m.clientName}` : ' · interno'}`}
                sub={`${m.hora}${m.obs ? ` · ${m.obs}` : ''}`}
              />
            ))}
            {!futuras.length && <p style={S.vazio}>Nenhuma marcação.</p>}
          </div>

          <div className="ui-card" style={{ padding: '16px 10px 8px' }}>
            <div style={S.cardH}><b style={S.cardT}>Rotina</b></div>
            <Linha primeira onClick={() => onNavigate('kanban')} left={<Sigla>TASK</Sigla>} title="Tasks em aprovação" right={<b style={{ ...S.num, color: tasksAprovacao ? 'var(--amber)' : 'var(--text)' }}>{tasksAprovacao}</b>} />
            <Linha onClick={() => onNavigate('kanban')} left={<Sigla>TASK</Sigla>} title="Tasks atrasadas" right={<b style={{ ...S.num, color: tasksAtrasadas ? 'var(--red)' : 'var(--text)' }}>{tasksAtrasadas}</b>} />
            <Linha onClick={() => onNavigate('entregas')} left={<Sigla>CLI</Sigla>} title="Clientes em que você está escalado" right={<b style={S.num}>{clientes.length}</b>} />
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
  data: { width: 104, textAlign: 'right', fontSize: 11, flexShrink: 0, fontFamily: 'var(--fm)' },
  leg: { display: 'inline-flex', alignItems: 'center', gap: 6 },
  num: { fontFamily: 'var(--fm)', fontSize: 13, fontWeight: 500, color: 'var(--text)' },
  diaBox: { width: 42, flexShrink: 0, textAlign: 'center', padding: '5px 0', borderRadius: 10, background: 'var(--c-dim)', border: '1px solid var(--c-border)', color: 'var(--text)' },
};
