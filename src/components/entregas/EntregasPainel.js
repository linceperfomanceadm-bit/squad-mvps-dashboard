import React, { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { stageOf, CADASTRO_PENDENCIAS } from '../../lib/firebase';
import {
  mesChave, rotuloMes, entregasDoMes, resumoMes, statusGeral, cadastroPendencias,
  entregasUnicas, temEscopoDefinido,
} from '../../lib/entregas';
import { PageHeader, Grid, Kpi, Tag, Empty } from '../shared/ui';
import { BarraEntrega, StatusEntrega, Aderencia } from './EntregasKit';
import ClienteFicha from './ClienteFicha';

const asArray = (v) => (Array.isArray(v) ? v : v ? [v] : []);

const FILTROS = [
  { id: 'todos',      label: 'Todos' },
  { id: 'atrasados',  label: 'Atrasados' },
  { id: 'abaixo',     label: 'Abaixo do ritmo' },
  { id: 'incompleto', label: 'Cadastro incompleto' },
  { id: 'semEscopo',  label: 'Sem escopo' },
];

// Quanto menor, mais para cima na lista.
const PESO = { atrasado: 0, faltou: 0, abaixo: 1, ritmo: 3, entregue: 4 };

/*
 * ENTREGAS × CONTRATO — a lista de todos os clientes ativos com o que
 * o contrato prevê no mês contra o que já foi entregue. Serve ao admin
 * e à CS (mesmo componente, mesmas regras).
 *
 * A lista abre com o pior em cima: atrasados, abaixo do ritmo e quem
 * ainda tem cadastro incompleto — é o que precisa de ação.
 */
export default function EntregasPainel({ clients, acoes, toast, titulo, csInicial = '' }) {
  const mes = mesChave();
  const [filtro, setFiltro] = useState('todos');
  const [cs, setCs] = useState(csInicial);
  const [busca, setBusca] = useState('');
  const [abertoId, setAbertoId] = useState(null);

  const base = useMemo(
    () => clients.filter(c => c.active !== false && stageOf(c) === 'live'),
    [clients]
  );

  const linhas = useMemo(() => base.map(c => {
    const itens = entregasDoMes(c, mes);
    const unicasAtrasadas = entregasUnicas(c).filter(u => u.atrasado).length;
    return {
      client: c,
      itens,
      resumo: resumoMes(itens),
      status: statusGeral(itens, mes),
      pendencias: cadastroPendencias(c),
      temEscopo: temEscopoDefinido(c),
      unicasAtrasadas,
      cs: asArray(c.responsibles?.cs),
    };
  }), [base, mes]);

  const nomesCs = useMemo(
    () => [...new Set(linhas.flatMap(l => l.cs))].sort((a, b) => a.localeCompare(b)),
    [linhas]
  );

  const doCs = cs ? linhas.filter(l => l.cs.includes(cs)) : linhas;

  const totais = useMemo(() => {
    const comItens = doCs.filter(l => l.itens.length);
    const combinado = comItens.reduce((s, l) => s + l.resumo.combinado, 0);
    const entregue = comItens.reduce((s, l) => s + l.resumo.entregue, 0);
    return {
      acompanhando: comItens.length,
      pct: combinado ? Math.round((entregue / combinado) * 100) : null,
      atrasados: doCs.filter(l => l.status === 'atrasado').length,
      incompletos: doCs.filter(l => l.pendencias.length).length,
    };
  }, [doCs]);

  const visiveis = doCs
    .filter(l => {
      if (filtro === 'atrasados') return l.status === 'atrasado' || l.unicasAtrasadas > 0;
      if (filtro === 'abaixo') return l.status === 'abaixo';
      if (filtro === 'incompleto') return l.pendencias.length > 0;
      if (filtro === 'semEscopo') return !l.temEscopo;
      return true;
    })
    .filter(l => !busca.trim() || String(l.client.name || '').toLowerCase().includes(busca.trim().toLowerCase()))
    .sort((a, b) => {
      const pa = a.status ? PESO[a.status] : (a.pendencias.length ? 2 : 5);
      const pb = b.status ? PESO[b.status] : (b.pendencias.length ? 2 : 5);
      if (pa !== pb) return pa - pb;
      return String(a.client.name).localeCompare(String(b.client.name));
    });

  const aberto = abertoId ? clients.find(c => c.id === abertoId) : null;

  return (
    <div className="fade-up">
      {titulo && <PageHeader title={titulo} sub={`Contrato contra o entregue · ${rotuloMes(mes, true)}`} />}

      <Grid cols={4}>
        <Kpi value={totais.acompanhando} label="Clientes com entregas no mês" />
        <Kpi
          value={totais.pct == null ? '—' : `${totais.pct}%`}
          label="Entregue do combinado no mês"
          tone={totais.pct == null ? undefined : totais.pct >= 100 ? 'good' : totais.pct >= 70 ? 'warn' : 'bad'}
        />
        <Kpi value={totais.atrasados} label="Clientes atrasados" tone={totais.atrasados ? 'bad' : undefined} />
        <Kpi value={totais.incompletos} label="Cadastros incompletos" tone={totais.incompletos ? 'warn' : undefined} />
      </Grid>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 14 }}>
        {FILTROS.map(fl => (
          <button key={fl.id} type="button" className={`ui-btn small ${filtro === fl.id ? 'on' : ''}`} onClick={() => setFiltro(fl.id)}>
            {fl.label}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        {nomesCs.length > 1 && (
          <select value={cs} onChange={e => setCs(e.target.value)} style={{ minWidth: 160 }} aria-label="Filtrar por CS">
            <option value="">Todas as CSs</option>
            {nomesCs.map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        )}
        <div style={{ position: 'relative' }}>
          <Search size={14} color="var(--dim)" style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)' }} />
          <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar cliente" style={S.busca} />
        </div>
      </div>

      <div className="ui-card" style={{ padding: '6px 20px' }}>
        {visiveis.length === 0 ? (
          <Empty>Nenhum cliente neste filtro.</Empty>
        ) : visiveis.map(l => (
          <button key={l.client.id} type="button" style={S.linha} onClick={() => setAbertoId(l.client.id)}>
            <div style={{ minWidth: 0, flex: '1 1 200px' }}>
              <p style={S.nome}>{l.client.name}</p>
              <p style={S.sub}>
                {l.cs.length ? `CS: ${l.cs.join(', ')}` : 'Sem CS'}
                {l.itens.length ? ` · ${l.resumo.entregue} de ${l.resumo.combinado} no mês` : ''}
              </p>
            </div>

            <div style={{ flex: '0 1 220px', minWidth: 120 }}>
              {l.itens.length > 0 ? (
                <BarraEntrega feito={l.resumo.entregue} qtd={l.resumo.combinado} status={l.status} />
              ) : (
                <span style={S.sub}>
                  {l.client.escopo?.semRecorrencia ? 'Sem entregas mensais' : l.temEscopo ? 'Nada combinado no mês' : 'Escopo não cadastrado'}
                </span>
              )}
            </div>

            <div style={{ display: 'flex', gap: 6, alignItems: 'center', justifyContent: 'flex-end', flexWrap: 'wrap', flex: '0 0 auto' }}>
              {l.unicasAtrasadas > 0 && <Tag tone="bad">Entrega única atrasada</Tag>}
              {l.pendencias.length > 0 && (
                <Tag tone="warn" style={{ cursor: 'help' }}>
                  <span title={l.pendencias.map(p => CADASTRO_PENDENCIAS[p]?.label || p).join(', ')}>
                    Cadastro incompleto
                  </span>
                </Tag>
              )}
              {l.status && <StatusEntrega status={l.status} />}
              <Aderencia pct={l.resumo.pct} />
            </div>
          </button>
        ))}
      </div>

      {aberto && (
        <ClienteFicha client={aberto} acoes={acoes} toast={toast} onClose={() => setAbertoId(null)} />
      )}
    </div>
  );
}

const S = {
  linha: { display: 'flex', alignItems: 'center', gap: 16, width: '100%', padding: '13px 0', background: 'none', border: 'none', borderBottom: '1px solid var(--border)', cursor: 'pointer', textAlign: 'left', flexWrap: 'wrap' },
  nome: { fontSize: 13.5, fontWeight: 500, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  sub: { fontSize: 11.5, color: 'var(--muted)', marginTop: 2 },
  busca: { background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 99, padding: '8px 12px 8px 32px', color: 'var(--text)', fontSize: 12.5, outline: 'none', width: 200, fontFamily: 'var(--f)' },
};
