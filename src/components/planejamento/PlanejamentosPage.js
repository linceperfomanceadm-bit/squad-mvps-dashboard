import React, { useState } from 'react';
import { Plus, Eye } from 'lucide-react';
import { PageHeader } from '../shared/ui';
import { mesChave, somaMeses, rotuloMes } from '../../lib/entregas';
import { statusDoPlano, contaAprovados, linkAprovacao, nomeDoMes, PLANO_STATUS } from '../../lib/planejamento';
import { Pill, Barra, Janela, BotaoFechar, JANELA } from './kit';
import PlanejamentoEditor from './PlanejamentoEditor';

// ─────────────────────────────────────────────────────────────
// Planejamentos da social media
//
// Um card por cliente da carteira no mês que vem e no atual (com
// atalho para criar o que falta) e, abaixo, os meses anteriores que
// tiverem planejamento. Abrir um card troca a tela pelo editor.
// ─────────────────────────────────────────────────────────────

const MESES_ANTERIORES = 3;

export default function PlanejamentosPage({ clientes, planos, me, acoes, toast, aberto, onAbrir }) {
  const [novo, setNovo] = useState(null); // { clientId, mes }

  const plano = aberto ? planos.find((p) => p.id === aberto.id) : null;
  if (aberto && plano) {
    return (
      <PlanejamentoEditor
        key={plano.id}
        plano={plano}
        me={me}
        acoes={acoes}
        toast={toast}
        postInicial={aberto.postId}
        onVoltar={() => onAbrir(null)}
      />
    );
  }

  const atual = mesChave();
  const proximo = somaMeses(atual, 1);
  const planoDe = (clientId, mes) => planos.find((p) => p.clientId === clientId && p.mes === mes);

  const anteriores = Array.from({ length: MESES_ANTERIORES }, (_, i) => somaMeses(atual, -(i + 1)))
    .filter((m) => planos.some((p) => p.mes === m));

  const secao = (mes, comVazios) => {
    const cards = clientes
      .map((c) => ({ c, pl: planoDe(c.id, mes) }))
      .filter(({ pl }) => comVazios || pl);
    if (!cards.length) return null;
    return (
      <section key={mes}>
        <div style={S.mesH}>{rotuloMes(mes, true)}</div>
        <div style={S.grade}>
          {cards.map(({ c, pl }) => (pl ? (
            <CardPlano key={c.id} plano={pl} onAbrir={() => onAbrir({ id: pl.id })} />
          ) : (
            <div key={c.id} className="ui-card" style={{ ...S.card, borderStyle: 'dashed', background: 'transparent' }}>
              <div>
                <b style={{ fontSize: 15, fontWeight: 500 }}>{c.name}</b>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>Planejamento de {nomeDoMes(mes)} ainda não criado</div>
              </div>
              <button type="button" className="ui-btn primary" style={{ alignSelf: 'flex-start' }} onClick={() => setNovo({ clientId: c.id, mes })}>
                <Plus size={15} strokeWidth={2.2} />Criar planejamento
              </button>
            </div>
          )))}
        </div>
      </section>
    );
  };

  return (
    <div className="fade-up">
      <PageHeader
        title="Planejamentos"
        sub="Monte o mês de cada cliente e mande o link para aprovação"
        right={<button type="button" className="ui-btn primary" onClick={() => setNovo({ clientId: clientes[0]?.id || '', mes: proximo })}><Plus size={15} strokeWidth={2.2} />Novo planejamento</button>}
      />
      {!clientes.length ? (
        <p style={{ color: 'var(--muted)', fontSize: 13 }}>Você ainda não tem clientes na carteira.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
          {secao(proximo, true)}
          {secao(atual, true)}
          {anteriores.map((m) => secao(m, false))}
        </div>
      )}

      {novo && (
        <NovoPlanejamento
          clientes={clientes}
          inicial={novo}
          planoDe={planoDe}
          onClose={() => setNovo(null)}
          onAbrirExistente={(id) => { setNovo(null); onAbrir({ id }); }}
          onCriar={async (form) => {
            const cli = clientes.find((c) => c.id === form.clientId);
            const res = await acoes.criarPlano({ clientId: form.clientId, clientName: cli?.name, mes: form.mes }, me);
            if (!res.success) { toast(res.error, 'e'); return; }
            setNovo(null);
            onAbrir({ id: res.id, postId: res.postId });
          }}
        />
      )}
    </div>
  );
}

