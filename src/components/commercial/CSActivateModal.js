import React, { useState } from 'react';
import { X, Check } from 'lucide-react';
import { SECTORS } from '../../lib/firebase';

const COLOR = SECTORS.cs.color;

/*
 * Modal de conclusão de setup (CS).
 * A partir do contrato (briefing), o CS confirma os dados do cliente e
 * seleciona os RESPONSÁVEIS por setor (pode escolher mais de um por
 * setor). Ao concluir, o cliente é criado com uma estrutura de
 * onboarding e cai no kanban dos setores escolhidos.
 */
export default function CSActivateModal({ deal, collaborators, onClose, onActivate }) {
  const b = deal.briefing || {};
  const [name, setName] = useState(b.companyName || deal.leadName || '');
  const [responsibles, setResponsibles] = useState({}); // { setor: [nomes] }

  const toggle = (sector, personName) => {
    setResponsibles(r => {
      const cur = r[sector] || [];
      return { ...r, [sector]: cur.includes(personName) ? cur.filter(n => n !== personName) : [...cur, personName] };
    });
  };

  const chosenSectors = Object.keys(responsibles).filter(s => (responsibles[s] || []).length > 0);
  const canConclude = name.trim() && chosenSectors.length > 0;

  const conclude = () => {
    if (!canConclude) return;
    // Monta os dados do cliente a partir do contrato.
    const clientData = {
      name: name.trim(),
      active: true,
      cnpj: b.docId || '',
      contactName: b.contactName || '',
      contactPhone: b.contactPhone || '',
      contactEmail: b.contactEmail || '',
      contractMonths: b.contractMonths || '',
      saleTotal: b.saleTotal || null,
      services: b.servicesSummary || [],
      fromDealId: deal.id,
    };
    onActivate(clientData, responsibles);
  };

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1300, padding: 20 }}>
      <div onClick={e => e.stopPropagation()} className="fade-up" style={{ background: 'rgba(16,16,30,.99)', border: `1px solid ${COLOR}44`, borderRadius: 16, padding: 24, width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ fontSize: 18, fontWeight: 800, color: '#fff' }}>Concluir Setup</h3>
          <button onClick={onClose} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: 6, cursor: 'pointer', display: 'flex' }}><X size={15} color="var(--muted)" /></button>
        </div>

        <label style={LBL}>NOME DO CLIENTE</label>
        <input value={name} onChange={e => setName(e.target.value)} style={{ ...INP, marginTop: 6, marginBottom: 18 }} />

        <label style={LBL}>RESPONSÁVEIS POR SETOR</label>
        <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4, marginBottom: 12 }}>Escolha quem vai receber o cliente no onboarding. Pode selecionar mais de um por setor. Só os setores escolhidos entram no kanban de onboarding.</p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {Object.values(SECTORS).filter(s => s.id !== 'comercial' && s.id !== 'cs').map(s => {
            const people = collaborators.filter(c => c.sector === s.id && c.active);
            const sel = responsibles[s.id] || [];
            return (
              <div key={s.id}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                  <span style={{ fontSize: 13, color: s.color, fontWeight: 600 }}>{s.emoji} {s.label}</span>
                  {sel.length > 0 && <span style={{ fontSize: 10, color: 'var(--green)', fontFamily: 'var(--fm)' }}>{sel.length} selecionado(s)</span>}
                </div>
                {people.length === 0
                  ? <span style={{ fontSize: 11, color: 'var(--muted)' }}>Sem colaboradores ativos</span>
                  : (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {people.map(c => {
                        const active = sel.includes(c.name);
                        return (
                          <button key={c.id} type="button" onClick={() => toggle(s.id, c.name)} style={{ fontSize: 12, fontWeight: 600, padding: '5px 11px', borderRadius: 14, cursor: 'pointer', background: active ? `${s.color}22` : 'var(--surface)', color: active ? s.color : 'var(--muted)', border: `1px solid ${active ? `${s.color}66` : 'var(--border)'}`, display: 'flex', alignItems: 'center', gap: 4 }}>
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

        <button disabled={!canConclude} onClick={conclude} style={{ width: '100%', marginTop: 20, padding: '12px', borderRadius: 10, border: 'none', fontSize: 14, fontWeight: 700, cursor: canConclude ? 'pointer' : 'not-allowed', opacity: canConclude ? 1 : .5, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: 'linear-gradient(135deg,#22c55e,#16a34a)', color: '#fff' }}>
          <Check size={16} /> Concluir e enviar ao onboarding
        </button>
        {!canConclude && <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 8, textAlign: 'center' }}>Defina o nome e ao menos um responsável.</p>}
      </div>
    </div>
  );
}

const LBL = { fontSize: 10, letterSpacing: '.12em', color: 'var(--muted)', fontWeight: 600, fontFamily: 'var(--fm)', display: 'block' };
const INP = { width: '100%', background: '#12121f', border: '1px solid var(--border)', borderRadius: 9, padding: '10px 13px', color: 'var(--text)', fontSize: 13, outline: 'none', fontFamily: 'var(--f)' };
