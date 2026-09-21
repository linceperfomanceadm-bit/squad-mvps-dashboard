import React, { useMemo, useState } from 'react';
import { ArrowLeftRight, HeartPulse, Hourglass, CalendarClock, AlarmClock, Check } from 'lucide-react';
import {
  stageOf, contractState, REQUEST_SLA_HOURS, FLUXO_PARADO_DIAS, CLIENT_STAGES,
} from '../../lib/firebase';
import { businessMsBetween } from '../../lib/taskTime';
import {
  mesChave, rotuloMes, entregasDoMes, resumoMes, cadastroPendencias, saudeDesatualizada,
} from '../../lib/entregas';
import { computeOpsHealth, resolveClientHealth, isCritical, HEALTH_LEVELS_4 } from '../../hooks/useClientHealth';
import { PageHeader, Grid, Kpi, Card, Tag, Empty, Breakdown } from '../shared/ui';
import { Overlay, ModalHeader, MODAL, LBL } from './ui';
import { Aderencia } from '../entregas/EntregasKit';
import ClienteFicha from '../entregas/ClienteFicha';

const asArray = (v) => (Array.isArray(v) ? v : v ? [v] : []);
const EM_FLUXO = ['kickoff', 'staffing', 'onboarding'];
const DIA = 86400000;

const toDate = (v) => {
  if (!v) return null;
  if (typeof v?.toDate === 'function') return v.toDate();
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
};

// Solicitação aberta que já passou do SLA da urgência (tempo útil).
const slaEstourado = (r) => {
  if (r.status !== 'open' || !r.createdAt) return false;
  const lim = (REQUEST_SLA_HOURS[r.urgency] || REQUEST_SLA_HOURS.medium) * 3600000;
  return businessMsBetween(toDate(r.createdAt), new Date()) > lim;
};

const ABAS = [
  { id: 'saude',    label: 'Saúde desatualizada', icon: HeartPulse },
  { id: 'fluxo',    label: 'Fluxo parado',        icon: Hourglass },
  { id: 'contrato', label: 'Contratos vencendo',  icon: CalendarClock },
  { id: 'sla',      label: 'SLA estourado',       icon: AlarmClock },
];

/*
 * GESTÃO DO TIME DE CS — painel do líder da CS (que é o líder do
 * comercial). Entra pelo mesmo acesso da CS; aparece para quem lidera
 * o setor CS (`leaderOf` inclui 'cs') e para o admin.
 *
 * Responde três perguntas:
 *   1. Como está a carteira de cada CS (tamanho, saúde, contratos,
 *      entregas do mês)?
 *   2. Onde alguém está deixando a bola cair (saúde sem revisão,
 *      cliente parado no fluxo, contrato vencendo, SLA estourado)?
 *   3. Preciso redistribuir? — transferir clientes entre CSs.
 */
