import React from 'react';
import { LogOut, Plus, Bell, BellOff, Sun, Moon, Calendar } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme, useSectorTheme, useBrandLogo } from '../../contexts/ThemeContext';
import { SECTORS, ADMIN_CONFIG } from '../../lib/firebase';
import { useDesktopNotifications } from '../../hooks/useDesktopNotifications';

// ─── AppShell ─────────────────────────────────────────────────
// Casca única de todos os painéis (admin e setores):
//   • sidebar de 224px com a marca e a navegação — o item ativo usa
//     o gradiente do setor (--grad), o resto é neutro;
//   • barra superior com Agenda, tema, notificações e o perfil.
//
// A aba `agenda` é retirada da sidebar e vira link no topo; o
// dashboard continua tratando `onNav('agenda')` como sempre.
// A largura de 224px é a mesma da sidebar antiga, então o
// `marginLeft: 224` dos dashboards ainda não migrados continua certo.

export const SIDEBAR_WIDTH = 224;

const configOf = (sectorId) => (sectorId === 'admin' ? ADMIN_CONFIG : SECTORS[sectorId]) || ADMIN_CONFIG;

const tagOf = (user, sectorId) => {
  if (sectorId === 'admin') return 'ADMIN';
  if (sectorId === 'cs' && user?.csRole) return user.csRole === 'comercial' ? 'CS COMERCIAL' : 'CS OPERACIONAL';
  return (configOf(sectorId).label || '').toUpperCase();
};

export default function AppShell({ sectorId, navItems, activeKey, onNav, onAddClient, addClientLabel = 'Novo Cliente', topActions, children }) {
  useSectorTheme(sectorId);
  const { user } = useAuth();
  const sector = configOf(sectorId);
  const hasAgenda = navItems.some(n => n.key === 'agenda');

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Aside sectorId={sectorId} navItems={navItems} activeKey={activeKey} onNav={onNav} onAddClient={onAddClient} addClientLabel={addClientLabel} />
      <main style={{ flex: 1, marginLeft: SIDEBAR_WIDTH, padding: '18px 32px 32px', minHeight: '100vh', minWidth: 0 }}>
        <TopBar
          sector={sector}
          user={user}
          tag={tagOf(user, sectorId)}
          agendaActive={activeKey === 'agenda'}
          onAgenda={hasAgenda ? () => onNav('agenda') : null}
          extra={topActions}
        />
        {children}
      </main>
    </div>
  );
}

// ─── Sidebar ──────────────────────────────────────────────────
export function Aside({ sectorId, navItems, activeKey, onNav, onAddClient, addClientLabel = 'Novo Cliente', showUser = false }) {
  const { user, logout } = useAuth();
  const brand = useBrandLogo();
  const sector = configOf(sectorId);
  const items = navItems.filter(n => n.key !== 'agenda');

  return (
    <aside style={S.aside}>
      <div style={S.brand}>
        <img src={brand} alt="Lince Performance" style={{ height: 22, objectFit: 'contain' }} />
      </div>

      {showUser && (
        <div style={S.user}>
          <div style={S.userAv}><img src={sector.logo} alt="" style={{ width: 24, height: 24, objectFit: 'contain' }} /></div>
          <div style={{ minWidth: 0 }}>
            <div style={S.userName}>{user?.name}</div>
            <div style={S.userTag}>{tagOf(user, sectorId)}</div>
          </div>
        </div>
      )}

      <nav style={S.nav}>
        {items.map(({ key, label, icon: Icon, badge, badgeDanger }) => {
          const on = activeKey === key;
          return (
            <button key={key} className={`sb-item${on ? ' on' : ''}`} onClick={() => onNav(key)}>
              {Icon && <Icon size={16} strokeWidth={on ? 1.9 : 1.6} />}
              <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>
              {badge > 0 && <span className={`sb-badge${badgeDanger ? ' danger' : ''}`}>{badge}</span>}
            </button>
          );
        })}
      </nav>

      <div style={S.foot}>
        {onAddClient && (
          <button className="ui-btn primary" style={{ width: '100%', justifyContent: 'center', height: 38 }} onClick={onAddClient}>
            <Plus size={14} /> {addClientLabel}
          </button>
        )}
        <button className="sb-item" onClick={logout}>
          <LogOut size={16} /> Sair
        </button>
      </div>
    </aside>
  );
}

