import { useState, useEffect } from 'react';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, query, orderBy, arrayUnion, arrayRemove } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { db, storage, WD_SERVICE_CONFIG } from '../lib/firebase';

export function useClients() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'clients'), orderBy('createdAt', 'desc'));
    return onSnapshot(q, snap => {
      setClients(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
  }, []);

  // Add client — admin creates, goes to WD onboarding automatically
  const addClient = async (data) => {
    try {
      const newClient = {
        name: data.name,
        // Responsible per sector (optional)
        responsibles: data.responsibles || {},
        // WebDesign data
        wd: {
          service: data.wdService || null,
          status: data.wdService ? 'onboarding' : null,
          onboardingStartedAt: data.wdService ? new Date().toISOString() : null,
          productionStartedAt: null,
          checklist: [],
          notes: '',
          recurrenceService: '',
        },
        // Social Media data
        sm: { posts: [] },
        // Design data
        design: { deliveries: [] },
        // VideoMaker data
        video: { deliveries: [] },
        // Brandbook (shared Design + Video)
        brandbook: { colors: [], typography: '', driveLink: '' },
        createdAt: serverTimestamp(),
        active: true,
      };
      await addDoc(collection(db, 'clients'), newClient);
      return { success: true };
    } catch (err) { return { success: false, error: err.message }; }
  };

  const updateClient = async (id, data) => {
    try { await updateDoc(doc(db, 'clients', id), data); return { success: true }; }
    catch (err) { return { success: false, error: err.message }; }
  };

  const deleteClient = async (id) => {
    try { await deleteDoc(doc(db, 'clients', id)); return { success: true }; }
    catch (err) { return { success: false, error: err.message }; }
  };

  // ─── Brand Hub: materiais (upload de arquivo OU link de vídeo) ───
  // Cada material: { id, type, name, url, path, fileType, addedBy,
  //   addedBySector, addedAt }. Registro de autoria para rastreio.
  const ALLOWED_FILE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/x-icon', 'image/vnd.microsoft.icon', 'application/pdf'];

  const addBrandMaterial = async (clientId, { type, name, file, videoUrl }, addedBy, addedBySector) => {
    try {
      const id = `mat_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
      let material = {
        id, type, name: name?.trim() || 'Sem nome',
        addedBy: addedBy || 'Desconhecido',
        addedBySector: addedBySector || '',
        addedAt: new Date().toISOString(),
      };

      if (type === 'video') {
        if (!videoUrl?.trim()) return { success: false, error: 'Informe o link do vídeo.' };
        material.url = videoUrl.trim();
        material.path = null;
        material.fileType = 'video';
      } else {
        if (!file) return { success: false, error: 'Selecione um arquivo.' };
        if (!ALLOWED_FILE_TYPES.includes(file.type)) {
          return { success: false, error: 'Formato não suportado. Use JPG, PNG, WEBP, ICO ou PDF.' };
        }
        if (file.size > 25 * 1024 * 1024) return { success: false, error: 'Arquivo muito grande (máx. 25MB).' };
        const clean = file.name.replace(/[^a-zA-Z0-9.]/g, '_');
        const path = `brand-hub/${clientId}/${id}_${clean}`;
        const storageRef = ref(storage, path);
        await uploadBytes(storageRef, file);
        material.url = await getDownloadURL(storageRef);
        material.path = path;
        material.fileType = file.type;
      }

      await updateDoc(doc(db, 'clients', clientId), {
        'brandbook.materials': arrayUnion(material),
      });
      return { success: true };
    } catch (err) { return { success: false, error: err.message }; }
  };

  // Remove material. Permissão (criador/admin) é checada na UI; aqui
  // só executa. Apaga o arquivo do Storage se houver.
  const removeBrandMaterial = async (clientId, material) => {
    try {
      if (material.path) { try { await deleteObject(ref(storage, material.path)); } catch {} }
      await updateDoc(doc(db, 'clients', clientId), {
        'brandbook.materials': arrayRemove(material),
      });
      return { success: true };
    } catch (err) { return { success: false, error: err.message }; }
  };

  // ── WebDesign actions ──────────────────────────────────────
  const wdMoveToProduction = async (clientId) => {
    try {
      const client = clients.find(c => c.id === clientId);
      if (!client) throw new Error('Cliente não encontrado');
      const cfg = WD_SERVICE_CONFIG[client.wd.service];
      const checklist = cfg.checklist.map((label, i) => ({ id: `item_${i}`, label, checked: false, checkedAt: null }));
      await updateDoc(doc(db, 'clients', clientId), {
        'wd.status': 'production',
        'wd.onboardingCompletedAt': new Date().toISOString(),
        'wd.productionStartedAt': new Date().toISOString(),
        'wd.checklist': checklist,
      });
      return { success: true };
    } catch (err) { return { success: false, error: err.message }; }
  };

  const wdMoveBackToOnboarding = async (clientId) => {
    try {
      await updateDoc(doc(db, 'clients', clientId), {
        'wd.status': 'onboarding',
        'wd.onboardingStartedAt': new Date().toISOString(),
        'wd.productionStartedAt': null,
        'wd.checklist': [],
      });
      return { success: true };
    } catch (err) { return { success: false, error: err.message }; }
  };

  const wdUpdateChecklist = async (clientId, updatedChecklist) => {
    try {
      await updateDoc(doc(db, 'clients', clientId), { 'wd.checklist': updatedChecklist });
      return { success: true };
    } catch (err) { return { success: false, error: err.message }; }
  };

  const wdUpdateNotes = async (clientId, notes) => {
    try { await updateDoc(doc(db, 'clients', clientId), { 'wd.notes': notes }); return { success: true }; }
    catch (err) { return { success: false, error: err.message }; }
  };

  const wdMoveStatus = async (clientId, newStatus, extra = {}) => {
    try {
      await updateDoc(doc(db, 'clients', clientId), { 'wd.status': newStatus, ...extra });
      return { success: true };
    } catch (err) { return { success: false, error: err.message }; }
  };

  // ── Social Media actions ──────────────────────────────────
  const smAddPost = async (clientId, post) => {
    try {
      const client = clients.find(c => c.id === clientId);
      const posts = [...(client?.sm?.posts || []), { ...post, id: `post_${Date.now()}`, status: 'production', createdAt: new Date().toISOString() }];
      await updateDoc(doc(db, 'clients', clientId), { 'sm.posts': posts });
      return { success: true };
    } catch (err) { return { success: false, error: err.message }; }
  };

  const smAddBulkPosts = async (postsData) => {
    // postsData: array of { clientId, date, name, linkArt, responsible }
    try {
      const byClient = {};
      postsData.forEach(p => { if (!byClient[p.clientId]) byClient[p.clientId] = []; byClient[p.clientId].push(p); });
      for (const [clientId, posts] of Object.entries(byClient)) {
        const client = clients.find(c => c.id === clientId);
        const existing = client?.sm?.posts || [];
        const newPosts = posts.map(p => ({ id: `post_${Date.now()}_${Math.random().toString(36).substr(2,5)}`, name: p.name, date: p.date, linkArt: p.linkArt, responsible: p.responsible, status: 'production', createdAt: new Date().toISOString() }));
        await updateDoc(doc(db, 'clients', clientId), { 'sm.posts': [...existing, ...newPosts] });
      }
      return { success: true };
    } catch (err) { return { success: false, error: err.message }; }
  };

  const smUpdatePostStatus = async (clientId, postId, newStatus) => {
    try {
      const client = clients.find(c => c.id === clientId);
      const posts = (client?.sm?.posts || []).map(p => p.id === postId ? { ...p, status: newStatus, updatedAt: new Date().toISOString() } : p);
      await updateDoc(doc(db, 'clients', clientId), { 'sm.posts': posts });
      return { success: true };
    } catch (err) { return { success: false, error: err.message }; }
  };

  // ── Design / Video deliveries ────────────────────────────
  const addDelivery = async (clientId, sector, delivery) => {
    // sector: 'design' or 'video'
    try {
      const client = clients.find(c => c.id === clientId);
      const key = sector === 'design' ? 'design.deliveries' : 'video.deliveries';
      const existing = sector === 'design' ? (client?.design?.deliveries || []) : (client?.video?.deliveries || []);
      const newDelivery = { ...delivery, id: `del_${Date.now()}`, createdAt: new Date().toISOString() };
      await updateDoc(doc(db, 'clients', clientId), { [key]: [...existing, newDelivery] });
      return { success: true };
    } catch (err) { return { success: false, error: err.message }; }
  };

  // ── Brandbook ────────────────────────────────────────────
  const updateBrandbook = async (clientId, brandbook) => {
    try {
      // Atualiza apenas colors/typography por campo, para NÃO apagar
      // os materials já existentes (que vivem em brandbook.materials).
      const patch = {};
      if ('colors' in brandbook) patch['brandbook.colors'] = brandbook.colors;
      if ('typography' in brandbook) patch['brandbook.typography'] = brandbook.typography;
      if ('driveLink' in brandbook) patch['brandbook.driveLink'] = brandbook.driveLink;
      await updateDoc(doc(db, 'clients', clientId), patch);
      return { success: true };
    } catch (err) { return { success: false, error: err.message }; }
  };

  return {
    clients, loading, addClient, updateClient, deleteClient,
    wdMoveToProduction, wdMoveBackToOnboarding, wdUpdateChecklist, wdUpdateNotes, wdMoveStatus,
    smAddPost, smAddBulkPosts, smUpdatePostStatus,
    addDelivery, updateBrandbook,
    addBrandMaterial, removeBrandMaterial,
  };
}