function CardPlano({ plano, onAbrir }) {
  const n = (plano.posts || []).length;
  const ap = contaAprovados(plano);
  const st = statusDoPlano(plano);
  const enviado = plano.enviadoEm ? new Date(plano.enviadoEm).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : null;
  return (
    <div className="ui-card" style={S.card}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' }}>
        <div style={{ minWidth: 0 }}>
          <b style={{ fontSize: 15, fontWeight: 500 }}>{plano.clientName}</b>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>{n} {n === 1 ? 'post' : 'posts'}{enviado ? ` · enviado em ${enviado}` : ''}</div>
        </div>
        <Pill def={PLANO_STATUS[st]} />
      </div>
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--muted)', marginBottom: 6 }}>
          <span>Aprovados pelo cliente</span>
          <span style={{ fontFamily: 'var(--fm)', color: 'var(--text)' }}>{ap}/{n}</span>
        </div>
        <Barra pct={n ? ap / n : 0} />
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button type="button" className="ui-btn primary" style={{ height: 30, padding: '0 12px', fontSize: 12 }} onClick={onAbrir}>Abrir</button>
        {plano.rodada > 0 && (
          <a className="ui-btn" style={{ height: 30, padding: '0 12px', fontSize: 12, textDecoration: 'none' }} href={linkAprovacao(plano.id)} target="_blank" rel="noreferrer">
            <Eye size={14} />Ver como o cliente
          </a>
        )}
      </div>
    </div>
  );
}

function NovoPlanejamento({ clientes, inicial, planoDe, onClose, onCriar, onAbrirExistente }) {
  const [form, setForm] = useState(inicial);
  const [busy, setBusy] = useState(false);
  const atual = mesChave();
  const meses = [atual, somaMeses(atual, 1), somaMeses(atual, 2)];
  const existente = form.clientId && planoDe(form.clientId, form.mes);

  return (
    <Janela onClose={onClose} largura={460} label="Novo planejamento">
      <div style={JANELA.h}>
        <h2 style={{ fontSize: 18, fontWeight: 500, flex: 1 }}>Novo planejamento</h2>
        <BotaoFechar onClick={onClose} />
      </div>
      <div style={JANELA.b}>
        <label>
          <span style={JANELA.lab}>Cliente</span>
          <select value={form.clientId} onChange={(e) => setForm((f) => ({ ...f, clientId: e.target.value }))} style={{ width: '100%' }}>
            {clientes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        <label>
          <span style={JANELA.lab}>Mês</span>
          <select value={form.mes} onChange={(e) => setForm((f) => ({ ...f, mes: e.target.value }))} style={{ width: '100%' }}>
            {meses.map((m) => <option key={m} value={m}>{rotuloMes(m, true)}</option>)}
          </select>
        </label>
        {existente && <p style={{ fontSize: 12, color: 'var(--amber)' }}>Esse cliente já tem planejamento nesse mês.</p>}
      </div>
      <div style={{ ...JANELA.f, justifyContent: 'flex-end' }}>
        <button type="button" className="ui-btn" onClick={onClose}>Cancelar</button>
        {existente ? (
          <button type="button" className="ui-btn primary" onClick={() => onAbrirExistente(existente.id)}>Abrir o existente</button>
        ) : (
          <button type="button" className="ui-btn primary" disabled={!form.clientId || busy} onClick={async () => { setBusy(true); await onCriar(form); setBusy(false); }}>
            {busy ? 'Criando…' : 'Criar e abrir'}
          </button>
        )}
      </div>
    </Janela>
  );
}

const S = {
  mesH: { fontSize: 12, color: 'var(--muted)', fontFamily: 'var(--fm)', letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: 10 },
  grade: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14 },
  card: { display: 'flex', flexDirection: 'column', gap: 12, color: 'var(--text)' },
};
