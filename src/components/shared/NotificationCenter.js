import React, { useState } from 'react';
import ReactDOM from 'react-dom';
import { Bell, X } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useTasks } from '../../hooks/useTasks';
import { useRequests } from '../../hooks/useRequests';
import { useClients } from '../../hooks/useClients';
import { useDesktopNotifications } from '../../hooks/useDesktopNotifications';

/*
 * NotificationCenter — montado uma única vez, no App, para todo
 * usuário logado.
 *
 * Ele existe porque a notificação precisa valer em QUALQUER tela, não
 * só naquela em que a pessoa está parada. Como cada painel já carrega
 * seus próprios hooks, aqui a gente assume o custo de um conjunto
 * extra de listeners do Firestore em troca de cobertura total.
 *
 * Não renderiza nada, exceto o convite para ligar as notificações —
 * mostrado uma vez por sessão, para quem ainda não decidiu.
 */
export default function NotificationCenter() {
  const { user } = useAuth();
  const { tasks } = useTasks();
  const { requests } = useRequests();
  const { clients } = useClients();
  const [dismissed, setDismissed] = useState(false);

  const notify = useDesktopNotifications({ tasks, requests, clients, user });

  const mostrarConvite =
    notify.supported && notify.permission === 'default' && !dismissed;

  if (!mostrarConvite) return null;

  return ReactDOM.createPortal(
    <div style={{
      position: 'fixed', right: 20, bottom: 20, zIndex: 99990,
      width: 320, background: 'rgba(16,16,30,.98)',
      border: '1px solid var(--neon-border)', borderRadius: 14,
      padding: 16, boxShadow: '0 18px 50px rgba(0,0,0,.6)',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <div style={{ background: 'var(--neon-dim)', border: '1px solid var(--neon-border)', borderRadius: 9, padding: 8, display: 'flex' }}>
          <Bell size={16} color="var(--neon)" />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>Ativar notificações</p>
          <p style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.55, marginTop: 4 }}>
            Avisamos quando a CS abrir uma solicitação para você, quando cair uma task
            nova ou um ajuste, e quando uma call for agendada.
          </p>
        </div>
        <button
          onClick={() => setDismissed(true)}
          style={{ background: 'none', border: 'none', padding: 2, cursor: 'pointer', display: 'flex', color: 'var(--muted)' }}
        >
          <X size={14} />
        </button>
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
        <button
          onClick={async () => { await notify.request(); setDismissed(true); }}
          style={{ flex: 1, background: 'linear-gradient(135deg,var(--neon),#c41f4a)', border: 'none', borderRadius: 9, padding: '9px', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
        >
          Ativar
        </button>
        <button
          onClick={() => setDismissed(true)}
          style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 9, padding: '9px 14px', color: 'var(--muted)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
        >
          Agora não
        </button>
      </div>
    </div>,
    document.body
  );
}
