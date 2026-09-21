import React, { useState } from 'react';
import { Minus, Plus } from 'lucide-react';
import { ENTREGA_STATUS, SECTORS } from '../../lib/firebase';
import { statusItem, fracaoDoMes } from '../../lib/entregas';
import { Tag } from '../shared/ui';

/*
 * Kit das entregas do contrato. Peças pequenas, reaproveitadas no
 * card do cliente (admin/CS), no painel de quem produz e no Mural do
 * Social Media — para que "12 de 16" tenha a mesma cara em todo lugar.
 *
 * Cor com propósito: verde = entregue, âmbar = abaixo do ritmo,
 * vermelho = atrasado / não fechou. "No ritmo" usa o gradiente do
 * painel, porque ainda não é conclusão — é andamento.
 */

const FILL = {
  entregue: 'var(--green)',
  ritmo: 'var(--grad)',
  abaixo: 'var(--amber)',
  atrasado: 'var(--red)',
  faltou: 'var(--red)',
};

export function StatusEntrega({ status, style }) {
  const st = ENTREGA_STATUS[status];
  if (!st) return null;
  return <Tag tone={st.tone} style={style}>{st.label}</Tag>;
}

// Barra de progresso com a marca do ritmo esperado (mês em andamento).
export function BarraEntrega({ feito, qtd, status, esperado }) {
  const pct = qtd ? Math.min(100, (feito / qtd) * 100) : 0;
  const marca = esperado != null && qtd ? Math.min(100, (esperado / qtd) * 100) : null;
  return (
    <div style={S.trilho}>
      <div style={{ ...S.fill, width: `${pct}%`, background: FILL[status] || 'var(--c)' }} />
      {marca != null && marca > 0 && marca < 100 && (
        <i title="Onde deveria estar hoje" style={{ ...S.marca, left: `${marca}%` }} />
      )}
    </div>
  );
}

// Aderência do mês em uma etiqueta: verde a partir de 100%, âmbar de
// 70% a 99%, vermelho abaixo. Sem escopo, não mostra nada.
export function Aderencia({ pct, style }) {
  if (pct == null) return null;
  const tone = pct >= 100 ? 'good' : pct >= 70 ? 'warn' : 'bad';
  return <Tag tone={tone} style={{ fontFamily: 'var(--fm)', ...style }}>{pct}%</Tag>;
}

/*
 * Uma linha de entrega: nome, setor, quantidade, barra e situação.
 * Com `onMarcar`, ganha os botões de − / +. `mostrarSetor` liga o
 * rótulo do setor (útil no card do cliente, onde há vários setores).
 */
export function LinhaEntrega({ item, mes, onMarcar, mostrarSetor = false, compacta = false }) {
  const [busy, setBusy] = useState(false);
  const status = statusItem(item, mes);
  const esperado = Math.floor(item.qtd * fracaoDoMes(mes));
  const setor = SECTORS[item.sector];

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
            {item.ajustado ? `ajustado neste mês (contrato: ${item.qtdContrato})` : `${item.qtd} por mês`}
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
              style={{ ...S.btn, ...S.btnMais, opacity: busy ? 0.5 : 1 }}
              disabled={busy}
              onClick={() => clicar(1)}
              title="Marcar uma entrega"
              aria-label={`Marcar uma entrega de ${item.label}`}
            >
              <Plus size={13} />
            </button>
          </div>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
        <div style={{ flex: 1 }}>
          <BarraEntrega feito={item.feito} qtd={item.qtd} status={status} esperado={status === 'entregue' ? null : esperado} />
        </div>
        <StatusEntrega status={status} />
      </div>
    </div>
  );
}

const S = {
  trilho: { position: 'relative', height: 6, borderRadius: 99, background: 'var(--soft)', overflow: 'visible' },
  fill: { height: '100%', borderRadius: 99, transition: 'width .25s ease' },
  marca: { position: 'absolute', top: -3, width: 2, height: 12, borderRadius: 2, background: 'var(--muted)', transform: 'translateX(-1px)' },
  linha: { borderBottom: '1px solid var(--border)' },
  nome: { fontSize: 13, fontWeight: 500, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  meta: { fontSize: 11, color: 'var(--muted)', marginTop: 2 },
  qtd: { fontFamily: 'var(--fm)', fontSize: 13, whiteSpace: 'nowrap' },
  btn: { width: 30, height: 30, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg3)', color: 'var(--text)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' },
  btnMais: { background: 'var(--c-dim)', borderColor: 'var(--c-border)', color: 'var(--c)' },
};
