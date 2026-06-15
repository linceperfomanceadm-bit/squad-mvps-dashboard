import React, { useState } from 'react';
import ReactDOM from 'react-dom';
import { Package, Plus, LogOut, Edit2, Trash2, Image as ImageIcon } from 'lucide-react';
import { usePortalAuth } from '../contexts/PortalAuthContext';
import { usePortalProducts } from '../hooks/usePortalProducts';
import ProductFormModal from '../components/portal/ProductFormModal';

const ACCENT = '#EE3363';

/*
 * Área do cliente do portal. Lista os produtos, mostra progresso contra
 * o teto contratado, e abre o modal de cadastro/edição. Rota: /portal
 */
export default function PortalDashboard() {
  const { client, logout } = usePortalAuth();
  const { products, loading, addProduct, updateProduct, removeProduct, uploadImage, removeImage } = usePortalProducts(client?.id);

  const [editing, setEditing] = useState(null); // produto em edição
  const [creating, setCreating] = useState(false);
  const [confirmDel, setConfirmDel] = useState(null);

  const limit = client?.productLimit || 0;
  const count = products.length;
  const pct = limit > 0 ? Math.min(100, Math.round((count / limit) * 100)) : 0;
  const atLimit = count >= limit;
  const complete = limit > 0 && count >= limit;

  return (
    <div style={{ minHeight: '100vh', background: '#07070e', fontFamily: "'Outfit',sans-serif" }}>
      {/* Topo */}
      <header style={{ borderBottom: '1px solid rgba(255,255,255,.08)', padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(14,14,28,.6)', position: 'sticky', top: 0, zIndex: 10, backdropFilter: 'blur(12px)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: `${ACCENT}1a`, border: `1px solid ${ACCENT}40`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Package size={20} color={ACCENT} />
          </div>
          <div>
            <p style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>{client?.clientName}</p>
            <p style={{ fontSize: 11, color: '#8b8b9e', fontFamily: "'JetBrains Mono',monospace" }}>Cadastro de Produtos</p>
          </div>
        </div>
        <button onClick={logout} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(20,20,38,.8)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 9, padding: '8px 14px', color: '#8b8b9e', fontSize: 13, cursor: 'pointer' }}>
          <LogOut size={14} /> Sair
        </button>
      </header>

      <main style={{ maxWidth: 1000, margin: '0 auto', padding: '28px 24px' }}>
        {/* Progresso */}
        <div style={{ background: 'rgba(14,14,28,.7)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 16, padding: 20, marginBottom: 22 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
            <div>
              <h1 style={{ fontSize: 22, fontWeight: 800, color: '#fff', marginBottom: 2 }}>Seus Produtos</h1>
              <p style={{ fontSize: 13, color: '#8b8b9e' }}>
                {complete
                  ? 'Você cadastrou todos os produtos contratados. 🎉'
                  : `Cadastre seus produtos — faltam ${limit - count} de ${limit}.`}
              </p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <p style={{ fontSize: 28, fontWeight: 800, color: complete ? '#22c55e' : ACCENT }}>{count}<span style={{ fontSize: 16, color: '#8b8b9e', fontWeight: 500 }}> / {limit}</span></p>
              <p style={{ fontSize: 10, color: '#8b8b9e', fontFamily: "'JetBrains Mono',monospace", letterSpacing: '.08em' }}>PRODUTOS</p>
            </div>
          </div>
          <div style={{ height: 8, borderRadius: 4, background: 'rgba(20,20,38,.9)', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${pct}%`, background: complete ? '#22c55e' : ACCENT, transition: 'width .4s', boxShadow: pct > 0 ? `0 0 10px ${complete ? '#22c55e' : ACCENT}88` : 'none' }} />
          </div>
        </div>

        {/* Botão adicionar */}
        <div style={{ marginBottom: 18 }}>
          <button
            onClick={() => !atLimit && setCreating(true)}
            disabled={atLimit}
            title={atLimit ? 'Limite de produtos atingido' : ''}
            style={{ display: 'flex', alignItems: 'center', gap: 8, background: atLimit ? 'rgba(20,20,38,.6)' : `linear-gradient(135deg,${ACCENT},#c41f4a)`, border: atLimit ? '1px solid rgba(255,255,255,.08)' : 'none', borderRadius: 10, padding: '12px 20px', color: atLimit ? '#6b6b80' : '#fff', fontSize: 14, fontWeight: 700, cursor: atLimit ? 'not-allowed' : 'pointer' }}
          >
            <Plus size={16} /> Adicionar produto
          </button>
          {atLimit && <p style={{ fontSize: 12, color: '#f59e0b', marginTop: 8 }}>Você atingiu o limite contratado. Fale com a agência se precisar de mais.</p>}
        </div>

        {/* Lista de produtos */}
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><div style={{ width: 30, height: 30, border: `3px solid ${ACCENT}30`, borderTopColor: ACCENT, borderRadius: '50%', animation: 'spin 1s linear infinite' }} /></div>
        ) : products.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', border: '1px dashed rgba(255,255,255,.1)', borderRadius: 16 }}>
            <Package size={40} color="#6b6b80" style={{ marginBottom: 12 }} />
            <p style={{ fontSize: 15, color: '#fff', fontWeight: 600, marginBottom: 4 }}>Nenhum produto ainda</p>
            <p style={{ fontSize: 13, color: '#8b8b9e' }}>Clique em "Adicionar produto" para começar.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 14 }}>
            {products.map(p => (
              <div key={p.id} style={{ background: 'rgba(14,14,28,.7)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 14, overflow: 'hidden' }}>
                <div style={{ height: 150, background: 'rgba(20,20,38,.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                  {p.images?.[0]?.url
                    ? <img src={p.images[0].url} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <ImageIcon size={32} color="#3a3a4e" />}
                  {p.images?.length > 1 && <span style={{ position: 'absolute', bottom: 8, right: 8, fontSize: 10, background: 'rgba(0,0,0,.7)', color: '#fff', padding: '2px 7px', borderRadius: 8, fontFamily: "'JetBrains Mono',monospace" }}>+{p.images.length - 1}</span>}
                </div>
                <div style={{ padding: 14 }}>
                  <p style={{ fontSize: 14, fontWeight: 700, color: '#fff', marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name || 'Sem nome'}</p>
                  <p style={{ fontSize: 13, color: ACCENT, fontWeight: 700, fontFamily: "'JetBrains Mono',monospace" }}>{p.price ? `R$ ${p.price}` : '—'}</p>
                  <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
                    <button onClick={() => setEditing(p)} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, background: 'rgba(20,20,38,.9)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 8, padding: '7px', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                      <Edit2 size={12} /> Editar
                    </button>
                    <button onClick={() => setConfirmDel(p)} style={{ background: 'rgba(20,20,38,.9)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 8, padding: '7px 10px', color: '#ef4444', cursor: 'pointer', display: 'flex' }}>
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Modal criar/editar */}
      {(creating || editing) && ReactDOM.createPortal(
        <ProductFormModal
          product={editing}
          onClose={() => { setCreating(false); setEditing(null); }}
          onSave={async (data, productId) => {
            if (productId) return updateProduct(productId, data);
            return addProduct(data);
          }}
          uploadImage={uploadImage}
          removeImage={removeImage}
        />, document.body)}

      {/* Confirmar exclusão */}
      {confirmDel && ReactDOM.createPortal(
        <div onClick={() => setConfirmDel(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: 20 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'rgba(16,16,30,.98)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 16, padding: 24, maxWidth: 380, textAlign: 'center' }}>
            <Trash2 size={28} color="#ef4444" style={{ marginBottom: 12 }} />
            <h3 style={{ fontSize: 17, fontWeight: 800, color: '#fff', marginBottom: 6 }}>Excluir produto?</h3>
            <p style={{ fontSize: 13, color: '#8b8b9e', marginBottom: 20 }}>"{confirmDel.name || 'Sem nome'}" e suas fotos serão removidos. Esta ação não pode ser desfeita.</p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={async () => { await removeProduct(confirmDel); setConfirmDel(null); }} style={{ flex: 1, background: 'linear-gradient(135deg,#ef4444,#dc2626)', border: 'none', borderRadius: 10, padding: '11px', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Excluir</button>
              <button onClick={() => setConfirmDel(null)} style={{ background: 'rgba(20,20,38,.9)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 10, padding: '11px 18px', color: '#8b8b9e', fontSize: 13, cursor: 'pointer' }}>Cancelar</button>
            </div>
          </div>
        </div>, document.body)}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