export default function CSLiderPanel({ clients, tasks, requests, collaborators, acoes, onTransferir, toast }) {
  const mes = mesChave();
  const [aba, setAba] = useState('saude');
  const [fichaId, setFichaId] = useState(null);
  const [transferir, setTransferir] = useState(null); // nome da CS de origem

  const base = useMemo(() => clients.filter(c => c.active !== false && stageOf(c) === 'live'), [clients]);
  const fluxo = useMemo(() => clients.filter(c => EM_FLUXO.includes(stageOf(c))), [clients]);

  // CSs = colaboradores ativos do setor + nomes que ainda aparecem em
  // clientes (quem saiu do time continua visível até ser transferido).
  const nomesCs = useMemo(() => {
    const set = new Set(collaborators.filter(c => c.active !== false && c.sector === 'cs').map(c => c.name));
    clients.forEach(c => asArray(c.responsibles?.cs).forEach(n => set.add(n)));
    return [...set].filter(Boolean).sort((a, b) => a.localeCompare(b));
  }, [collaborators, clients]);

  const ativos = useMemo(
    () => new Set(collaborators.filter(c => c.active !== false && c.sector === 'cs').map(c => c.name)),
    [collaborators]
  );

  const porCs = useMemo(() => nomesCs.map(nome => {
    const carteira = base.filter(c => asArray(c.responsibles?.cs).includes(nome));
    const emFluxo = fluxo.filter(c => asArray(c.responsibles?.cs).includes(nome));
    const ops = { green: 0, yellow: 0, orange: 0, red: 0 };
    carteira.forEach(c => { ops[computeOpsHealth(c.id, tasks).level] += 1; });
    const itens = carteira.flatMap(c => entregasDoMes(c, mes));
    const reqs = requests.filter(r => r.createdBy === nome);

    // Tempo médio do cadastro até a entrada na base, nos últimos 90 dias.
    const noventa = Date.now() - 90 * DIA;
    const duracoes = carteira
      .map(c => {
        const ini = toDate(c.createdAt);
        const fim = toDate(c.kickoff?.confirmedAt);
        return ini && fim && fim.getTime() >= noventa ? (fim - ini) / DIA : null;
      })
      .filter(v => v != null && v >= 0);

    return {
      nome,
      ativo: ativos.has(nome),
      carteira,
      emFluxo,
      ops,
      criticos: carteira.filter(c => isCritical(c, tasks)).length,
      saudeVelha: carteira.filter(c => saudeDesatualizada(c)).length,
      vencendo: carteira.filter(c => ['ending', 'expired'].includes(contractState(c).status)).length,
      incompletos: carteira.filter(c => cadastroPendencias(c).length).length,
      entregas: resumoMes(itens),
      reqAbertas: reqs.filter(r => r.status === 'open').length,
      reqEstouradas: reqs.filter(slaEstourado).length,
      reqParaEncerrar: reqs.filter(r => r.status === 'answered').length,
      tempoMedio: duracoes.length ? Math.round(duracoes.reduce((s, v) => s + v, 0) / duracoes.length) : null,
    };
  }), [nomesCs, ativos, base, fluxo, tasks, requests, mes]);

  const totais = useMemo(() => {
    const itens = base.flatMap(c => entregasDoMes(c, mes));
    return {
      ativos: base.length,
      semCs: base.filter(c => asArray(c.responsibles?.cs).length === 0).length,
      criticos: base.filter(c => isCritical(c, tasks)).length,
      vencendo: base.filter(c => ['ending', 'expired'].includes(contractState(c).status)).length,
      incompletos: base.filter(c => cadastroPendencias(c).length).length,
      entregas: resumoMes(itens),
    };
  }, [base, tasks, mes]);

  // ── Pontos de atenção ──────────────────────────────────────
  const listas = useMemo(() => ({
    saude: base
      .filter(c => saudeDesatualizada(c))
      .map(c => {
        const h = resolveClientHealth(c);
        const dias = h.at ? Math.floor((Date.now() - new Date(h.at).getTime()) / DIA) : null;
        return { id: c.id, client: c, titulo: c.name, sub: dias == null ? 'Nunca avaliado' : `Última avaliação há ${dias} dias${h.by ? ` · ${h.by}` : ''}` };
      }),
    fluxo: fluxo
      .map(c => ({ c, dias: toDate(c.createdAt) ? Math.floor((Date.now() - toDate(c.createdAt).getTime()) / DIA) : null }))
      .filter(x => x.dias != null && x.dias >= FLUXO_PARADO_DIAS)
      .sort((a, b) => b.dias - a.dias)
      .map(({ c, dias }) => ({
        id: c.id, client: null, titulo: c.name,
        sub: `${CLIENT_STAGES[stageOf(c)]?.label || stageOf(c)} · há ${dias} dias desde o cadastro`,
      })),
    contrato: base
      .map(c => ({ c, st: contractState(c) }))
      .filter(x => ['ending', 'expired'].includes(x.st.status))
      .sort((a, b) => (a.st.daysLeft ?? 0) - (b.st.daysLeft ?? 0))
      .map(({ c, st }) => ({
        id: c.id, client: c, titulo: c.name,
        sub: st.daysLeft < 0 ? `Venceu há ${Math.abs(st.daysLeft)} dias` : st.daysLeft === 0 ? 'Vence hoje' : `Vence em ${st.daysLeft} dias`,
      })),
    sla: requests
      .filter(slaEstourado)
      .map(r => ({
        id: r.id, client: null, titulo: r.subject || 'Solicitação',
        sub: `${r.clientName || '—'} · para ${r.toName || '—'} · aberta por ${r.createdBy || '—'}`,
      })),
  }), [base, fluxo, requests]);

  const linhasAba = listas[aba] || [];
  const ficha = fichaId ? clients.find(c => c.id === fichaId) : null;

  return (
    <div className="fade-up">
      <PageHeader title="Gestão do time" sub={`Carteira e desempenho das CSs · ${rotuloMes(mes, true)}`} />

      <Grid cols={3}>
        <Kpi value={totais.ativos} label="Clientes ativos na base" tone={undefined}>
          <Breakdown rows={[
            ['Sem CS definida', totais.semCs],
            ['Cadastro incompleto', totais.incompletos],
          ]} />
        </Kpi>
        <Kpi value={totais.criticos} label="Clientes críticos" tone={totais.criticos ? 'bad' : 'good'}>
          <Breakdown rows={[['Contratos vencendo em 30 dias', totais.vencendo]]} />
        </Kpi>
        <Kpi
          value={totais.entregas.pct == null ? '—' : `${totais.entregas.pct}%`}
          label="Entregue do combinado no mês"
          tone={totais.entregas.pct == null ? undefined : totais.entregas.pct >= 100 ? 'good' : totais.entregas.pct >= 70 ? 'warn' : 'bad'}
        >
          <Breakdown rows={[['Entregas', `${totais.entregas.entregue} de ${totais.entregas.combinado}`]]} />
        </Kpi>
      </Grid>

      {/* ── Por CS ─────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(320px,1fr))', gap: 14, marginBottom: 14 }}>
        {porCs.length === 0 && <Card><Empty>Nenhuma CS cadastrada.</Empty></Card>}
        {porCs.map(cs => {
          const total = cs.carteira.length;
          return (
            <Card
              key={cs.nome}
              title={cs.nome}
              sub={cs.ativo ? `${total} ${total === 1 ? 'cliente' : 'clientes'}` : 'fora do time'}
              right={total > 0 && (
                <button type="button" className="ui-btn small" onClick={() => setTransferir(cs.nome)} title="Transferir clientes desta CS">
                  <ArrowLeftRight size={13} /> Transferir
                </button>
              )}
            >
              {/* Farol operacional em uma barra empilhada */}
              <div style={{ display: 'flex', height: 8, borderRadius: 99, overflow: 'hidden', background: 'var(--soft)', margin: '12px 0 6px' }}>
                {['green', 'yellow', 'orange', 'red'].map(l => (
                  cs.ops[l] > 0 ? <i key={l} title={`${HEALTH_LEVELS_4[l].label}: ${cs.ops[l]}`} style={{ width: `${(cs.ops[l] / Math.max(1, total)) * 100}%`, background: HEALTH_LEVELS_4[l].color }} /> : null
                ))}
              </div>
              <p style={S.nota}>
                Farol operacional · {cs.ops.green} em dia · {cs.ops.yellow + cs.ops.orange} em atenção · {cs.ops.red} crítico{cs.ops.red === 1 ? '' : 's'}
              </p>

              <div style={{ marginTop: 14 }}>
                <Breakdown rows={[
                  ['Em onboarding (fluxo)', cs.emFluxo.length],
                  ['Críticos', cs.criticos],
                  ['Saúde sem revisão há +30 dias', cs.saudeVelha],
                  ['Contratos vencendo', cs.vencendo],
                  ['Cadastro incompleto', cs.incompletos],
                  ['Solicitações abertas', cs.reqEstouradas ? `${cs.reqAbertas} (${cs.reqEstouradas} fora do SLA)` : cs.reqAbertas],
                  ['Respondidas aguardando encerrar', cs.reqParaEncerrar],
                  ['Tempo médio até a base (90 dias)', cs.tempoMedio == null ? '—' : `${cs.tempoMedio} dias`],
                ]} />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
                <span style={{ ...S.nota, flex: 1 }}>
                  Entregas do mês na carteira
                  {cs.entregas.combinado ? ` · ${cs.entregas.entregue} de ${cs.entregas.combinado}` : ' · sem escopo'}
                </span>
                <Aderencia pct={cs.entregas.pct} />
              </div>
            </Card>
          );
        })}
      </div>

      {/* ── Pontos de atenção ──────────────────────── */}
      <Card title="Pontos de atenção" sub="o que precisa de cobrança agora">
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '10px 0 12px' }}>
          {ABAS.map(a => (
            <button key={a.id} type="button" className={`ui-btn small ${aba === a.id ? 'on' : ''}`} onClick={() => setAba(a.id)}>
              <a.icon size={13} /> {a.label}
              <span style={{ fontFamily: 'var(--fm)', fontSize: 11, color: listas[a.id].length ? 'var(--text)' : 'var(--dim)' }}>{listas[a.id].length}</span>
            </button>
          ))}
        </div>
        {linhasAba.length === 0 ? (
          <Empty>Nada por aqui. Tudo em dia neste ponto.</Empty>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {linhasAba.slice(0, 30).map(l => (
              <div
                key={l.id}
                onClick={l.client ? () => setFichaId(l.client.id) : undefined}
                style={{ ...S.linha, cursor: l.client ? 'pointer' : 'default' }}
              >
                <div style={{ minWidth: 0, flex: 1 }}>
                  <p style={S.titulo}>{l.titulo}</p>
                  <p style={S.nota}>{l.sub}</p>
                </div>
                {l.client && <Tag>CS: {asArray(l.client.responsibles?.cs).join(', ') || '—'}</Tag>}
              </div>
            ))}
            {linhasAba.length > 30 && <p style={S.nota}>e mais {linhasAba.length - 30}.</p>}
          </div>
        )}
      </Card>

      {ficha && <ClienteFicha client={ficha} acoes={acoes} toast={toast} onClose={() => setFichaId(null)} />}

      {transferir && (
        <TransferirModal
          de={transferir}
          carteira={base.filter(c => asArray(c.responsibles?.cs).includes(transferir))}
          destinos={[...ativos].filter(n => n !== transferir).sort((a, b) => a.localeCompare(b))}
          onClose={() => setTransferir(null)}
          onConfirm={async (ids, para) => {
            const r = await onTransferir(ids, transferir, para);
            if (r?.success) {
              toast(`${ids.length} ${ids.length === 1 ? 'cliente transferido' : 'clientes transferidos'} para ${para}.`);
              setTransferir(null);
            } else toast(r?.error || 'Não foi possível transferir.', 'e');
          }}
        />
      )}
    </div>
  );
}

