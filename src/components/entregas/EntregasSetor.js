import React, { useMemo, useState } from 'react';
import { SECTORS, naCarteira } from '../../lib/firebase';
import {
  mesesEditaveis, rotuloMes, entregasDoSetor, entregasUnicasDoMes, resumoMes, acompanhaEntregas, mesConcluido,
} from '../../lib/entregas';
import { PageHeader, Grid, Kpi, Empty } from '../shared/ui';
import { LinhaEntrega, LinhaEntregaUnica, Aderencia } from './EntregasKit';

const asArray = (v) => (Array.isArray(v) ? v : v ? [v] : []);

/*
 * ENTREGAS DO MÊS — o checklist de quem produz.
 *
 * Um card por cliente da carteira da pessoa, só com os itens do setor
 * dela. Duas fontes no mesmo card:
 *
 *   · Recorrentes do escopo — cada "+" marca uma entrega; o card do
 *     cliente no admin e na CS atualiza na hora. O mês vira no dia 1
 *     para todos; até o dia 5 o mês anterior ainda aceita marcação.
 *   · Serviços únicos (site, ID Visual) — sem botão: contam 1 de 1 no
 *     mês em que o serviço é finalizado no painel de Web ou de Design
 *     (regra em `entregasUnicasDoMes`).
 *
 * `todos` (líder do setor / admin) mostra a carteira inteira do setor.
 */
export default function EntregasSetor({ clients, sectorId, me, acoes, todos = false }) {
  const editaveis = mesesEditaveis();
  const [mes, setMes] = useState(editaveis[0]);
  const setor = SECTORS[sectorId];

  const cards = useMemo(() => clients
    .filter(c => naCarteira(c))
    .map(c => {
      // Recorrente segue a carteira do setor; serviço único segue o
      // responsável do próprio serviço (no Web cada site tem os seus).
      const doSetor = todos || asArray(c.responsibles?.[sectorId]).includes(me);
      const recorrentes = doSetor && acompanhaEntregas(c, mes) ? entregasDoSetor(c, sectorId, mes) : [];
      const unicas = entregasUnicasDoMes(c, mes, { sector: sectorId, dono: todos ? null : me });
      return { client: c, recorrentes, unicas, resumo: resumoMes([...unicas, ...recorrentes]) };
    })
    .filter(x => x.recorrentes.length || x.unicas.length)
    .sort((a, b) => (a.resumo.pct ?? 101) - (b.resumo.pct ?? 101)),
  [clients, sectorId, me, todos, mes]);

  const totais = useMemo(() => {
    const combinado = cards.reduce((s, x) => s + x.resumo.combinado, 0);
    const entregue = cards.reduce((s, x) => s + x.resumo.entregue, 0);
    return {
      combinado,
      entregue,
      faltam: Math.max(0, combinado - entregue),
      completos: cards.filter(x => mesConcluido(x.resumo)).length,
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
        <Kpi
          value={`${totais.completos}/${cards.length}`}
          label="Clientes com o mês completo"
          tone={cards.length && totais.completos === cards.length ? 'good' : undefined}
        />
      </Grid>

      {cards.length === 0 ? (
        <div className="ui-card">
          <Empty>
            Nenhuma entrega de {setor?.label || 'seu setor'} para você neste mês. Entregas mensais aparecem quando a CS
            cadastra o escopo; sites e ID Visual aparecem sozinhos a partir do painel.
          </Empty>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(340px,1fr))', gap: 14 }}>
          {cards.map(({ client, recorrentes, unicas, resumo }) => (
            <div key={client.id} className="ui-card">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)', flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {client.name}
                </p>
                <Aderencia pct={resumo.pct} mes={mes} />
              </div>
              {unicas.map(it => (
                <LinhaEntregaUnica key={it.id} item={it} compacta />
              ))}
              {recorrentes.map(it => (
                <LinhaEntrega
                  key={it.id}
                  item={it}
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
