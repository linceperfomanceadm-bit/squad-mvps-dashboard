import React, { useState } from 'react';
import { Video, CalendarPlus, Pencil, Paperclip, Trash2, Check, X } from 'lucide-react';
import { SECTORS, WD_SERVICE_CONFIG, stageOf, CLIENT_STAGES } from '../../lib/firebase';
import { clientCallCalendarUrl } from '../../lib/calendarLink';
import ContractBlock from './ContractBlock';
import {
  Overlay, ModalHeader, Section, RO, Tag,
  money, fmtDateTime, fmtDate, INP, BTN_PRIMARY, BTN_GREEN, BTN_CANCEL,
} from './ui';

const COLOR = SECTORS.cs.color;
const KICKOFF_COLOR = 'var(--purple)';
const asArray = (v) => (Array.isArray(v) ? v : v ? [v] : []);

/*
 * MODAL DO CLIENTE — usado nas abas Kick Off e Onboarding.
 *
 * O mesmo componente para todo mundo, mudando só o que cada um pode
 * fazer. Quem passa handler, ganha botão:
 *
 *   onScheduleKickoff / onCancelKickoff / onConfirmKickoffCall
 *     → CS Comercial e admin. Só destrava com o quadro de
 *       responsáveis completo.
 *
 *   onSchedule / onReschedule / onConfirm
 *     → CS Operacional e admin, depois do Kick Off realizado.
 *
 *   onRename
 *     → libera a edição do nome do cliente. Quem renomeia mexe em
 *       card, solicitação e documento já criados (o nome está
 *       copiado neles), então isso é da CS Comercial e do admin.
 *
 *   onAddAttachment / onRemoveAttachment
 *     → anexos avulsos, adicionados depois do cadastro.
 *
 *   onRenewContract / onCloseContract / onReopenContract
 *     → prazo do contrato. É a CS que registra o desfecho.
 *
 *   nenhum handler
 *     → leitura pura. É o caso da CS Operacional na aba Kick Off e
 *       dos responsáveis de setor na aba Onboarding.
 *
 * O anexo do CONTRATO nunca é renderizado aqui, de propósito: ele tem
 * CPF, CNPJ e valores e fica só guardado no Storage.
 */
