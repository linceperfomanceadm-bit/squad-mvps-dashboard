import React, { useState } from 'react';
import { LayoutDashboard, Kanban, Plus } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useClients } from '../../hooks/useClients';
import { useToast } from '../../components/shared/Toast';
import Sidebar from '../../components/shared/Sidebar';
import SMOverview from '../../components/sectors/socialMedia/SMOverview';
import SMKanban from '../../components/sectors/socialMedia/SMKanban';
import SMBulkInput from '../../components/sectors/socialMedia/SMBulkInput';

const NAV = [
  { key: 'overview', label: 'Visão Geral',    icon: LayoutDashboard },
  { key: 'kanban',   label: 'Kanban',          icon: Kanban },
  { key: 'planning', label: 'Planejamento',    icon: Plus },
];

export default function SocialMediaDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { clients, loading, smAddBulkPosts, smUpdatePostStatus } = useClients();
  const [page, setPage] = useState('overview');

  // Each collaborator sees only their posts
  const myPosts = [];
  clients.forEach(c => {
    (c.sm?.posts || []).forEach(p => {
      if (p.responsible === user?.name) myPosts.push({ ...p, clientName: c.name, clientId: c.id });
    });
  });

  const handleBulkSave = async (rows) => {
    const res = await smAddBulkPosts(rows);
    if (res.success) toast(`${rows.length} post${rows.length > 1 ? 's' : ''} adicionado${rows.length > 1 ? 's' : ''} ao Kanban!`);
    else toast(res.error, 'e');
    if (res.success) setPage('kanban');
    return res;
  };

  const handleStatusChange = async (clientId, postId, newStatus) => {
    const res = await smUpdatePostStatus(clientId, postId, newStatus);
    if (!res.success) toast(res.error, 'e');
  };

  const navItems = NAV.map(n => ({
    ...n,
    badge: n.key === 'kanban' ? myPosts.filter(p => p.status === 'client').length : 0,
    badgeDanger: n.key === 'kanban',
  }));

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar sectorId="socialmedia" navItems={navItems} activeKey={page} onNav={setPage} />
      <main style={{ flex: 1, marginLeft: 224, padding: 32, minHeight: '100vh', overflow: 'auto' }}>
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
            <div className="spinner" style={{ width: 36, height: 36 }} />
          </div>
        ) : page === 'overview' ? (
          <SMOverview myPosts={myPosts} onNavigate={setPage} />
        ) : page === 'kanban' ? (
          <SMKanban myPosts={myPosts} onStatusChange={handleStatusChange} />
        ) : (
          <SMBulkInput clients={clients} responsible={user?.name} onSave={handleBulkSave} />
        )}
      </main>
    </div>
  );
}
