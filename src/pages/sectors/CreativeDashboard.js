import React, { useState } from 'react';
import { LayoutDashboard, PlusCircle, BookOpen } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useClients } from '../../hooks/useClients';
import { useToast } from '../../components/shared/Toast';
import Sidebar from '../../components/shared/Sidebar';
import CreativeOverview from '../../components/sectors/creative/CreativeOverview';
import DeliveryModal from '../../components/sectors/creative/DeliveryModal';
import VaultPage from '../../components/sectors/creative/VaultPage';

const NAV = [
  { key: 'overview', label: 'Visão Geral', icon: LayoutDashboard },
  { key: 'vault',    label: 'O Cofre',     icon: BookOpen },
];

export default function CreativeDashboard({ sectorId }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const { clients, loading, addDelivery, updateBrandbook } = useClients();
  const [page, setPage] = useState('overview');
  const [showDeliveryModal, setShowDeliveryModal] = useState(false);

  const deliveryKey = sectorId === 'design' ? 'design' : 'video';
  const responsibleField = sectorId === 'design' ? 'design' : 'videomaker';

  // Only clients where this collaborator is responsible for this sector
  const myClients = clients.filter(
    c => c.active && c.responsibles?.[responsibleField] === user?.name
  );

  // Only this collaborator's deliveries
  const myDeliveries = [];
  myClients.forEach(c => {
    const deliveries = sectorId === 'design'
      ? (c.design?.deliveries || [])
      : (c.video?.deliveries || []);
    deliveries.forEach(d => {
      if (d.responsible === user?.name) {
        myDeliveries.push({ ...d, clientName: c.name, clientId: c.id });
      }
    });
  });

  const handleAddDelivery = async (data) => {
    const res = await addDelivery(data.clientId, deliveryKey, {
      ...data,
      responsible: user?.name,
    });
    if (res.success) {
      toast('Entrega cadastrada!');
      setShowDeliveryModal(false);
    } else {
      toast(res.error, 'e');
    }
  };

  const handleUpdateBrandbook = async (clientId, brandbook) => {
    const res = await updateBrandbook(clientId, brandbook);
    if (res.success) toast('Brandbook atualizado!');
    else toast(res.error, 'e');
  };

  const sectorColor = sectorId === 'design' ? '#a78bfa' : '#fb923c';
  const navItems = NAV.map(n => ({ ...n, badge: 0 }));

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar sectorId={sectorId} navItems={navItems} activeKey={page} onNav={setPage} />
      <main style={{ flex: 1, marginLeft: 224, padding: 32, minHeight: '100vh', overflow: 'auto' }}>
        {/* Floating add delivery button */}
        <button
          onClick={() => setShowDeliveryModal(true)}
          style={{
            position: 'fixed', bottom: 28, right: 28, zIndex: 100,
            background: `linear-gradient(135deg, ${sectorColor}, ${sectorColor}99)`,
            border: 'none', borderRadius: 14, padding: '14px 22px',
            color: '#fff', fontSize: 14, fontWeight: 700,
            display: 'flex', alignItems: 'center', gap: 8,
            boxShadow: `0 8px 28px ${sectorColor}40`,
            cursor: 'pointer',
          }}
        >
          <PlusCircle size={18} /> Cadastrar Entrega
        </button>

        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
            <div className="spinner" style={{ width: 36, height: 36 }} />
          </div>
        ) : page === 'overview' ? (
          <CreativeOverview myDeliveries={myDeliveries} sectorId={sectorId} />
        ) : (
          <VaultPage clients={clients} sectorId={sectorId} onUpdateBrandbook={handleUpdateBrandbook} />
        )}
      </main>

      {showDeliveryModal && (
        <DeliveryModal
          clients={myClients}
          sectorId={sectorId}
          onClose={() => setShowDeliveryModal(false)}
          onSave={handleAddDelivery}
        />
      )}
    </div>
  );
}
