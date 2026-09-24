import React, { useMemo, useState } from 'react';
import { Search, FileText, AlertTriangle, Users } from 'lucide-react';
import { naCarteira, stageOf, contractState, CLIENT_STAGES } from '../../lib/firebase';
import { asArray } from '../../lib/wdJobs';
import { mesChave, rotuloMes, entregasDoSetor, resumoMes, acompanhaEntregas } from '../../lib/entregas';
import { computeOpsHealth, resolveClientHealth, HEALTH_LEVELS_4, HEALTH_ORDER_4 } from '../../hooks/useClientHealth';
import { PageHeader, Grid, Kpi, Card, Tag, Row, Empty, Breakdown } from '../shared/ui';
import { Aderencia } from '../entregas/EntregasKit';
import ClienteFicha from '../entregas/ClienteFicha';

/*
 * CARTEIRA DO SOCIAL MEDIA — visão do admin.
 *
 * Responde "quais clientes cada social media cuida e como eles
 * estão?". A carteira usa a MESMA regra do painel do Social Media
 * (`naCarteira` + `responsibles.socialmedia`), então o admin vê
 * exatamente o que a pessoa vê no Mural dela — inclusive o cliente
 * ainda em Kick Off/onboarding, que já é trabalho de pré-estratégia.
 *
 * Só leitura. Trocar o responsável continua no cadastro do cliente
 * (aba Clientes); clicar num cliente abre a ficha de contrato e
 * entregas, com as mesmas ações que o admin já tem nas Entregas.
 */

// Cor semântica do farol — variáveis em vez do hex de HEALTH_LEVELS_4,
// para funcionar nos dois temas.
const COR_NIVEL = { green: 'var(--green)', yellow: 'var(--amber)', orange: 'var(--orange)', red: 'var(--red)' };
const TOM_NIVEL = { green: 'good', yellow: 'warn', orange: 'warn', red: 'bad' };
const NIVEIS = ['green', 'yellow', 'orange', 'red'];

const DOC_ABERTO = ['rascunho', 'revisao'];

const FILTROS = [
  { id: 'todos',   label: 'Todos' },
  { id: 'atencao', label: 'Precisa de atenção' },
  { id: 'fluxo',   label: 'Em onboarding' },
  { id: 'semBase', label: 'Sem base de cálculo' },
];

/*
 * Cliente que contratou Social Media. Três fontes, da mais nova para a
 * mais antiga: setores exigidos no cadastro, serviços do contrato
 * (objetos `{ id }` no cadastro novo, ids soltos no antigo) e o escopo
 * mensal. Cliente antigo sem nada disso não entra na conta de "sem
 * social media" — não dá para cobrar o que não se sabe se foi vendido.
 */
const contrataSocialMedia = (c) => {
  if (asArray(c.staffing?.sectors).includes('socialmedia')) return true;
  const servicos = asArray(c.contrato?.servicos || c.services);
  if (servicos.some(s => (typeof s === 'string' ? s : s?.id) === 'social_media')) return true;
  return entregasDoSetor(c, 'socialmedia').length > 0;
};

