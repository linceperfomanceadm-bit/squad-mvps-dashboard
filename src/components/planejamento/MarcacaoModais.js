import React, { useState } from 'react';
import { MARCACAO_TIPOS } from '../../lib/firebase';
import { dataLonga, hojeISO } from '../../lib/planejamento';
import { Janela, BotaoFechar, JANELA, BTN } from './kit';

// ─────────────────────────────────────────────────────────────
// Agenda manual do Videomaker: ver/excluir e criar marcação.
// ─────────────────────────────────────────────────────────────

const TAG = { fontFamily: 'var(--fm)', fontSize: 10, padding: '3px 8px', borderRadius: 6, background: 'var(--c-dim)', border: '1px solid var(--c-border)', color: 'var(--c)' };

export function MarcacaoModal({ marcacao: m, podeExcluir, onExcluir, onClose }) {
  const t = MARCACAO_TIPOS[m.tipo] || MARCACAO_TIPOS.out;
  return (
    <Janela onClose={onClose} largura={460} label="Marcação">
      <div style={{ ...JANELA.h, alignItems: 'center' }}>
        <span style={TAG}>{t.tag}</span>
        <div style={{ flex: 1 }} />
        <BotaoFechar onClick={onClose} />
      </div>
      <div style={JANELA.b}>
        <div>
          <h2 style={{ fontSize: 19, fontWeight: 500 }}>{t.label}{m.clientName ? ` · ${m.clientName}` : ' · interno'}</h2>
          <div style={{ fontFamily: 'var(--fm)', fontSize: 12, color: 'var(--muted)', marginTop: 6 }}>{dataLonga(m.data)} · {m.hora}</div>
        </div>
        <p style={{ fontSize: 13, lineHeight: 1.55 }}>{m.obs || 'Sem observação.'}</p>
        <p style={{ fontSize: 11.5, color: 'var(--muted)' }}>
          {m.tipo === 'cap' && m.clientName ? `A Social Media de ${m.clientName} vê esta captação nos reels do cliente.` : 'Só você vê esta marcação.'}
          {m.autorName ? ` Criada por ${m.autorName}.` : ''}
        </p>
      </div>
      <div style={{ ...JANELA.f, justifyContent: 'flex-end' }}>
        {podeExcluir && <button type="button" className="ui-btn" style={BTN.perigo} onClick={onExcluir}>Excluir</button>}
        <button type="button" className="ui-btn" onClick={onClose}>Fechar</button>
      </div>
    </Janela>
  );
}

export function NovaMarcacaoModal({ clientes, dataInicial, onSalvar, onClose }) {
  const hoje = hojeISO();
  const [f, setF] = useState({
    tipo: 'cap',
    data: dataInicial && dataInicial >= hoje ? dataInicial : hoje,
    hora: '09:00',
    clientId: clientes.length === 1 ? clientes[0].id : '',
    obs: '',
  });
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));

  const salvar = async () => {
    setBusy(true);
    const cli = clientes.find((c) => c.id === f.clientId);
    await onSalvar({ ...f, clientName: cli?.name || '' });
    setBusy(false);
  };

  return (
    <Janela onClose={onClose} largura={460} label="Nova marcação">
      <div style={JANELA.h}>
        <h2 style={{ fontSize: 18, fontWeight: 500, flex: 1 }}>Nova marcação</h2>
        <BotaoFechar onClick={onClose} />
      </div>
      <div style={JANELA.b}>
        <div>
          <span style={JANELA.lab}>Tipo</span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {Object.values(MARCACAO_TIPOS).map((t) => (
              <button key={t.id} type="button" aria-pressed={f.tipo === t.id} onClick={() => setF((x) => ({ ...x, tipo: t.id }))} style={{ ...S.chip, ...(f.tipo === t.id ? S.chipOn : null) }}>
                {t.label}
              </button>
            ))}
          </div>
        </div>
        <div style={JANELA.dois}>
          <label>
            <span style={JANELA.lab}>Dia</span>
            <input type="date" value={f.data} onChange={set('data')} style={{ ...JANELA.fld, colorScheme: 'dark light' }} />
          </label>
          <label>
            <span style={JANELA.lab}>Horário</span>
            <input type="time" value={f.hora} onChange={set('hora')} style={{ ...JANELA.fld, colorScheme: 'dark light' }} />
          </label>
        </div>
        <label>
          <span style={JANELA.lab}>Cliente (opcional)</span>
          <select value={f.clientId} onChange={set('clientId')} style={{ width: '100%' }}>
            <option value="">Sem cliente · interno</option>
            {clientes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        <label>
          <span style={JANELA.lab}>Observação</span>
          <textarea rows={3} value={f.obs} onChange={set('obs')} placeholder="Ex.: levar tripé e luz de LED; gravar 3 reels" style={{ ...JANELA.fld, resize: 'vertical', lineHeight: 1.45 }} />
        </label>
      </div>
      <div style={{ ...JANELA.f, justifyContent: 'flex-end' }}>
        <button type="button" className="ui-btn" onClick={onClose}>Cancelar</button>
        <button type="button" className="ui-btn primary" disabled={busy || !f.data} onClick={salvar}>{busy ? 'Salvando…' : 'Salvar na agenda'}</button>
      </div>
    </Janela>
  );
}

const S = {
  chip: { height: 34, padding: '0 14px', borderRadius: 99, fontSize: 12.5, fontWeight: 500, border: '1px solid var(--border-h)', background: 'var(--bg2)', color: 'var(--muted)' },
  chipOn: { background: 'var(--grad)', color: 'var(--on)', borderColor: 'transparent' },
};
