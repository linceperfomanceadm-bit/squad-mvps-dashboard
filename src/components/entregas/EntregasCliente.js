import React, { useState } from 'react';
import { ChevronDown, ChevronRight, CalendarClock, SlidersHorizontal, CheckCircle2, Circle } from 'lucide-react';
import { SECTORS } from '../../lib/firebase';
import {
  rotuloMes, entregasDoMes, resumoMes, historicoMeses, entregasUnicas,
  escopoAgendado, mesesEditaveis, statusItem, temEscopoDefinido,
} from '../../lib/entregas';
import { LinhaEntrega, Aderencia, StatusEntrega } from './EntregasKit';
import { Tag, Empty } from '../shared/ui';

/*
 * ENTREGAS DE UM CLIENTE — o que o admin e a CS abrem para conferir o
 * contrato contra o que foi feito.
 *
 * Três partes:
 *   1. Recorrentes do mês — o checklist que cada setor vai marcando.
 *   2. Entregas únicas   — site e ID Visual, lidos dos painéis de Web
 *                          e Design (ninguém marca nada novo aqui).
 *   3. Histórico         — cada mês fechado com o resultado final.
 *
 * Handlers opcionais:
 *   onMarcar(mes, itemId, delta) → mostra os botões − / +
 *   onAjustar(mes, qtds)          → libera "ajustar este mês"
 */
