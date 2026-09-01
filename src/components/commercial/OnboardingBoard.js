import React, { useMemo, useState } from 'react';
import { UserPlus, Clock } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useClients } from '../../hooks/useClients';
import { useCollaborators } from '../../hooks/useCollaborators';
import { useToast } from '../shared/Toast';
import { SECTORS } from '../../lib/firebase';
import StaffingModal from './StaffingModal';
import ClientOnboardingModal from './ClientOnboardingModal';
import { CARD, GRID, Tag, Empty, fmtDate, fmtDateTime } from './ui';

const asArray = (v) => (Array.isArray(v) ? v : v ? [v] : []);
const RECENT_DAYS = 30;

/*
 * ONBOARDING DE CLIENTES — a mesma tela para todo mundo, mudando só
 * o que cada pessoa enxerga:
 *
 *  1. "Aguardando sua indicação" — aparece para quem LIDERA algum
 *     setor (`leaderOf`) e para o admin. Lista os clientes em staffing
 *     que ainda não têm responsável no setor dessa pessoa. É aqui que
 *     o quadro é fechado e o cliente entra na base.
 *
 *  2. "Onboarding em andamento" — clientes ativos com a call de
 *     onboarding pendente, em que a pessoa é responsável. Mostra a
 *     data e hora quando o CS Operacional agenda, e "aguardando
 *     agendamento" no intervalo entre a ativação e o agendamento.
 *
 *  3. "Entraram recentemente" — quem já fez a call nos últimos 30
 *     dias, como contexto.
 *
 * O admin vê tudo, de todos os setores.
 */
