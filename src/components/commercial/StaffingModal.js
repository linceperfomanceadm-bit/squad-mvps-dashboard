import React, { useState } from 'react';
import { Check, RefreshCw, Paperclip } from 'lucide-react';
import { SECTORS, WD_SERVICE_CONFIG, driveDoCliente } from '../../lib/firebase';
import { Overlay, ModalHeader, Section, LBL, BTN_GREEN, BTN_CANCEL, money, LinkDrive } from './ui';

const asArray = (v) => (Array.isArray(v) ? v : v ? [v] : []);

/*
 * INDICAÇÃO DE RESPONSÁVEIS — usado pelo líder de cada setor.
 *
 * O líder vê o briefing e os serviços contratados para decidir quem
 * pega o cliente, e escolhe uma ou mais pessoas DO SETOR DELE. Quando
 * o último setor pendente é preenchido, o cliente é ativado na base
 * automaticamente (a regra vive no hook, não aqui).
 *
 * O admin usa o mesmo modal, mas pode indicar por qualquer setor —
 * é o destravamento de quando um líder está ausente.
 *
 * TROCA: setor já indicado mostra quem está no cliente e um botão
 * "Trocar". Ele abre a mesma lista de pessoas, já marcada com os
 * atuais, e salva por cima. Enquanto o cliente está em fluxo isso é
 * rotina (férias, saída, redistribuição de carga) e não deveria
 * exigir o admin.
 */
