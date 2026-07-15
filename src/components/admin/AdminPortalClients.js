import React, { useState, useMemo } from 'react';
import ReactDOM from 'react-dom';
import { Package, Plus, X, Copy, Edit2, Trash2, ExternalLink, Eye, EyeOff, Download, ImageIcon, ChevronLeft, ChevronRight } from 'lucide-react';
import { usePortalClients } from '../../hooks/usePortalClients';
import { usePortalProducts } from '../../hooks/usePortalProducts';
import { ECOMMERCE_PLATFORMS, PORTAL_STATUS } from '../../lib/firebase';
 
const ACCENT = '#EE3363';
 
/*
 * Gestão dos acessos ao Portal de Coleta (admin e WebDesign).
 * Cria acessos (cliente do CRM ou avulso), define limite e plataforma,
 * lista os clientes com status e contagem de produtos.
 */
export default function AdminPortalClients({ clients = [], currentUser, toast }) {
  const { portalClients, loading, createPortalClient, updatePortalClient, deletePortalClient } = usePortalClients();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [confirmDel, setConfirmDel] = useState(null);
  const [viewing, setViewing] = useState(null);
 
  return (
    <div className="fade-up">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: '#fff', letterSpacing: '-.5px', marginBottom: 4 }}>Portal de Produtos</h1>
          <p style={{ fontSize: 13, color: 'var(--muted)' }}>Crie acessos para os clientes cadastrarem os próprios produtos.</p>
        </div>
        <button onClick={() => { setEditing(null); setShowForm(true); }} style={{ display: 'flex', alignItems: 'center', gap: 8, background: `linear-gradient(135deg,${ACCENT},#c41f4a)`, border: 'none', borderRadius: 10, padding: '11px 18px', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
          <Plus size={16} /> Novo acesso
        </button>
      </div>
 
      {/* Link do portal */}
      <div style={{ background: 'rgba(12,12,24,.6)', border: '1px solid var(--border)', borderRadius: 12, padding: 14, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <ExternalLink size={15} color={ACCENT} />
        <span style={{ fontSize: 13, color: 'var(--text)' }}>Link de acesso do cliente:</span>
        <code style={{ fontSize: 12, color: ACCENT, fontFamily: 'var(--fm)', background: 'rgba(0,0,0,.3)', padding: '3px 8px', borderRadius: 6 }}>{typeof window !== 'undefined' ? window.location.origin : ''}/portal/login</code>
        <button onClick={() => { navigator.clipboard?.writeText(`${window.location.origin}/portal/login`); toast?.('Link copiado!'); }} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 7, padding: '5px 10px', color: 'var(--muted)', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
          <Copy size={12} /> Copiar
        </button>
      </div>
 
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><div className="spinner" style={{ width: 30, height: 30 }} /></div>
      ) : portalClients.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '50px 20px', border: '1px dashed var(--border)', borderRadius: 16 }}>
          <Package size={36} color="var(--muted)" style={{ marginBottom: 12 }} />
          <p style={{ fontSize: 15, color: 'var(--text)', fontWeight: 600, marginBottom: 4 }}>Nenhum acesso criado ainda</p>
          <p style={{ fontSize: 13, color: 'var(--muted)' }}>Clique em "Novo acesso" para o primeiro cliente.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(320px,1fr))', gap: 14 }}>
          {portalClients.map(pc => (
            <PortalClientCard key={pc.id} pc={pc} onView={() => setViewing(pc)} onEdit={() => { setEditing(pc); setShowForm(true); }} onDelete={() => setConfirmDel(pc)} />
          ))}
        </div>
      )}
 
      {showForm && ReactDOM.createPortal(
        <PortalClientForm
          editing={editing}
          clients={clients}
          currentUser={currentUser}
          onClose={() => setShowForm(false)}
          onCreate={createPortalClient}
          onUpdate={updatePortalClient}
          toast={toast}
        />, document.body)}
 
      {confirmDel && ReactDOM.createPortal(
        <ConfirmDelete pc={confirmDel} onClose={() => setConfirmDel(null)} onConfirm={async () => { const r = await deletePortalClient(confirmDel.id); if (r.success) toast?.('Acesso removido.'); setConfirmDel(null); }} />,
        document.body)}
 
      {viewing && ReactDOM.createPortal(
        <ProductViewerModal pc={viewing} onClose={() => setViewing(null)} toast={toast} />, document.body)}
    </div>
  );
}
 
