import React, { useState } from 'react';
import { LayoutDashboard, UserCheck, AlertCircle, RefreshCw, CheckCircle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useClients } from '../../hooks/useClients';
import { useCollaborators } from '../../hooks/useCollaborators';
import { useToast } from '../../components/shared/Toast';
import Sidebar from '../../components/shared/Sidebar';
import WDOverview from '../../components/sectors/webdesign/WDOverview';
import WDClientList from '../../components/sectors/webdesign/WDClientList';
import WDAddClientModal from '../../components/sectors/webdesign/WDAddClientModal';

const NAV = [
  { key: 'overview',    label: 'Visão Geral',  icon: LayoutDashboard },
  { key: 'onboarding',  label: 'Onboarding',   icon: UserCheck },
  { key: 'production',  label: 'Produção',      icon: AlertCircle },
  { key: 'inactive',    label: 'Inativos',      icon: AlertCircle },
  { key: 'recurrence',  label: 'Recorrência',   icon: RefreshCw },
  { key: 'finished',    label: 'Finalizados',   icon: CheckCircle },
];

export default function WebDesignDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { clients, loading, addClient, wdMoveToProduction, wdMoveBackToOnboarding, wdUpdateChecklist, wdUpdateNotes, wdMoveStatus, deleteClient } = useClients();
  const { collaborators } = useCollaborators('webdesign');

  const [page, setPage] = useState('overview');
  const [prodSubTab, setProdSubTab] = useState('ecommerce');
  const [showAddModal, setShowAddModal] = useState(false);

  const wdClients = clients.filter(c => c.wd?.status);

  const counts = {
    onboarding: wdClients.filter(c => c.wd.status === 'onboarding').length,
    production: wdClients.filter(c => c.wd.status === 'production').length,
    inactive: wdClients.filter(c => c.wd.status === 'inactive').length,
    recurrence: wdClients.filter(c => c.wd.status === 'recurrence').length,
    finished: wdClients.filter(c => c.wd.status === 'finished').length,
  };

  const overdueOnboarding = wdClients.filter(c => {
    if (c.wd.status !== 'onboarding' || !c.wd.onboardingStartedAt) return false;
    return (Date.now() - new Date(c.wd.onboardingStartedAt)) / 86400000 > 7;
  }).length;

  const navItems = NAV.map(n => ({
    ...n,
    badge: counts[n.key] || 0,
    badgeDanger: n.key === 'onboarding' && overdueOnboarding > 0,
  }));

  const handleAdd = async (data) => {
    const res = await addClient(data);
    if (res.success) toast(`${data.name} cadastrado!`);
    return res;
  };

  const wrap = (fn, successMsg) => async (...args) => {
    const res = await fn(...args);
    if (res.success && successMsg) toast(successMsg);
    else if (!res.success) toast(res.error, 'e');
    return res;
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar
        sectorId="webdesign"
        navItems={navItems}
        activeKey={page}
        onNav={setPage}
        onAddClient={() => setShowAddModal(true)}
      />
      <main style={{ flex: 1, marginLeft: 224, padding: 32, minHeight: '100vh', overflow: 'auto' }}>
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
            <div className="spinner" style={{ width: 36, height: 36 }} />
          </div>
        ) : page === 'overview' ? (
          <WDOverview clients={wdClients} collaborators={collaborators} onNavigate={setPage} />
        ) : (
          <WDClientList
            clients={wdClients}
            collaborators={collaborators}
            page={page}
            prodSubTab={prodSubTab}
            setProdSubTab={setProdSubTab}
            onMoveToProduction={wrap(wdMoveToProduction)}
            onMoveBackToOnboarding={wrap(wdMoveBackToOnboarding)}
            onUpdateChecklist={wdUpdateChecklist}
            onUpdateNotes={wdUpdateNotes}
            onMoveStatus={(id, status, extra) => wrap(wdMoveStatus)(id, status, extra)}
            onDelete={wrap(deleteClient, 'Cliente removido.')}
            onAddClient={() => setShowAddModal(true)}
          />
        )}
      </main>
      {showAddModal && (
        <WDAddClientModal
          onClose={() => setShowAddModal(false)}
          onAdd={handleAdd}
          collaborators={collaborators}
        />
      )}
    </div>
  );
}