export default function OnboardingBoard({ sectorId, isAdminView = false }) {
  const { user } = useAuth();
  const { clients, setSectorResponsibles, pendingSectorsOf } = useClients();
  const { collaborators } = useCollaborators();
  const { toast } = useToast();

  const [staffingTarget, setStaffingTarget] = useState(null);
  const [openId, setOpenId] = useState(null);

  const me = user?.name;
  const isAdmin = isAdminView || !!user?.isAdmin;
  const color = SECTORS[sectorId]?.color || 'var(--neon)';

  // Setores que esta pessoa pode preencher. Admin destrava todos.
  const mySectors = useMemo(() => {
    if (isAdmin) return Object.keys(SECTORS);
    return asArray(user?.leaderOf);
  }, [isAdmin, user]);

  // 1. Clientes em staffing esperando algum setor meu.
  const aguardando = useMemo(() => {
    if (!mySectors.length) return [];
    return clients
      .filter(c => c.stage === 'staffing')
      .map(c => ({ client: c, pendentes: pendingSectorsOf(c).filter(s => mySectors.includes(s)) }))
      .filter(x => x.pendentes.length > 0)
      .sort((a, b) => new Date(a.client.staffing?.startedAt || 0) - new Date(b.client.staffing?.startedAt || 0));
  }, [clients, mySectors, pendingSectorsOf]);

  // Sou responsável por este cliente em algum setor?
  const souResponsavel = (c) => Object.values(c.responsibles || {}).some(v => asArray(v).includes(me));

  // 2. Clientes ativos com a call ainda pendente.
  const emOnboarding = useMemo(() => clients
    .filter(c => c.active !== false && c.stage !== 'staffing' && c.kickoff?.pending)
    .filter(c => isAdmin || souResponsavel(c))
    .sort((a, b) => {
      const aa = a.kickoff?.at ? new Date(a.kickoff.at).getTime() : Infinity;
      const bb = b.kickoff?.at ? new Date(b.kickoff.at).getTime() : Infinity;
      return aa - bb;
    }),
    [clients, isAdmin, me]); // eslint-disable-line react-hooks/exhaustive-deps

  // 3. Quem fez a call recentemente.
  const recentes = useMemo(() => {
    const cutoff = Date.now() - RECENT_DAYS * 86400000;
    return clients.filter(c => {
      if (c.active === false || c.stage === 'staffing' || c.kickoff?.pending) return false;
      if (!isAdmin && !souResponsavel(c)) return false;
      const at = c.kickoff?.confirmedAt;
      return at ? new Date(at).getTime() >= cutoff : false;
    });
  }, [clients, isAdmin, me]); // eslint-disable-line react-hooks/exhaustive-deps

  const openClient = openId ? clients.find(c => c.id === openId) || null : null;
  const vazio = aguardando.length === 0 && emOnboarding.length === 0 && recentes.length === 0;

  return (
    <div className="fade-up">
      <div style={{ marginBottom: 22 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, color: '#fff', letterSpacing: '-.5px', marginBottom: 4 }}>Onboarding de Clientes</h1>
        <p style={{ fontSize: 13, color: 'var(--muted)' }}>
          Clientes novos entrando na agência. Leia o briefing antes de começar a produzir.
        </p>
      </div>

      {vazio && (
        <Empty msg="Nenhum cliente em onboarding agora. ✨" />
      )}

      {/* 1. Staffing */}
      {aguardando.length > 0 && (
        <Bloco
          title="Aguardando sua indicação"
          sub="Escolha quem fica responsável por estes clientes. O cliente só entra na base quando todos os setores forem preenchidos."
          color="var(--amber)"
        >
          <div style={GRID}>
            {aguardando.map(({ client, pendentes }) => (
              <StaffingCard
                key={client.id}
                client={client}
                pendentes={pendentes}
                todosPendentes={pendingSectorsOf(client)}
                onOpen={() => setStaffingTarget({ client, sectors: pendentes })}
              />
            ))}
          </div>
        </Bloco>
      )}

      {/* 2. Em onboarding */}
      {emOnboarding.length > 0 && (
        <Bloco
          title="Onboarding em andamento"
          sub="Clientes já ativos, aguardando a call de onboarding com o time."
          color={color}
        >
          <div style={GRID}>
            {emOnboarding.map(c => (
              <OnboardingCard key={c.id} client={c} color={color} onOpen={() => setOpenId(c.id)} />
            ))}
          </div>
        </Bloco>
      )}

      {/* 3. Recentes */}
      {recentes.length > 0 && (
        <Bloco
          title="Entraram recentemente"
          sub={`Clientes que fizeram a call de onboarding nos últimos ${RECENT_DAYS} dias.`}
          color="var(--green)"
        >
          <div style={GRID}>
            {recentes.map(c => (
              <RecenteCard key={c.id} client={c} onOpen={() => setOpenId(c.id)} />
            ))}
          </div>
        </Bloco>
      )}

      {staffingTarget && (
        <StaffingModal
          client={clients.find(c => c.id === staffingTarget.client.id) || staffingTarget.client}
          sectors={staffingTarget.sectors}
          collaborators={collaborators}
          toast={toast}
          onClose={() => setStaffingTarget(null)}
          onConfirm={(sector, nomes, opts) => setSectorResponsibles(staffingTarget.client.id, sector, nomes, me, opts)}
        />
      )}

      {openClient && (
        <ClientOnboardingModal client={openClient} onClose={() => setOpenId(null)} />
      )}
    </div>
  );
}

function Bloco({ title, sub, color, children }) {
  return (
    <div style={{ marginBottom: 30 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <span style={{ width: 3, height: 15, background: color, borderRadius: 2 }} />
        <h2 style={{ fontSize: 15, fontWeight: 800, color: '#fff' }}>{title}</h2>
      </div>
      <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 14, lineHeight: 1.5 }}>{sub}</p>
      {children}
    </div>
  );
}

