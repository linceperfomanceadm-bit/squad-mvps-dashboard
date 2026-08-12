import React, { useState } from 'react';
import { Check } from 'lucide-react';
import { SECTORS } from '../../lib/firebase';
import { Overlay, ModalHeader, LBL, INP, BTN_GREEN } from './ui';

const COLOR = SECTORS.cs.color;

/*
 * Confirmação da call de onboarding (CS Comercial).
 * O CS confirma o nome do cliente e define os RESPONSÁVEIS do projeto
 * por setor. Ao confirmar, o cliente é criado na coleção `clients` e
 * cai direto na aba "Kickoff" do CS Operacional.
 *
 * Nos setores operacionais aparecem todos os colaboradores ativos.
 * No CS, só os do time OPERACIONAL (quem toca o cliente no dia a dia).
 */
export default function CSResponsiblesModal({ deal, collaborators, onClose, onConfirm }) {
  const b = deal.briefing || {};
  const [name, setName] = useState(b.companyName || deal.leadName || '');
  const [responsibles, setResponsibles] = useState({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const toggle = (sectorId, personName) => {
    setResponsibles(r => {
      const cur = r[sectorId] || [];
      return {
        ...r,
        [sectorId]: cur.includes(personName) ? cur.filter(n => n !== personName) : [...cur, personName],
      };
    });
  };

  const peopleOf = (sectorId) => collaborators.filter(c => {
    if (c.sector !== sectorId || c.active === false) return false;
    // No CS, só o time operacional recebe cliente.
    if (sectorId === 'cs') return (c.csRole || 'operacional') === 'operacional';
    return true;
  });

  const chosenSectors = Object.keys(responsibles).filter(s => (responsibles[s] || []).length > 0);
  const canConfirm = name.trim() && chosenSectors.length > 0 && !busy;

  const confirm = async () => {
    if (!canConfirm) return;
    setBusy(true);
    setError('');
    const clean = {};
    chosenSectors.forEach(s => { clean[s] = responsibles[s]; });

    const clientData = {
      name: name.trim(),
      active: true,
      responsibles: clean,
      // Dados vindos do pré-formulário do closer
      contactName: b.contactName || '',
      contactCpf: b.contactCpf || '',
      cnpj: b.companyCnpj || b.docId || '',
      address: b.address || '',
      contactPhone: b.contactPhone || '',
      contactEmail: b.contactEmail || '',
      contractMonths: b.contractMonths || '',
      saleTotal: b.saleTotal != null ? b.saleTotal : null,
      services: b.servicesSummary || [],
      briefing: b.briefing || '',
      observations: b.observations || '',
      closedBy: deal.closerName || null,
      secondCloser: deal.secondCloser || null,
      fromDealId: deal.id,
      // Entra pendente de kickoff no CS Operacional
      kickoff: { pending: true, confirmedAt: null, confirmedBy: null },
      clientHealth: null,
      onboardingCallAt: deal.onboardingCall?.at || null,
    };

    const r = await onConfirm(clientData);
    setBusy(false);
    if (r && r.success === false) setError(r.error || 'Falha ao concluir o onboarding.');
  };

  return (
    <Overlay onClose={onClose}>
      <div style={{ background: 'rgba(16,16,30,.99)', border: `1px solid ${COLOR}44`, borderRadius: 16, padding: 24, width: '100%', maxWidth: 540, maxHeight: '88vh', overflowY: 'auto' }}>
        <ModalHeader title="Call de onboarding realizada" onClose={onClose} />
        <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 18, lineHeight: 1.5 }}>
          Confirme o nome do cliente e defina quem fica responsável por ele em cada setor.
          Depois disso o cliente é criado e vai para a aba de Kickoff do CS Operacional.
        </p>

        <p style={LBL}>NOME DO CLIENTE *</p>
        <input value={name} onChange={e => setName(e.target.value)} style={{ ...INP, marginTop: 6, marginBottom: 18 }} />

        <p style={LBL}>RESPONSÁVEIS POR SETOR *</p>
        <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4, marginBottom: 12 }}>
          Pode escolher mais de uma pessoa por setor. Só os setores com alguém marcado entram no projeto.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {Object.values(SECTORS).filter(s => s.id !== 'comercial').map(s => {
            const people = peopleOf(s.id);
            const sel = responsibles[s.id] || [];
            return (
              <div key={s.id}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                  <span style={{ fontSize: 13, color: s.color, fontWeight: 600 }}>{s.emoji} {s.label}</span>
                  {sel.length > 0 && <span style={{ fontSize: 10, color: 'var(--green)', fontFamily: 'var(--fm)' }}>{sel.length} selecionado(s)</span>}
                </div>
                {people.length === 0 ? (
                  <span style={{ fontSize: 11, color: 'var(--muted)' }}>Sem colaboradores ativos</span>
                ) : (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {people.map(c => {
                      const active = sel.includes(c.name);
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => toggle(s.id, c.name)}
                          style={{ fontSize: 12, fontWeight: 600, padding: '5px 11px', borderRadius: 14, cursor: 'pointer', background: active ? `${s.color}22` : 'var(--surface)', color: active ? s.color : 'var(--muted)', border: `1px solid ${active ? `${s.color}66` : 'var(--border)'}`, display: 'flex', alignItems: 'center', gap: 4 }}
                        >
                          {active && <Check size={11} />} {c.name}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {error && <p style={{ fontSize: 12, color: 'var(--neon)', marginTop: 14 }}>⚠ {error}</p>}

        <button
          disabled={!canConfirm}
          onClick={confirm}
          style={{ ...BTN_GREEN, width: '100%', marginTop: 20, padding: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: canConfirm ? 1 : .5, cursor: canConfirm ? 'pointer' : 'not-allowed' }}
        >
          <Check size={16} /> {busy ? 'Criando cliente...' : 'Concluir onboarding'}
        </button>
        {!canConfirm && !busy && (
          <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 8, textAlign: 'center' }}>
            Defina o nome e ao menos um responsável.
          </p>
        )}
      </div>
    </Overlay>
  );
}
