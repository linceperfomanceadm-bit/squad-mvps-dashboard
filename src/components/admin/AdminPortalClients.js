import React, { useState, useMemo } from 'react';
import ReactDOM from 'react-dom';
import { Package, Plus, X, Copy, Edit2, Trash2, ExternalLink, Eye, EyeOff } from 'lucide-react';
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
            <PortalClientCard key={pc.id} pc={pc} onEdit={() => { setEditing(pc); setShowForm(true); }} onDelete={() => setConfirmDel(pc)} />
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
    </div>
  );
}

function PortalClientCard({ pc, onEdit, onDelete }) {
  const { products } = usePortalProducts(pc.id);
  const platform = ECOMMERCE_PLATFORMS.find(p => p.id === pc.platform);
  const platformLabel = pc.platform === 'outro' ? (pc.platformOther || 'Outro') : (platform?.label || '—');
  const count = products.length;
  const limit = pc.productLimit || 0;
  const pct = limit > 0 ? Math.min(100, Math.round((count / limit) * 100)) : 0;
  const st = PORTAL_STATUS[pc.status] || PORTAL_STATUS.collecting;
  const done = count >= limit && limit > 0;

  return (
    <div style={{ background: 'rgba(12,12,24,.88)', border: '1px solid var(--border)', borderRadius: 14, padding: 16 }}>
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

      <div style={{ display: 'flex', gap: 6, marginTop: 14 }}>
        <button onClick={onEdit} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px', color: 'var(--text)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
          <Edit2 size={12} /> Editar
        </button>
        <button onClick={onDelete} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 11px', color: '#ef4444', cursor: 'pointer', display: 'flex' }}>
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

function FieldA({ label, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={{ fontSize: 10, letterSpacing: '.12em', color: 'var(--muted)', fontWeight: 600, fontFamily: 'var(--fm)' }}>{label}</label>
      {children}
    </div>
  );
}

const INP = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 9, padding: '11px 13px', color: 'var(--text)', fontSize: 14, outline: 'none', width: '100%', fontFamily: 'var(--f)' };
