import React, { useEffect, useRef, useState } from 'react';
import { LogOut, Plus, Bell, BellOff, Sun, Moon, Calendar, Check, Trash2 } from 'lucide-react';
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
  const [open, setOpen] = useState(false);
  const boxRef = useRef(null);

  // Fecha ao clicar fora ou com Esc. Ao fechar, tudo vira "lido".
  useEffect(() => {
    if (!open) return;
    const fora = (e) => { if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false); };
    const esc = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', fora);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', fora); document.removeEventListener('keydown', esc); };
  }, [open]);
  useEffect(() => { if (!open) notify.markAllRead(); }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const bloqueado = !notify.supported || notify.permission === 'denied';
  const statusDesktop = !notify.supported
    ? 'Navegador sem suporte'
    : notify.permission === 'denied'
      ? 'Bloqueadas nas configurações do navegador'
      : notify.active ? 'Ligadas' : 'Desligadas';

  const handleDesktop = () => {
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
      <div ref={boxRef} style={{ position: 'relative' }}>
        <button className={`top-btn icon${open ? ' on' : ''}`} onClick={() => setOpen(o => !o)} title="Notificações" aria-expanded={open}>
          <Bell size={16} />
          {notify.unread > 0 && <span style={S.badge}>{notify.unread > 9 ? '9+' : notify.unread}</span>}
        </button>

        {open && (
          <div className="fade-up" style={S.panel}>
            <div style={S.panelHead}>
              <b style={{ fontSize: 13.5, fontWeight: 500 }}>Notificações</b>
              {notify.history.length > 0 && (
                <button className="top-btn" style={{ height: 28, padding: '0 8px', fontSize: 11.5 }} onClick={notify.clearHistory} title="Limpar tudo">
                  <Trash2 size={12} /> Limpar
                </button>
              )}
            </div>

            <div style={S.panelList}>
              {notify.history.length === 0 ? (
                <p style={{ padding: '26px 16px', textAlign: 'center', color: 'var(--muted)', fontSize: 12.5, lineHeight: 1.5 }}>
                  Nada por enquanto.<br />Solicitações, tasks e calls suas vão aparecer aqui.
                </p>
              ) : notify.history.map(n => (
                <div key={n.tag} style={{ ...S.item, background: n.read ? 'transparent' : 'var(--c-dim)' }}>
                  {!n.read && <span style={S.itemDot} />}
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <p style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--text)' }}>{n.title}</p>
                    {n.body && <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2, lineHeight: 1.4 }}>{n.body}</p>}
                    <p style={{ fontSize: 10, fontFamily: 'var(--fm)', color: 'var(--dim)', marginTop: 5 }}>{quando(n.at)}</p>
                  </div>
                </div>
              ))}
            </div>

            <button
              className="top-btn"
              onClick={handleDesktop}
              disabled={bloqueado}
              style={{ ...S.panelFoot, opacity: bloqueado ? .5 : 1 }}
              title={notify.permission === 'default' ? 'Pedir permissão ao navegador' : 'Ligar ou desligar o aviso na área de trabalho'}
            >
              {notify.active ? <Check size={13} color="var(--green)" /> : <BellOff size={13} />}
              <span style={{ flex: 1, textAlign: 'left' }}>Aviso na área de trabalho</span>
              <span style={{ fontSize: 11, color: notify.active ? 'var(--green)' : 'var(--muted)' }}>{statusDesktop}</span>
            </button>
          </div>
        )}
      </div>
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

// "há 5 min", "ontem 14:32", "02/09 09:03"
function quando(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const diff = (Date.now() - d.getTime()) / 60000;
  if (diff < 1) return 'agora';
  if (diff < 60) return `há ${Math.floor(diff)} min`;
  const hoje = new Date();
  const mesmoDia = d.toDateString() === hoje.toDateString();
  const hora = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  if (mesmoDia) return `hoje ${hora}`;
  const ontem = new Date(hoje); ontem.setDate(hoje.getDate() - 1);
  if (d.toDateString() === ontem.toDateString()) return `ontem ${hora}`;
  return `${d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} ${hora}`;
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
  badge: { position: 'absolute', top: 4, right: 3, minWidth: 16, height: 16, padding: '0 4px', borderRadius: 99, background: 'var(--c)', color: 'var(--on)', fontFamily: 'var(--fm)', fontSize: 9.5, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid var(--bg)' },
  panel: { position: 'absolute', top: 44, right: 0, width: 340, background: 'var(--bg2)', border: '1px solid var(--border-h)', borderRadius: 16, boxShadow: '0 20px 50px -20px rgba(0,0,0,.5), var(--shadow)', zIndex: 60, overflow: 'hidden' },
  panelHead: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px 10px', borderBottom: '1px solid var(--border)' },
  panelList: { maxHeight: 360, overflowY: 'auto' },
  item: { display: 'flex', gap: 10, padding: '11px 14px', borderBottom: '1px solid var(--border)', position: 'relative' },
  itemDot: { width: 7, height: 7, borderRadius: '50%', background: 'var(--c)', marginTop: 6, flexShrink: 0 },
  panelFoot: { width: '100%', height: 40, borderRadius: 0, borderTop: '1px solid var(--border)', padding: '0 14px', fontSize: 12.5, gap: 8 },
  me: { display: 'flex', alignItems: 'center', gap: 10, paddingLeft: 12, marginLeft: 6, borderLeft: '1px solid var(--border)' },
  meAv: { width: 36, height: 36, borderRadius: '50%', background: 'var(--bg2)', border: '1px solid var(--border-h)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  meName: { fontSize: 13, fontWeight: 500, color: 'var(--text)' },
  meTag: { fontSize: 9.5, letterSpacing: '.12em', color: 'var(--c)', fontFamily: 'var(--fm)' },
};
