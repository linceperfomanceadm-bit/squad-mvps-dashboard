import React, { useState } from 'react';
import ReactDOM from 'react-dom';
import { Copy, ExternalLink, ChevronDown, ChevronUp, Edit2, Check, Upload, Trash2, FileText, Image as ImageIcon, Video, Download, Plus, X, History } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';

// Responsável pode estar salvo como string (legado) ou array (multi).
const asArray = (v) => (Array.isArray(v) ? v : (v ? [v] : []));

function ColorSwatch({ hex }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(hex);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, cursor: 'pointer' }} onClick={handleCopy}>
      <div style={{ width: 24, height: 24, borderRadius: 6, background: hex, border: '1px solid rgba(255,255,255,.1)', flexShrink: 0 }} />
      <span style={{ fontSize: 12, color: 'var(--text)', fontFamily: 'var(--fm)' }}>{hex}</span>
      {copied
        ? <Check size={12} color="var(--green)" style={{ marginLeft: 'auto' }} />
        : <Copy  size={12} color="var(--muted)" style={{ marginLeft: 'auto' }} />}
    </div>
  );
}

function fmtDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function fmtDateTime(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
}

// Cartão de um material da biblioteca.
function MaterialItem({ material, canDelete, onDelete }) {
  const isImg = material.fileType?.startsWith('image/');
  const isPdf = material.fileType === 'application/pdf';
  const isVideo = material.type === 'video';
  const Icon = isVideo ? Video : isPdf ? FileText : ImageIcon;

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <div style={{ height: 110, background: 'rgba(0,0,0,.25)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {isImg
          ? <img src={material.url} alt={material.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : <Icon size={32} color="var(--muted)" />}
      </div>
      <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={material.name}>{material.name}</p>
        <p style={{ fontSize: 10, color: 'var(--muted)', fontFamily: 'var(--fm)' }}>
          {material.addedBy}{material.addedAt ? ` · ${fmtDate(material.addedAt)}` : ''}
        </p>
        <div style={{ display: 'flex', gap: 6, marginTop: 'auto' }}>
          {isVideo ? (
            <a href={material.url} target="_blank" rel="noreferrer" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, background: 'rgba(56,189,248,.1)', border: '1px solid rgba(56,189,248,.3)', borderRadius: 7, padding: '6px', color: 'var(--blue)', fontSize: 12, fontWeight: 600, textDecoration: 'none' }}>
              <ExternalLink size={12} /> Abrir vídeo
            </a>
          ) : (
            <a href={material.url} target="_blank" rel="noreferrer" download={material.name} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, background: 'var(--neon-dim)', border: '1px solid var(--neon-border)', borderRadius: 7, padding: '6px', color: 'var(--neon)', fontSize: 12, fontWeight: 600, textDecoration: 'none' }}>
              <Download size={12} /> Baixar
            </a>
          )}
          {canDelete && (
            <button onClick={() => onDelete(material)} title="Excluir" style={{ background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.3)', borderRadius: 7, padding: '6px 9px', color: '#ef4444', cursor: 'pointer', display: 'flex' }}>
              <Trash2 size={12} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// Modal para adicionar material (arquivos OU link de vídeo).
//
// Vive num portal no document.body de propósito: o Brand Hub roda dentro
// de containers com `animation: ... both`, e um ancestral com transform
// aplicado vira o bloco de contenção de qualquer position:fixed filho.
// Era isso que jogava o modal para longe da viewport e obrigava a
// rolar a página inteira para achá-lo.
function AddMaterialModal({ onClose, onAdd }) {
  const [tab, setTab] = useState('file');
  const [name, setName] = useState('');
  const [files, setFiles] = useState([]);
  const [videoUrl, setVideoUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    setError('');
    if (tab === 'file' && files.length === 0) { setError('Selecione ao menos um arquivo.'); return; }
    if (tab === 'video' && !videoUrl.trim()) { setError('Cole o link do vídeo.'); return; }
    setBusy(true);
    const r = await onAdd(
      tab === 'video'
        ? { type: 'video', name: name.trim() || 'Vídeo', videoUrl }
        : { type: 'file', files }
    );
    setBusy(false);
    if (r.success) onClose();
    else setError(r.error || 'Erro ao adicionar.');
  };

  const content = (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99997, padding: 20, overflowY: 'auto' }}>
      <div onClick={e => e.stopPropagation()} className="fade-up" style={{ background: 'rgba(16,16,30,.99)', border: '1px solid var(--border)', borderRadius: 16, width: '100%', maxWidth: 440, padding: 22, boxShadow: '0 24px 64px rgba(0,0,0,.7)', flexShrink: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ fontSize: 17, fontWeight: 800, color: '#fff' }}>Adicionar material</h3>
          <button onClick={onClose} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: 6, cursor: 'pointer', display: 'flex' }}><X size={15} color="var(--muted)" /></button>
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <button onClick={() => setTab('file')} style={{ flex: 1, padding: '9px', borderRadius: 9, cursor: 'pointer', fontSize: 13, fontWeight: 700, background: tab === 'file' ? 'var(--neon-dim)' : 'var(--surface)', color: tab === 'file' ? 'var(--neon)' : 'var(--muted)', border: `1px solid ${tab === 'file' ? 'var(--neon-border)' : 'var(--border)'}` }}>Arquivos</button>
          <button onClick={() => setTab('video')} style={{ flex: 1, padding: '9px', borderRadius: 9, cursor: 'pointer', fontSize: 13, fontWeight: 700, background: tab === 'video' ? 'var(--neon-dim)' : 'var(--surface)', color: tab === 'video' ? 'var(--neon)' : 'var(--muted)', border: `1px solid ${tab === 'video' ? 'var(--neon-border)' : 'var(--border)'}` }}>Vídeo (link)</button>
        </div>

        {tab === 'file' ? (
          <>
            <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '24px', border: '1px dashed var(--border)', borderRadius: 12, cursor: 'pointer' }}>
              <Upload size={24} color="var(--neon)" />
              <span style={{ fontSize: 13, color: 'var(--text)', fontWeight: 600, textAlign: 'center' }}>
                {files.length === 0
                  ? 'Clique para escolher (pode selecionar vários)'
                  : `${files.length} arquivo${files.length > 1 ? 's' : ''} selecionado${files.length > 1 ? 's' : ''}`}
              </span>
              <span style={{ fontSize: 11, color: 'var(--muted)', textAlign: 'center' }}>JPG, PNG, WEBP, ICO ou PDF (máx. 25MB cada)</span>
              <input
                type="file"
                multiple
                accept="image/jpeg,image/png,image/webp,image/x-icon,.ico,application/pdf"
                onChange={e => setFiles(Array.from(e.target.files || []))}
                style={{ display: 'none' }}
              />
            </label>

            {files.length > 0 && (
              <div style={{ marginTop: 10, maxHeight: 140, overflowY: 'auto' }}>
                {files.map((f, i) => (
                  <div key={`${f.name}_${i}`} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 7, marginBottom: 5 }}>
                    <FileText size={12} color="var(--muted)" style={{ flexShrink: 0 }} />
                    <span style={{ fontSize: 12, color: 'var(--text)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
                    <button
                      onClick={() => setFiles(list => list.filter((_, idx) => idx !== i))}
                      style={{ background: 'none', border: 'none', color: 'var(--neon)', cursor: 'pointer', padding: 0, display: 'flex', flexShrink: 0 }}
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 10, lineHeight: 1.5 }}>
              Cada arquivo entra com o próprio nome de origem.
            </p>
          </>
        ) : (
          <>
            <label style={S.label}>NOME (opcional)</label>
            <input style={{ ...S.input, marginTop: 6, marginBottom: 14 }} value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Vídeo institucional" />
            <label style={S.label}>LINK DO VÍDEO</label>
            <input style={{ ...S.input, marginTop: 6 }} value={videoUrl} onChange={e => setVideoUrl(e.target.value)} placeholder="https://youtube.com/... ou Drive" />
          </>
        )}

        {error && <p style={{ fontSize: 12, color: 'var(--neon)', marginTop: 12 }}>{error}</p>}
        <button onClick={submit} disabled={busy} style={{ ...S.saveBtn, width: '100%', marginTop: 18, opacity: busy ? 0.7 : 1 }}>
          {busy ? 'Enviando...' : 'Adicionar'}
        </button>
      </div>
    </div>
  );

  return ReactDOM.createPortal(content, document.body);
}