export default function ClientOnboardingModal({
  client, onClose,
  onScheduleKickoff, onCancelKickoff, onConfirmKickoffCall,
  onSchedule, onReschedule, onConfirm,
  onRename, onAddAttachment, onRemoveAttachment,
  onRenewContract, onCloseContract, onReopenContract,
}) {
  const [editandoNome, setEditandoNome] = useState(false);
  const [rascunho, setRascunho] = useState(client.name || '');
  const [salvandoNome, setSalvandoNome] = useState(false);
  const [erroNome, setErroNome] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erroAnexo, setErroAnexo] = useState('');
  const [removendo, setRemovendo] = useState(null);

  const contrato = client.contrato || {};
  const briefing = contrato.briefing || client.briefing || '';
  const servicos = contrato.servicos || client.services || [];
  const anexo = contrato.anexoBriefing || null;

  const stage = stageOf(client);
  const kickoffCall = client.kickoffCall || {};
  const onboardingCall = client.kickoff || {};

  const exigidos = client.staffing?.sectors || [];
  const time = Object.entries(client.responsibles || {}).filter(([, v]) => asArray(v).length);
  const faltando = exigidos.filter(sid => !asArray(client.responsibles?.[sid]).length);
  const quadroCompleto = faltando.length === 0;

  const participantes = time.flatMap(([, v]) => asArray(v));
  const anexos = Array.isArray(client.anexos) ? client.anexos : [];

  const salvarNome = async () => {
    setErroNome('');
    setSalvandoNome(true);
    const r = await onRename(rascunho);
    setSalvandoNome(false);
    if (r && r.success === false) { setErroNome(r.error || 'Não foi possível renomear.'); return; }
    setEditandoNome(false);
  };

  const enviarAnexo = async (file) => {
    if (!file) return;
    setErroAnexo('');
    setEnviando(true);
    const r = await onAddAttachment(file);
    setEnviando(false);
    if (r && r.success === false) setErroAnexo(r.error || 'Não foi possível enviar.');
  };

  const removerAnexo = async (anexo) => {
    setErroAnexo('');
    setRemovendo(anexo.id || anexo.path || anexo.url);
    const r = await onRemoveAttachment(anexo);
    setRemovendo(null);
    if (r && r.success === false) setErroAnexo(r.error || 'Não foi possível remover.');
  };

  return (
    <Overlay onClose={onClose}>
      <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 16, padding: 24, width: '100%', maxWidth: 600, maxHeight: '88vh', overflowY: 'auto' }}>
        <ModalHeader title={client.name} onClose={onClose} />

        {onRename && (editandoNome ? (
          <div style={{ marginBottom: 14 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                style={{ ...INP, flex: 1 }}
                value={rascunho}
                onChange={e => setRascunho(e.target.value)}
                placeholder="Nome do cliente"
                autoFocus
              />
              <button
                style={{ ...BTN_GREEN, padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 5, opacity: salvandoNome ? .6 : 1 }}
                disabled={salvandoNome}
                onClick={salvarNome}
              >
                <Check size={14} /> Salvar
              </button>
              <button
                style={{ ...BTN_CANCEL, padding: '10px 12px', display: 'flex', alignItems: 'center' }}
                onClick={() => { setEditandoNome(false); setRascunho(client.name || ''); setErroNome(''); }}
              >
                <X size={14} />
              </button>
            </div>
            <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 6, lineHeight: 1.5 }}>
              O nome novo também é aplicado nos cards, solicitações e documentos já criados para este cliente.
            </p>
            {erroNome && <p style={{ fontSize: 11, color: 'var(--neon)', marginTop: 5 }}>⚠ {erroNome}</p>}
          </div>
        ) : (
          <button
            style={{ background: 'none', border: 'none', padding: 0, marginBottom: 12, cursor: 'pointer', color: 'var(--muted)', fontSize: 11, fontFamily: 'var(--fm)', display: 'flex', alignItems: 'center', gap: 5 }}
            onClick={() => { setRascunho(client.name || ''); setEditandoNome(true); }}
          >
            <Pencil size={11} /> editar nome
          </button>
        ))}

        <div style={{ marginBottom: 16 }}>
          <Tag text={(CLIENT_STAGES[stage]?.label || stage).toUpperCase()} color={CLIENT_STAGES[stage]?.color || COLOR} />
        </div>

        {/* ── Call 1: Kick Off ── */}
        <CallBlock
          label="CALL DE KICK OFF"
          sublabel="CS Comercial + CS Operacional"
          color={KICKOFF_COLOR}
          call={kickoffCall}
          client={client}
          kind="kickoff"
          participants={participantes}
          waitingText={
            !quadroCompleto
              ? `Bloqueada até os líderes indicarem responsável em: ${faltando.map(s => SECTORS[s]?.label || s).join(', ')}.`
              : 'Aguardando a CS Comercial definir data e hora.'
          }
        />

        {(onScheduleKickoff || onCancelKickoff || onConfirmKickoffCall) && stage === 'kickoff' && (
          <div style={{ display: 'flex', gap: 8, marginBottom: 18, flexWrap: 'wrap' }}>
            {!kickoffCall.at && onScheduleKickoff && (
              <button
                style={{ ...BTN_PRIMARY, flex: 1, opacity: quadroCompleto ? 1 : .45, cursor: quadroCompleto ? 'pointer' : 'not-allowed' }}
                disabled={!quadroCompleto}
                onClick={onScheduleKickoff}
              >
                Agendar Kick Off
              </button>
            )}
            {kickoffCall.at && onScheduleKickoff && (
              <button style={{ ...BTN_CANCEL, flex: 1 }} onClick={onScheduleKickoff}>Reagendar</button>
            )}
            {kickoffCall.at && onCancelKickoff && (
              <button style={BTN_CANCEL} onClick={onCancelKickoff}>Cancelar agendamento</button>
            )}
            {kickoffCall.at && onConfirmKickoffCall && (
              <button style={{ ...BTN_GREEN, flex: 1 }} onClick={onConfirmKickoffCall}>✓ Kick Off realizado</button>
            )}
          </div>
        )}

        {/* ── Call 2: Onboarding ── */}
        {(stage === 'onboarding' || stage === 'live' || onboardingCall.at) && (
          <>
            <CallBlock
              label="CALL DE ONBOARDING"
              sublabel="CS Operacional + time do projeto"
              color={COLOR}
              call={onboardingCall}
              client={client}
              kind="onboarding"
              participants={participantes}
              waitingText="Aguardando a CS Operacional definir data e hora."
            />

            {(onSchedule || onReschedule || onConfirm) && (
              <div style={{ display: 'flex', gap: 8, marginBottom: 18, flexWrap: 'wrap' }}>
                {!onboardingCall.at && onSchedule && (
                  <button style={{ ...BTN_PRIMARY, flex: 1 }} onClick={onSchedule}>Agendar onboarding</button>
                )}
                {onboardingCall.at && onReschedule && (
                  <button style={{ ...BTN_CANCEL, flex: 1 }} onClick={onReschedule}>Reagendar</button>
                )}
                {onboardingCall.at && onConfirm && (
                  <button style={{ ...BTN_GREEN, flex: 1 }} onClick={onConfirm}>✓ Call realizada</button>
                )}
              </div>
            )}
          </>
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
            {time.map(([sid, v]) => {
              const indicacao = client.staffing?.log?.[sid];
              return (
                <div key={sid} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
                  <span style={{ fontSize: 12, color: SECTORS[sid]?.color || 'var(--text)' }}>
                    {SECTORS[sid]?.emoji} {SECTORS[sid]?.label || sid}
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'var(--fm)', textAlign: 'right' }}>
                    {asArray(v).join(', ')}
                    {indicacao?.at && (
                      <>
                        <br />
                        <span style={{ fontSize: 10, color: 'var(--dim)' }}>
                          indicado em {fmtDate(indicacao.at)}{indicacao.by ? ` por ${indicacao.by}` : ''}
                        </span>
                      </>
                    )}
                  </span>
                </div>
              );
            })}
          </Section>
        )}

        {(contrato.wdService || contrato.hasIdVisual) && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
            {contrato.wdService && (
              <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 8, background: `color-mix(in srgb, ${SECTORS.webdesign.color} 9%, transparent)`, color: SECTORS.webdesign.color, fontFamily: 'var(--fm)' }}>
                {WD_SERVICE_CONFIG[contrato.wdService]?.label || contrato.wdService}
              </span>
            )}
            {contrato.hasIdVisual && (
              <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 8, background: `color-mix(in srgb, ${SECTORS.design.color} 9%, transparent)`, color: SECTORS.design.color, fontFamily: 'var(--fm)' }}>
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

        {(onRenewContract || onCloseContract) && (
          <ContractBlock
            client={client}
            color={COLOR}
            onRenew={onRenewContract}
            onClose={onCloseContract}
            onReopen={onReopenContract}
          />
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

        {(onAddAttachment || anexos.length > 0) && (
          <Section title="Anexos" color={COLOR}>
            {anexos.length === 0 && (
              <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 10 }}>
                Nenhum arquivo além do cadastro.
              </p>
            )}

            {anexos.map((a, i) => {
              const chave = a.id || a.path || a.url || i;
              const saindo = removendo === (a.id || a.path || a.url);
              return (
                <div key={chave} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 0', borderBottom: i < anexos.length - 1 ? '1px solid var(--border)' : 'none', opacity: saindo ? .45 : 1 }}>
                  <Paperclip size={13} color="var(--muted)" style={{ flexShrink: 0 }} />
                  <a
                    href={a.url}
                    target="_blank"
                    rel="noreferrer"
                    style={{ flex: 1, fontSize: 12, color: 'var(--blue)', textDecoration: 'none', wordBreak: 'break-all' }}
                  >
                    {a.name}
                  </a>
                  <span style={{ fontSize: 10, color: 'var(--muted)', fontFamily: 'var(--fm)', whiteSpace: 'nowrap' }}>
                    {a.by ? `${a.by} · ` : ''}{fmtDate(a.at)}
                  </span>
                  {onRemoveAttachment && (
                    <button
                      style={{ background: 'none', border: 'none', padding: 4, cursor: 'pointer', display: 'flex', flexShrink: 0 }}
                      disabled={saindo}
                      onClick={() => removerAnexo(a)}
                      title="Remover anexo"
                    >
                      <Trash2 size={13} color="var(--muted)" />
                    </button>
                  )}
                </div>
              );
            })}

            {onAddAttachment && (
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 12, padding: '9px 14px', borderRadius: 9, border: '1px dashed var(--border)', background: 'var(--surface)', color: enviando ? 'var(--muted)' : 'var(--text)', fontSize: 12, fontWeight: 600, cursor: enviando ? 'default' : 'pointer' }}>
                <Paperclip size={13} />
                {enviando ? 'Enviando...' : 'Adicionar arquivo'}
                <input
                  type="file"
                  disabled={enviando}
                  style={{ display: 'none' }}
                  onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; enviarAnexo(f); }}
                />
              </label>
            )}

            {erroAnexo && <p style={{ fontSize: 11, color: 'var(--neon)', marginTop: 8 }}>⚠ {erroAnexo}</p>}
          </Section>
        )}

        {onboardingCall.confirmedAt && (
          <div style={{ marginTop: 8 }}>
            <Tag text={`ONBOARDING REALIZADO · ${onboardingCall.confirmedBy || '—'}`} color="var(--green)" />
          </div>
        )}
      </div>
    </Overlay>
  );
}