// ─── Barra superior ───────────────────────────────────────────
function TopBar({ sector, user, tag, agendaActive, onAgenda, extra }) {
  const { theme, toggle } = useTheme();
  const notify = useDesktopNotifications({ user });

  const bloqueado = !notify.supported || notify.permission === 'denied';
  const notifLabel = !notify.supported
    ? 'Navegador sem suporte a notificações'
    : notify.permission === 'denied'
      ? 'Notificações bloqueadas nas configurações do navegador'
      : notify.active
        ? 'Notificações ligadas — clique para desligar'
        : 'Notificações desligadas — clique para ligar';

  const handleNotify = () => {
    if (bloqueado) return;
    if (notify.permission === 'default') { notify.request(); return; }
    notify.toggle();
  };

  return (
    <div style={S.top}>
      <div style={{ flex: 1 }} />
      {extra}
      {onAgenda && (
        <button className={`top-btn${agendaActive ? ' on' : ''}`} onClick={onAgenda}>
          <Calendar size={14} /> Agenda
        </button>
      )}
      <button className="top-btn icon" onClick={toggle} title={theme === 'light' ? 'Mudar para o tema escuro' : 'Mudar para o tema claro'}>
        {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
      </button>
      <button className={`top-btn icon${bloqueado ? ' dim' : ''}`} onClick={handleNotify} title={notifLabel} style={{ position: 'relative' }}>
        {notify.active ? <Bell size={16} /> : <BellOff size={16} />}
        {notify.active && <span style={S.dot} />}
      </button>
      <div style={S.me}>
        <div style={S.meAv}><img src={sector.logo} alt="" style={{ width: 26, height: 26, objectFit: 'contain' }} /></div>
        <div style={{ lineHeight: 1.15 }}>
          <div style={S.meName}>{user?.name}</div>
          <div style={S.meTag}>{tag}</div>
        </div>
      </div>
    </div>
  );
}

const S = {
  aside: { width: SIDEBAR_WIDTH, height: '100vh', background: 'var(--panel)', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', padding: '22px 14px', position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 20, overflowY: 'auto' },
  brand: { display: 'flex', alignItems: 'center', padding: '4px 8px 26px' },
  user: { display: 'flex', alignItems: 'center', gap: 10, padding: '8px 8px 14px', marginBottom: 10, borderBottom: '1px solid var(--border)' },
  userAv: { width: 34, height: 34, borderRadius: 11, background: 'var(--bg3)', border: '1px solid var(--border-h)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  userName: { fontSize: 13, fontWeight: 500, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  userTag: { fontSize: 9.5, letterSpacing: '.12em', color: 'var(--c)', fontFamily: 'var(--fm)', marginTop: 1 },
  nav: { display: 'flex', flexDirection: 'column', gap: 2, flex: 1 },
  foot: { paddingTop: 12, borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 6 },
  top: { display: 'flex', alignItems: 'center', gap: 6, height: 44, marginBottom: 16 },
  dot: { position: 'absolute', top: 8, right: 8, width: 7, height: 7, borderRadius: '50%', background: 'var(--c)', border: '2px solid var(--bg)' },
  me: { display: 'flex', alignItems: 'center', gap: 10, paddingLeft: 12, marginLeft: 6, borderLeft: '1px solid var(--border)' },
  meAv: { width: 36, height: 36, borderRadius: '50%', background: 'var(--bg2)', border: '1px solid var(--border-h)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  meName: { fontSize: 13, fontWeight: 500, color: 'var(--text)' },
  meTag: { fontSize: 9.5, letterSpacing: '.12em', color: 'var(--c)', fontFamily: 'var(--fm)' },
};
