import React, { useState } from 'react';
import { Minus, Plus, CheckCircle2 } from 'lucide-react';
import { SECTORS } from '../../lib/firebase';
import { tomAderencia } from '../../lib/entregas';
import { Tag } from '../shared/ui';

/*
 * Kit das entregas do contrato. Peças pequenas, reaproveitadas no
 * card do cliente (admin/CS), no painel de quem produz e no Mural do
 * Social Media — para que "12 de 16" tenha a mesma cara em todo lugar.
 *
 * Sem situação ("atrasado", "abaixo do ritmo"): o acompanhamento é o
 * contador e a barra. O ritmo padrão dividia o mês por igual e acusava
 * atraso de quem seguia um planejamento diferente — ver
 * `itemConcluido` em lib/entregas.js. A barra usa o gradiente do painel
 * enquanto anda e fica verde ao completar.
 *
 * Serviço único (site, ID Visual) usa `LinhaEntregaUnica`: mesmo
 * "0 de 1" e mesma barra, sem − / +, porque quem conclui é o card do
 * serviço no painel de Web ou de Design.
 *
 * Entrega única do escopo (`item.unica`, ex.: Google Meu Negócio) usa
 * `LinhaEntrega` normal — alguém marca — mas trava em 1 de 1.
 */

export function BarraEntrega({ feito, qtd }) {
  const pct = qtd ? Math.min(100, (feito / qtd) * 100) : 0;
  const completo = qtd > 0 && feito >= qtd;
  return (
    <div style={S.trilho}>
      <div style={{ ...S.fill, width: `${pct}%`, background: completo ? 'var(--green)' : 'var(--grad)' }} />
    </div>
  );
}

// Aderência do mês em uma etiqueta. Neutra enquanto o mês corre; verde
// ao completar; com `mes` fechado, âmbar/vermelho (`tomAderencia`).
// Sem escopo, não mostra nada.
export function Aderencia({ pct, mes, style }) {
  if (pct == null) return null;
  return <Tag tone={tomAderencia(pct, mes)} style={{ fontFamily: 'var(--fm)', ...style }}>{pct}%</Tag>;
}

/*
 * Uma linha de entrega: nome, setor, quantidade e barra.
 * Com `onMarcar`, ganha os botões de − / +. `mostrarSetor` liga o
 * rótulo do setor (útil no card do cliente, onde há vários setores).
 */
export function LinhaEntrega({ item, onMarcar, mostrarSetor = false, compacta = false }) {
  const [busy, setBusy] = useState(false);
  const setor = SECTORS[item.sector];
  const unica = item.unica === true;
  const podeMais = !busy && !(unica && item.feito >= 1);

  const clicar = async (delta) => {
    if (busy || !onMarcar) return;
    setBusy(true);
    await onMarcar(item.id, delta);
    setBusy(false);
  };

  return (
    <div style={{ ...S.linha, padding: compacta ? '9px 0' : '11px 0' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <p style={S.nome}>{item.label}</p>
          <p style={S.meta}>
            {mostrarSetor && setor ? `${setor.label} · ` : ''}
            {unica ? 'Entrega única' : item.ajustado ? `ajustado neste mês (contrato: ${item.qtdContrato})` : `${item.qtd} por mês`}
          </p>
        </div>
        <span style={S.qtd}>
          <b style={{ color: 'var(--text)', fontWeight: 500 }}>{item.feito}</b>
          <span style={{ color: 'var(--muted)' }}> de {item.qtd}</span>
        </span>
        {onMarcar && (
          <div style={{ display: 'flex', gap: 4 }}>
            <button
              type="button"
              style={{ ...S.btn, opacity: item.feito > 0 && !busy ? 1 : 0.4 }}
              disabled={item.feito === 0 || busy}
              onClick={() => clicar(-1)}
              title="Desmarcar uma entrega"
              aria-label={`Desmarcar uma entrega de ${item.label}`}
            >
              <Minus size={13} />
            </button>
            <button
              type="button"
              style={{ ...S.btn, ...S.btnMais, opacity: podeMais ? 1 : 0.4 }}
              disabled={!podeMais}
              onClick={() => clicar(1)}
              title="Marcar uma entrega"
              aria-label={`Marcar uma entrega de ${item.label}`}
            >
              <Plus size={13} />
            </button>
          </div>
        )}
      </div>
      <div style={{ marginTop: 8 }}>
        <BarraEntrega feito={item.feito} qtd={item.qtd} />
      </div>
    </div>
  );
}

/*
 * Linha de serviço único. A barra acompanha as etapas do checklist do
 * card, mas só fica cheia e verde quando o serviço é finalizado — todas
 * as etapas marcadas ainda não é entrega.
 */
export function LinhaEntregaUnica({ item, mostrarSetor = false, compacta = false }) {
  const setor = SECTORS[item.sector];
  const { feito: etapas = 0, total = 0 } = item.checklist || {};
  const pct = item.feito ? 100 : total ? Math.min(90, (etapas / total) * 100) : 0;
  const data = (d) => (d ? new Date(d).toLocaleDateString('pt-BR') : '');
  const vencido = !item.feito && item.atrasado;

  return (
    <div style={{ ...S.linha, padding: compacta ? '9px 0' : '11px 0' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <p style={S.nome}>{item.label}</p>
          <p style={S.meta}>
            {mostrarSetor && setor ? `${setor.label} · ` : ''}
            Serviço único
            {item.feito
              ? ` · finalizado em ${data(item.concluidoEm)}`
              : ` · ${item.fase}${total ? ` · ${etapas} de ${total} etapas` : ''}`}
            {!item.feito && item.prazo && (
              <span style={{ color: vencido ? 'var(--red)' : 'var(--muted)' }}>
                {vencido ? ' · prazo venceu em ' : ' · prazo '}{data(item.prazo)}
              </span>
            )}
          </p>
        </div>
        {item.feito ? <CheckCircle2 size={15} color="var(--green)" style={{ flexShrink: 0 }} /> : null}
        <span style={S.qtd} title="Conta como entregue quando o serviço é finalizado no painel">
          <b style={{ color: 'var(--text)', fontWeight: 500 }}>{item.feito}</b>
          <span style={{ color: 'var(--muted)' }}> de 1</span>
        </span>
      </div>
      <div style={{ marginTop: 8 }}>
        <div style={S.trilho}>
          <div style={{ ...S.fill, width: `${pct}%`, background: item.feito ? 'var(--green)' : 'var(--grad)' }} />
        </div>
      </div>
    </div>
  );
}

const S = {
  trilho: { height: 6, borderRadius: 99, background: 'var(--soft)', overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 99, transition: 'width .25s ease' },
  linha: { borderBottom: '1px solid var(--border)' },
  nome: { fontSize: 13, fontWeight: 500, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  meta: { fontSize: 11, color: 'var(--muted)', marginTop: 2 },
  qtd: { fontFamily: 'var(--fm)', fontSize: 13, whiteSpace: 'nowrap' },
  btn: { width: 30, height: 30, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg3)', color: 'var(--text)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' },
  btnMais: { background: 'var(--c-dim)', borderColor: 'var(--c-border)', color: 'var(--c)' },
};