// ── Bloco de uma call (estado + link + adicionar à agenda) ─────
function CallBlock({ label, sublabel, color, call, client, kind, participants, waitingText }) {
  const agendada = !!call?.at;
  const calendarUrl = agendada
    ? clientCallCalendarUrl({ kind, client, at: call.at, meetLink: call.meetLink, participants })
    : null;

  return (
    <div style={{ background: agendada ? `color-mix(in srgb, ${color} 7%, transparent)` : 'var(--surface)', border: `1px solid ${agendada ? `color-mix(in srgb, ${color} 25%, transparent)` : 'var(--border)'}`, borderRadius: 12, padding: 14, marginBottom: 14 }}>
      <p style={{ fontSize: 9, letterSpacing: '.12em', color: 'var(--muted)', fontFamily: 'var(--fm)' }}>{label}</p>
      <p style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>{sublabel}</p>

      {agendada ? (
        <>
          <p style={{ fontSize: 17, fontWeight: 600, color, marginTop: 8, fontFamily: 'var(--fm)' }}>
            📅 {fmtDateTime(call.at)}
          </p>
          {call.scheduledBy && (
            <p style={{ fontSize: 10, color: 'var(--muted)', fontFamily: 'var(--fm)', marginTop: 4 }}>agendada por {call.scheduledBy}</p>
          )}
          <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
            {call.meetLink && (
              <a href={call.meetLink} target="_blank" rel="noreferrer" style={{ flex: 1, minWidth: 130, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '10px', borderRadius: 9, background: 'var(--green)', color: 'var(--on)', fontSize: 12, fontWeight: 700, textDecoration: 'none' }}>
                <Video size={14} /> Abrir call
              </a>
            )}
            {calendarUrl && (
              <a href={calendarUrl} target="_blank" rel="noreferrer" style={{ flex: 1, minWidth: 130, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '10px', borderRadius: 9, background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--muted)', fontSize: 12, fontWeight: 700, textDecoration: 'none' }}>
                <CalendarPlus size={14} /> Adicionar à agenda
              </a>
            )}
          </div>
        </>
      ) : (
        <p style={{ fontSize: 13, color: 'var(--amber)', marginTop: 8, lineHeight: 1.5 }}>{waitingText}</p>
      )}

      {call?.confirmedAt && (
        <p style={{ fontSize: 10, color: 'var(--green)', fontFamily: 'var(--fm)', marginTop: 10 }}>
          ✓ realizada em {fmtDateTime(call.confirmedAt)}{call.confirmedBy ? ` por ${call.confirmedBy}` : ''}
        </p>
      )}
    </div>
  );
}
