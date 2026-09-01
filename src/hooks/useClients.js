import { useState, useEffect } from 'react';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, query, orderBy, arrayUnion, arrayRemove } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { db, storage, WD_SERVICE_CONFIG, ID_VISUAL_CONFIG } from '../lib/firebase';

// Responsável pode estar salvo como string (docs antigos) ou array.
const asArray = (v) => (Array.isArray(v) ? v : v ? [v] : []);

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

  // Add client — o CS Comercial cadastra o cliente novo (estágio
  // `staffing`) ou o admin cadastra direto. Campos extras (bloco
  // `contrato`, `kickoff`, etc.) são preservados: só `name`,
  // `responsibles` e os blocos de setor têm tratamento especial.
  //
  // Em `staffing` o cliente grava `active: false` de propósito: é o
  // que já o esconde de todos os filtros do app (`active !== false`)
  // sem precisar mexer em dezenas de telas. Ele volta a `true` quando
  // o quadro de responsáveis fecha.
  const addClient = async (data) => {
    try {
      const { name, responsibles, wdService, idVisualResponsible, stage, ...extra } = data || {};
      const emStaffing = stage === 'staffing';
      const newClient = {
        ...extra,
        name,
        stage: stage || 'live',
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
        active: !emStaffing,
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

  // ════════════════════════════════════════════════════════════
  //  ONBOARDING DE CLIENTES — duas calls
  //
  //  staffing   → líderes indicam os responsáveis
  //  kickoff    → CS COMERCIAL agenda e realiza a call de Kick Off,
  //               junto com a CS Operacional
  //  onboarding → CS OPERACIONAL agenda a call de onboarding. É no
  //               AGENDAMENTO que o cliente vira `active: true` e
  //               aparece para os responsáveis de cada setor
  //  live       → call de onboarding realizada, rotina normal
  //
  //  Dois blocos separados no documento:
  //    kickoffCall{} → call 1 (Kick Off), dona: CS Comercial
  //    kickoff{}     → call 2 (Onboarding), dona: CS Operacional
  //
  //  O nome `kickoff` para a call 2 é legado e foi mantido de
  //  propósito: é o que os clientes já cadastrados usam. Renomear
  //  exigiria migrar a base inteira sem ganho nenhum.
  // ════════════════════════════════════════════════════════════

  // Setores que ainda não têm ninguém indicado.
  // `staffing.sectors` é definido no cadastro (serviços contratados).
  const pendingSectorsOf = (client) => {
    const exigidos = client?.staffing?.sectors || [];
    return exigidos.filter(sid => !asArray(client?.responsibles?.[sid]).length);
  };

  // Líder indica os responsáveis do SETOR DELE. Se com isso o quadro
  // fechar, o cliente avança para o Kick Off na mesma escrita — nada
  // de rodar duas vezes e deixar o cliente num estado quebrado se a
  // segunda falhar.
  const setSectorResponsibles = async (clientId, sector, names, byName, opts = {}) => {
    try {
      const client = clients.find(c => c.id === clientId);
      if (!client) return { success: false, error: 'Cliente não encontrado.' };
      const lista = asArray(names).filter(Boolean);
      if (!lista.length) return { success: false, error: 'Selecione ao menos um responsável.' };

      const patch = {
        [`responsibles.${sector}`]: lista,
        [`staffing.log.${sector}`]: { by: byName || null, at: new Date().toISOString() },
      };

      // ID Visual vendido: o bloco `idv` nasce agora, com o designer
      // que o líder escolheu. É o mesmo formato de antes, só que o
      // dono é definido aqui em vez de no cadastro da CS.
      if (sector === 'design' && client.contrato?.hasIdVisual && !client.idv?.responsible) {
        const dono = opts.idvResponsible && lista.includes(opts.idvResponsible) ? opts.idvResponsible : lista[0];
        patch.idv = {
          responsible: dono,
          status: 'onboarding',
          onboardingStartedAt: new Date().toISOString(),
          productionStartedAt: null,
          checklist: [],
          notes: '',
        };
      }

      // Simula o resultado para saber se este foi o último setor.
      const simulado = {
        ...client,
        responsibles: { ...(client.responsibles || {}), [sector]: lista },
      };
      const aindaFalta = pendingSectorsOf(simulado);
      const fechou = aindaFalta.length === 0 && client.stage === 'staffing';

      if (fechou) {
        // Quadro completo: destrava o Kick Off para a CS Comercial.
        // O cliente CONTINUA invisível para os setores — só aparece
        // quando a call de onboarding for agendada.
        patch.stage = 'kickoff';
        patch.active = false;
        patch['staffing.completedAt'] = new Date().toISOString();
        patch.kickoffCall = {
          pending: true, at: null, meetLink: '',
          scheduledBy: null, scheduledAt: null,
          confirmedAt: null, confirmedBy: null,
        };
      }

      await updateDoc(doc(db, 'clients', clientId), patch);
      return { success: true, activated: fechou };
    } catch (err) { return { success: false, error: err.message }; }
  };

  // ── Call 1: Kick Off (CS Comercial) ──────────────────────────
  // Só destrava com o quadro de responsáveis fechado. Quem agenda é a
  // CS Comercial; na ausência dela, o admin.
  const scheduleKickoffCall = async (clientId, byName, at, meetLink) => {
    if (!at) return { success: false, error: 'Defina a data e a hora da call.' };
    try {
      const client = clients.find(c => c.id === clientId);
      if (!client) return { success: false, error: 'Cliente não encontrado.' };
      if (pendingSectorsOf(client).length > 0) {
        return { success: false, error: 'Ainda faltam responsáveis. A call de Kick Off só abre com o quadro completo.' };
      }
      await updateDoc(doc(db, 'clients', clientId), {
        'kickoffCall.pending': true,
        'kickoffCall.at': at,
        'kickoffCall.meetLink': String(meetLink || '').trim(),
        'kickoffCall.scheduledBy': byName || null,
        'kickoffCall.scheduledAt': new Date().toISOString(),
      });
      return { success: true };
    } catch (err) { return { success: false, error: err.message }; }
  };

  // Desmarca o agendamento do Kick Off. O cliente volta para
  // "aguardando agendamento" — não apaga o cadastro.
  const cancelKickoffCall = async (clientId) => {
    try {
      await updateDoc(doc(db, 'clients', clientId), {
        'kickoffCall.at': null,
        'kickoffCall.meetLink': '',
        'kickoffCall.scheduledBy': null,
        'kickoffCall.scheduledAt': null,
      });
      return { success: true };
    } catch (err) { return { success: false, error: err.message }; }
  };

  // Kick Off realizado: o cliente passa para a mão da CS Operacional,
  // que agenda a call de onboarding com o time.
  const confirmKickoffCall = async (clientId, byName) => {
    try {
      const client = clients.find(c => c.id === clientId);
      if (!client) return { success: false, error: 'Cliente não encontrado.' };
      if (!client.kickoffCall?.at) {
        return { success: false, error: 'Agende a call antes de marcá-la como realizada.' };
      }
      const now = new Date().toISOString();
      await updateDoc(doc(db, 'clients', clientId), {
        stage: 'onboarding',
        'kickoffCall.pending': false,
        'kickoffCall.confirmedAt': now,
        'kickoffCall.confirmedBy': byName || null,
        // Abre a call 2 para a CS Operacional.
        kickoff: {
          pending: true, at: null, meetLink: '',
          scheduledBy: null, scheduledAt: null,
          confirmedAt: null, confirmedBy: null,
        },
      });
      return { success: true };
    } catch (err) { return { success: false, error: err.message }; }
  };

  // ── Call 2: Onboarding (CS Operacional) ──────────────────────
  // O agendamento é o gatilho de visibilidade: `active: true` faz o
  // cliente aparecer na aba de onboarding de cada responsável.
  const scheduleOnboarding = async (clientId, byName, at, meetLink) => {
    if (!at) return { success: false, error: 'Defina a data e a hora da call.' };
    try {
      await updateDoc(doc(db, 'clients', clientId), {
        stage: 'onboarding',
        active: true,
        'kickoff.pending': true,
        'kickoff.at': at,
        'kickoff.meetLink': String(meetLink || '').trim(),
        'kickoff.scheduledBy': byName || null,
        'kickoff.scheduledAt': new Date().toISOString(),
      });
      return { success: true };
    } catch (err) { return { success: false, error: err.message }; }
  };

  // CS Operacional confirma que a call aconteceu. O cliente sai da
  // aba de onboarding de todo mundo e entra na rotina normal.
  const confirmKickoff = async (clientId, byName) => {
    try {
      await updateDoc(doc(db, 'clients', clientId), {
        stage: 'live',
        active: true,
        'kickoff.pending': false,
        'kickoff.confirmedAt': new Date().toISOString(),
        'kickoff.confirmedBy': byName || null,
      });
      return { success: true };
    } catch (err) { return { success: false, error: err.message }; }
  };

  // Cancela um cadastro feito por engano. Só antes de qualquer
  // indicação de responsável — depois disso o cliente já existe para
  // outras pessoas e apagar viraria surpresa.
  const cancelStaffing = async (clientId) => {
    try {
      const client = clients.find(c => c.id === clientId);
      if (!client) return { success: false, error: 'Cliente não encontrado.' };
      if (client.stage !== 'staffing') {
        return { success: false, error: 'Este cliente já está ativo na base.' };
      }
      // O CS Operacional já vem preenchido do cadastro, então ele NÃO
      // pode entrar nesta conta — senão nenhum cadastro seria mais
      // cancelável. O que trava o cancelamento é um líder de setor de
      // produção já ter indicado alguém.
      const indicados = Object.entries(client.responsibles || {})
        .filter(([sid, v]) => sid !== 'cs' && asArray(v).length);
      if (indicados.length) {
        return { success: false, error: 'Já existe setor com responsável indicado — não dá para cancelar.' };
      }
      await deleteDoc(doc(db, 'clients', clientId));
      return { success: true };
    } catch (err) { return { success: false, error: err.message }; }
  };

  // ── Anexos do cadastro (briefing e contrato) ────────────────
  // Pastas separadas de propósito: o contrato tem CPF, CNPJ e valores
  // e nunca é renderizado em tela nenhuma do app.
  const uploadClientFile = async (kind, file) => {
    const MAX = 25 * 1024 * 1024;
    if (!file) return { success: false, error: 'Nenhum arquivo selecionado.' };
    if (file.size > MAX) return { success: false, error: `"${file.name}" passa de 25MB.` };
    try {
      const clean = file.name.replace(/[^a-zA-Z0-9.]/g, '_');
      const pasta = kind === 'contrato' ? 'contratos' : 'briefings';
      const path = `${pasta}/${Date.now()}_${clean}`;
      const storageRef = ref(storage, path);
      await uploadBytes(storageRef, file);
      return {
        success: true,
        file: { name: file.name, url: await getDownloadURL(storageRef), path, type: file.type },
      };
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
    addDelivery, updateBrandbook,
    addBrandMaterial, removeBrandMaterial,
    setSectorResponsibles, scheduleOnboarding, cancelStaffing,
    scheduleKickoffCall, cancelKickoffCall, confirmKickoffCall,
    pendingSectorsOf, uploadClientFile,
  };
}
