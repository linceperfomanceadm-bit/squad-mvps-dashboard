import React, { useState } from 'react';
import { LayoutDashboard, Users, UserCog, BarChart2, Activity } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useClients } from '../../hooks/useClients';
import { useCollaborators } from '../../hooks/useCollaborators';
import { useToast } from '../../components/shared/Toast';
import Sidebar from '../../components/shared/Sidebar';
import AdminOverview from '../../components/admin/AdminOverview';
import AdminFeed from '../../components/admin/AdminFeed';
import AdminCharts from '../../components/admin/AdminCharts';
import AdminClients from '../../components/admin/AdminClients';
import AdminCollaborators from '../../components/admin/AdminCollaborators';

const NAV = [
  { key: 'overview',       label: 'Visão Geral',    icon: LayoutDashboard },
  { key: 'feed',           label: 'Extrato Diário',  icon: Activity },
  { key: 'charts',         label: 'Relatórios',      icon: BarChart2 },
  { key: 'clients',        label: 'Clientes',        icon: Users },
  { key: 'collaborators',  label: 'Colaboradores',   icon: UserCog },
];

export default function AdminDashboard() {
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const { clients, loading: loadingClients, addClient, updateClient, deleteClient, wdMoveToProduction, wdMoveBackToOnboarding, wdUpdateChecklist, wdMoveStatus, smUpdatePostStatus } = useClients();
  const { collaborators, loading: loadingCollabs, addCollaborator, updateCollaborator, deleteCollaborator } = useCollaborators();
  const [page, setPage] = useState('overview');

  const loading = loadingClients || loadingCollabs;

  const handleAddClient = async (data) => {
    const res = await addClient(data);
    if (res.success) toast(`${data.name} cadastrado!`);
    else toast(res.error, 'e');
    return res;
  };

  const handleAddCollab = async (data) => {
    const res = await addCollaborator(data);
    if (res.success) toast(`${data.name} adicionado ao time!`);
    else toast(res.error, 'e');
    return res;
  };

  const handleUpdateCollab = async (id, data) => {
    const res = await updateCollaborator(id, data);
    if (!res.success) toast(res.error, 'e');
    return res;
  };

  const handleDeleteCollab = async (id) => {
    const res = await deleteCollaborator(id);
    if (res.success) toast('Colaborador removido.', 'e');
    else toast(res.error, 'e');
    return res;
  };

  // custom sidebar for admin (no sector color, uses neon)
  const navItems = NAV.map(n => ({ ...n, badge: 0 }));

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {/* Custom admin sidebar */}
      <aside style={S.sidebar}>
        <div style={S.logo}>
          <div style={S.logoIcon}><span style={{ fontSize: 20 }}>👑</span></div>
          <div>
            <div style={S.logoText}>Admin</div>
            <div style={S.logoBadge}>{user?.name}</div>
          </div>
        </div>
        <nav style={{ display: 'flex', flexDirection: 'column', gap: 3, flex: 1 }}>
          {navItems.map(({ key, label, icon: Icon }) => (
            <button key={key} style={{ ...S.ni, ...(page === key ? S.niActive : {}) }} onClick={() => setPage(key)}>
              <Icon size={15} color={page === key ? 'var(--neon)' : 'var(--muted)'} />
              <span>{label}</span>
            </button>
          ))}
        </nav>
        <div style={{ paddingTop: 14, borderTop: '1px solid var(--border)' }}>
          <button style={S.logoutBtn} onClick={logout}>
            <span style={{ fontSize: 14 }}>🚪</span>
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>Sair</span>
          </button>
        </div>
      </aside>

      <main style={{ flex: 1, marginLeft: 224, padding: 32, minHeight: '100vh', overflow: 'auto' }}>
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
            <div className="spinner" style={{ width: 36, height: 36 }} />
          </div>
        ) : page === 'overview' ? (
          <AdminOverview clients={clients} collaborators={collaborators} onNavigate={setPage} />
        ) : page === 'feed' ? (
          <AdminFeed clients={clients} collaborators={collaborators} />
        ) : page === 'charts' ? (
          <AdminCharts clients={clients} />
        ) : page === 'clients' ? (
          <AdminClients
            clients={clients}
            collaborators={collaborators}
            onAdd={handleAddClient}
            onUpdate={updateClient}
            onDelete={deleteClient}
            onWdMoveToProduction={wdMoveToProduction}
            onWdMoveBackToOnboarding={wdMoveBackToOnboarding}
            onWdMoveStatus={wdMoveStatus}
          />
        ) : (
          <AdminCollaborators
            collaborators={collaborators}
            onAdd={handleAddCollab}
            onUpdate={handleUpdateCollab}
            onDelete={handleDeleteCollab}
          />
        )}
      </main>
    </div>
  );
}

const S = {
  sidebar: { width: 224, height: '100vh', background: 'rgba(9,9,20,.97)', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', padding: '20px 14px', position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 20, backdropFilter: 'blur(24px)' },
  logo: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 28, paddingBottom: 20, borderBottom: '1px solid var(--border)' },
  logoIcon: { width: 38, height: 38, borderRadius: 10, background: 'var(--neon-dim)', border: '1px solid var(--neon-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 16px rgba(238,51,99,.2)' },
  logoText: { fontSize: 14, fontWeight: 800, color: '#fff' },
  logoBadge: { fontSize: 10, color: 'var(--neon)', letterSpacing: '.08em', marginTop: 1, fontFamily: 'var(--fm)', textTransform: 'uppercase' },
  ni: { display: 'flex', alignItems: 'center', gap: 9, background: 'transparent', border: 'none', borderRadius: 9, padding: '9px 11px', color: 'var(--muted)', fontSize: 13, fontWeight: 500, textAlign: 'left', width: '100%', cursor: 'pointer', transition: 'all .15s' },
  niActive: { background: 'var(--neon-dim)', color: 'var(--neon)', borderLeft: '2px solid var(--neon)', paddingLeft: 9 },
  logoutBtn: { display: 'flex', alignItems: 'center', gap: 8, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 9, padding: '9px 12px', cursor: 'pointer', width: '100%' },
};