function PortalClientCard({ pc, onView, onEdit, onDelete }) {
  const { products } = usePortalProducts(pc.id);
  const platform = ECOMMERCE_PLATFORMS.find(p => p.id === pc.platform);
  const platformLabel = pc.platform === 'outro' ? (pc.platformOther || 'Outro') : (platform?.label || '—');
  const count = products.length;
  const limit = pc.productLimit || 0;
  const pct = limit > 0 ? Math.min(100, Math.round((count / limit) * 100)) : 0;
  const st = PORTAL_STATUS[pc.status] || PORTAL_STATUS.collecting;
  const done = count >= limit && limit > 0;
 
  return (
    <div onClick={onView} style={{ background: 'rgba(12,12,24,.88)', border: '1px solid var(--border)', borderRadius: 14, padding: 16, cursor: 'pointer', transition: 'border-color .2s, transform .15s' }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = `${ACCENT}66`; e.currentTarget.style.transform = 'translateY(-2px)'; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.transform = 'none'; }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <div>
          <p style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>{pc.clientName}</p>
          <p style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'var(--fm)' }}>@{pc.username}</p>
        </div>
        <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 8, fontFamily: 'var(--fm)', background: `${(done ? '#22c55e' : st.color)}1a`, color: done ? '#22c55e' : st.color, whiteSpace: 'nowrap' }}>
          {done ? 'COMPLETO' : st.label.toUpperCase()}
        </span>
      </div>
 
      <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 11, padding: '3px 9px', borderRadius: 8, background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)' }}>{platformLabel}</span>
        {pc.crmClientId && <span style={{ fontSize: 11, padding: '3px 9px', borderRadius: 8, background: `${ACCENT}1a`, color: ACCENT }}>CRM</span>}
        {!pc.active && <span style={{ fontSize: 11, padding: '3px 9px', borderRadius: 8, background: 'rgba(239,68,68,.15)', color: '#ef4444' }}>Desativado</span>}
      </div>
 
      {/* progresso */}
      <div style={{ marginTop: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
          <span style={{ fontSize: 11, color: 'var(--muted)' }}>Produtos</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: done ? '#22c55e' : 'var(--text)', fontFamily: 'var(--fm)' }}>{count} / {limit}</span>
        </div>
        <div style={{ height: 6, borderRadius: 4, background: 'var(--surface)', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${pct}%`, background: done ? '#22c55e' : ACCENT, transition: 'width .4s' }} />
        </div>
      </div>
 
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 12, fontSize: 11, color: ACCENT, fontWeight: 600 }}>
        <Eye size={13} /> {count > 0 ? `Ver ${count} produto${count > 1 ? 's' : ''} cadastrado${count > 1 ? 's' : ''}` : 'Nenhum produto cadastrado ainda'}
      </div>
 
      <div style={{ display: 'flex', gap: 6, marginTop: 14 }}>
        <button onClick={e => { e.stopPropagation(); onEdit(); }} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px', color: 'var(--text)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
          <Edit2 size={12} /> Editar
        </button>
        <button onClick={e => { e.stopPropagation(); onDelete(); }} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 11px', color: '#ef4444', cursor: 'pointer', display: 'flex' }}>
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  );
}
 
function PortalClientForm({ editing, clients, currentUser, onClose, onCreate, onUpdate, toast }) {
  const isEdit = !!editing;
  const [mode, setMode] = useState(editing?.crmClientId ? 'crm' : 'avulso'); // crm | avulso
  const [crmClientId, setCrmClientId] = useState(editing?.crmClientId || '');
  const [clientName, setClientName] = useState(editing?.clientName || '');
  const [username, setUsername] = useState(editing?.username || '');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [productLimit, setProductLimit] = useState(editing?.productLimit || '');
  const [platform, setPlatform] = useState(editing?.platform || '');
  const [platformOther, setPlatformOther] = useState(editing?.platformOther || '');
  const [active, setActive] = useState(editing?.active !== false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
 
  const activeClients = useMemo(() => clients.filter(c => c.active), [clients]);
 
  // ao escolher cliente do CRM, herda o nome
  const pickCrm = (id) => {
    setCrmClientId(id);
    const c = clients.find(x => x.id === id);
    if (c) setClientName(c.name);
  };
 
  const submit = async () => {
    setError(''); setBusy(true);
    const payload = {
      clientName, username,
      productLimit, platform, platformOther,
      crmClientId: mode === 'crm' ? crmClientId : null,
      createdBy: currentUser?.name || null,
    };
    let r;
    if (isEdit) {
      const patch = { clientName, productLimit: Number(productLimit), platform, platformOther: platform === 'outro' ? platformOther : '', active, crmClientId: mode === 'crm' ? crmClientId : null };
      if (password) patch.password = password;
      if (username) patch.username = username;
      r = await onUpdate(editing.id, patch);
    } else {
      r = await onCreate({ ...payload, password });
    }
    setBusy(false);
    if (r.success) { toast?.(isEdit ? 'Acesso atualizado.' : 'Acesso criado!'); onClose(); }
    else setError(r.error);
  };
 
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: 20 }}>
      <div onClick={e => e.stopPropagation()} className="fade-up" style={{ background: 'rgba(16,16,30,.99)', border: '1px solid var(--border)', borderRadius: 18, width: '100%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto', padding: 24, boxShadow: '0 24px 64px rgba(0,0,0,.7)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <h2 style={{ fontSize: 18, fontWeight: 800, color: '#fff' }}>{isEdit ? 'Editar acesso' : 'Novo acesso'}</h2>
          <button onClick={onClose} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: 7, cursor: 'pointer', display: 'flex' }}><X size={16} color="var(--muted)" /></button>
        </div>
 
        {/* Tipo: CRM ou avulso */}
        {!isEdit && (
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <button onClick={() => setMode('crm')} style={{ flex: 1, padding: '10px', borderRadius: 9, cursor: 'pointer', fontSize: 13, fontWeight: 700, background: mode === 'crm' ? `${ACCENT}1f` : 'var(--surface)', color: mode === 'crm' ? ACCENT : 'var(--muted)', border: `1px solid ${mode === 'crm' ? `${ACCENT}60` : 'var(--border)'}` }}>Cliente do CRM</button>
            <button onClick={() => setMode('avulso')} style={{ flex: 1, padding: '10px', borderRadius: 9, cursor: 'pointer', fontSize: 13, fontWeight: 700, background: mode === 'avulso' ? `${ACCENT}1f` : 'var(--surface)', color: mode === 'avulso' ? ACCENT : 'var(--muted)', border: `1px solid ${mode === 'avulso' ? `${ACCENT}60` : 'var(--border)'}` }}>Cliente avulso</button>
          </div>
        )}
 
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {mode === 'crm' && !isEdit ? (
            <FieldA label="CLIENTE DO CRM *">
              <select style={INP} value={crmClientId} onChange={e => pickCrm(e.target.value)}>
                <option value="">Selecione...</option>
                {activeClients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </FieldA>
          ) : (
            <FieldA label="NOME DO CLIENTE *"><input style={INP} value={clientName} onChange={e => setClientName(e.target.value)} placeholder="Ex: Loja da Maria" /></FieldA>
          )}
 
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <FieldA label="USUÁRIO *"><input style={INP} value={username} onChange={e => setUsername(e.target.value)} placeholder="usuario" /></FieldA>
            <FieldA label={isEdit ? 'NOVA SENHA' : 'SENHA *'}>
              <div style={{ position: 'relative' }}>
                <input style={{ ...INP, paddingRight: 40 }} type={showPass ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder={isEdit ? 'deixe em branco p/ manter' : '••••'} />
                <button onClick={() => setShowPass(!showPass)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex' }}>{showPass ? <EyeOff size={14} color="var(--muted)" /> : <Eye size={14} color="var(--muted)" />}</button>
              </div>
            </FieldA>
          </div>
 
          <FieldA label="QUANTIDADE DE PRODUTOS *"><input style={INP} type="number" min="1" value={productLimit} onChange={e => setProductLimit(e.target.value)} placeholder="Ex: 30" /></FieldA>
 
          <FieldA label="PLATAFORMA *">
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {ECOMMERCE_PLATFORMS.map(p => (
                <button key={p.id} onClick={() => setPlatform(p.id)} style={{ padding: '8px 14px', borderRadius: 9, cursor: 'pointer', fontSize: 13, fontWeight: 600, background: platform === p.id ? `${p.color}22` : 'var(--surface)', color: platform === p.id ? p.color : 'var(--muted)', border: `1px solid ${platform === p.id ? `${p.color}60` : 'var(--border)'}` }}>{p.label}</button>
              ))}
            </div>
          </FieldA>
          {platform === 'outro' && <FieldA label="QUAL PLATAFORMA? *"><input style={INP} value={platformOther} onChange={e => setPlatformOther(e.target.value)} placeholder="Ex: WooCommerce, Wix..." /></FieldA>}
 
          {isEdit && (
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
              <button onClick={() => setActive(!active)} style={{ width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer', background: active ? '#22c55e' : 'rgba(40,40,60,.9)', position: 'relative' }}>
                <span style={{ position: 'absolute', top: 2, left: active ? 22 : 2, width: 20, height: 20, borderRadius: '50%', background: '#fff', transition: 'left .2s' }} />
              </button>
              <span style={{ fontSize: 13, color: 'var(--text)' }}>Acesso ativo</span>
            </label>
          )}
        </div>
 
        {error && <p style={{ fontSize: 12, color: ACCENT, marginTop: 14 }}>{error}</p>}
        <button onClick={submit} disabled={busy} style={{ width: '100%', background: `linear-gradient(135deg,${ACCENT},#c41f4a)`, border: 'none', borderRadius: 10, padding: '13px', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', marginTop: 18, opacity: busy ? 0.7 : 1 }}>
          {busy ? 'Salvando...' : (isEdit ? 'Salvar' : 'Criar acesso')}
        </button>
      </div>
    </div>
  );
}
 
function ConfirmDelete({ pc, onClose, onConfirm }) {
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: 20 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'rgba(16,16,30,.98)', border: '1px solid var(--border)', borderRadius: 16, padding: 24, maxWidth: 380, textAlign: 'center' }}>
        <Trash2 size={28} color="#ef4444" style={{ marginBottom: 12 }} />
        <h3 style={{ fontSize: 17, fontWeight: 800, color: '#fff', marginBottom: 6 }}>Remover acesso?</h3>
        <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 20 }}>O acesso de "{pc.clientName}" será removido. Os produtos cadastrados não são apagados automaticamente.</p>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onConfirm} style={{ flex: 1, background: 'linear-gradient(135deg,#ef4444,#dc2626)', border: 'none', borderRadius: 10, padding: '11px', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Remover</button>
          <button onClick={onClose} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '11px 18px', color: 'var(--muted)', fontSize: 13, cursor: 'pointer' }}>Cancelar</button>
        </div>
      </div>
    </div>
  );
}
 
