import { useState, useEffect } from 'react';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, query, orderBy, arrayUnion, arrayRemove } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { db, storage, WD_SERVICE_CONFIG, ID_VISUAL_CONFIG } from '../lib/firebase';

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

  // Add client — admin cria, ou o CS Comercial cria ao fechar o
  // onboarding. Campos extras (dados do contrato, kickoff, etc.) são
  // preservados: só `name`, `responsibles` e os blocos de setor têm
  // tratamento especial.
  const addClient = async (data) => {
    try {
      const { name, responsibles, wdService, idVisualResponsible, ...extra } = data || {};
      const newClient = {
        ...extra,
        name,
        // Responsible per sector (optional)
        responsibles: responsibles || {},
        // ID Visual — bloco próprio, dono próprio. Só o designer
        // responsável enxerga; o time de web não vê nada disso.
        idv: idVisualResponsible ? {
          responsible: idVisualResponsible,
          status: 'onboarding',
          onboardingStartedAt: new Date().toISOString(),
          productionStartedAt: null,
          checklist: [],
          notes: '',
        } : null,
        // WebDesign data
        wd: {
          service: wdService || null,
          status: wdService ? 'onboarding' : null,
          onboardingStartedAt: wdService ? new Date().toISOString() : null,
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
      const ref = await addDoc(collection(db, 'clients'), newClient);
      return { success: true, id: ref.id };
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

  // Toda ação no Brand Hub vira uma linha de histórico. É o que permite
  // saber depois quem subiu ou apagou cada arquivo — o Brand Hub é
  // compartilhado entre Design, Vídeo, Social Media e admin.
  const logBrand = (clientId, entry) => updateDoc(doc(db, 'clients', clientId), {
    'brandbook.log': arrayUnion({
      id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      at: new Date().toISOString(),
      ...entry,
    }),
  });

  // Aceita um arquivo (`file`) ou vários (`files`) de uma vez. Cada
  // arquivo vira um material com o próprio nome de origem.
  const addBrandMaterial = async (clientId, { type, name, file, files, videoUrl }, addedBy, addedBySector) => {
    try {
      const by = addedBy || 'Desconhecido';
      const sector = addedBySector || '';
      const stamp = () => `mat_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;

      if (type === 'video') {
        if (!videoUrl?.trim()) return { success: false, error: 'Informe o link do vídeo.' };
        const material = {
          id: stamp(), type: 'video',
          name: name?.trim() || 'Vídeo',
          url: videoUrl.trim(), path: null, fileType: 'video',
          addedBy: by, addedBySector: sector, addedAt: new Date().toISOString(),
        };
        await updateDoc(doc(db, 'clients', clientId), { 'brandbook.materials': arrayUnion(material) });
        await logBrand(clientId, { action: 'add', name: material.name, by, sector });
        return { success: true };
      }

      const lista = (files && files.length) ? Array.from(files) : (file ? [file] : []);
      if (lista.length === 0) return { success: false, error: 'Selecione ao menos um arquivo.' };

      const invalido = lista.find(f => !ALLOWED_FILE_TYPES.includes(f.type));
      if (invalido) {
        return { success: false, error: `"${invalido.name}": formato não suportado. Use JPG, PNG, WEBP, ICO ou PDF.` };
      }
      const grande = lista.find(f => f.size > 25 * 1024 * 1024);
      if (grande) return { success: false, error: `"${grande.name}" passa de 25MB.` };

      for (const f of lista) {
        const id = stamp();
        const clean = f.name.replace(/[^a-zA-Z0-9.]/g, '_');
        const path = `brand-hub/${clientId}/${id}_${clean}`;
        const storageRef = ref(storage, path);
        await uploadBytes(storageRef, f);
        const material = {
          id, type: 'file',
          name: f.name,
          url: await getDownloadURL(storageRef),
          path, fileType: f.type,
          addedBy: by, addedBySector: sector, addedAt: new Date().toISOString(),
        };
        await updateDoc(doc(db, 'clients', clientId), { 'brandbook.materials': arrayUnion(material) });
        await logBrand(clientId, { action: 'add', name: material.name, by, sector });
      }
      return { success: true, count: lista.length };
    } catch (err) { return { success: false, error: err.message }; }
  };

  // Remove material. Permissão (criador/admin) é checada na UI; aqui
  // só executa. Apaga o arquivo do Storage se houver.
  const removeBrandMaterial = async (clientId, material, byName, bySector) => {
    try {
      if (material.path) { try { await deleteObject(ref(storage, material.path)); } catch {} }
      await updateDoc(doc(db, 'clients', clientId), {
        'brandbook.materials': arrayRemove(material),
      });
      await logBrand(clientId, {
        action: 'remove',
        name: material.name || 'material',
        by: byName || 'Desconhecido',
        sector: bySector || '',
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

  // ── ID Visual actions ──────────────────────────────────────
  // Espelham o fluxo do WebDesign (onboarding → produção →
  // finalizado), mas gravam no bloco `idv`, que pertence ao designer.
  const idvMoveToProduction = async (clientId) => {
    try {
      const checklist = ID_VISUAL_CONFIG.checklist.map((label, i) => ({
        id: `idv_${i}`, label, checked: false, checkedAt: null,
      }));
      await updateDoc(doc(db, 'clients', clientId), {
        'idv.status': 'production',
        'idv.onboardingCompletedAt': new Date().toISOString(),
        'idv.productionStartedAt': new Date().toISOString(),
        'idv.checklist': checklist,
      });
      return { success: true };
    } catch (err) { return { success: false, error: err.message }; }
  };

  const idvMoveBackToOnboarding = async (clientId) => {
    try {
      await updateDoc(doc(db, 'clients', clientId), {
        'idv.status': 'onboarding',
        'idv.onboardingStartedAt': new Date().toISOString(),
        'idv.productionStartedAt': null,
        'idv.checklist': [],
      });
      return { success: true };
    } catch (err) { return { success: false, error: err.message }; }
  };

  const idvUpdateChecklist = async (clientId, updatedChecklist) => {
    try {
      await updateDoc(doc(db, 'clients', clientId), { 'idv.checklist': updatedChecklist });
      return { success: true };
    } catch (err) { return { success: false, error: err.message }; }
  };

  const idvUpdateNotes = async (clientId, notes) => {
    try { await updateDoc(doc(db, 'clients', clientId), { 'idv.notes': notes }); return { success: true }; }
    catch (err) { return { success: false, error: err.message }; }
  };

  const idvMoveStatus = async (clientId, newStatus) => {
    try {
      const patch = { 'idv.status': newStatus };
      if (newStatus === 'finished') patch['idv.finishedAt'] = new Date().toISOString();
      await updateDoc(doc(db, 'clients', clientId), patch);
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
  const updateBrandbook = async (clientId, brandbook, byName, bySector) => {
    try {
      // Atualiza apenas colors/typography por campo, para NÃO apagar
      // os materials já existentes (que vivem em brandbook.materials).
      const patch = {};
      if ('colors' in brandbook) patch['brandbook.colors'] = brandbook.colors;
      if ('typography' in brandbook) patch['brandbook.typography'] = brandbook.typography;
      if ('driveLink' in brandbook) patch['brandbook.driveLink'] = brandbook.driveLink;
      await updateDoc(doc(db, 'clients', clientId), patch);
      await logBrand(clientId, {
        action: 'brandbook',
        name: 'paleta / tipografia',
        by: byName || 'Desconhecido',
        sector: bySector || '',
      });
      return { success: true };
    } catch (err) { return { success: false, error: err.message }; }
  };

  // ── Onboarding: marca o "ok" de um setor no checklist ────────
  // Cada colaborador marca apenas o próprio setor. Quando todos os
  // setores envolvidos estão ok, o status vira 'ready' (pronto p/ CS).
  const markOnboardingSector = async (clientId, sector, byName, done = true) => {
    try {
      const client = clients.find(c => c.id === clientId);
      if (!client || !client.onboarding) return { success: false, error: 'Cliente sem onboarding ativo.' };
      const checklist = { ...(client.onboarding.checklist || {}) };
      checklist[sector] = done
        ? { ok: true, by: byName, at: new Date().toISOString() }
        : { ok: false, by: null, at: null };
      const sectors = client.onboarding.sectors || Object.keys(checklist);
      const allOk = sectors.every(s => checklist[s]?.ok);
      const patch = {
        'onboarding.checklist': checklist,
        'onboarding.status': allOk ? 'ready' : 'running',
      };
      if (allOk) patch['onboarding.readyAt'] = new Date().toISOString();
      await updateDoc(doc(db, 'clients', clientId), patch);
      return { success: true, allOk };
    } catch (err) { return { success: false, error: err.message }; }
  };

  // ── CS Operacional: Kickoff ─────────────────────────────────
  // O cliente entra em `kickoff.pending` quando o CS Comercial conclui
  // o onboarding. Ao confirmar o kickoff, ele sai da aba de pendentes.
  const confirmKickoff = async (clientId, byName) => {
    try {
      await updateDoc(doc(db, 'clients', clientId), {
        'kickoff.pending': false,
        'kickoff.confirmedAt': new Date().toISOString(),
        'kickoff.confirmedBy': byName || null,
      });
      return { success: true };
    } catch (err) { return { success: false, error: err.message }; }
  };

  // ── CS Operacional: Saúde do Cliente (farol manual) ─────────
  // level: 'green' | 'yellow' | 'orange' | 'red' | null (limpar)
  const setClientHealth = async (clientId, level, note, byName) => {
    try {
      await updateDoc(doc(db, 'clients', clientId), {
        clientHealth: level
          ? { level, note: note || '', by: byName || null, at: new Date().toISOString() }
          : null,
      });
      return { success: true };
    } catch (err) { return { success: false, error: err.message }; }
  };

  return {
    clients, loading, addClient, updateClient, deleteClient,
    confirmKickoff, setClientHealth,
    wdMoveToProduction, wdMoveBackToOnboarding, wdUpdateChecklist, wdUpdateNotes, wdMoveStatus,
    idvMoveToProduction, idvMoveBackToOnboarding, idvUpdateChecklist, idvUpdateNotes, idvMoveStatus,
    smAddPost, smAddBulkPosts, smUpdatePostStatus,
    addDelivery, updateBrandbook,
    addBrandMaterial, removeBrandMaterial,
    markOnboardingSector,
  };
}
