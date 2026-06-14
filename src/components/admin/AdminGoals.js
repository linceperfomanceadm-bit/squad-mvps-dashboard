import React, { useState, useEffect } from 'react';
import { Target, Check } from 'lucide-react';
import { SECTORS } from '../../lib/firebase';

const COLOR = SECTORS.comercial.color;

/*
 * Painel de metas comerciais (admin).
 * Define meta da equipe e meta individual por closer (mensal, contagem
 * de vendas — sem valores em R$). Persistido em commercial_config/goals.
 */
export default function AdminGoals({ goals, collaborators, onSave, toast }) {
  const closers = collaborators.filter(c => c.sector === 'comercial' && c.commercialRole === 'closer' && c.active);

  const [teamGoal, setTeamGoal] = useState(goals.teamGoal || 0);
  const [individual, setIndividual] = useState(goals.individual || {});

  useEffect(() => { setTeamGoal(goals.teamGoal || 0); setIndividual(goals.individual || {}); }, [goals]);

  const save = async () => {
    const r = await onSave({ teamGoal: Number(teamGoal) || 0, individual });
    r.success ? toast('Metas salvas!') : toast(r.error, 'e');
  };

  return (
    <div className="fade-up">
      <div style={{ marginBottom: 22 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, color: '#fff', letterSpacing: '-.5px', marginBottom: 4 }}>Metas Comerciais</h1>
        <p style={{ fontSize: 13, color: 'var(--muted)' }}>Metas mensais de vendas (contagem). Resetam naturalmente a cada mês.</p>
      </div>

      <div style={{ ...CARD, marginBottom: 18, maxWidth: 360 }}>
        <label style={LBL}>META DA EQUIPE (vendas/mês)</label>
        <input type="number" min="0" value={teamGoal} onChange={e => setTeamGoal(e.target.value)} style={{ ...INP, marginTop: 8 }} />
      </div>

      <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 12 }}>Metas individuais (Closers)</h2>
      {closers.length === 0 ? (
        <p style={{ fontSize: 13, color: 'var(--muted)' }}>Nenhum closer ativo cadastrado.</p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(240px,1fr))', gap: 12 }}>
          {closers.map(c => (
            <div key={c.id} style={CARD}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <div style={{ width: 34, height: 34, borderRadius: 10, background: `${COLOR}1a`, border: `1px solid ${COLOR}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: COLOR }}>{c.name.charAt(0)}</div>
                <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{c.name}</span>
              </div>
              <input
                type="number" min="0"
                value={individual[c.name] ?? ''}
                onChange={e => setIndividual(prev => ({ ...prev, [c.name]: Number(e.target.value) || 0 }))}
                placeholder="Meta mensal"
                style={INP}
              />
            </div>
          ))}
        </div>
      )}

      <button onClick={save} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'linear-gradient(135deg,var(--neon),#c41f4a)', border: 'none', borderRadius: 10, padding: '11px 20px', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', marginTop: 20, boxShadow: '0 4px 14px rgba(238,51,99,.3)' }}>
        <Check size={15} /> Salvar metas
      </button>
    </div>
  );
}

const LBL = { fontSize: 10, letterSpacing: '.14em', color: 'var(--muted)', fontWeight: 600, fontFamily: 'var(--fm)' };
const INP = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 9, padding: '10px 13px', color: 'var(--text)', fontSize: 13, outline: 'none', width: '100%', fontFamily: 'var(--f)' };
const CARD = { background: 'rgba(12,12,24,.88)', border: '1px solid var(--border)', borderRadius: 14, padding: 16 };