export default function EntregasCliente({ client, onMarcar, onAjustar }) {
  const editaveis = mesesEditaveis();
  const [mes, setMes] = useState(editaveis[0]);
  const [ajustando, setAjustando] = useState(false);
  const [aberto, setAberto] = useState(null);

  const itens = entregasDoMes(client, mes);
  const resumo = resumoMes(itens);
  const agendado = escopoAgendado(client);
  const unicas = entregasUnicas(client);
  const historico = historicoMeses(client).filter(h => h.mes !== mes);
  const semRecorrencia = client?.escopo?.semRecorrencia === true;

  return (
    <div>
      {/* ── Recorrentes ─────────────────────────────── */}
      <div style={S.cab}>
        <h4 style={S.tit}>Entregas do mês</h4>
        {editaveis.length > 1 ? (
          <div style={{ display: 'flex', gap: 4 }}>
            {editaveis.map(m => (
              <button key={m} type="button" className={`ui-btn small ${m === mes ? 'on' : ''}`} onClick={() => { setMes(m); setAjustando(false); }}>
                {rotuloMes(m)}
              </button>
            ))}
          </div>
        ) : (
          <span style={S.mes}>{rotuloMes(mes, true)}</span>
        )}
        <div style={{ flex: 1 }} />
        <Aderencia pct={resumo.pct} />
      </div>

      {itens.length === 0 ? (
        <Empty>
          {semRecorrencia
            ? 'Este cliente não tem entregas mensais no contrato.'
            : temEscopoDefinido(client)
              ? 'Nenhuma entrega combinada para este mês.'
              : 'Escopo de entregas ainda não cadastrado. Use "Completar cadastro" para informar o que o contrato prevê por mês.'}
        </Empty>
      ) : ajustando ? (
        <AjusteMes
          itens={itens}
          mes={mes}
          onCancel={() => setAjustando(false)}
          onSave={async (qtds) => {
            const r = await onAjustar(mes, qtds);
            if (!r || r.success !== false) setAjustando(false);
          }}
        />
      ) : (
        <>
          <div>
            {itens.map(it => (
              <LinhaEntrega
                key={it.id}
                item={it}
                mes={mes}
                mostrarSetor
                onMarcar={onMarcar ? (itemId, delta) => onMarcar(mes, itemId, delta) : undefined}
              />
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10, flexWrap: 'wrap' }}>
            <span style={S.nota}>{resumo.entregue} de {resumo.combinado} entregas combinadas</span>
            <div style={{ flex: 1 }} />
            {onAjustar && (
              <button type="button" className="ui-btn small" onClick={() => setAjustando(true)}>
                <SlidersHorizontal size={13} /> Ajustar este mês
              </button>
            )}
          </div>
        </>
      )}

      {agendado && (
        <p style={{ ...S.nota, display: 'flex', alignItems: 'center', gap: 6, marginTop: 10 }}>
          <CalendarClock size={13} color="var(--blue)" />
          Novo escopo cadastrado — passa a valer em {rotuloMes(agendado.desde, true).toLowerCase()}.
        </p>
      )}

      {/* ── Entregas únicas ─────────────────────────── */}
      {unicas.length > 0 && (
        <>
          <div style={{ ...S.cab, marginTop: 22 }}>
            <h4 style={S.tit}>Entregas únicas</h4>
          </div>
          {unicas.map(u => (
            <div key={u.id} style={S.unica}>
              {u.concluido
                ? <CheckCircle2 size={16} color="var(--green)" style={{ flexShrink: 0 }} />
                : <Circle size={16} color={u.atrasado ? 'var(--red)' : 'var(--dim)'} style={{ flexShrink: 0 }} />}
              <div style={{ minWidth: 0, flex: 1 }}>
                <p style={S.unicaNome}>{u.label}</p>
                <p style={S.nota}>
                  {SECTORS[u.sector]?.label || u.sector}
                  {u.responsaveis.length ? ` · ${u.responsaveis.join(', ')}` : ''}
                  {u.checklist.total ? ` · ${u.checklist.feito} de ${u.checklist.total} etapas` : ''}
                </p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <Tag tone={u.concluido ? 'good' : u.atrasado ? 'bad' : 'info'}>{u.fase}</Tag>
                {!u.concluido && u.prazo && (
                  <p style={{ ...S.nota, marginTop: 4, color: u.atrasado ? 'var(--red)' : 'var(--muted)' }}>
                    {u.atrasado ? 'prazo venceu em ' : 'prazo '}{u.prazo.toLocaleDateString('pt-BR')}
                  </p>
                )}
              </div>
            </div>
          ))}
        </>
      )}

      {/* ── Histórico ───────────────────────────────── */}
      {historico.length > 0 && (
        <>
          <div style={{ ...S.cab, marginTop: 22 }}>
            <h4 style={S.tit}>Histórico</h4>
            <span style={S.mes}>meses fechados</span>
          </div>
          {historico.map(h => {
            const open = aberto === h.mes;
            return (
              <div key={h.mes} style={S.hist}>
                <button type="button" style={S.histCab} onClick={() => setAberto(open ? null : h.mes)}>
                  {open ? <ChevronDown size={14} color="var(--muted)" /> : <ChevronRight size={14} color="var(--muted)" />}
                  <span style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500 }}>{rotuloMes(h.mes, true)}</span>
                  <span style={{ ...S.nota, fontFamily: 'var(--fm)' }}>{h.resumo.entregue} de {h.resumo.combinado}</span>
                  <div style={{ flex: 1 }} />
                  <Aderencia pct={h.resumo.pct} />
                </button>
                {open && (
                  <div style={{ padding: '4px 0 8px 22px' }}>
                    {h.itens.map(it => (
                      <div key={it.id} style={S.histLinha}>
                        <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: 'var(--text)' }}>
                          {it.label}
                          <span style={{ color: 'var(--muted)' }}> · {SECTORS[it.sector]?.label || it.sector}</span>
                        </span>
                        <span style={{ fontFamily: 'var(--fm)', fontSize: 12, color: 'var(--muted)' }}>
                          {it.feito} de {it.qtd}{it.ajustado ? '*' : ''}
                        </span>
                        <StatusEntrega status={statusItem(it, h.mes)} />
                      </div>
                    ))}
                    {h.itens.some(it => it.ajustado) && (
                      <p style={{ ...S.nota, marginTop: 6 }}>* quantidade ajustada naquele mês</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}

// Ajuste de quantidades só do mês em tela. Deixar igual ao contrato
// remove o ajuste.
function AjusteMes({ itens, mes, onCancel, onSave }) {
  const [valores, setValores] = useState(() => Object.fromEntries(itens.map(it => [it.id, String(it.qtd)])));
  const [salvando, setSalvando] = useState(false);

  const salvar = async () => {
    setSalvando(true);
    const qtds = {};
    itens.forEach(it => {
      const v = Math.max(0, Math.round(Number(valores[it.id]) || 0));
      if (v === it.qtdContrato) { if (it.ajustado) qtds[it.id] = null; }
      else if (v !== it.qtd || !it.ajustado) qtds[it.id] = v;
    });
    await onSave(qtds);
    setSalvando(false);
  };

  return (
    <div style={{ background: 'var(--bg3)', borderRadius: 12, padding: 14 }}>
      <p style={{ ...S.nota, marginBottom: 10, lineHeight: 1.5 }}>
        Quantidades só de {rotuloMes(mes, true).toLowerCase()}. Use para o primeiro mês de quem entrou no meio
        do mês ou para um combinado pontual. O contrato e os outros meses não mudam.
      </p>
      {itens.map(it => (
        <div key={it.id} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <span style={{ flex: 1, fontSize: 13, color: 'var(--text)' }}>
            {it.label} <span style={{ color: 'var(--muted)', fontSize: 11 }}>· contrato: {it.qtdContrato}</span>
          </span>
          <input
            type="number"
            min={0}
            value={valores[it.id]}
            onChange={e => setValores(v => ({ ...v, [it.id]: e.target.value }))}
            style={S.num}
            aria-label={`Quantidade de ${it.label} neste mês`}
          />
        </div>
      ))}
      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <button type="button" className="ui-btn primary" disabled={salvando} onClick={salvar}>
          {salvando ? 'Salvando...' : 'Salvar ajuste'}
        </button>
        <button type="button" className="ui-btn" onClick={onCancel}>Cancelar</button>
      </div>
    </div>
  );
}

const S = {
  cab: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, flexWrap: 'wrap' },
  tit: { fontSize: 14, fontWeight: 500, color: 'var(--text)' },
  mes: { fontSize: 12, color: 'var(--muted)' },
  nota: { fontSize: 11.5, color: 'var(--muted)' },
  unica: { display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--border)' },
  unicaNome: { fontSize: 13, fontWeight: 500, color: 'var(--text)' },
  hist: { borderBottom: '1px solid var(--border)' },
  histCab: { display: 'flex', alignItems: 'center', gap: 8, width: '100%', background: 'none', border: 'none', padding: '10px 0', cursor: 'pointer', textAlign: 'left' },
  histLinha: { display: 'flex', alignItems: 'center', gap: 10, padding: '5px 0' },
  num: { width: 72, background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8, padding: '7px 9px', color: 'var(--text)', fontSize: 13, fontFamily: 'var(--fm)', outline: 'none' },
};