// ── Card do staffing (visão do líder) ──────────────────────────
function StaffingCard({ client, pendentes, todosPendentes, onOpen }) {
  const contrato = client.contrato || {};
  const dias = client.staffing?.startedAt
    ? Math.floor((Date.now() - new Date(client.staffing.startedAt).getTime()) / 86400000)
    : null;
  const atrasado = dias != null && dias >= 3;

  return (
    <div style={{ ...CARD, border: `1px solid ${atrasado ? 'var(--neon-border)' : 'var(--amber-b)'}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <p style={{ fontSize: 16, fontWeight: 800, color: '#fff' }}>{client.name}</p>
        <Tag text="AGUARDANDO VOCÊ" color="var(--amber)" />
      </div>

      {contrato.contactName && <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 6 }}>👤 {contrato.contactName}</p>}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 10 }}>
        {pendentes.map(sid => (
          <Tag key={sid} text={`${SECTORS[sid]?.emoji || ''} ${SECTORS[sid]?.label || sid}`} color={SECTORS[sid]?.color || 'var(--muted)'} />
        ))}
      </div>

      {todosPendentes.length > pendentes.length && (
        <p style={{ fontSize: 11, color: '#666', marginTop: 8, lineHeight: 1.5 }}>
          Outros setores também pendentes: {todosPendentes.filter(s => !pendentes.includes(s)).map(s => SECTORS[s]?.label || s).join(', ')}
        </p>
      )}

      {dias != null && (
        <p style={{ fontSize: 11, color: atrasado ? 'var(--neon)' : '#666', fontFamily: 'var(--fm)', marginTop: 10, display: 'flex', alignItems: 'center', gap: 4 }}>
          <Clock size={11} /> cadastrado há {dias} dia{dias !== 1 ? 's' : ''}
        </p>
      )}

      <button
        onClick={onOpen}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, width: '100%', marginTop: 14, padding: '11px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,var(--neon),#c41f4a)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
      >
        <UserPlus size={14} /> Indicar responsáveis
      </button>
    </div>
  );
}

// ── Card do cliente em onboarding ──────────────────────────────
function OnboardingCard({ client, color, onOpen }) {
  const contrato = client.contrato || {};
  const at = client.kickoff?.at;
  const when = at ? new Date(at) : null;
  const passou = when && when < new Date();
  const servicos = contrato.servicos || client.services || [];

  return (
    <button
      onClick={onOpen}
      style={{ ...CARD, textAlign: 'left', width: '100%', cursor: 'pointer', border: `1px solid ${at ? (passou ? 'var(--amber-b)' : `${color}40`) : 'var(--border)'}` }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <p style={{ fontSize: 16, fontWeight: 800, color: '#fff' }}>{client.name}</p>
        {at
          ? <Tag text={passou ? 'CALL PASSOU' : 'AGENDADO'} color={passou ? 'var(--amber)' : color} />
          : <Tag text="AGUARDANDO AGENDAMENTO" color="var(--muted)" />}
      </div>

      {at ? (
        <p style={{ fontSize: 13, fontWeight: 700, color: passou ? 'var(--amber)' : color, fontFamily: 'var(--fm)', marginTop: 10 }}>
          📅 {fmtDateTime(at)}
        </p>
      ) : (
        <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 10, lineHeight: 1.5 }}>
          O CS Operacional ainda vai definir data e hora da call.
        </p>
      )}

      {contrato.contactName && <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 8 }}>👤 {contrato.contactName}</p>}

      {servicos.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 10 }}>
          {servicos.map((s, i) => (
            <span key={i} style={{ fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 8, background: 'var(--surface)', color: 'var(--muted)', fontFamily: 'var(--fm)' }}>
              {s.label || s}
            </span>
          ))}
        </div>
      )}

      <p style={{ fontSize: 11, color: '#555', marginTop: 12 }}>Abrir para ver o briefing completo →</p>
    </button>
  );
}

// ── Card de quem já entrou ─────────────────────────────────────
function RecenteCard({ client, onOpen }) {
  const contrato = client.contrato || {};
  return (
    <button
      onClick={onOpen}
      style={{ ...CARD, textAlign: 'left', width: '100%', cursor: 'pointer', border: '1px solid var(--green-b)' }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <p style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>{client.name}</p>
        <Tag text="ATIVO" color="var(--green)" />
      </div>
      {contrato.contactName && <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 6 }}>👤 {contrato.contactName}</p>}
      {client.kickoff?.confirmedAt && (
        <p style={{ fontSize: 10, color: '#555', fontFamily: 'var(--fm)', marginTop: 8 }}>
          Onboarding em {fmtDate(client.kickoff.confirmedAt)}
        </p>
      )}
    </button>
  );
}
