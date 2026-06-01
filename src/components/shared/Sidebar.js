import React from 'react';
import { LogOut, Plus } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { SECTORS } from '../../lib/firebase';

export default function Sidebar({ navItems, activeKey, onNav, onAddClient, sectorId }) {
  const { user, logout } = useAuth();
  const sector = SECTORS[sectorId];
  const color = sector?.color || 'var(--neon)';

  return (
    <aside style={{ ...S.sb, borderColor: `${color}22` }}>
      <div style={S.logo}>
        <div style={{ ...S.logoIcon, background: `${color}18`, border: `1px solid ${color}40`, boxShadow: `0 0 16px ${color}30` }}>
          <span style={{ fontSize: 20 }}>{sector?.emoji || '⚡'}</span>
        </div>
        <div>
          <div style={S.logoText}>{sector?.label || 'Dashboard'}</div>
          <div style={{ ...S.logoBadge, color }}>{user?.name}</div>
        </div>
      </div>

      <nav style={S.nav}>
        {navItems.map(({ key, label, icon: Icon, badge, badgeDanger }) => (
          <button
            key={key}
            style={{ ...S.ni, ...(activeKey === key ? { ...S.niActive, background: `${color}15`, color, borderLeft: `2px solid ${color}` } : {}) }}
            onClick={() => onNav(key)}
          >
            <Icon size={15} color={activeKey === key ? color : 'var(--muted)'} />
            <span>{label}</span>
            {badge > 0 && (
              <span style={{ ...S.badge, ...(badgeDanger ? { background: `${color}25`, color } : {}) }}>{badge}</span>
            )}
          </button>
        ))}
      </nav>

      <div style={S.bottom}>
        {onAddClient && (
          <button style={{ ...S.addBtn, background: `linear-gradient(135deg,${color}30,${color}15)`, border: `1px solid ${color}45`, color }} onClick={onAddClient}>
            <Plus size={14} /> Novo Cliente
          </button>
        )}
        <button style={S.logoutBtn} onClick={logout} title="Sair">
          <LogOut size={14} color="var(--muted)" />
        </button>
      </div>
    </aside>
  );
}

const S = {
  sb: { width: 224, height: '100vh', background: 'rgba(9,9,20,.97)', borderRight: '1px solid', display: 'flex', flexDirection: 'column', padding: '20px 14px', position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 20, backdropFilter: 'blur(24px)' },
  logo: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 28, paddingBottom: 20, borderBottom: '1px solid var(--border)' },
  logoIcon: { width: 38, height: 38, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  logoText: { fontSize: 14, fontWeight: 800, color: '#fff' },
  logoBadge: { fontSize: 10, letterSpacing: '.08em', marginTop: 1, fontFamily: 'var(--fm)', textTransform: 'uppercase' },
  nav: { display: 'flex', flexDirection: 'column', gap: 3, flex: 1 },
  ni: { display: 'flex', alignItems: 'center', gap: 9, background: 'transparent', border: 'none', borderRadius: 9, padding: '9px 11px', color: 'var(--muted)', fontSize: 13, fontWeight: 500, textAlign: 'left', width: '100%', transition: 'all .15s' },
  niActive: { paddingLeft: 9 },
  badge: { marginLeft: 'auto', background: 'rgba(255,255,255,.07)', borderRadius: 10, padding: '1px 7px', fontSize: 10, color: 'var(--muted)', fontFamily: 'var(--fm)' },
  bottom: { paddingTop: 14, borderTop: '1px solid var(--border)', display: 'flex', gap: 8 },
  addBtn: { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 9, padding: 9, fontSize: 12, fontWeight: 600, transition: 'all .2s' },
  logoutBtn: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 9, padding: '9px 10px', display: 'flex', alignItems: 'center' },
};
