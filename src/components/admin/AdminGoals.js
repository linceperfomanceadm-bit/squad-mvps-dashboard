import React, { useState, useEffect } from 'react';
import { Check } from 'lucide-react';
import { CARD, LBL, INP, BTN_PRIMARY, money } from '../commercial/ui';

/*
 * Metas comerciais (admin).
 *
 * Closers  → meta de VALOR (R$) vendido no mês, equipe e individual.
 *            Quando a call é fechada em dupla, o valor é dividido
 *            entre os dois closers.
 * SDRs     → meta de CALLS AGENDADAS no mês, equipe e individual.
 *
 * Persistido em commercial_config/goals. Mensais — resetam sozinhas.
 */
export default function AdminGoals({ goals, collaborators, onSave, toast }) {
  const closers = collaborators.filter(c => c.sector === 'comercial' && c.commercialRole === 'closer' && c.active);
  const sdrs    = collaborators.filter(c => c.sector === 'comercial' && c.commercialRole === 'sdr' && c.active);

  const [teamGoal, setTeamGoal] = useState(goals.teamGoal || 0);
  const [individual, setIndividual] = useState(goals.individual || {});
  const [sdrTeamGoal, setSdrTeamGoal] = useState(goals.sdrTeamGoal || 0);
  const [sdrIndividual, setSdrIndividual] = useState(goals.sdrIndividual || {});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setTeamGoal(goals.teamGoal || 0);
    setIndividual(goals.individual || {});
    setSdrTeamGoal(goals.sdrTeamGoal || 0);
    setSdrIndividual(goals.sdrIndividual || {});
  }, [goals]);

  const save = async () => {
    setSaving(true);
    const r = await onSave({
      teamGoal: Number(teamGoal) || 0,
      individual,
      sdrTeamGoal: Number(sdrTeamGoal) || 0,
      sdrIndividual,
    });
    setSaving(false);
    if (r.success) toast('Metas salvas!');
    else toast(r.error, 'e');
  };

  const sumIndividual = Object.values(individual).reduce((s, v) => s + (Number(v) || 0), 0);
  const sumSdr = Object.values(sdrIndividual).reduce((s, v) => s + (Number(v) || 0), 0);

  return (
    <div className="fade-up">
      <div style={{ marginBottom: 22 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, color: '#fff', letterSpacing: '-.5px', marginBottom: 4 }}>Metas Comerciais</h1>
        <p style={{ fontSize: 13, color: 'var(--muted)' }}>Metas mensais. Resetam naturalmente a cada virada de mês.</p>
      </div>

      {/* ── CLOSERS ── */}
      <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 12 }}>💼 Closers — meta de vendas (R$)</h2>

      <div style={{ ...CARD, marginBottom: 14, maxWidth: 380 }}>
        <p style={LBL}>META DA EQUIPE (R$/mês)</p>
        <input type="number" min="0" step="100" value={teamGoal} onChange={e => setTeamGoal(e.target.value)} style={{ ...INP, marginTop: 8 }} />
        <p style={{ fontSize: 11, color: '#666', marginTop: 6 }}>{money(Number(teamGoal) || 0)}</p>
      </div>

      {closers.length === 0 ? (
        <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 22 }}>Nenhum closer ativo cadastrado.</p>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: 10, marginBottom: 8 }}>
            {closers.map(c => (
              <div key={c.id} style={CARD}>
                <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>{c.name}</p>
                <input
                  type="number" min="0" step="100"
                  value={individual[c.name] || ''}
                  onChange={e => setIndividual(i => ({ ...i, [c.name]: e.target.value }))}
                  placeholder="0"
                  style={INP}
                />
                <p style={{ fontSize: 11, color: '#666', marginTop: 6 }}>{money(Number(individual[c.name]) || 0)}</p>
              </div>
            ))}
          </div>
          <p style={{ fontSize: 12, color: sumIndividual >= (Number(teamGoal) || 0) ? 'var(--green)' : 'var(--amber)', marginBottom: 26, fontFamily: 'var(--fm)' }}>
            Soma das individuais: {money(sumIndividual)} · Meta da equipe: {money(Number(teamGoal) || 0)}
          </p>
        </>
      )}

      {/* ── SDRs ── */}
      <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 12 }}>🎯 SDRs — meta de calls agendadas</h2>

      <div style={{ ...CARD, marginBottom: 14, maxWidth: 380 }}>
        <p style={LBL}>META DA EQUIPE (calls/mês)</p>
        <input type="number" min="0" value={sdrTeamGoal} onChange={e => setSdrTeamGoal(e.target.value)} style={{ ...INP, marginTop: 8 }} />
      </div>

      {sdrs.length === 0 ? (
        <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 22 }}>Nenhum SDR ativo cadastrado.</p>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: 10, marginBottom: 8 }}>
            {sdrs.map(c => (
              <div key={c.id} style={CARD}>
                <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>{c.name}</p>
                <input
                  type="number" min="0"
                  value={sdrIndividual[c.name] || ''}
                  onChange={e => setSdrIndividual(i => ({ ...i, [c.name]: e.target.value }))}
                  placeholder="0"
                  style={INP}
                />
                <p style={{ fontSize: 11, color: '#666', marginTop: 6 }}>calls/mês</p>
              </div>
            ))}
          </div>
          <p style={{ fontSize: 12, color: sumSdr >= (Number(sdrTeamGoal) || 0) ? 'var(--green)' : 'var(--amber)', marginBottom: 26, fontFamily: 'var(--fm)' }}>
            Soma das individuais: {sumSdr} calls · Meta da equipe: {Number(sdrTeamGoal) || 0} calls
          </p>
        </>
      )}

      <button
        onClick={save}
        disabled={saving}
        style={{ ...BTN_PRIMARY, display: 'flex', alignItems: 'center', gap: 8, padding: '12px 24px', opacity: saving ? .6 : 1 }}
      >
        <Check size={15} /> {saving ? 'Salvando...' : 'Salvar metas'}
      </button>
    </div>
  );
}