/* ─────────── Visualizador de produtos cadastrados pelo cliente ─────────── */
function ProductViewerModal({ pc, onClose, toast }) {
  const { products, loading } = usePortalProducts(pc.id);
  const [selected, setSelected] = useState(null);
 
  const platform = ECOMMERCE_PLATFORMS.find(p => p.id === pc.platform);
  const platformLabel = pc.platform === 'outro' ? (pc.platformOther || 'Outro') : (platform?.label || '—');
 
  const csvEscape = (v) => {
    const s = (v === null || v === undefined) ? '' : String(v);
    return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
 
  const downloadCsv = () => {
    if (!products.length) { toast?.('Nenhum produto para exportar.'); return; }
    const headers = ['Nome', 'Preço (R$)', 'Estoque', 'Categoria', 'Descrição', 'Tem variantes', 'Tipo variante', 'Opções variante', 'Peso (kg)', 'Comprimento (cm)', 'Largura (cm)', 'Altura (cm)', 'Qtd fotos', 'URLs das fotos'];
    const rows = products.map(p => [
      p.name, p.price, p.stock, p.category, p.description,
      p.hasVariants ? 'Sim' : 'Não', p.variantType, p.variantDescription,
      p.weightKg, p.lengthCm, p.widthCm, p.heightCm,
      (p.images || []).length,
      (p.images || []).map(i => i.url).join(' | '),
    ].map(csvEscape).join(';'));
    const csv = '\uFEFF' + [headers.join(';'), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `produtos_${(pc.clientName || 'cliente').replace(/[^a-zA-Z0-9]/g, '_')}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
    toast?.('CSV baixado!');
  };
 
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: 20 }}>
      <div onClick={e => e.stopPropagation()} className="fade-up" style={{ background: 'rgba(16,16,30,.99)', border: '1px solid var(--border)', borderRadius: 18, width: '100%', maxWidth: 720, maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 64px rgba(0,0,0,.7)' }}>
        {/* header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, padding: 22, borderBottom: '1px solid var(--border)' }}>
          <div>
            <h2 style={{ fontSize: 19, fontWeight: 800, color: '#fff', marginBottom: 3 }}>{pc.clientName}</h2>
            <p style={{ fontSize: 12, color: 'var(--muted)', fontFamily: 'var(--fm)' }}>@{pc.username} · {platformLabel} · {products.length} produto{products.length !== 1 ? 's' : ''}</p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={downloadCsv} style={{ display: 'flex', alignItems: 'center', gap: 6, background: `linear-gradient(135deg,${ACCENT},#c41f4a)`, border: 'none', borderRadius: 9, padding: '9px 14px', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
              <Download size={14} /> Baixar CSV
            </button>
            <button onClick={onClose} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: 9, cursor: 'pointer', display: 'flex' }}><X size={16} color="var(--muted)" /></button>
          </div>
        </div>
 
        {/* body */}
        <div style={{ overflowY: 'auto', padding: 22 }}>
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><div className="spinner" style={{ width: 30, height: 30 }} /></div>
          ) : products.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', border: '1px dashed var(--border)', borderRadius: 14 }}>
              <Package size={34} color="var(--muted)" style={{ marginBottom: 10 }} />
              <p style={{ fontSize: 14, color: 'var(--text)', fontWeight: 600 }}>Este cliente ainda não cadastrou produtos.</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: 12 }}>
              {products.map(p => {
                const cover = (p.images || [])[0];
                return (
                  <div key={p.id} onClick={() => setSelected(p)} style={{ background: 'rgba(12,12,24,.7)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', cursor: 'pointer', transition: 'border-color .2s' }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = `${ACCENT}66`}
                    onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}>
                    <div style={{ height: 130, background: '#0c0c18', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                      {cover ? <img src={cover.url} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <ImageIcon size={28} color="var(--muted)" />}
                      {(p.images || []).length > 1 && <span style={{ position: 'absolute', bottom: 6, right: 6, fontSize: 10, fontWeight: 700, background: 'rgba(0,0,0,.7)', color: '#fff', padding: '2px 7px', borderRadius: 6, fontFamily: 'var(--fm)' }}>{(p.images || []).length} fotos</span>}
                    </div>
                    <div style={{ padding: 11 }}>
                      <p style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name || 'Sem nome'}</p>
                      <p style={{ fontSize: 13, fontWeight: 700, color: ACCENT, fontFamily: 'var(--fm)' }}>{p.price ? `R$ ${p.price}` : '—'}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
 
      {selected && ReactDOM.createPortal(
        <ProductDetailModal product={selected} onClose={() => setSelected(null)} toast={toast} />, document.body)}
    </div>
  );
}
 
function ProductDetailModal({ product, onClose, toast }) {
  const imgs = product.images || [];
  const [idx, setIdx] = useState(0);
  const cur = imgs[idx];
 
  const downloadImage = async (img, i) => {
    try {
      const res = await fetch(img.url);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const ext = (blob.type.split('/')[1] || 'jpg').split('+')[0];
      a.href = url;
      a.download = `${(product.name || 'produto').replace(/[^a-zA-Z0-9]/g, '_')}_${i + 1}.${ext}`;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    } catch {
      window.open(img.url, '_blank');
      toast?.('Abrindo imagem em nova aba (download direto bloqueado).');
    }
  };
 
  const Row = ({ label, value }) => value ? (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '9px 0', borderBottom: '1px solid var(--border)' }}>
      <span style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'var(--fm)', letterSpacing: '.05em', whiteSpace: 'nowrap' }}>{label}</span>
      <span style={{ fontSize: 13, color: 'var(--text)', textAlign: 'right', wordBreak: 'break-word' }}>{value}</span>
    </div>
  ) : null;
 
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200, padding: 20 }}>
      <div onClick={e => e.stopPropagation()} className="fade-up" style={{ background: 'rgba(16,16,30,.99)', border: '1px solid var(--border)', borderRadius: 18, width: '100%', maxWidth: 560, maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 64px rgba(0,0,0,.7)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottom: '1px solid var(--border)' }}>
          <h2 style={{ fontSize: 17, fontWeight: 800, color: '#fff' }}>{product.name || 'Produto'}</h2>
          <button onClick={onClose} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: 8, cursor: 'pointer', display: 'flex' }}><X size={16} color="var(--muted)" /></button>
        </div>
 
        <div style={{ overflowY: 'auto', padding: 20 }}>
          {imgs.length > 0 && (
            <div style={{ marginBottom: 18 }}>
              <div style={{ position: 'relative', height: 260, background: '#0c0c18', borderRadius: 12, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <img src={cur.url} alt={product.name} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                {imgs.length > 1 && (
                  <>
                    <button onClick={() => setIdx((idx - 1 + imgs.length) % imgs.length)} style={navBtn('left')}><ChevronLeft size={18} color="#fff" /></button>
                    <button onClick={() => setIdx((idx + 1) % imgs.length)} style={navBtn('right')}><ChevronRight size={18} color="#fff" /></button>
                    <span style={{ position: 'absolute', bottom: 8, left: '50%', transform: 'translateX(-50%)', fontSize: 11, fontWeight: 700, background: 'rgba(0,0,0,.7)', color: '#fff', padding: '3px 9px', borderRadius: 8, fontFamily: 'var(--fm)' }}>{idx + 1} / {imgs.length}</span>
                  </>
                )}
                <button onClick={() => downloadImage(cur, idx)} style={{ position: 'absolute', top: 8, right: 8, display: 'flex', alignItems: 'center', gap: 5, background: 'rgba(0,0,0,.7)', border: 'none', borderRadius: 8, padding: '6px 10px', color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                  <Download size={12} /> Baixar
                </button>
              </div>
              {imgs.length > 1 && (
                <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                  {imgs.map((im, i) => (
                    <div key={i} onClick={() => setIdx(i)} style={{ width: 48, height: 48, borderRadius: 8, overflow: 'hidden', cursor: 'pointer', border: `2px solid ${i === idx ? ACCENT : 'transparent'}` }}>
                      <img src={im.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
 
          <Row label="PREÇO" value={product.price ? `R$ ${product.price}` : ''} />
          <Row label="ESTOQUE" value={product.stock} />
          <Row label="CATEGORIA" value={product.category} />
          <Row label="DESCRIÇÃO" value={product.description} />
          {product.hasVariants && <Row label="TIPO VARIANTE" value={product.variantType} />}
          {product.hasVariants && <Row label="OPÇÕES" value={product.variantDescription} />}
          <Row label="PESO" value={product.weightKg ? `${product.weightKg} kg` : ''} />
          <Row label="DIMENSÕES" value={(product.lengthCm || product.widthCm || product.heightCm) ? `${product.lengthCm || '?'} × ${product.widthCm || '?'} × ${product.heightCm || '?'} cm` : ''} />
 
          {imgs.length > 0 && (
            <button onClick={() => imgs.forEach((im, i) => downloadImage(im, i))} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '11px', color: 'var(--text)', fontSize: 13, fontWeight: 700, cursor: 'pointer', marginTop: 18 }}>
              <Download size={14} /> Baixar todas as {imgs.length} fotos
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
 
const navBtn = (side) => ({ position: 'absolute', top: '50%', [side]: 8, transform: 'translateY(-50%)', background: 'rgba(0,0,0,.6)', border: 'none', borderRadius: '50%', width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' });
 
function FieldA({ label, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={{ fontSize: 10, letterSpacing: '.12em', color: 'var(--muted)', fontWeight: 600, fontFamily: 'var(--fm)' }}>{label}</label>
      {children}
    </div>
  );
}
 
const INP = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 9, padding: '11px 13px', color: 'var(--text)', fontSize: 14, outline: 'none', width: '100%', fontFamily: 'var(--f)' };
