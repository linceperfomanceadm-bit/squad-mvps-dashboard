import React, { useState } from 'react';
import { CalendarClock, RefreshCw, Ban, RotateCcw } from 'lucide-react';
import { contractState, CONTRACT_STATUS, CONTRACT_ALERT_DAYS } from '../../lib/firebase';
import { Section, Tag, INP, LBL, BTN_PRIMARY, BTN_CANCEL, fmtDate } from './ui';

/*
 * BLOCO DE CONTRATO — usado no modal do cliente da CS Comercial e no
 * drawer da CS Operacional.
 *
 * O prazo vem da duração que a CS Comercial preencheu no cadastro e
 * corre a partir da call de onboarding realizada. Nada disso é campo
 * gravado: `contractState()` deriva tudo, então cliente antigo já
 * entra com o relógio andando, sem migração.
 *
 * As ações só aparecem para quem recebe handler:
 *   onRenew  → CS e admin. Renovar SOMA meses ao prazo, não reinicia.
 *   onClose  → encerra o contrato (não desativa o cliente).
 *   onReopen → desfaz um encerramento feito por engano.
 */
export default function ContractBlock({ client, color = 'var(--c)', onRenew, onClose, onReopen }) {
  const [modo, setModo] = useState(null); // 'renew' | 'close'
  const [meses, setMeses] = useState('');
  const [motivo, setMotivo] = useState('');
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState('');

  const st = contractState(client);
  const cfg = CONTRACT_STATUS[st.status] || CONTRACT_STATUS.unknown;
  const alerta = st.status === 'ending' || st.status === 'expired';

  const fechar = () => { setModo(null); setMeses(''); setMotivo(''); setErro(''); };

  const confirmarRenovacao = async () => {
    setErro('');
    setBusy(true);
    const r = await onRenew(meses, motivo);
    setBusy(false);
    if (r && r.success === false) { setErro(r.error || 'Não foi possível renovar.'); return; }
    fechar();
  };

  const confirmarEncerramento = async () => {
    setErro('');
    setBusy(true);
    const r = await onClose(motivo);
    setBusy(false);
    if (r && r.success === false) { setErro(r.error || 'Não foi possível encerrar.'); return; }
    fechar();
  };

  const restante = () => {
    if (st.daysLeft == null) return null;
    if (st.daysLeft < 0) return `venceu há ${Math.abs(st.daysLeft)} dia${Math.abs(st.daysLeft) !== 1 ? 's' : ''}`;
    if (st.daysLeft === 0) return 'vence hoje';
    return `faltam ${st.daysLeft} dia${st.daysLeft !== 1 ? 's' : ''}`;
  };

  return (
    <Section title="Contrato" color={color}>
      <div style={{
        background: alerta ? `color-mix(in srgb, ${cfg.color} 8%, transparent)` : 'var(--surface)',
        border: `1px solid ${alerta ? `color-mix(in srgb, ${cfg.color} 30%, transparent)` : 'var(--border)'}`,
        borderRadius: 12, padding: 14, marginBottom: 12,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <CalendarClock size={14} color={cfg.color} />
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
              {st.months ? `${st.months} ${st.months === 1 ? 'mês' : 'meses'}` : 'Sem prazo definido'}
            </span>
          </div>
          <Tag text={cfg.label.toUpperCase()} color={cfg.color} />
        </div>

        {st.status === 'unknown' && (
          <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 9, lineHeight: 1.55 }}>
            A duração não foi preenchida no cadastro, ou o cliente ainda não teve a call de
            onboarding realizada — o relógio começa a correr a partir dela.
          </p>
        )}

        {st.status === 'closed' && (
          <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 9, lineHeight: 1.55 }}>
            Encerrado em {fmtDate(st.closedAt)}{st.closedBy ? ` por ${st.closedBy}` : ''}.
            {st.closeReason ? ` Motivo: ${st.closeReason}` : ''}
          </p>
        )}

        {st.endAt && st.status !== 'closed' && (
          <>
            <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 9, fontFamily: 'var(--fm)' }}>
              {fmtDate(st.startAt)} → {fmtDate(st.endAt)}
            </p>
            <p style={{ fontSize: 13, fontWeight: 700, color: cfg.color, marginTop: 5, fontFamily: 'var(--fm)' }}>
              {restante()}
            </p>
            {st.addedMonths > 0 && (
              <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 5 }}>
                {st.baseMonths} do contrato original + {st.addedMonths} de renovação
              </p>
            )}
            {alerta && (
              <p style={{ fontSize: 11, color: cfg.color, marginTop: 8, lineHeight: 1.5 }}>
                {st.status === 'expired'
                  ? 'O prazo já passou. Registre a renovação ou o encerramento para o cliente parar de aparecer aqui.'
                  : `Entra no aviso da CS a ${CONTRACT_ALERT_DAYS} dias do fim. Fale com o cliente e registre o desfecho.`}
              </p>
            )}
          </>
        )}
      </div>

      {st.renewals.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <p style={{ ...LBL, marginBottom: 6 }}>RENOVAÇÕES</p>
          {st.renewals.map((r, i) => (
            <div key={`${r.at || i}`} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, padding: '5px 0', borderBottom: i < st.renewals.length - 1 ? '1px solid var(--border)' : 'none' }}>
              <span style={{ fontSize: 12, color: 'var(--text)' }}>
                +{r.months} {r.months === 1 ? 'mês' : 'meses'}
                {r.note ? ` · ${r.note}` : ''}
              </span>
              <span style={{ fontSize: 10, color: 'var(--muted)', fontFamily: 'var(--fm)', whiteSpace: 'nowrap', textAlign: 'right' }}>
                {r.by ? `${r.by} · ` : ''}{fmtDate(r.at)}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* ── Ações ── */}
      {modo === null && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {onRenew && st.status !== 'closed' && (
            <button
              style={{ ...BTN_PRIMARY, flex: 1, minWidth: 150, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}
              onClick={() => { setModo('renew'); setMeses(''); setMotivo(''); setErro(''); }}
            >
              <RefreshCw size={14} /> Renovar contrato
            </button>
          )}
          {onClose && st.status !== 'closed' && (
            <button
              style={{ ...BTN_CANCEL, flex: 1, minWidth: 150, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}
              onClick={() => { setModo('close'); setMotivo(''); setErro(''); }}
            >
              <Ban size={14} /> Encerrar contrato
            </button>
          )}
          {onReopen && st.status === 'closed' && (
            <button
              style={{ ...BTN_CANCEL, flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}
              onClick={async () => { setBusy(true); await onReopen(); setBusy(false); }}
              disabled={busy}
            >
              <RotateCcw size={14} /> Reabrir contrato
            </button>
          )}
        </div>
      )}

      {modo === 'renew' && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 14 }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>Renovar contrato</p>
          <p style={{ fontSize: 11.5, color: 'var(--muted)', lineHeight: 1.55, marginBottom: 12 }}>
            Os meses são somados ao prazo atual, não reiniciam a contagem.
            {st.endAt ? ` Hoje o contrato vai até ${fmtDate(st.endAt)}.` : ''}
          </p>

          <p style={LBL}>RENOVADO POR QUANTOS MESES? *</p>
          <input
            style={{ ...INP, marginTop: 6, marginBottom: 12 }}
            value={meses}
            onChange={e => setMeses(e.target.value.replace(/\D/g, ''))}
            placeholder="Ex: 6"
            inputMode="numeric"
            autoFocus
          />

          <p style={LBL}>OBSERVAÇÃO</p>
          <input
            style={{ ...INP, marginTop: 6, marginBottom: 12 }}
            value={motivo}
            onChange={e => setMotivo(e.target.value)}
            placeholder="Ex: renovou com reajuste de 10%"
          />

          {erro && <p style={{ fontSize: 11, color: 'var(--neon)', marginBottom: 10 }}>⚠ {erro}</p>}

          <div style={{ display: 'flex', gap: 8 }}>
            <button style={{ ...BTN_PRIMARY, flex: 1, opacity: busy ? .6 : 1 }} disabled={busy} onClick={confirmarRenovacao}>
              {busy ? 'Salvando...' : 'Confirmar renovação'}
            </button>
            <button style={BTN_CANCEL} onClick={fechar}>Cancelar</button>
          </div>
        </div>
      )}

      {modo === 'close' && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 14 }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>Encerrar contrato</p>
          <p style={{ fontSize: 11.5, color: 'var(--muted)', lineHeight: 1.55, marginBottom: 12 }}>
            O cliente para de aparecer no aviso de vencimento. Ele continua ativo nos painéis
            de produção — desativar de vez é uma ação separada, na tela de clientes do admin.
          </p>

          <p style={LBL}>MOTIVO</p>
          <input
            style={{ ...INP, marginTop: 6, marginBottom: 12 }}
            value={motivo}
            onChange={e => setMotivo(e.target.value)}
            placeholder="Ex: não renovou por corte de verba"
            autoFocus
          />

          {erro && <p style={{ fontSize: 11, color: 'var(--neon)', marginBottom: 10 }}>⚠ {erro}</p>}

          <div style={{ display: 'flex', gap: 8 }}>
            <button style={{ ...BTN_PRIMARY, flex: 1, opacity: busy ? .6 : 1 }} disabled={busy} onClick={confirmarEncerramento}>
              {busy ? 'Salvando...' : 'Confirmar encerramento'}
            </button>
            <button style={BTN_CANCEL} onClick={fechar}>Cancelar</button>
          </div>
        </div>
      )}
    </Section>
  );
}
