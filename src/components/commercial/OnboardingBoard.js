import React, { useMemo, useState } from 'react';
import { useClients } from '../../hooks/useClients';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../components/shared/Toast';
import { SECTORS } from '../../lib/firebase';
import { Check, ClipboardList } from 'lucide-react';

/*
 * Board de Onboarding por setor.
 * Mostra os clientes cujo onboarding está em andamento e que incluem o
 * setor atual. Cada colaborador só marca/desmarca o "ok" do SEU setor.
 * Quando todos os setores dão ok, o cliente sai daqui (status 'ready')
 * e aparece na aba Onboarding do CS.
 */
export default function OnboardingBoard({ sectorId }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const { clients, markOnboardingSector } = useClients();
  const [busy, setBusy] = useState(null);

  const color = SECTORS[sectorId]?.color || 'var(--neon)';

  // Clientes em onboarding que envolvem este setor e ainda não concluíram.
  const mine = useMemo(() => clients.filter(c =>
    c.onboarding && c.onboarding.status === 'running' && (c.onboarding.sectors || []).includes(sectorId)
  ), [clients, sectorId]);

  const toggle = async (client) => {
    const current = client.onboarding?.checklist?.[sectorId]?.ok;
    setBusy(client.id);
    const r = await markOnboardingSector(client.id, sectorId, user?.name, !current);
    setBusy(null);
    if (!r.success) { toast(r.error, 'e'); return; }
    if (r.allOk) toast('Todos os setores concluíram! Cliente pronto para o CS. 🎉');
    else toast(current ? 'Marcação removida.' : 'Setor marcado como pronto.');
  };

  return (
    <div className="fade-up">
      <div style={{ marginBottom: 22 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, color: '#fff', letterSpacing: '-.5px', marginBottom: 4 }}>Onboarding</h1>
        <p style={{ fontSize: 13, color: 'var(--muted)' }}>Novos clientes que precisam do seu setor. Marque quando o seu setup estiver pronto.</p>
      </div>

      {mine.length === 0 ? (
        <div style={{ background: 'rgba(12,12,24,.6)', border: '1px dashed var(--border)', borderRadius: 14, padding: '48px 24px', textAlign: 'center' }}>
          <ClipboardList size={26} color="var(--muted)" style={{ marginBottom: 10 }} />
          <p style={{ fontSize: 13, color: 'var(--muted)' }}>Nenhum cliente em onboarding para o seu setor agora.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: 14 }}>
          {mine.map(c => {
            const cl = c.onboarding?.checklist || {};
            const sectors = c.onboarding?.sectors || [];
            const myOk = cl[sectorId]?.ok;
            const services = (c.services || c.onboarding?.services || []);
            return (
              <div key={c.id} style={{ background: 'rgba(12,12,24,.9)', border: `1px solid ${myOk ? 'var(--green-b)' : 'var(--border)'}`, borderRadius: 14, padding: 18 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <span style={{ fontSize: 16, fontWeight: 800, color: '#fff' }}>{c.name}</span>
                  {myOk && <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--green)', fontFamily: 'var(--fm)', background: 'var(--green-dim)', padding: '2px 8px', borderRadius: 8 }}>SEU OK ✓</span>}
                </div>

                {/* Serviços vendidos (contexto) */}
                {services.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 10 }}>
                    {services.map((s, i) => (
                      <span key={i} style={{ fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 8, background: 'var(--surface)', color: 'var(--muted)', fontFamily: 'var(--fm)' }}>{s.label || s}</span>
                    ))}
                  </div>
                )}

                {/* Progresso dos setores */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
                  {sectors.map(s => {
                    const ok = cl[s]?.ok;
                    const isMine = s === sectorId;
                    return (
                      <div key={s} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                        <span style={{ fontSize: 12, color: isMine ? (SECTORS[s]?.color || 'var(--text)') : 'var(--muted)', fontWeight: isMine ? 700 : 500 }}>
                          {SECTORS[s]?.emoji} {SECTORS[s]?.label || s}{isMine ? ' (você)' : ''}
                        </span>
                        <span style={{ fontSize: 10, fontWeight: 700, fontFamily: 'var(--fm)', color: ok ? 'var(--green)' : 'var(--muted)' }}>{ok ? `✓ ${cl[s]?.by || ''}` : 'pendente'}</span>
                      </div>
                    );
                  })}
                </div>

                <button
                  disabled={busy === c.id}
                  onClick={() => toggle(c)}
                  style={{ width: '100%', marginTop: 14, padding: '11px', borderRadius: 10, border: myOk ? '1px solid var(--border)' : 'none', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: myOk ? 'var(--surface)' : `linear-gradient(135deg,${color},${color}cc)`, color: myOk ? 'var(--muted)' : '#fff' }}
                >
                  <Check size={15} /> {myOk ? 'Desmarcar meu setor' : 'Marcar meu setor como pronto'}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
