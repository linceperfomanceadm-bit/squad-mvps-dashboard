import React from 'react';
import { Video } from 'lucide-react';
import { SECTORS, WD_SERVICE_CONFIG } from '../../lib/firebase';
import {
  Overlay, ModalHeader, Section, RO, Tag,
  money, fmtDateTime, BTN_PRIMARY, BTN_GREEN, BTN_CANCEL,
} from './ui';

const COLOR = SECTORS.cs.color;
const asArray = (v) => (Array.isArray(v) ? v : v ? [v] : []);

/*
 * MODAL DO CLIENTE NA ABA ONBOARDING.
 *
 * Mesmo componente para todo mundo, mudando só os botões:
 *   · setores (responsáveis) → leitura. Veem dados, time, serviços,
 *     briefing e a data da call.
 *   · CS Operacional e admin  → recebem onSchedule / onConfirm e
 *     ganham os botões de agendar, reagendar e confirmar a call.
 *
 * O anexo do CONTRATO nunca é renderizado aqui, de propósito: ele tem
 * CPF, CNPJ e valores e fica só guardado no Storage.
 */
export default function ClientOnboardingModal({
  client, onClose, onSchedule, onReschedule, onConfirm,
}) {
  const contrato = client.contrato || {};
  const briefing = contrato.briefing || client.briefing || '';
  const servicos = contrato.servicos || client.services || [];
  const anexo = contrato.anexoBriefing || null;
  const kickoff = client.kickoff || {};
  const agendada = !!kickoff.at;

  const exigidos = client.staffing?.sectors || [];
  const time = Object.entries(client.responsibles || {}).filter(([, v]) => asArray(v).length);
  const faltando = exigidos.filter(sid => !asArray(client.responsibles?.[sid]).length);

  return (
    <Overlay onClose={onClose}>
      <div style={{ background: 'rgba(16,16,30,.99)', border: '1px solid var(--border)', borderRadius: 16, padding: 24, width: '100%', maxWidth: 600, maxHeight: '88vh', overflowY: 'auto' }}>
        <ModalHeader title={client.name} onClose={onClose} />

        {/* Estado da call */}
        <div style={{ background: agendada ? `${COLOR}12` : 'var(--surface)', border: `1px solid ${agendada ? `${COLOR}40` : 'var(--border)'}`, borderRadius: 12, padding: 14, marginBottom: 18 }}>
          <p style={{ fontSize: 9, letterSpacing: '.12em', color: 'var(--muted)', fontFamily: 'var(--fm)' }}>CALL DE ONBOARDING</p>
          {agendada ? (
            <>
              <p style={{ fontSize: 17, fontWeight: 800, color: COLOR, marginTop: 5, fontFamily: 'var(--fm)' }}>
                📅 {fmtDateTime(kickoff.at)}
              </p>
              {kickoff.scheduledBy && (
                <p style={{ fontSize: 10, color: '#666', fontFamily: 'var(--fm)', marginTop: 4 }}>agendada por {kickoff.scheduledBy}</p>
              )}
              {kickoff.meetLink && (
                <a href={kickoff.meetLink} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 12, padding: '10px', borderRadius: 9, background: 'linear-gradient(135deg,#22c55e,#16a34a)', color: '#fff', fontSize: 12, fontWeight: 700, textDecoration: 'none' }}>
                  <Video size={14} /> Abrir call
                </a>
              )}
            </>
          ) : (
            <p style={{ fontSize: 13, color: 'var(--amber)', marginTop: 6, lineHeight: 1.5 }}>
              Aguardando o CS Operacional definir data e hora.
            </p>
          )}
        </div>

        {/* Ações da CS Operacional / admin */}
        {(onSchedule || onReschedule || onConfirm) && (
          <div style={{ display: 'flex', gap: 8, marginBottom: 18, flexWrap: 'wrap' }}>
            {!agendada && onSchedule && (
              <button style={{ ...BTN_PRIMARY, flex: 1 }} onClick={onSchedule}>Agendar call</button>
            )}
            {agendada && onReschedule && (
              <button style={{ ...BTN_CANCEL, flex: 1 }} onClick={onReschedule}>Reagendar</button>
            )}
            {agendada && onConfirm && (
              <button style={{ ...BTN_GREEN, flex: 1 }} onClick={onConfirm}>✓ Call realizada</button>
            )}
          </div>
        )}

        {faltando.length > 0 && (
          <div style={{ background: 'var(--amber-dim)', border: '1px solid var(--amber-b)', borderRadius: 10, padding: 12, marginBottom: 18 }}>
            <p style={{ fontSize: 12, color: 'var(--amber)', lineHeight: 1.5 }}>
              Aguardando indicação de responsável em: {faltando.map(s => SECTORS[s]?.label || s).join(', ')}.
            </p>
          </div>
        )}

        {time.length > 0 && (
          <Section title="Time do projeto" color={COLOR}>
            {time.map(([sid, v]) => (
              <div key={sid} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 5 }}>
                <span style={{ fontSize: 12, color: SECTORS[sid]?.color || 'var(--text)' }}>
                  {SECTORS[sid]?.emoji} {SECTORS[sid]?.label || sid}
                </span>
                <span style={{ fontSize: 11, color: '#bbb', fontFamily: 'var(--fm)', textAlign: 'right' }}>{asArray(v).join(', ')}</span>
              </div>
            ))}
          </Section>
        )}

        {(contrato.wdService || contrato.hasIdVisual) && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
            {contrato.wdService && (
              <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 8, background: `${SECTORS.webdesign.color}18`, color: SECTORS.webdesign.color, fontFamily: 'var(--fm)' }}>
                {WD_SERVICE_CONFIG[contrato.wdService]?.label || contrato.wdService}
              </span>
            )}
            {contrato.hasIdVisual && (
              <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 8, background: `${SECTORS.design.color}18`, color: SECTORS.design.color, fontFamily: 'var(--fm)' }}>
                ID Visual{client.idv?.responsible ? ` · ${client.idv.responsible}` : ''}
              </span>
            )}
          </div>
        )}

        {servicos.length > 0 && (
          <Section title="Serviços contratados" color={COLOR}>
            {servicos.map(s => (
              <div key={s.id} style={{ marginBottom: 12 }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{s.label}</p>
                {s.desc && <p style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.6, marginTop: 3, whiteSpace: 'pre-wrap' }}>{s.desc}</p>}
              </div>
            ))}
          </Section>
        )}

        {briefing && (
          <Section title="Briefing" color={COLOR}>
            <p style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{briefing}</p>
            {anexo?.url && (
              <a href={anexo.url} target="_blank" rel="noreferrer" style={{ display: 'inline-block', marginTop: 10, fontSize: 12, color: 'var(--blue)', fontFamily: 'var(--fm)' }}>
                📎 {anexo.name}
              </a>
            )}
          </Section>
        )}

        <Section title="Cliente" color={COLOR}>
          <RO label="Razão social" value={contrato.razaoSocial} />
          <RO label="Nome fantasia" value={contrato.tradeName || contrato.companyName} />
          <RO label="CNPJ" value={contrato.cnpj || client.cnpj} />
          <RO label="Representante" value={contrato.contactName || client.contactName} />
          <RO label="Telefone" value={contrato.contactPhone || client.contactPhone} />
          <RO label="E-mail" value={contrato.contactEmail || client.contactEmail} />
          <RO label="Endereço" value={contrato.address || client.address} />
          <RO label="Duração" value={(contrato.contractMonths || client.contractMonths) ? `${contrato.contractMonths || client.contractMonths} meses` : null} />
          <RO label="Valor" value={(contrato.saleTotal ?? client.saleTotal) != null ? money(contrato.saleTotal ?? client.saleTotal) : null} />
        </Section>

        {(contrato.observations || client.observations) && (
          <Section title="Observações" color={COLOR}>
            <p style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
              {contrato.observations || client.observations}
            </p>
          </Section>
        )}

        {kickoff.confirmedAt && (
          <div style={{ marginTop: 8 }}>
            <Tag text={`CALL REALIZADA · ${kickoff.confirmedBy || '—'}`} color="var(--green)" />
          </div>
        )}
      </div>
    </Overlay>
  );
}
