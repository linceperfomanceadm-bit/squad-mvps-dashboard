import React, { useState } from 'react';
import { X, Info, Layers, Truck, Image as ImageIcon, Upload, Trash2, Check } from 'lucide-react';
import { PRODUCT_CATEGORIES } from '../../lib/firebase';

const ACCENT = '#EE3363';

/*
 * Modal de cadastro/edição de produto, em abas:
 *   Informações · Variantes · Frete · Fotos
 *
 * Fluxo de fotos: na edição, sobe direto. Na criação, o produto é
 * salvo primeiro (para ter id) e depois as fotos são anexadas — por
 * isso o "Salvar" cria o produto e, se houver fotos pendentes, faz o
 * upload em seguida.
 */
const TABS = [
  { id: 'info', label: 'Informações', icon: Info },
  { id: 'variants', label: 'Variantes', icon: Layers },
  { id: 'shipping', label: 'Frete', icon: Truck },
  { id: 'photos', label: 'Fotos', icon: ImageIcon },
];

export default function ProductFormModal({ product, onClose, onSave, uploadImage, removeImage }) {
  const isEdit = !!product;
  const [tab, setTab] = useState('info');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    name: product?.name || '',
    price: product?.price || '',
    description: product?.description || '',
    category: product?.category || '',
    stock: product?.stock || '',
    hasVariants: product?.hasVariants || false,
    variantType: product?.variantType || '',
    variantDescription: product?.variantDescription || '',
    weightKg: product?.weightKg || '',
    lengthCm: product?.lengthCm || '',
    widthCm: product?.widthCm || '',
    heightCm: product?.heightCm || '',
  });
  const [images, setImages] = useState(product?.images || []);
  const [uploading, setUploading] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  // Fotos: na edição sobem direto (já há id). Na criação, o upload é
  // feito depois — por ora o cliente salva e reabre em "Editar" para
  // anexar (sinalizado na UI). Aqui mostramos só o preview local.

  const handleFiles = async (fileList) => {
    const files = Array.from(fileList);
    if (isEdit) {
      setUploading(true);
      for (const file of files) {
        const r = await uploadImage(product.id, file);
        if (r.success) {
          const next = [...images, r.image];
          setImages(next);
          await onSave({ images: next }, product.id);
        }
      }
      setUploading(false);
    } else {
      // ainda não há id — mostra só preview local (upload na edição)
      files.forEach(file => {
        const url = URL.createObjectURL(file);
        setImages(prev => [...prev, { url, _local: true }]);
      });
    }
  };

  const removeImg = async (idx) => {
    const img = images[idx];
    if (isEdit && img.path) {
      await removeImage(img);
      const next = images.filter((_, i) => i !== idx);
      setImages(next);
      await onSave({ images: next }, product.id);
    } else {
      setImages(prev => prev.filter((_, i) => i !== idx));
    }
  };

  const handleSave = async () => {
    if (!form.name.trim()) { setError('Informe o nome do produto.'); setTab('info'); return; }
    setBusy(true); setError('');

    if (isEdit) {
      const r = await onSave({ ...form, images }, product.id);
      setBusy(false);
      if (r.success) onClose();
      else setError(r.error || 'Erro ao salvar.');
      return;
    }

    // criação: salva primeiro (sem as fotos locais), pega o id, sobe fotos
    const cleanImages = images.filter(i => !i._local);
    const r = await onSave({ ...form, images: cleanImages });
    if (!r.success) { setBusy(false); setError(r.error || 'Erro ao criar.'); return; }

    // Observação MVP: o onSave de criação não retorna o id aqui, então
    // as fotos pendentes da criação são subidas na próxima edição. Para
    // simplificar o MVP, instruímos o cliente a salvar e reabrir para
    // adicionar fotos — ou subir fotos já na edição. Mantemos o produto
    // criado e fechamos.
    setBusy(false);
    onClose();
  };

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.65)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: 20 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'rgba(16,16,30,.99)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 18, width: '100%', maxWidth: 560, maxHeight: '90vh', display: 'flex', flexDirection: 'column', fontFamily: "'Outfit',sans-serif", boxShadow: '0 24px 64px rgba(0,0,0,.7)' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 22px', borderBottom: '1px solid rgba(255,255,255,.08)' }}>
          <h2 style={{ fontSize: 18, fontWeight: 800, color: '#fff' }}>{isEdit ? 'Editar produto' : 'Novo produto'}</h2>
          <button onClick={onClose} style={{ background: 'rgba(20,20,38,.9)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 8, padding: 7, cursor: 'pointer', display: 'flex' }}><X size={16} color="#8b8b9e" /></button>
        </div>

        {/* Abas */}
        <div style={{ display: 'flex', gap: 4, padding: '12px 22px 0', borderBottom: '1px solid rgba(255,255,255,.08)' }}>
          {TABS.map(t => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button key={t.id} onClick={() => setTab(t.id)} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', borderBottom: `2px solid ${active ? ACCENT : 'transparent'}`, padding: '8px 12px', color: active ? '#fff' : '#8b8b9e', fontSize: 13, fontWeight: active ? 700 : 500, cursor: 'pointer' }}>
                <Icon size={14} /> {t.label}
              </button>
            );
          })}
        </div>

        {/* Conteúdo */}
        <div style={{ padding: 22, overflowY: 'auto', flex: 1 }}>
          {tab === 'info' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <Field label="NOME DO PRODUTO *"><input style={INP} value={form.name} onChange={e => set('name', e.target.value)} placeholder="Ex: Camiseta Básica" /></Field>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Field label="PREÇO (R$)"><input style={INP} value={form.price} onChange={e => set('price', e.target.value)} placeholder="99,90" /></Field>
                <Field label="ESTOQUE"><input style={INP} value={form.stock} onChange={e => set('stock', e.target.value)} placeholder="Qtd." /></Field>
              </div>
              <Field label="CATEGORIA">
                <select style={INP} value={form.category} onChange={e => set('category', e.target.value)}>
                  <option value="">Selecione...</option>
                  {PRODUCT_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </Field>
              <Field label="DESCRIÇÃO"><textarea style={{ ...INP, resize: 'vertical', minHeight: 80 }} rows={4} value={form.description} onChange={e => set('description', e.target.value)} placeholder="Descreva o produto: material, uso, diferenciais..." /></Field>
            </div>
          )}

          {tab === 'variants' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                <button onClick={() => set('hasVariants', !form.hasVariants)} style={{ width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer', background: form.hasVariants ? ACCENT : 'rgba(40,40,60,.9)', position: 'relative', transition: 'background .2s' }}>
                  <span style={{ position: 'absolute', top: 2, left: form.hasVariants ? 22 : 2, width: 20, height: 20, borderRadius: '50%', background: '#fff', transition: 'left .2s' }} />
                </button>
                <span style={{ fontSize: 14, color: '#fff', fontWeight: 600 }}>Este produto tem variantes</span>
              </label>
              <p style={{ fontSize: 12, color: '#8b8b9e', lineHeight: 1.5 }}>Variantes são versões do mesmo produto: tamanhos (P, M, G), cores, sabores, etc.</p>
              {form.hasVariants && (
                <>
                  <Field label="TIPO DE VARIANTE"><input style={INP} value={form.variantType} onChange={e => set('variantType', e.target.value)} placeholder="Ex: Tamanho, Cor, Sabor" /></Field>
                  <Field label="OPÇÕES / DESCRIÇÃO"><textarea style={{ ...INP, resize: 'vertical', minHeight: 70 }} rows={3} value={form.variantDescription} onChange={e => set('variantDescription', e.target.value)} placeholder="Ex: P, M, G, GG — ou: Azul, Vermelho, Preto" /></Field>
                </>
              )}
            </div>
          )}

          {tab === 'shipping' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <p style={{ fontSize: 12, color: '#8b8b9e', lineHeight: 1.5 }}>Medidas e peso da embalagem — usados para calcular o frete na loja.</p>
              <Field label="PESO (KG)"><input style={INP} value={form.weightKg} onChange={e => set('weightKg', e.target.value)} placeholder="Ex: 0.3" /></Field>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                <Field label="COMPRIM. (CM)"><input style={INP} value={form.lengthCm} onChange={e => set('lengthCm', e.target.value)} placeholder="20" /></Field>
                <Field label="LARGURA (CM)"><input style={INP} value={form.widthCm} onChange={e => set('widthCm', e.target.value)} placeholder="15" /></Field>
                <Field label="ALTURA (CM)"><input style={INP} value={form.heightCm} onChange={e => set('heightCm', e.target.value)} placeholder="5" /></Field>
              </div>
            </div>
          )}

          {tab === 'photos' && (
            <div>
              {!isEdit && (
                <div style={{ background: '#f59e0b14', border: '1px solid #f59e0b40', borderRadius: 10, padding: 12, marginBottom: 14, fontSize: 12, color: '#fbbf24', lineHeight: 1.5 }}>
                  Dica: salve o produto primeiro e reabra em "Editar" para anexar as fotos. (No MVP, o upload de fotos acontece na edição.)
                </div>
              )}
              <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '28px', border: '1px dashed rgba(255,255,255,.15)', borderRadius: 12, cursor: isEdit ? 'pointer' : 'not-allowed', opacity: isEdit ? 1 : 0.5 }}>
                <Upload size={26} color={ACCENT} />
                <span style={{ fontSize: 13, color: '#fff', fontWeight: 600 }}>{uploading ? 'Enviando...' : 'Clique para enviar fotos'}</span>
                <span style={{ fontSize: 11, color: '#8b8b9e' }}>JPG, PNG (várias de uma vez)</span>
                <input type="file" accept="image/*" multiple disabled={!isEdit || uploading} onChange={e => e.target.files && handleFiles(e.target.files)} style={{ display: 'none' }} />
              </label>

              {images.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(90px,1fr))', gap: 8, marginTop: 14 }}>
                  {images.map((img, i) => (
                    <div key={i} style={{ position: 'relative', aspectRatio: '1', borderRadius: 8, overflow: 'hidden', border: '1px solid rgba(255,255,255,.1)' }}>
                      <img src={img.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      <button onClick={() => removeImg(i)} style={{ position: 'absolute', top: 4, right: 4, background: 'rgba(0,0,0,.7)', border: 'none', borderRadius: 6, padding: 4, cursor: 'pointer', display: 'flex' }}><Trash2 size={12} color="#ef4444" /></button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '16px 22px', borderTop: '1px solid rgba(255,255,255,.08)' }}>
          {error && <p style={{ fontSize: 12, color: ACCENT, marginBottom: 10 }}>{error}</p>}
          <button onClick={handleSave} disabled={busy} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: `linear-gradient(135deg,${ACCENT},#c41f4a)`, border: 'none', borderRadius: 10, padding: '13px', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', opacity: busy ? 0.7 : 1 }}>
            <Check size={16} /> {busy ? 'Salvando...' : (isEdit ? 'Salvar alterações' : 'Criar produto')}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={{ fontSize: 10, letterSpacing: '.12em', color: '#8b8b9e', fontWeight: 600, fontFamily: "'JetBrains Mono',monospace" }}>{label}</label>
      {children}
    </div>
  );
}

const INP = { background: 'rgba(20,20,38,.8)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 9, padding: '11px 13px', color: '#fff', fontSize: 14, outline: 'none', width: '100%', fontFamily: "'Outfit',sans-serif" };