const LOG_LABEL = { add: 'ADICIONOU', remove: 'EXCLUIU', brandbook: 'EDITOU' };
const LOG_TAG = {
  add:       { background: 'var(--green-dim)', color: 'var(--green)', border: '1px solid var(--green-b)' },
  remove:    { background: 'rgba(239,68,68,.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,.3)' },
  brandbook: { background: 'var(--neon-dim)', color: 'var(--neon)', border: '1px solid var(--neon-border)' },
};

// ─── Card de um cliente ────────────────────────────────────────
function ClientVaultCard({ client, canEditBrandbook, canAddMaterial, currentUser, currentSector, isAdmin, onUpdate, onAddMaterial, onRemoveMaterial }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [showLog, setShowLog] = useState(false);

  const bb = client.brandbook || {};
  const materials = bb.materials || [];
  const log = [...(bb.log || [])].sort((a, b) => new Date(b.at) - new Date(a.at));
  const hasData = (bb.colors?.length > 0) || bb.typography;

  const [form, setForm] = useState({
    colors: (bb.colors || []).join(', '),
    typography: bb.typography || '',
  });

  const handleSave = () => {
    const colors = form.colors.split(',').map(c => c.trim()).filter(Boolean);
    onUpdate(client.id, { colors, typography: form.typography.trim() }, currentUser, currentSector);
    setEditing(false);
  };

  return (
    <div style={{ background: 'rgba(12,12,24,.88)', border: '1px solid var(--border)', borderRadius: 14, marginBottom: 10, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', cursor: 'pointer' }} onClick={() => setOpen(!open)}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--neon-dim)', border: '1px solid var(--neon-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 700, color: 'var(--neon)' }}>
            {client.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{client.name}</p>
            <p style={{ fontSize: 11, color: 'var(--muted)' }}>{materials.length > 0 ? `${materials.length} material(is)` : (hasData ? 'Brand disponível' : 'Sem dados ainda')}</p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {canEditBrandbook && (
            <button style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, padding: '5px 7px', color: 'var(--muted)', display: 'flex', alignItems: 'center', cursor: 'pointer' }} onClick={e => { e.stopPropagation(); setEditing(!editing); setOpen(true); }} title="Editar paleta/tipografia">
              <Edit2 size={13} />
            </button>
          )}
          {open ? <ChevronUp size={16} color="var(--muted)" /> : <ChevronDown size={16} color="var(--muted)" />}
        </div>
      </div>

      {open && (
        <div style={{ padding: '0 16px 16px', borderTop: '1px solid var(--border)' }} className="fade-in">
          {editing && canEditBrandbook ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 14 }}>
              <div>
                <label style={S.label}>CORES (HEX separados por vírgula)</label>
                <input style={S.input} value={form.colors} onChange={e => setForm(f => ({ ...f, colors: e.target.value }))} placeholder="#EE3363, #0f0f18, #ffffff" />
              </div>
              <div>
                <label style={S.label}>TIPOGRAFIA</label>
                <input style={S.input} value={form.typography} onChange={e => setForm(f => ({ ...f, typography: e.target.value }))} placeholder="Ex: Outfit Bold + JetBrains Mono" />
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button style={S.cancelBtn} onClick={() => setEditing(false)}>Cancelar</button>
                <button style={S.saveBtn} onClick={handleSave}>Salvar</button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18, marginTop: 14 }}>
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

              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <p style={S.label}>MATERIAIS</p>
                  {canAddMaterial && (
                    <button onClick={() => setShowAdd(true)} style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'var(--neon-dim)', border: '1px solid var(--neon-border)', borderRadius: 8, padding: '6px 12px', color: 'var(--neon)', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                      <Plus size={13} /> Adicionar
                    </button>
                  )}
                </div>
                {materials.length === 0 ? (
                  <p style={{ fontSize: 13, color: 'var(--muted)', padding: '8px 0' }}>Nenhum material ainda.</p>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))', gap: 10 }}>
                    {materials.map(m => (
                      <MaterialItem
                        key={m.id}
                        material={m}
                        canDelete={isAdmin || m.addedBy === currentUser}
                        onDelete={(mat) => onRemoveMaterial(client.id, mat, currentUser, currentSector)}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Histórico — quem mexeu no quê */}
              {log.length > 0 && (
                <div>
                  <button
                    onClick={() => setShowLog(v => !v)}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'transparent', border: 'none', padding: 0, color: 'var(--muted)', fontSize: 10, fontFamily: 'var(--fm)', letterSpacing: '.14em', fontWeight: 600, cursor: 'pointer' }}
                  >
                    <History size={12} />
                    HISTÓRICO ({log.length})
                    {showLog ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                  </button>
                  {showLog && (
                    <div style={{ marginTop: 10, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 9, padding: '4px 12px', maxHeight: 220, overflowY: 'auto' }}>
                      {log.slice(0, 40).map(l => (
                        <div key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                          <span style={{ fontSize: 9, fontWeight: 700, fontFamily: 'var(--fm)', padding: '2px 7px', borderRadius: 10, flexShrink: 0, ...(LOG_TAG[l.action] || {}) }}>
                            {LOG_LABEL[l.action] || l.action}
                          </span>
                          <span style={{ fontSize: 12, color: 'var(--text)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.name}</span>
                          <span style={{ fontSize: 10, color: 'var(--muted)', fontFamily: 'var(--fm)', flexShrink: 0, textAlign: 'right' }}>
                            {l.by} · {fmtDateTime(l.at)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {showAdd && (
        <AddMaterialModal
          onClose={() => setShowAdd(false)}
          onAdd={(data) => onAddMaterial(client.id, data)}
        />
      )}
    </div>
  );
}

export default function VaultPage({ clients, sectorId, onUpdateBrandbook, onAddMaterial, onRemoveMaterial, isAdminView = false }) {
  const { user } = useAuth();
  const [search, setSearch] = useState('');

  const isAdmin = isAdminView || user?.isAdmin;
  const logSector = isAdminView ? 'admin' : (sectorId || '');

  // Permissão de editar paleta/tipografia é POR CLIENTE: ser responsável
  // por um cliente não dá direito de mexer no brand de todos os outros.
  const canEditOf = (c) => isAdmin || (!!sectorId && asArray(c.responsibles?.[sectorId]).includes(user?.name));

  // `c.active !== false` em vez de `c.active`: cliente antigo, cadastrado
  // antes do campo existir, continua aparecendo.
  const activeClients = clients.filter(
    c => c.active !== false && c.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="fade-up">
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, color: '#fff', letterSpacing: '-.5px', marginBottom: 4 }}>
          ✨ Brand Hub
        </h1>
        <p style={{ fontSize: 13, color: 'var(--muted)' }}>
          Biblioteca de materiais dos clientes — paletas, tipografias e arquivos
          {isAdminView && <span style={{ color: 'var(--neon)', marginLeft: 8 }}>· Modo Admin</span>}
        </p>
      </div>

      <input
        style={{ ...S.input, marginBottom: 16, width: '100%', maxWidth: 380 }}
        placeholder="Buscar cliente..."
        value={search}
        onChange={e => setSearch(e.target.value)}
      />

      {activeClients.length === 0 ? (
        <p style={{ fontSize: 13, color: 'var(--muted)', textAlign: 'center', padding: '40px 0' }}>
          Nenhum cliente encontrado.
        </p>
      ) : (
        activeClients.map(c => (
          <ClientVaultCard
            key={c.id}
            client={c}
            canEditBrandbook={canEditOf(c)}
            canAddMaterial={true}
            currentUser={user?.name}
            currentSector={logSector}
            isAdmin={isAdmin}
            onUpdate={onUpdateBrandbook}
            onAddMaterial={onAddMaterial}
            onRemoveMaterial={onRemoveMaterial}
          />
        ))
      )}
    </div>
  );
}

const S = {
  label: { fontSize: 10, letterSpacing: '.14em', color: 'var(--muted)', fontWeight: 600, fontFamily: 'var(--fm)', display: 'block', marginBottom: 6 },
  input: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 9, padding: '10px 13px', color: 'var(--text)', fontSize: 13, outline: 'none', fontFamily: 'var(--f)', width: '100%' },
  cancelBtn: { background: 'transparent', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 16px', color: 'var(--muted)', fontSize: 13, cursor: 'pointer', fontFamily: 'var(--f)' },
  saveBtn: { background: 'linear-gradient(135deg,var(--neon),#c41f4a)', border: 'none', borderRadius: 8, padding: '8px 18px', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 14px rgba(238,51,99,.3)' },
};
