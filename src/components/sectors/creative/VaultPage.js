import React, { useState } from 'react';
import { Copy, ExternalLink, Plus, ChevronDown, ChevronUp, Edit2, Check } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';

function ColorSwatch({ hex, onCopy }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(hex);
    setCopied(true);
    onCopy && onCopy(hex);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, cursor: 'pointer', transition: 'all .15s' }} onClick={handleCopy} title="Copiar HEX">
      <div style={{ width: 24, height: 24, borderRadius: 6, background: hex, border: '1px solid rgba(255,255,255,.1)', flexShrink: 0 }} />
      <span style={{ fontSize: 12, color: 'var(--text)', fontFamily: 'var(--fm)' }}>{hex}</span>
      {copied ? <Check size={12} color="var(--green)" style={{ marginLeft: 'auto' }} /> : <Copy size={12} color="var(--muted)" style={{ marginLeft: 'auto' }} />}
    </div>
  );
}

function ClientVaultCard({ client, isAdmin, onUpdate }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    colors: client.brandbook?.colors?.join(', ') || '',
    typography: client.brandbook?.typography || '',
    driveLink: client.brandbook?.driveLink || '',
  });

  const handleSave = () => {
    const colors = form.colors.split(',').map(c => c.trim()).filter(c => c.startsWith('#') || c.length > 0);
    onUpdate(client.id, { colors, typography: form.typography, driveLink: form.driveLink });
    setEditing(false);
  };

  const bb = client.brandbook || {};
  const hasData = bb.colors?.length || bb.typography || bb.driveLink;

  return (
    <div style={{ background: 'rgba(12,12,24,.88)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', marginBottom: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', cursor: 'pointer' }} onClick={() => setOpen(!open)}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--neon-dim)', border: '1px solid var(--neon-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 700, color: 'var(--neon)' }}>
            {client.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{client.name}</p>
            <p style={{ fontSize: 11, color: 'var(--muted)' }}>{hasData ? 'Brandbook disponível' : 'Sem dados ainda'}</p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {isAdmin && (
            <button style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, padding: '5px 7px', color: 'var(--muted)', display: 'flex', alignItems: 'center', cursor: 'pointer' }}
              onClick={e => { e.stopPropagation(); setEditing(!editing); setOpen(true); }}>
              <Edit2 size={13} />
            </button>
          )}
          {open ? <ChevronUp size={16} color="var(--muted)" /> : <ChevronDown size={16} color="var(--muted)" />}
        </div>
      </div>

      {open && (
        <div style={{ padding: '0 16px 16px', borderTop: '1px solid var(--border)' }} className="fade-in">
          {editing && isAdmin ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 14 }}>
              <div>
                <label style={S.label}>CORES (HEX separados por vírgula)</label>
                <input style={S.input} value={form.colors} onChange={e => setForm(f => ({ ...f, colors: e.target.value }))} placeholder="#EE3363, #0f0f18, #ffffff" />
              </div>
              <div>
                <label style={S.label}>TIPOGRAFIA</label>
                <input style={S.input} value={form.typography} onChange={e => setForm(f => ({ ...f, typography: e.target.value }))} placeholder="Ex: Outfit Bold + JetBrains Mono" />
              </div>
              <div>
                <label style={S.label}>LINK ASSETS (GOOGLE DRIVE)</label>
                <input style={S.input} value={form.driveLink} onChange={e => setForm(f => ({ ...f, driveLink: e.target.value }))} placeholder="https://drive.google.com/..." />
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button style={S.cancelBtn} onClick={() => setEditing(false)}>Cancelar</button>
                <button style={S.saveBtn} onClick={handleSave}>Salvar Brandbook</button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 14 }}>
              {bb.colors?.length > 0 && (
                <div>
                  <p style={{ ...S.label, marginBottom: 8 }}>PALETA DE CORES</p>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(140px,1fr))', gap: 6 }}>
                    {bb.colors.map((c, i) => <ColorSwatch key={i} hex={c} />)}
                  </div>
                </div>
              )}
              {bb.typography && (
                <div>
                  <p style={{ ...S.label, marginBottom: 6 }}>TIPOGRAFIA</p>
                  <p style={{ fontSize: 14, color: 'var(--text)', background: 'var(--surface)', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)' }}>{bb.typography}</p>
                </div>
              )}
              {bb.driveLink && (
                <a href={bb.driveLink} target="_blank" rel="noreferrer"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(56,189,248,.1)', border: '1px solid rgba(56,189,248,.3)', borderRadius: 8, padding: '9px 14px', color: 'var(--blue)', fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>
                  <ExternalLink size={14} /> Acessar Pasta de Assets
                </a>
              )}
              {!hasData && <p style={{ fontSize: 13, color: 'var(--muted)', textAlign: 'center', padding: '8px 0' }}>Nenhum dado de brandbook cadastrado.</p>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function VaultPage({ clients, sectorId, onUpdateBrandbook }) {
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const activeClients = clients.filter(c => c.active && c.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="fade-up">
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, color: '#fff', letterSpacing: '-.5px', marginBottom: 4 }}>🔐 O Cofre</h1>
        <p style={{ fontSize: 13, color: 'var(--muted)' }}>Brandbooks dos clientes — paletas, tipografias e assets</p>
      </div>
      <input
        style={{ ...S.input, marginBottom: 16, width: '100%', maxWidth: 380 }}
        placeholder="Buscar cliente..."
        value={search}
        onChange={e => setSearch(e.target.value)}
      />
      {activeClients.length === 0
        ? <p style={{ fontSize: 13, color: 'var(--muted)', textAlign: 'center', padding: '40px 0' }}>Nenhum cliente encontrado.</p>
        : activeClients.map(c => (
          <ClientVaultCard
            key={c.id}
            client={c}
            isAdmin={user?.isAdmin}
            onUpdate={onUpdateBrandbook}
          />
        ))
      }
    </div>
  );
}

const S = {
  label: { fontSize: 10, letterSpacing: '.14em', color: 'var(--muted)', fontWeight: 600, fontFamily: 'var(--fm)', display: 'block' },
  input: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 9, padding: '10px 13px', color: 'var(--text)', fontSize: 13, outline: 'none', fontFamily: 'var(--f)' },
  cancelBtn: { background: 'transparent', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 16px', color: 'var(--muted)', fontSize: 13, cursor: 'pointer', fontFamily: 'var(--f)' },
  saveBtn: { background: 'linear-gradient(135deg,var(--neon),#c41f4a)', border: 'none', borderRadius: 8, padding: '8px 18px', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 14px rgba(238,51,99,.3)' },
};
