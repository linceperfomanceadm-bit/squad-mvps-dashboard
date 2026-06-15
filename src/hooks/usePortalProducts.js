import { useState, useEffect } from 'react';
import {
  collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, query, where, orderBy, serverTimestamp,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { db, storage } from '../lib/firebase';

/*
 * Produtos coletados por um cliente do portal. Coleção `portal_products`
 * filtrada por portalClientId. Fotos no Firebase Storage em
 * portal-products/{portalClientId}/{productId}/{fileName}.
 *
 * Campos do produto:
 *   portalClientId, name, price, description, category, stock,
 *   hasVariants, variantType, variantDescription,
 *   weightKg, lengthCm, widthCm, heightCm,
 *   images: [{ path, url }], createdAt, updatedAt
 */
export function usePortalProducts(portalClientId) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!portalClientId) { setLoading(false); return; }
    const q = query(
      collection(db, 'portal_products'),
      where('portalClientId', '==', portalClientId),
    );
    return onSnapshot(q, snap => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      // ordena por criação (client-side, evita índice composto)
      list.sort((a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0));
      setProducts(list);
      setLoading(false);
    }, () => setLoading(false));
  }, [portalClientId]);

  const addProduct = async (data) => {
    try {
      await addDoc(collection(db, 'portal_products'), {
        portalClientId,
        name: data.name?.trim() || '',
        price: data.price || '',
        description: data.description?.trim() || '',
        category: data.category || '',
        stock: data.stock || '',
        hasVariants: !!data.hasVariants,
        variantType: data.variantType || '',
        variantDescription: data.variantDescription || '',
        weightKg: data.weightKg || '',
        lengthCm: data.lengthCm || '',
        widthCm: data.widthCm || '',
        heightCm: data.heightCm || '',
        images: data.images || [],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      return { success: true };
    } catch (err) { return { success: false, error: err.message }; }
  };

  const updateProduct = async (id, patch) => {
    try {
      await updateDoc(doc(db, 'portal_products', id), { ...patch, updatedAt: serverTimestamp() });
      return { success: true };
    } catch (err) { return { success: false, error: err.message }; }
  };

  const removeProduct = async (product) => {
    try {
      // apaga as fotos do Storage primeiro (best-effort)
      for (const img of product.images || []) {
        if (img.path) { try { await deleteObject(ref(storage, img.path)); } catch {} }
      }
      await deleteDoc(doc(db, 'portal_products', product.id));
      return { success: true };
    } catch (err) { return { success: false, error: err.message }; }
  };

  // Upload de uma foto → retorna { path, url }
  const uploadImage = async (productId, file) => {
    try {
      const clean = file.name.replace(/[^a-zA-Z0-9.]/g, '_');
      const path = `portal-products/${portalClientId}/${productId}/${Date.now()}_${clean}`;
      const storageRef = ref(storage, path);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      return { success: true, image: { path, url } };
    } catch (err) { return { success: false, error: err.message }; }
  };

  const removeImage = async (img) => {
    try { if (img.path) await deleteObject(ref(storage, img.path)); return { success: true }; }
    catch (err) { return { success: false, error: err.message }; }
  };

  return { products, loading, addProduct, updateProduct, removeProduct, uploadImage, removeImage };
}
