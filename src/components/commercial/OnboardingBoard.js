import React, { useMemo, useState } from 'react';
import ReactDOM from 'react-dom';
import { UserPlus, Clock } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useClients } from '../../hooks/useClients';
import { useCollaborators } from '../../hooks/useCollaborators';
import { useToast } from '../shared/Toast';
import { SECTORS, STAFFING_ALERT_DAYS, stageOf } from '../../lib/firebase';
import StaffingModal from './StaffingModal';
import ClientOnboardingModal from './ClientOnboardingModal';
import {
  CARD, GRID, Tag, Empty, ConfirmModal, ScheduleModal,
  fmtDate, fmtDateTime, toLocalInput, BTN_PRIMARY, BTN_CANCEL, BTN_GREEN,
} from './ui';

const asArray = (v) => (Array.isArray(v) ? v : v ? [v] : []);
const RECENT_DAYS = 30;
const KICKOFF_COLOR = '#a78bfa';

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
  const {
    clients, setSectorResponsibles, pendingSectorsOf,
    scheduleKickoffCall, cancelKickoffCall, confirmKickoffCall,
  } = useClients();
  const { collaborators } = useCollaborators();
  const { toast } = useToast();

  const [staffingTarget, setStaffingTarget] = useState(null);
  const [openId, setOpenId] = useState(null);
  const [kickoffSchedule, setKickoffSchedule] = useState(null);
  const [kickoffCancel, setKickoffCancel] = useState(null);

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
      .filter(c => stageOf(c) === 'staffing')
      .map(c => ({ client: c, pendentes: pendingSectorsOf(c).filter(s => mySectors.includes(s)) }))
      .filter(x => x.pendentes.length > 0)
      .sort((a, b) => new Date(a.client.staffing?.startedAt || 0) - new Date(b.client.staffing?.startedAt || 0));
  }, [clients, mySectors, pendingSectorsOf]);

  // Sou responsável por este cliente em algum setor?
  const souResponsavel = (c) => Object.values(c.responsibles || {}).some(v => asArray(v).includes(me));

  // 2. Clientes com a call de onboarding JÁ AGENDADA. Antes disso o
  //    cliente grava `active: false` e nem aparece aqui — é o que
  //    garante que o time só o conhece quando há data marcada.
  const emOnboarding = useMemo(() => clients
    .filter(c => c.active !== false && stageOf(c) === 'onboarding' && c.kickoff?.at)
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
      if (c.active === false || stageOf(c) !== 'live') return false;
      if (!isAdmin && !souResponsavel(c)) return false;
      const at = c.kickoff?.confirmedAt;
      return at ? new Date(at).getTime() >= cutoff : false;
    });
  }, [clients, isAdmin, me]); // eslint-disable-line react-hooks/exhaustive-deps

  // Clientes com o quadro fechado esperando o Kick Off. Só o admin vê
  // — para os setores esse cliente ainda não existe.
  const emKickoff = useMemo(() => {
    if (!isAdmin) return [];
    return clients
      .filter(c => stageOf(c) === 'kickoff')
      .sort((a, b) => {
        const aa = a.kickoffCall?.at ? new Date(a.kickoffCall.at).getTime() : Infinity;
        const bb = b.kickoffCall?.at ? new Date(b.kickoffCall.at).getTime() : Infinity;
        return aa - bb;
      });
  }, [clients, isAdmin]);

  const openClient = openId ? clients.find(c => c.id === openId) || null : null;
  const vazio = aguardando.length === 0 && emKickoff.length === 0 && emOnboarding.length === 0 && recentes.length === 0;

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

      {/* 2. Kick Off — só o admin, para destravar na ausência da CS Comercial */}
      {isAdmin && emKickoff.length > 0 && (
        <Bloco
          title="Aguardando Kick Off"
          sub="Quadro fechado, esperando a CS Comercial marcar a call. Você pode agendar por ela se for preciso."
          color={KICKOFF_COLOR}
        >
          <div style={GRID}>
            {emKickoff.map(c => (
              <AdminKickoffCard
                key={c.id}
                client={c}
                onOpen={() => setOpenId(c.id)}
                onSchedule={() => setKickoffSchedule(c)}
                onCancel={() => setKickoffCancel(c)}
                onConfirm={async () => {
                  const r = await confirmKickoffCall(c.id, me);
                  if (r.success) toast(`Kick Off de ${c.name} concluído!`);
                  else toast(r.error, 'e');
                }}
              />
            ))}
          </div>
        </Bloco>
      )}

      {/* 3. Em onboarding */}
      {emOnboarding.length > 0 && (
        <Bloco
          title="Onboarding em andamento"
          sub="Call de onboarding marcada. Leia o briefing antes da reunião."
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
        <ClientOnboardingModal
          client={openClient}
          onClose={() => setOpenId(null)}
          onScheduleKickoff={isAdmin && stageOf(openClient) === 'kickoff'
            ? () => { setKickoffSchedule(openClient); setOpenId(null); }
            : undefined}
          onCancelKickoff={isAdmin && stageOf(openClient) === 'kickoff' && openClient.kickoffCall?.at
            ? () => { setKickoffCancel(openClient); setOpenId(null); }
            : undefined}
          onConfirmKickoffCall={isAdmin && stageOf(openClient) === 'kickoff' && openClient.kickoffCall?.at
            ? async () => {
              const r = await confirmKickoffCall(openClient.id, me);
              if (r.success) toast(`Kick Off de ${openClient.name} concluído!`);
              else toast(r.error, 'e');
              setOpenId(null);
            }
            : undefined}
        />
      )}

      {kickoffSchedule && ReactDOM.createPortal(
        <ScheduleModal
          title={kickoffSchedule.kickoffCall?.at ? 'Reagendar Kick Off' : 'Agendar Kick Off'}
          subtitle={`Call de Kick Off com ${kickoffSchedule.name}, entre CS Comercial e CS Operacional.`}
          initialAt={toLocalInput(kickoffSchedule.kickoffCall?.at)}
          initialLink={kickoffSchedule.kickoffCall?.meetLink || ''}
          confirmLabel={kickoffSchedule.kickoffCall?.at ? 'Reagendar' : 'Agendar call'}
          onClose={() => setKickoffSchedule(null)}
          onConfirm={async (at, link) => {
            const r = await scheduleKickoffCall(kickoffSchedule.id, me, at, link);
            if (r.success) toast('Kick Off agendado!');
            else toast(r.error, 'e');
            setKickoffSchedule(null);
          }}
        />, document.body)}

      {kickoffCancel && ReactDOM.createPortal(
        <ConfirmModal
          title="Cancelar agendamento"
          text={`Desmarcar a call de Kick Off de ${kickoffCancel.name}? O cliente volta para "aguardando agendamento".`}
          confirmLabel="Desmarcar call"
          onClose={() => setKickoffCancel(null)}
          onConfirm={async () => {
            const r = await cancelKickoffCall(kickoffCancel.id);
            if (r.success) toast('Agendamento desmarcado.');
            else toast(r.error, 'e');
            setKickoffCancel(null);
          }}
        />, document.body)}
    </div>
  );
}

