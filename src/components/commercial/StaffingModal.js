import React, { useState } from 'react';
import { Check } from 'lucide-react';
import { SECTORS, WD_SERVICE_CONFIG } from '../../lib/firebase';
import { Overlay, ModalHeader, Section, LBL, BTN_GREEN, BTN_CANCEL, money } from './ui';

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
 */
export default function StaffingModal({ client, sectors, collaborators, onClose, onConfirm, toast }) {
  const [sel, setSel] = useState({});
  const [busy, setBusy] = useState('');
  const [idvOwner, setIdvOwner] = useState('');

  const contrato = client.contrato || {};
  const briefing = contrato.briefing || client.briefing || '';
  const servicos = contrato.servicos || client.services || [];
  const anexo = contrato.anexoBriefing || null;

  const toggle = (sectorId, personName) => {
    setSel(r => {
      const cur = r[sectorId] || [];
      return {
        ...r,
        [sectorId]: cur.includes(personName) ? cur.filter(n => n !== personName) : [...cur, personName],
      };
    });
  };

  const peopleOf = (sectorId) => collaborators.filter(c => {
    if (c.sector !== sectorId || c.active === false) return false;
    // No CS, quem toca o cliente no dia a dia é o time operacional.
    if (sectorId === 'cs') return (c.csRole || 'operacional') === 'operacional';
    return true;
  });

  const temIdVisual = !!contrato.hasIdVisual;

  const salvar = async (sectorId) => {
    const nomes = sel[sectorId] || [];
    if (!nomes.length) return;
    setBusy(sectorId);
    const opts = sectorId === 'design' && temIdVisual
      ? { idvResponsible: idvOwner || nomes[0] }
      : {};
    const r = await onConfirm(sectorId, nomes, opts);
    setBusy('');
    if (!r.success) { toast?.(r.error, 'e'); return; }
    toast?.(r.activated
      ? `${client.name} está ativo! Foi para o Onboarding do CS Operacional. 🎉`
      : `Responsáveis de ${SECTORS[sectorId]?.label || sectorId} definidos.`);
  };

  return (
    <Overlay onClose={onClose}>
      <div style={{ background: 'rgba(16,16,30,.99)', border: '1px solid var(--border)', borderRadius: 16, padding: 24, width: '100%', maxWidth: 620, maxHeight: '88vh', overflowY: 'auto' }}>
        <ModalHeader title={client.name} onClose={onClose} />
        <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: -8, marginBottom: 18, lineHeight: 1.5 }}>
          Leia o briefing e defina quem fica responsável por este cliente. Pode escolher mais de uma pessoa.
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
                  <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 8, background: `${SECTORS.webdesign.color}18`, color: SECTORS.webdesign.color, fontFamily: 'var(--fm)' }}>
                    {WD_SERVICE_CONFIG[contrato.wdService]?.label || contrato.wdService}
                  </span>
                )}
                {temIdVisual && (
                  <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 8, background: `${SECTORS.design.color}18`, color: SECTORS.design.color, fontFamily: 'var(--fm)' }}>
                    ID Visual
                  </span>
                )}
              </div>
            )}
            {contrato.contractMonths && (
              <p style={{ fontSize: 11, color: '#666', fontFamily: 'var(--fm)' }}>
                {contrato.contractMonths} meses{contrato.saleTotal != null ? ` · ${money(contrato.saleTotal)}` : ''}
              </p>
            )}
          </Section>
        )}

        {briefing && (
          <Section title="Briefing" color="var(--neon)">
            <p style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{briefing}</p>
            {anexo?.url && (
              <a href={anexo.url} target="_blank" rel="noreferrer" style={{ display: 'inline-block', marginTop: 10, fontSize: 12, color: 'var(--blue)', fontFamily: 'var(--fm)' }}>
                📎 {anexo.name}
              </a>
            )}
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
                {jaTem.length > 0 ? (
                  <p style={{ fontSize: 12, color: 'var(--green)', marginTop: 6 }}>
                    ✓ Já definido: {jaTem.join(', ')}
                  </p>
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
                            style={{ fontSize: 12, fontWeight: 600, padding: '5px 11px', borderRadius: 14, cursor: 'pointer', background: active ? `${s.color}22` : 'var(--surface)', color: active ? s.color : 'var(--muted)', border: `1px solid ${active ? `${s.color}66` : 'var(--border)'}`, display: 'flex', alignItems: 'center', gap: 4 }}
                          >
                            {active && <Check size={11} />} {c.name}
                          </button>
                        );
                      })}
                    </div>
                    {sid === 'design' && temIdVisual && escolhidos.length > 1 && (
                      <div style={{ marginTop: 10, background: 'rgba(255,255,255,.03)', border: '1px solid var(--border)', borderRadius: 9, padding: 12 }}>
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
                                style={{ fontSize: 12, fontWeight: 600, padding: '5px 11px', borderRadius: 14, cursor: 'pointer', background: on ? `${s.color}22` : 'var(--surface)', color: on ? s.color : 'var(--muted)', border: `1px solid ${on ? `${s.color}66` : 'var(--border)'}` }}
                              >
                                {on ? '◉' : '○'} {nome}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    <button
                      disabled={!escolhidos.length || busy === sid}
                      onClick={() => salvar(sid)}
                      style={{ ...BTN_GREEN, width: '100%', marginTop: 10, opacity: escolhidos.length ? 1 : .45, cursor: escolhidos.length ? 'pointer' : 'not-allowed' }}
                    >
                      {busy === sid ? 'Salvando...' : `Confirmar responsáveis de ${s.label}`}
                    </button>
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
