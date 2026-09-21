import React from 'react';
import { ClipboardEdit } from 'lucide-react';
import { CADASTRO_PENDENCIAS, CONTRACT_STATUS, contractState } from '../../lib/firebase';
import { cadastroPendencias } from '../../lib/entregas';
import { Overlay, ModalHeader, MODAL, fmtDate } from '../commercial/ui';
import { Tag } from '../shared/ui';
import EntregasCliente from './EntregasCliente';

const asArray = (v) => (Array.isArray(v) ? v : v ? [v] : []);
const TOM_CONTRATO = { active: 'good', ending: 'warn', expired: 'bad', closed: undefined, unknown: undefined };

/*
 * Card de contrato e entregas de um cliente — aberto pela lista
 * "Entregas × Contrato" (admin e CS) e pelo painel do líder da CS.
 * Reúne o que é preciso para responder "o cliente está recebendo o
 * que contratou?": prazo, pendências de cadastro e as entregas.
 */
export default function ClienteContratoModal({ client, onClose, onEditar, onMarcar, onAjustar }) {
  const pend = cadastroPendencias(client);
  const ct = contractState(client);
  const cfg = CONTRACT_STATUS[ct.status] || CONTRACT_STATUS.unknown;
  const cs = asArray(client.responsibles?.cs);

  return (
    <Overlay onClose={onClose}>
      <div style={{ ...MODAL, maxWidth: 640 }}>
        <ModalHeader title={client.name} onClose={onClose} />

        <div style={S.topo}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
              <Tag tone={TOM_CONTRATO[ct.status]}>{cfg.label}</Tag>
              {ct.endAt && ct.status !== 'closed' && (
                <span style={S.nota}>até {fmtDate(ct.endAt)}{ct.months ? ` · ${ct.months} meses` : ''}</span>
              )}
              {cs.length > 0 && <span style={S.nota}>CS: {cs.join(', ')}</span>}
            </div>
            {pend.length > 0 && (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
                {pend.map(p => <Tag key={p} tone="warn">Falta: {CADASTRO_PENDENCIAS[p]?.label || p}</Tag>)}
              </div>
            )}
          </div>
          {onEditar && (
            <button type="button" className={`ui-btn ${pend.length ? 'primary' : ''}`} onClick={onEditar} style={{ flexShrink: 0 }}>
              <ClipboardEdit size={14} /> {pend.length ? 'Completar cadastro' : 'Editar cadastro'}
            </button>
          )}
        </div>

        <EntregasCliente client={client} onMarcar={onMarcar} onAjustar={onAjustar} />
      </div>
    </Overlay>
  );
}

const S = {
  topo: { display: 'flex', gap: 12, alignItems: 'flex-start', padding: '4px 0 16px', marginBottom: 14, borderBottom: '1px solid var(--border)', flexWrap: 'wrap' },
  nota: { fontSize: 12, color: 'var(--muted)' },
};