export default function AdminCarteiraSM({ clients, collaborators, tasks, documents, acoes, toast }) {
  const mes = mesChave();
  const [sel, setSel] = useState(null);
  const [filtro, setFiltro] = useState('todos');
  const [busca, setBusca] = useState('');
  const [fichaId, setFichaId] = useState(null);

  const carteiraGeral = useMemo(() => clients.filter(c => naCarteira(c)), [clients]);

  const ativos = useMemo(
    () => new Set(collaborators.filter(c => c.active !== false && c.sector === 'socialmedia').map(c => c.name)),
    [collaborators]
  );

  // Social medias = time ativo + nomes que ainda aparecem em clientes
  // (quem saiu continua visível até o cliente ser redistribuído).
  const nomes = useMemo(() => {
    const set = new Set(ativos);
    carteiraGeral.forEach(c => asArray(c.responsibles?.socialmedia).forEach(n => set.add(n)));
    return [...set].filter(Boolean).sort((a, b) => a.localeCompare(b));
  }, [ativos, carteiraGeral]);

  // Uma linha por cliente, calculada uma vez só e reaproveitada nos
  // cards de resumo e na lista.
  const linhas = useMemo(() => {
    const mapa = new Map();
    carteiraGeral.forEach(c => {
      if (!asArray(c.responsibles?.socialmedia).length) return;
      const estagio = stageOf(c);
      const ops = computeOpsHealth(c.id, tasks);
      const saude = resolveClientHealth(c);
      const itens = acompanhaEntregas(c, mes) ? entregasDoSetor(c, 'socialmedia', mes) : [];
      const docsAbertos = documents.filter(d => d.clientId === c.id && DOC_ABERTO.includes(d.status)).length;
      const critico = ops.level === 'red' || saude.level === 'red';
      mapa.set(c.id, {
        c,
        estagio,
        emFluxo: estagio !== 'live',
        ops,
        saude,
        itens,
        resumo: resumoMes(itens),
        docsAbertos,
        atrasadas: ops.stats.overdue,
        semBase: estagio === 'live' && !c.sm?.baseCalculo,
        encerrado: contractState(c).status === 'closed',
        critico,
        atencao: critico || ops.stats.overdue > 0 || saude.level === 'orange',
      });
    });
    return mapa;
  }, [carteiraGeral, tasks, documents, mes]);

  const porSm = useMemo(() => nomes.map(nome => {
    const lista = carteiraGeral
      .filter(c => asArray(c.responsibles?.socialmedia).includes(nome))
      .map(c => linhas.get(c.id))
      .filter(Boolean);
    const ops = { green: 0, yellow: 0, orange: 0, red: 0 };
    lista.forEach(l => { ops[l.ops.level] += 1; });
    return {
      nome,
      ativo: ativos.has(nome),
      lista,
      ops,
      emFluxo: lista.filter(l => l.emFluxo).length,
      criticos: lista.filter(l => l.critico).length,
      atrasadas: lista.reduce((s, l) => s + l.atrasadas, 0),
      semBase: lista.filter(l => l.semBase).length,
      docsAbertos: lista.reduce((s, l) => s + l.docsAbertos, 0),
      entregas: resumoMes(lista.flatMap(l => l.itens)),
    };
  }), [nomes, ativos, carteiraGeral, linhas]);

  const totais = useMemo(() => {
    const todas = [...linhas.values()];
    const semSm = clients.filter(c =>
      c.active !== false
      && stageOf(c) === 'live'
      && contractState(c).status !== 'closed'
      && !asArray(c.responsibles?.socialmedia).length
      && contrataSocialMedia(c)
    );
    return {
      clientes: todas.length,
      emFluxo: todas.filter(l => l.emFluxo).length,
      criticos: todas.filter(l => l.critico).length,
      semBase: todas.filter(l => l.semBase).length,
      semSm,
      entregas: resumoMes(todas.flatMap(l => l.itens)),
    };
  }, [linhas, clients]);

  const atual = porSm.find(p => p.nome === sel) || porSm[0] || null;

  const visiveis = useMemo(() => {
    if (!atual) return [];
    const termo = busca.trim().toLowerCase();
    return atual.lista
      .filter(l => filtro === 'todos'
        || (filtro === 'atencao' && l.atencao)
        || (filtro === 'fluxo' && l.emFluxo)
        || (filtro === 'semBase' && l.semBase))
      .filter(l => !termo || (l.c.name || '').toLowerCase().includes(termo))
      // Mais urgente primeiro: crítico, depois o pior farol, depois nome.
      .sort((a, b) => (
        (b.critico - a.critico)
        || (HEALTH_ORDER_4[a.ops.level] - HEALTH_ORDER_4[b.ops.level])
        || (a.c.name || '').localeCompare(b.c.name || '')
      ));
  }, [atual, filtro, busca]);

  const contagem = (id) => {
    if (!atual) return 0;
    if (id === 'atencao') return atual.lista.filter(l => l.atencao).length;
    if (id === 'fluxo') return atual.emFluxo;
    if (id === 'semBase') return atual.semBase;
    return atual.lista.length;
  };

  const ficha = fichaId ? clients.find(c => c.id === fichaId) : null;
  const tomEntregas = (pct) => (pct == null ? undefined : pct >= 100 ? 'good' : pct >= 70 ? 'warn' : 'bad');

  return (
    <div className="fade-up">
      <PageHeader
        title="Carteira do Social Media"
        sub={`${ativos.size} ${ativos.size === 1 ? 'social media no time' : 'social medias no time'} · ${rotuloMes(mes, true)}`}
      />

      <Grid cols={4}>
        <Kpi value={totais.clientes} label="Clientes com social media">
          <Breakdown rows={[['Em onboarding', totais.emFluxo]]} />
        </Kpi>
        <Kpi value={totais.semSm.length} label="Contrataram e estão sem social media" tone={totais.semSm.length ? 'bad' : 'good'}>
          {totais.semSm.length > 0 ? (
            <p style={S.nota}>
              {totais.semSm.slice(0, 3).map(c => c.name).join(', ')}
              {totais.semSm.length > 3 ? ` e mais ${totais.semSm.length - 3}` : ''}
            </p>
          ) : <p style={S.nota}>Todo cliente ativo com o serviço tem responsável.</p>}
        </Kpi>
        <Kpi value={totais.criticos} label="Clientes críticos" tone={totais.criticos ? 'bad' : 'good'}>
          <Breakdown rows={[['Sem base de cálculo', totais.semBase]]} />
        </Kpi>
        <Kpi
          value={totais.entregas.pct == null ? '—' : `${totais.entregas.pct}%`}
          label="Entregas do Social Media no mês"
          tone={tomEntregas(totais.entregas.pct)}
        >
          <Breakdown rows={[['Entregas', totais.entregas.combinado ? `${totais.entregas.entregue} de ${totais.entregas.combinado}` : 'sem escopo']]} />
        </Kpi>
      </Grid>

      {porSm.length === 0 ? (
        <Card><Empty>Nenhum social media cadastrado ainda.</Empty></Card>
      ) : (
        <>
          {/* ── Uma pessoa por card; o selecionado abre a carteira ── */}
          <div style={S.grade}>
            {porSm.map(p => {
              const on = atual?.nome === p.nome;
              const total = p.lista.length;
              return (
                <button
                  key={p.nome}
                  type="button"
                  className="ui-card"
                  onClick={() => { setSel(p.nome); setFiltro('todos'); setBusca(''); }}
                  style={{ ...S.pessoa, borderColor: on ? 'var(--c-border)' : 'var(--border)', background: on ? 'var(--c-dim)' : 'var(--bg2)' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={S.pessoaNome}>{p.nome}</span>
                    <Aderencia pct={p.entregas.pct} style={{ marginLeft: 'auto' }} />
                  </div>
                  <span style={S.nota}>
                    {p.ativo ? `${total} ${total === 1 ? 'cliente' : 'clientes'}` : `fora do time · ${total} ${total === 1 ? 'cliente' : 'clientes'}`}
                    {p.emFluxo > 0 ? ` · ${p.emFluxo} em onboarding` : ''}
                  </span>

                  <div style={S.trilho}>
                    {NIVEIS.map(l => (p.ops[l] > 0
                      ? <i key={l} title={`${HEALTH_LEVELS_4[l].label}: ${p.ops[l]}`} style={{ width: `${(p.ops[l] / Math.max(1, total)) * 100}%`, background: COR_NIVEL[l] }} />
                      : null))}
                  </div>

                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', minHeight: 22 }}>
                    {p.criticos > 0 && <Tag tone="bad">{p.criticos} {p.criticos === 1 ? 'crítico' : 'críticos'}</Tag>}
                    {p.atrasadas > 0 && <Tag tone="bad">{p.atrasadas} {p.atrasadas === 1 ? 'task atrasada' : 'tasks atrasadas'}</Tag>}
                    {p.semBase > 0 && <Tag tone="warn">{p.semBase} sem base</Tag>}
                    {p.criticos === 0 && p.atrasadas === 0 && p.semBase === 0 && total > 0 && <Tag tone="good">Tudo em dia</Tag>}
                  </div>
                </button>
              );
            })}
          </div>

          {/* ── Carteira da pessoa selecionada ───────────────────── */}
          {atual && (
            <Card
              title={`Carteira de ${atual.nome}`}
              sub={`${atual.lista.length} ${atual.lista.length === 1 ? 'cliente' : 'clientes'}${atual.docsAbertos ? ` · ${atual.docsAbertos} ${atual.docsAbertos === 1 ? 'documento em aberto' : 'documentos em aberto'}` : ''}`}
              right={(
                <div style={S.busca}>
                  <Search size={13} color="var(--dim)" />
                  <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar cliente" style={S.buscaInput} />
                </div>
              )}
            >
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '10px 0 12px' }}>
                {FILTROS.map(f => (
                  <button key={f.id} type="button" className={`ui-btn small ${filtro === f.id ? 'on' : ''}`} onClick={() => setFiltro(f.id)}>
                    {f.label}
                    <span style={{ fontFamily: 'var(--fm)', fontSize: 11, color: contagem(f.id) ? 'var(--text)' : 'var(--dim)' }}>{contagem(f.id)}</span>
                  </button>
                ))}
              </div>

              {atual.lista.length === 0 ? (
                <div style={S.vazio}>
                  <Users size={20} color="var(--dim)" />
                  <p style={S.nota}>Sem clientes atribuídos. O responsável por setor é definido no cadastro do cliente.</p>
                </div>
              ) : visiveis.length === 0 ? (
                <Empty>Nenhum cliente neste filtro.</Empty>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {visiveis.map(l => {
                    const cs = asArray(l.c.responsibles?.cs).join(', ');
                    const partes = [
                      l.emFluxo ? (CLIENT_STAGES[l.estagio]?.label || l.estagio) : null,
                      `CS: ${cs || '—'}`,
                      asArray(l.c.responsibles?.socialmedia).length > 1 ? `divide com ${asArray(l.c.responsibles.socialmedia).filter(n => n !== atual.nome).join(', ')}` : null,
                    ].filter(Boolean);
                    return (
                      <Row
                        key={l.c.id}
                        onClick={() => setFichaId(l.c.id)}
                        left={<i title={`Farol operacional: ${HEALTH_LEVELS_4[l.ops.level].label}`} style={{ ...S.ponto, background: COR_NIVEL[l.ops.level] }} />}
                        title={l.c.name}
                        sub={partes.join(' · ')}
                        right={(
                          <div style={S.tags}>
                            {l.encerrado && <Tag>Contrato encerrado</Tag>}
                            {l.saude.level && <Tag tone={TOM_NIVEL[l.saude.level]}>Cliente: {HEALTH_LEVELS_4[l.saude.level].label}</Tag>}
                            {l.atrasadas > 0 && (
                              <Tag tone="bad"><AlertTriangle size={11} /> {l.atrasadas} {l.atrasadas === 1 ? 'atrasada' : 'atrasadas'}</Tag>
                            )}
                            {l.semBase && <Tag tone="warn">Sem base de cálculo</Tag>}
                            {l.docsAbertos > 0 && <Tag><FileText size={11} /> {l.docsAbertos}</Tag>}
                            {l.resumo.combinado > 0 && (
                              <span style={S.entregas}>
                                {l.resumo.entregue}/{l.resumo.combinado}
                                <Aderencia pct={l.resumo.pct} />
                              </span>
                            )}
                          </div>
                        )}
                      />
                    );
                  })}
                </div>
              )}
            </Card>
          )}
        </>
      )}

      {ficha && <ClienteFicha client={ficha} acoes={acoes} toast={toast} onClose={() => setFichaId(null)} />}
    </div>
  );
}