// ── Card de Kick Off na visão do admin ─────────────────────────
function AdminKickoffCard({ client, onOpen, onSchedule, onCancel, onConfirm }) {
  const call = client.kickoffCall || {};
  const agendada = !!call.at;
  const passou = agendada && new Date(call.at) < new Date();

  return (
    <div style={{ ...CARD, border: `1px solid ${agendada ? (passou ? 'var(--amber-b)' : `${KICKOFF_COLOR}40`) : 'var(--border)'}` }}>
      <button onClick={onOpen} style={{ background: 'none', border: 'none', padding: 0, textAlign: 'left', width: '100%', cursor: 'pointer' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
          <p style={{ fontSize: 16, fontWeight: 800, color: '#fff' }}>{client.name}</p>
          {agendada
            ? <Tag text={passou ? 'CALL PASSOU' : 'AGENDADO'} color={passou ? 'var(--amber)' : KICKOFF_COLOR} />
            : <Tag text="SEM AGENDA" color="var(--muted)" />}
        </div>
        {agendada && (
          <p style={{ fontSize: 13, fontWeight: 700, color: passou ? 'var(--amber)' : KICKOFF_COLOR, fontFamily: 'var(--fm)', marginTop: 10 }}>
            📅 {fmtDateTime(call.at)}
          </p>
        )}
      </button>
      <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
        <button style={{ ...BTN_PRIMARY, flex: 1 }} onClick={onSchedule}>
          {agendada ? 'Reagendar' : 'Agendar call'}
        </button>
        {agendada && <button style={BTN_CANCEL} onClick={onCancel}>Desmarcar</button>}
        {agendada && (
          <button style={{ ...BTN_GREEN, width: '100%' }} onClick={onConfirm}>✓ Kick Off realizado</button>
        )}
      </div>
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
  const atrasado = dias != null && dias >= STAFFING_ALERT_DAYS;

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
          Aguardando a CS Operacional definir data e hora da call.
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