export default function StaffingModal({ client, sectors, collaborators, onClose, onConfirm, toast }) {
  const [sel, setSel] = useState({});
  const [busy, setBusy] = useState('');
  const [idvOwner, setIdvOwner] = useState('');
  // Setores que a pessoa abriu para trocar. Vazio = mostra só quem
  // já está no cliente, para ninguém mexer sem querer.
  const [editando, setEditando] = useState({});

  const abrirTroca = (sectorId, atuais) => {
    setSel(r => ({ ...r, [sectorId]: atuais }));
    if (sectorId === 'design' && client.idv?.responsible) setIdvOwner(client.idv.responsible);
    setEditando(e => ({ ...e, [sectorId]: true }));
  };

  const contrato = client.contrato || {};
  const briefing = contrato.briefing || client.briefing || '';
  const servicos = contrato.servicos || client.services || [];
  const anexo = contrato.anexoBriefing || null;
  const drive = driveDoCliente(client);

  const toggle = (sectorId, personName) => {
    setSel(r => {
      const cur = r[sectorId] || [];
      return {
        ...r,
        [sectorId]: cur.includes(personName) ? cur.filter(n => n !== personName) : [...cur, personName],
      };
    });
  };

  // A CS é um time só: qualquer colaborador ativo do setor pode ser
  // indicado, inclusive quem ainda está cadastrado como 'comercial'.
  const peopleOf = (sectorId) => collaborators.filter(c => c.sector === sectorId && c.active !== false);

  const temIdVisual = !!contrato.hasIdVisual;

  // Quadro do projeto fora dos setores que esta pessoa preenche: o
  // líder enxerga o que os outros líderes já decidiram (e quem ainda
  // falta), para escolher o time olhando o conjunto.
  const setoresDoProjeto = Array.from(new Set([
    ...(client.staffing?.sectors || []),
    ...Object.keys(client.responsibles || {}).filter(sid => asArray(client.responsibles[sid]).length),
  ])).filter(sid => !sectors.includes(sid));

  const salvar = async (sectorId) => {
    const nomes = sel[sectorId] || [];
    if (!nomes.length) return;
    setBusy(sectorId);
    // Na troca o ID Visual pode existir mesmo sem a marcação no
    // contrato (admin adicionou depois), então o dono vai junto.
    const opts = sectorId === 'design' && (temIdVisual || client.idv?.responsible)
      ? { idvResponsible: idvOwner || nomes[0] }
      : {};
    const r = await onConfirm(sectorId, nomes, opts);
    setBusy('');
    if (!r.success) { toast?.(r.error, 'e'); return; }
    setEditando(e => ({ ...e, [sectorId]: false }));
    const setorNome = SECTORS[sectorId]?.label || sectorId;
    toast?.(r.activated
      ? `${client.name} está ativo! Foi para o Onboarding do CS Operacional. 🎉`
      : r.trocado
        ? `Responsáveis de ${setorNome} atualizados: ${nomes.join(', ')}.`
        : `Responsáveis de ${setorNome} definidos.`);
  };

  return (
    <Overlay onClose={onClose}>
      <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 16, padding: 24, width: '100%', maxWidth: 620, maxHeight: '88vh', overflowY: 'auto' }}>
        <ModalHeader title={client.name} onClose={onClose} />
        <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: -8, marginBottom: 18, lineHeight: 1.5 }}>
          Leia o briefing e defina quem fica responsável por este cliente. Pode escolher mais de uma
          pessoa — e trocar depois, enquanto o cliente ainda está em onboarding.
        </p>

        {servicos.length > 0 && (
          <Section title="Serviços contratados" color="var(--neon)">
            {servicos.map(s => (
              <div key={s.id} style={{ marginBottom: 12 }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{s.label}</p>
                {s.desc && <p style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.6, marginTop: 3, whiteSpace: 'pre-wrap' }}>{s.desc}</p>}
              </div>
            ))}
            {(temIdVisual || contrato.wdService) && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                {contrato.wdService && (
                  <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 8, background: `color-mix(in srgb, ${SECTORS.webdesign.color} 9%, transparent)`, color: SECTORS.webdesign.color, fontFamily: 'var(--fm)' }}>
                    {WD_SERVICE_CONFIG[contrato.wdService]?.label || contrato.wdService}
                  </span>
                )}
                {temIdVisual && (
                  <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 8, background: `color-mix(in srgb, ${SECTORS.design.color} 9%, transparent)`, color: SECTORS.design.color, fontFamily: 'var(--fm)' }}>
                    ID Visual
                  </span>
                )}
              </div>
            )}
            {contrato.contractMonths && (
              <p style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'var(--fm)' }}>
                {contrato.contractMonths} meses{contrato.saleTotal != null ? ` · ${money(contrato.saleTotal)}` : ''}
              </p>
            )}
          </Section>
        )}

        {(briefing || drive || anexo?.url) && (
          <Section title="Briefing" color="var(--neon)">
            {briefing && <p style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{briefing}</p>}
            {(drive || anexo?.url) && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginTop: briefing ? 12 : 0 }}>
                <LinkDrive url={drive} />
                {/* Anexo de briefing do formato antigo (o campo saiu do cadastro). */}
                {anexo?.url && (
                  <a href={anexo.url} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--blue)', fontFamily: 'var(--fm)', textDecoration: 'none' }}>
                    <Paperclip size={12} /> {anexo.name}
                  </a>
                )}
              </div>
            )}
          </Section>
        )}

        {setoresDoProjeto.length > 0 && (
          <Section title="Time do projeto" color="var(--blue)">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {setoresDoProjeto.map(sid => {
                const s = SECTORS[sid] || { label: sid, color: 'var(--muted)', emoji: '📦' };
                const nomes = asArray(client.responsibles?.[sid]);
                return (
                  <div key={sid} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: s.color, minWidth: 120 }}>{s.emoji} {s.label}</span>
                    {nomes.length > 0 ? (
                      <span style={{ display: 'flex', flexWrap: 'wrap', gap: 5, flex: 1 }}>
                        {nomes.map(n => (
                          <span key={n} style={{ fontSize: 11, fontWeight: 600, padding: '2px 9px', borderRadius: 10, background: `color-mix(in srgb, ${s.color} 11%, transparent)`, color: s.color, border: `1px solid color-mix(in srgb, ${s.color} 30%, transparent)` }}>
                            {n}{sid === 'design' && client.idv?.responsible === n && nomes.length > 1 ? ' · ID Visual' : ''}
                          </span>
                        ))}
                      </span>
                    ) : (
                      <span style={{ fontSize: 12, color: 'var(--amber)', fontStyle: 'italic' }}>aguardando o líder</span>
                    )}
                  </div>
                );
              })}
            </div>
          </Section>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 18, marginTop: 6 }}>
          {sectors.map(sid => {
            const s = SECTORS[sid] || { id: sid, label: sid, color: 'var(--muted)', emoji: '📦' };
            const jaTem = asArray(client.responsibles?.[sid]);
            const people = peopleOf(sid);
            const escolhidos = sel[sid] || [];
            return (
              <div key={sid}>
                <p style={LBL}>{s.emoji} {String(s.label).toUpperCase()}</p>
                {jaTem.length > 0 && !editando[sid] ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 6, flexWrap: 'wrap' }}>
                    <p style={{ fontSize: 12, color: 'var(--green)' }}>
                      ✓ Já definido: {jaTem.join(', ')}
                      {sid === 'design' && client.idv?.responsible && (
                        <span style={{ color: 'var(--muted)' }}> · ID Visual: {client.idv.responsible}</span>
                      )}
                    </p>
                    <button
                      type="button"
                      onClick={() => abrirTroca(sid, jaTem)}
                      style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'var(--surface)', border: '1px solid var(--border-h)', borderRadius: 8, padding: '5px 11px', fontSize: 11.5, fontWeight: 600, color: 'var(--muted)', cursor: 'pointer' }}
                    >
                      <RefreshCw size={11} /> Trocar
                    </button>
                  </div>
                ) : people.length === 0 ? (
                  <p style={{ fontSize: 12, color: 'var(--amber)', marginTop: 6 }}>
                    Nenhum colaborador ativo neste setor. Cadastre alguém antes de indicar.
                  </p>
                ) : (
                  <>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                      {people.map(c => {
                        const active = escolhidos.includes(c.name);
                        return (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => toggle(sid, c.name)}
                            style={{ fontSize: 12, fontWeight: 600, padding: '5px 11px', borderRadius: 14, cursor: 'pointer', background: active ? `color-mix(in srgb, ${s.color} 13%, transparent)` : 'var(--surface)', color: active ? s.color : 'var(--muted)', border: `1px solid ${active ? `color-mix(in srgb, ${s.color} 40%, transparent)` : 'var(--border)'}`, display: 'flex', alignItems: 'center', gap: 4 }}
                          >
                            {active && <Check size={11} />} {c.name}
                          </button>
                        );
                      })}
                    </div>
                    {sid === 'design' && (temIdVisual || client.idv?.responsible) && escolhidos.length > 1 && (
                      <div style={{ marginTop: 10, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 9, padding: 12 }}>
                        <p style={LBL}>QUEM FICA COM A ID VISUAL?</p>
                        <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4, marginBottom: 8, lineHeight: 1.5 }}>
                          A criação de marca tem um dono só. Os demais continuam responsáveis pelo cliente no Design.
                        </p>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          {escolhidos.map(nome => {
                            const on = (idvOwner || escolhidos[0]) === nome;
                            return (
                              <button
                                key={nome}
                                type="button"
                                onClick={() => setIdvOwner(nome)}
                                style={{ fontSize: 12, fontWeight: 600, padding: '5px 11px', borderRadius: 14, cursor: 'pointer', background: on ? `color-mix(in srgb, ${s.color} 13%, transparent)` : 'var(--surface)', color: on ? s.color : 'var(--muted)', border: `1px solid ${on ? `color-mix(in srgb, ${s.color} 40%, transparent)` : 'var(--border)'}` }}
                              >
                                {on ? '◉' : '○'} {nome}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    {editando[sid] && (
                      <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 8, lineHeight: 1.5 }}>
                        Quem sair da lista perde este cliente da carteira na hora. O que já foi produzido
                        continua no cliente.
                      </p>
                    )}
                    <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                      {editando[sid] && (
                        <button
                          type="button"
                          onClick={() => setEditando(e => ({ ...e, [sid]: false }))}
                          style={{ ...BTN_CANCEL, flex: '0 0 auto' }}
                        >
                          Cancelar
                        </button>
                      )}
                      <button
                        disabled={!escolhidos.length || busy === sid}
                        onClick={() => salvar(sid)}
                        style={{ ...BTN_GREEN, flex: 1, opacity: escolhidos.length ? 1 : .45, cursor: escolhidos.length ? 'pointer' : 'not-allowed' }}
                      >
                        {busy === sid
                          ? 'Salvando...'
                          : editando[sid] ? `Atualizar responsáveis de ${s.label}` : `Confirmar responsáveis de ${s.label}`}
                      </button>
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>

        <button style={{ ...BTN_CANCEL, width: '100%', marginTop: 20 }} onClick={onClose}>Fechar</button>
      </div>
    </Overlay>
  );
}