const S = {
  nota: { fontSize: 11.5, color: 'var(--muted)', lineHeight: 1.45 },
  grade: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(240px,1fr))', gap: 14, marginBottom: 14 },
  pessoa: { display: 'flex', flexDirection: 'column', gap: 8, textAlign: 'left', cursor: 'pointer', width: '100%', color: 'var(--text)', fontFamily: 'var(--f)', transition: 'border-color .15s, background .15s' },
  pessoaNome: { fontSize: 14, fontWeight: 500, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  trilho: { display: 'flex', height: 6, borderRadius: 99, overflow: 'hidden', background: 'var(--soft)', margin: '4px 0 2px' },
  busca: { display: 'flex', alignItems: 'center', gap: 7, height: 32, padding: '0 12px', borderRadius: 99, background: 'var(--bg3)', border: '1px solid var(--border)' },
  buscaInput: { background: 'transparent', border: 'none', outline: 'none', color: 'var(--text)', fontSize: 12.5, width: 150 },
  vazio: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '26px 0', textAlign: 'center' },
  ponto: { width: 8, height: 8, borderRadius: '50%', flexShrink: 0 },
  tags: { display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end', maxWidth: '60%' },
  entregas: { display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: 'var(--fm)', fontSize: 11, color: 'var(--text)' },
};
