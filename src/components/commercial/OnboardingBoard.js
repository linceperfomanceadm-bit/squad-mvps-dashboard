import React, { useMemo } from 'react';
import { ClipboardList } from 'lucide-react';
import { useClients } from '../../hooks/useClients';
import { SECTORS } from '../../lib/firebase';
import { CARD, GRID, Tag, fmtDate } from './ui';

/*
 * "Novos Clientes" do setor — apenas informativo.
 *
 * No fluxo novo o setor NÃO marca mais "setup pronto": quando o CS
 * Comercial conclui a call de onboarding, o cliente já nasce ativo e
 * segue para o Kickoff do CS Operacional. Este painel existe só para
 * o setor ver quem entrou na carteira dele recentemente, com o
 * briefing e os serviços vendidos como contexto.
 */
const RECENT_DAYS = 30;

export default function OnboardingBoard({ sectorId }) {
  const { clients } = useClients();
  const color = SECTORS[sectorId]?.color || 'var(--neon)';

  const mine = useMemo(() => {
    const cutoff = Date.now() - RECENT_DAYS * 86400000;
    return clients
      .filter(c => {
        if (c.active === false) return false;
        const r = c.responsibles?.[sectorId];
        const hasMe = Array.isArray(r) ? r.length > 0 : !!r;
        if (!hasMe) return false;
        // Pendente de kickoff OU ativado nos últimos 30 dias.
        if (c.kickoff?.pending) return true;
        const at = c.kickoff?.confirmedAt || c.onboardingCallAt;
        return at ? new Date(at).getTime() >= cutoff : false;
      })
      .sort((a, b) => (a.kickoff?.pending === b.kickoff?.pending ? 0 : a.kickoff?.pending ? -1 : 1));
  }, [clients, sectorId]);

  return (
    <div className="fade-up">
      <div style={{ marginBottom: 22 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, color: '#fff', letterSpacing: '-.5px', marginBottom: 4 }}>Novos Clientes</h1>
        <p style={{ fontSize: 13, color: 'var(--muted)' }}>
          Clientes que entraram na carteira do seu setor nos últimos {RECENT_DAYS} dias. Leia o briefing antes de começar.
        </p>
      </div>

      {mine.length === 0 ? (
        <div style={{ background: 'rgba(12,12,24,.6)', border: '1px dashed var(--border)', borderRadius: 14, padding: '48px 24px', textAlign: 'center' }}>
          <ClipboardList size={26} color="var(--muted)" style={{ marginBottom: 10 }} />
          <p style={{ fontSize: 13, color: 'var(--muted)' }}>Nenhum cliente novo para o seu setor agora.</p>
        </div>
      ) : (
        <div style={GRID}>
          {mine.map(c => {
            const people = c.responsibles?.[sectorId];
            const names = Array.isArray(people) ? people.join(', ') : people;
            const services = c.services || [];
            return (
              <div key={c.id} style={{ ...CARD, border: `1px solid ${c.kickoff?.pending ? 'var(--amber-b)' : `${color}30`}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                  <p style={{ fontSize: 16, fontWeight: 800, color: '#fff' }}>{c.name}</p>
                  {c.kickoff?.pending
                    ? <Tag text="AGUARDA KICKOFF" color="var(--amber)" />
                    : <Tag text="ATIVO" color="var(--green)" />}
                </div>

                {names && <p style={{ fontSize: 12, color, marginTop: 6 }}>👤 {names}</p>}
                {c.contactName && <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>Contato: {c.contactName}</p>}

                {services.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 10 }}>
                    {services.map((s, i) => (
                      <span key={i} style={{ fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 8, background: 'var(--surface)', color: 'var(--muted)', fontFamily: 'var(--fm)' }}>
                        {s.label || s}
                      </span>
                    ))}
                  </div>
                )}

                {c.briefing && (
                  <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
                    <p style={{ fontSize: 9, letterSpacing: '.12em', color: 'var(--muted)', fontFamily: 'var(--fm)', marginBottom: 5 }}>BRIEFING</p>
                    <p style={{ fontSize: 12, color: '#ccc', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{c.briefing}</p>
                  </div>
                )}

                {(c.kickoff?.confirmedAt || c.onboardingCallAt) && (
                  <p style={{ fontSize: 10, color: '#555', fontFamily: 'var(--fm)', marginTop: 10 }}>
                    {c.kickoff?.confirmedAt ? `Kickoff em ${fmtDate(c.kickoff.confirmedAt)}` : `Onboarding em ${fmtDate(c.onboardingCallAt)}`}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