// Escolher quais clientes da CS vão para quem.
function TransferirModal({ de, carteira, destinos, onClose, onConfirm }) {
  const [sel, setSel] = useState([]);
  const [para, setPara] = useState(destinos[0] || '');
  const [busy, setBusy] = useState(false);
  const toggle = (id) => setSel(s => (s.includes(id) ? s.filter(x => x !== id) : [...s, id]));
  const todos = sel.length === carteira.length;

  return (
    <Overlay onClose={onClose}>
      <div style={{ ...MODAL, maxWidth: 520 }}>
        <ModalHeader title={`Transferir clientes de ${de}`} onClose={onClose} />
        <p style={{ ...S.nota, marginBottom: 12, lineHeight: 1.5 }}>
          Os clientes escolhidos passam para a outra CS. Se o cliente for dividido com mais alguém, essa pessoa continua nele.
        </p>

        <p style={LBL}>PARA</p>
        {destinos.length === 0 ? (
          <p style={{ ...S.nota, marginTop: 6 }}>Não há outra CS ativa para receber.</p>
        ) : (
          <select value={para} onChange={e => setPara(e.target.value)} style={{ width: '100%', marginTop: 6, marginBottom: 14 }}>
            {destinos.map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        )}

        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 6 }}>
          <p style={{ ...LBL, flex: 1 }}>CLIENTES ({sel.length} DE {carteira.length})</p>
          <button type="button" className="ui-btn small" onClick={() => setSel(todos ? [] : carteira.map(c => c.id))}>
            {todos ? 'Limpar' : 'Selecionar todos'}
          </button>
        </div>
        <div style={{ maxHeight: 300, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
          {carteira.map(c => {
            const on = sel.includes(c.id);
            return (
              <button key={c.id} type="button" onClick={() => toggle(c.id)} style={{ ...S.linha, border: `1px solid ${on ? 'var(--c-border)' : 'transparent'}`, cursor: 'pointer', textAlign: 'left' }}>
                <span style={{ width: 18, height: 18, borderRadius: 5, border: '1px solid var(--border-h)', background: on ? 'var(--c)' : 'transparent', color: 'var(--on)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {on && <Check size={12} />}
                </span>
                <span style={{ ...S.titulo, flex: 1 }}>{c.name}</span>
              </button>
            );
          })}
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
          <button
            type="button"
            className="ui-btn primary"
            style={{ flex: 1, justifyContent: 'center' }}
            disabled={!sel.length || !para || busy}
            onClick={async () => { setBusy(true); await onConfirm(sel, para); setBusy(false); }}
          >
            {busy ? 'Transferindo...' : `Transferir ${sel.length || ''} para ${para || '—'}`}
          </button>
          <button type="button" className="ui-btn" onClick={onClose}>Cancelar</button>
        </div>
      </div>
    </Overlay>
  );
}

const S = {
  nota: { fontSize: 11.5, color: 'var(--muted)', lineHeight: 1.45 },
  linha: { display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 12, background: 'var(--bg3)', width: '100%' },
  titulo: { fontSize: 12.5, fontWeight: 500, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
};
