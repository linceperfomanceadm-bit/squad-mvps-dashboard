import React, { useMemo, useState } from 'react';
import { SECTORS, naCarteira } from '../../lib/firebase';
import {
  mesesEditaveis, rotuloMes, entregasDoSetor, resumoMes, statusGeral, acompanhaEntregas,
} from '../../lib/entregas';
import { PageHeader, Grid, Kpi, Empty } from '../shared/ui';
import { LinhaEntrega, Aderencia, StatusEntrega } from './EntregasKit';

const asArray = (v) => (Array.isArray(v) ? v : v ? [v] : []);

/*
 * ENTREGAS DO MÊS — o checklist de quem produz.
 *
 * Um card por cliente da carteira da pessoa, só com os itens do setor
 * dela. Cada "+" marca uma entrega; o card do cliente no admin e na
 * CS atualiza na hora. O mês vira no dia 1 para todos; até o dia 5 o
 * mês anterior ainda aceita marcação atrasada.
 *
 * `todos` (líder do setor / admin) mostra a carteira inteira do setor.
 */
export default function EntregasSetor({ clients, sectorId, me, acoes, todos = false }) {
  const editaveis = mesesEditaveis();
  const [mes, setMes] = useState(editaveis[0]);
  const setor = SECTORS[sectorId];

  const cards = useMemo(() => clients
    .filter(c => naCarteira(c) && (todos || asArray(c.responsibles?.[sectorId]).includes(me)))
    .filter(c => acompanhaEntregas(c, mes))
    .map(c => {
      const itens = entregasDoSetor(c, sectorId, mes);
      return { client: c, itens, resumo: resumoMes(itens), status: statusGeral(itens, mes) };
    })
    .filter(x => x.itens.length)
    .sort((a, b) => (a.resumo.pct ?? 101) - (b.resumo.pct ?? 101)),
  [clients, sectorId, me, todos, mes]);

  const totais = useMemo(() => {
    const combinado = cards.reduce((s, x) => s + x.resumo.combinado, 0);
    const entregue = cards.reduce((s, x) => s + x.resumo.entregue, 0);
    return {
      combinado,
      entregue,
      faltam: Math.max(0, combinado - entregue),
      atrasados: cards.filter(x => x.status === 'atrasado').length,
    };
  }, [cards]);

  return (
    <div className="fade-up">
      <PageHeader
        title="Entregas do mês"
        sub={`${setor?.label || ''} · ${rotuloMes(mes, true)}`}
        right={editaveis.length > 1 ? editaveis.map(m => (
          <button key={m} type="button" className={`ui-btn small ${m === mes ? 'on' : ''}`} onClick={() => setMes(m)}>
            {rotuloMes(m)}
          </button>
        )) : null}
      />

      {editaveis.length > 1 && mes !== editaveis[0] && (
        <p style={{ fontSize: 12, color: 'var(--amber)', marginBottom: 14 }}>
          Mês anterior aberto até o dia 5 — marque aqui o que foi entregue e ficou sem registro.
        </p>
      )}

      <Grid cols={3}>
        <Kpi value={`${totais.entregue}/${totais.combinado}`} label="Entregue do combinado" />
        <Kpi value={totais.faltam} label="Entregas faltando no mês" tone={totais.faltam ? undefined : 'good'} />
        <Kpi value={totais.atrasados} label="Clientes atrasados" tone={totais.atrasados ? 'bad' : undefined} />
      </Grid>

      {cards.length === 0 ? (
        <div className="ui-card">
          <Empty>
            Nenhum cliente da sua carteira tem entregas mensais de {setor?.label || 'seu setor'} no contrato.
            Quando a CS cadastrar o escopo, o checklist aparece aqui.
          </Empty>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(340px,1fr))', gap: 14 }}>
          {cards.map(({ client, itens, resumo, status }) => (
            <div key={client.id} className="ui-card">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)', flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {client.name}
                </p>
                {status && <StatusEntrega status={status} />}
                <Aderencia pct={resumo.pct} />
              </div>
              {itens.map(it => (
                <LinhaEntrega
                  key={it.id}
                  item={it}
                  mes={mes}
                  compacta
                  onMarcar={acoes?.marcar ? (itemId, delta) => acoes.marcar(client.id, mes, itemId, delta) : undefined}
                />
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
