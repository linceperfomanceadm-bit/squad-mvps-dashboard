import React, { useState } from 'react';
import { Check, Square, CheckSquare } from 'lucide-react';
import { SECTORS, WD_SERVICE_CONFIG, WD_WEB_SERVICES } from '../../lib/firebase';
import { Overlay, ModalHeader, MODAL, LBL, INP, BTN_PRIMARY, BTN_CANCEL } from './ui';

/*
 * Cadastro manual de cliente — CS Operacional.
 *
 * Existe para o caso do cliente que não veio pelo funil comercial.
 * Entra direto como ATIVO (sem kickoff pendente), porque quem está
 * cadastrando já está com ele na mão.
 *
 * ID Visual é um serviço à parte: marcar aqui exige escolher o
 * designer, e a demanda vai para o painel DELE — não aparece no
 * quadro do time de web.
 */

const asArray = (val) => (Array.isArray(val) ? val : (val ? [val] : []));

function MultiResponsibleSelect({ sector, collaborators, selected, onChange }) {
  const sectorCollabs = collaborators.filter(c => c.sector === sector.id && c.active !== false);
  const sel = asArray(selected);
  const toggle = (name) => {
    if (sel.includes(name)) onChange(sel.filter(n => n !== name));
    else onChange([...sel, name]);
  };
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
      <span style={{ fontSize: 13, color: sector.color, minWidth: 110, display: 'flex', alignItems: 'center', gap: 5, paddingTop: 4 }}>
        {sector.emoji} {sector.label}
      </span>
      <div style={{ flex: 1, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {sectorCollabs.length === 0
          ? <span style={{ fontSize: 12, color: 'var(--muted)', paddingTop: 4 }}>Sem colaboradores</span>
          : sectorCollabs.map(c => {
            const active = sel.includes(c.name);
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => toggle(c.name)}
                style={{
                  fontSize: 12, fontWeight: 600, padding: '5px 11px', borderRadius: 16, cursor: 'pointer',
                  background: active ? `${sector.color}22` : 'var(--surface)',
                  color: active ? sector.color : 'var(--muted)',
                  border: `1px solid ${active ? `${sector.color}66` : 'var(--border)'}`,
                  display: 'flex', alignItems: 'center', gap: 4,
                }}
              >
                {active && <Check size={11} />} {c.name}
              </button>
            );
          })}
      </div>
    </div>
  );
}

export default function CSAddClientModal({ collaborators, onClose, onAdd }) {
  const [form, setForm] = useState({
    name: '', wdService: '', responsibles: {},
    idVisual: false, idVisualResponsible: '',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const designers = collaborators
    .filter(c => c.sector === 'design' && c.active !== false)
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));

  const salvar = async () => {
    setError('');
    if (!form.name.trim()) { setError('Preencha o nome do cliente.'); return; }
    if (form.idVisual && !form.idVisualResponsible) {
      setError('Escolha o designer responsável pelo ID Visual.');
      return;
    }
    setBusy(true);
    const res = await onAdd({
      name: form.name.trim(),
      wdService: form.wdService || '',
      responsibles: form.responsibles,
      idVisualResponsible: form.idVisual ? form.idVisualResponsible : '',
      // Cadastro manual entra ativo: não passa pelo kickoff do funil.
      kickoff: { pending: false, confirmedAt: new Date().toISOString(), confirmedBy: 'Cadastro manual' },
      manualEntry: true,
    });
    setBusy(false);
    if (res.success) onClose();
    else setError(res.error || 'Não foi possível cadastrar.');
  };

  return (
    <Overlay onClose={onClose}>
      <div style={{ ...MODAL, maxWidth: 560 }}>
        <ModalHeader title="Novo cliente" onClose={onClose} />
        <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 16, lineHeight: 1.55 }}>
          Para clientes que não vieram pelo funil comercial. Entra direto como ativo, sem passar pelo Kickoff.
        </p>

        <p style={LBL}>NOME DO CLIENTE *</p>
        <input
          style={{ ...INP, marginTop: 6, marginBottom: 14 }}
          value={form.name}
          onChange={e => set('name', e.target.value)}
          placeholder="Ex: Empresa XYZ"
          autoFocus
        />

        <p style={LBL}>SERVIÇO WEBDESIGN</p>
        <select
          style={{ ...INP, marginTop: 6, marginBottom: 14, cursor: 'pointer' }}
          value={form.wdService}
          onChange={e => set('wdService', e.target.value)}
        >
          <option value="">Nenhum (sem WebDesign)</option>
          {WD_WEB_SERVICES.map(k => (
            <option key={k} value={k}>{WD_SERVICE_CONFIG[k]?.label || k}</option>
          ))}
        </select>

        {/* ID Visual */}
        <div style={{
          background: form.idVisual ? 'var(--neon-dim)' : 'var(--surface)',
          border: `1px solid ${form.idVisual ? 'var(--neon-border)' : 'var(--border)'}`,
          borderRadius: 11, padding: 14, marginBottom: 16,
        }}>
          <button
            type="button"
            onClick={() => setForm(f => ({ ...f, idVisual: !f.idVisual, idVisualResponsible: '' }))}
            style={{
              display: 'flex', alignItems: 'center', gap: 9, background: 'transparent', border: 'none',
              padding: 0, width: '100%', textAlign: 'left', cursor: 'pointer',
              color: form.idVisual ? 'var(--neon)' : 'var(--text)', fontSize: 13, fontWeight: 700,
            }}
          >
            {form.idVisual ? <CheckSquare size={16} /> : <Square size={16} color="var(--muted)" />}
            ID Visual
          </button>
          <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 8, lineHeight: 1.55 }}>
            Vai para o painel do designer escolhido, com onboarding, produção e checklist próprios.
            O time de WebDesign não enxerga essa demanda.
          </p>

          {form.idVisual && (
            <>
              <p style={{ ...LBL, marginTop: 12 }}>DESIGNER RESPONSÁVEL *</p>
              <select
                style={{ ...INP, marginTop: 6, cursor: 'pointer' }}
                value={form.idVisualResponsible}
                onChange={e => set('idVisualResponsible', e.target.value)}
              >
                <option value="">Selecionar designer</option>
                {designers.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
              </select>
              {designers.length === 0 && (
                <p style={{ fontSize: 11, color: 'var(--amber)', marginTop: 8 }}>
                  Nenhum designer ativo cadastrado.
                </p>
              )}
            </>
          )}
        </div>

        <p style={LBL}>RESPONSÁVEIS POR SETOR</p>
        <p style={{ fontSize: 11, color: 'var(--muted)', margin: '6px 0 10px' }}>
          Clique para adicionar ou remover. Pode escolher mais de um por setor.
        </p>
        {Object.values(SECTORS).map(s => (
          <MultiResponsibleSelect
            key={s.id}
            sector={s}
            collaborators={collaborators}
            selected={form.responsibles[s.id]}
            onChange={(arr) => set('responsibles', { ...form.responsibles, [s.id]: arr })}
          />
        ))}

        {error && <p style={{ fontSize: 12, color: 'var(--neon)', marginTop: 12 }}>⚠ {error}</p>}

        <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
          <button style={{ ...BTN_PRIMARY, flex: 1, opacity: busy ? .6 : 1 }} disabled={busy} onClick={salvar}>
            {busy ? 'Cadastrando...' : 'Cadastrar cliente'}
          </button>
          <button style={BTN_CANCEL} onClick={onClose}>Cancelar</button>
        </div>
      </div>
    </Overlay>
  );
}
