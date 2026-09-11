import { useState, useEffect } from 'react';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, query, orderBy, where, getDocs, writeBatch, arrayUnion, arrayRemove, runTransaction } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { db, storage, WD_SERVICE_CONFIG, ID_VISUAL_CONFIG, contractState } from '../lib/firebase';
import { wdJobsOf, WD_ACTIVE_STATUSES } from '../lib/wdJobs';

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
  // `kickoff`) ou o admin cadastra direto. Campos extras (bloco
  // `contrato`, `kickoff`, etc.) são preservados: só `name`,
  // `responsibles` e os blocos de setor têm tratamento especial.
  //
  // Fora de `live` o cliente grava `active: false` de propósito: é o
  // que já o esconde de todos os filtros do app (`active !== false`)
  // sem precisar mexer em dezenas de telas. Ele volta a `true` no
  // agendamento da call de onboarding.
  const addClient = async (data) => {
    try {
      const { name, responsibles, wdService, idVisualResponsible, stage, ...extra } = data || {};
      const emFluxo = stage === 'kickoff' || stage === 'staffing' || stage === 'onboarding';
      // Cadastro da CS Comercial: a call de Kick Off já nasce aberta,
      // sem depender de responsáveis — eles vêm depois dela.
      const kickoffCall = stage === 'kickoff'
        ? { pending: true, at: null, meetLink: '', scheduledBy: null, scheduledAt: null, confirmedAt: null, confirmedBy: null }
        : undefined;
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
        ...(kickoffCall ? { kickoffCall } : {}),
        createdAt: serverTimestamp(),
        active: !emFluxo,
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
  // Todas recebem `jobId` por último (opcional). 'main' (padrão) é o
  // bloco `wd`; qualquer outro id é um item de `wdJobs[]`. Chamadas
  // antigas sem jobId continuam mexendo no serviço principal.
  const wdPatch = async (clientId, jobId, fields) => {
    const ref = doc(db, 'clients', clientId);
    if (!jobId || jobId === 'main') {
      const upd = {};
      Object.entries(fields).forEach(([k, v]) => { upd[`wd.${k}`] = v; });
      await updateDoc(ref, upd);
      return;
    }
    // Array inteiro reescrito dentro de transação: não atropela
    // outro serviço do mesmo cliente editado ao mesmo tempo.
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists()) throw new Error('Cliente não encontrado');
      const jobs = snap.data().wdJobs || [];
      if (!jobs.some(j => j.id === jobId)) throw new Error('Serviço não encontrado');
      tx.update(ref, { wdJobs: jobs.map(j => (j.id === jobId ? { ...j, ...fields } : j)) });
    });
  };

  // Aceita chaves no formato antigo ('wd.status') ou simples ('status').
  const stripWd = (extra) => Object.fromEntries(Object.entries(extra || {}).map(([k, v]) => [k.replace(/^wd\./, ''), v]));

  const wdMoveToProduction = async (clientId, jobId = 'main') => {
    try {
      const client = clients.find(c => c.id === clientId);
      if (!client) throw new Error('Cliente não encontrado');
      const job = wdJobsOf(client).find(j => j.id === jobId);
      const cfg = WD_SERVICE_CONFIG[job?.service];
      if (!cfg) throw new Error('Serviço sem configuração de checklist');
      const checklist = cfg.checklist.map((label, i) => ({ id: `item_${i}`, label, checked: false, checkedAt: null }));
      await wdPatch(clientId, jobId, {
        status: 'production',
        onboardingCompletedAt: new Date().toISOString(),
        productionStartedAt: new Date().toISOString(),
        checklist,
      });
      return { success: true };
    } catch (err) { return { success: false, error: err.message }; }
  };

  const wdMoveBackToOnboarding = async (clientId, jobId = 'main') => {
    try {
      await wdPatch(clientId, jobId, {
        status: 'onboarding',
        onboardingStartedAt: new Date().toISOString(),
        productionStartedAt: null,
        checklist: [],
      });
      return { success: true };
    } catch (err) { return { success: false, error: err.message }; }
  };

  const wdUpdateChecklist = async (clientId, updatedChecklist, jobId = 'main') => {
    try {
      await wdPatch(clientId, jobId, { checklist: updatedChecklist });
      return { success: true };
    } catch (err) { return { success: false, error: err.message }; }
  };

  const wdUpdateNotes = async (clientId, notes, jobId = 'main') => {
    try { await wdPatch(clientId, jobId, { notes }); return { success: true }; }
    catch (err) { return { success: false, error: err.message }; }
  };

  const wdMoveStatus = async (clientId, newStatus, extra = {}, jobId = 'main') => {
    try {
      await wdPatch(clientId, jobId, { ...stripWd(extra), status: newStatus });
      return { success: true };
    } catch (err) { return { success: false, error: err.message }; }
  };

  // Novo serviço de Web para um cliente que JÁ está na base.
  // Sem serviço de Web ainda → preenche o `wd`. Já tem → entra em
  // `wdJobs[]`. Os responsáveis também são somados ao
  // `responsibles.webdesign` do cliente (CS e tasks enxergam quem está nele).
  const wdAddService = async (clientId, { service, responsibles } = {}, byName = null) => {
    try {
      if (!WD_SERVICE_CONFIG[service]) throw new Error('Selecione o serviço.');
      const names = asArray(responsibles);
      if (!names.length) throw new Error('Selecione ao menos um responsável.');
      const ref = doc(db, 'clients', clientId);
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(ref);
        if (!snap.exists()) throw new Error('Cliente não encontrado');
        const data = snap.data();
        const current = wdJobsOf({ id: clientId, ...data });
        if (current.some(j => j.service === service && WD_ACTIVE_STATUSES.includes(j.status))) {
          throw new Error(`${data.name} já tem ${WD_SERVICE_CONFIG[service].label} em andamento.`);
        }
        const now = new Date().toISOString();
        const base = {
          service,
          status: 'onboarding',
          onboardingStartedAt: now,
          productionStartedAt: null,
          checklist: [],
          notes: '',
          recurrenceService: '',
          responsibles: names,
          addedBy: byName || null,
          addedAt: now,
        };
        const clientResp = asArray(data.responsibles?.webdesign);
        const upd = {
          'responsibles.webdesign': [...new Set([...clientResp, ...names])],
        };
        if (!data.wd?.status) {
          upd.wd = base;
        } else {
          // O principal legado passa a guardar os próprios responsáveis,
          // senão herdaria as pessoas do serviço novo.
          if (data.wd.responsibles === undefined) upd['wd.responsibles'] = clientResp;
          upd.wdJobs = [...(data.wdJobs || []), { ...base, id: `job_${Date.now()}` }];
        }
        tx.update(ref, upd);
      });
      return { success: true };
    } catch (err) { return { success: false, error: err.message }; }
  };

  // Remove UM serviço de Web — o cliente continua na base.
  const wdRemoveService = async (clientId, jobId = 'main') => {
    try {
      const ref = doc(db, 'clients', clientId);
      if (!jobId || jobId === 'main') {
        await updateDoc(ref, {
          wd: { service: null, status: null, onboardingStartedAt: null, productionStartedAt: null, checklist: [], notes: '', recurrenceService: '' },
        });
      } else {
        await runTransaction(db, async (tx) => {
          const snap = await tx.get(ref);
          if (!snap.exists()) throw new Error('Cliente não encontrado');
          tx.update(ref, { wdJobs: (snap.data().wdJobs || []).filter(j => j.id !== jobId) });
        });
      }
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
  //  kickoff    → CS COMERCIAL agenda e realiza a call de Kick Off.
  //               A CS Operacional acompanha a data, sem agendar.
  //  staffing   → Kick Off realizado. Os LÍDERES de cada setor
  //               indicam os responsáveis, pelo card travado na aba
  //               de Onboarding da CS Operacional.
  //  onboarding → quadro fechado. A CS OPERACIONAL agenda a call de
  //               onboarding. É no AGENDAMENTO que o cliente vira
  //               `active: true` e aparece para os responsáveis
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
  // fechar, o cliente avança para o onboarding na mesma escrita —
  // nada de rodar duas vezes e deixar o cliente num estado quebrado
  // se a segunda falhar.
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
        // Quadro completo: destrava a call de onboarding para a CS
        // Operacional. O cliente CONTINUA invisível para os setores —
        // só aparece quando essa call for agendada.
        patch.stage = 'onboarding';
        patch.active = false;
        patch['staffing.completedAt'] = new Date().toISOString();
        patch.kickoff = {
          pending: true, at: null, meetLink: '',
          scheduledBy: null, scheduledAt: null,
          confirmedAt: null, confirmedBy: null,
        };
      }

      await updateDoc(doc(db, 'clients', clientId), patch);
      return { success: true, activated: fechou };
    } catch (err) { return { success: false, error: err.message }; }
  };

  // Cobrança do líder que ainda não indicou ninguém. Fica registrado
  // no cliente (quem cobrou, quando) — é o histórico que a CS usa
  // depois para explicar um onboarding atrasado.
  const nudgeSectorLeader = async (clientId, sector, byName) => {
    try {
      await updateDoc(doc(db, 'clients', clientId), {
        [`staffing.nudges.${sector}`]: { by: byName || null, at: new Date().toISOString() },
      });
      return { success: true };
    } catch (err) { return { success: false, error: err.message }; }
  };

  // ── Call 1: Kick Off (CS Comercial) ──────────────────────────
  // Primeira etapa do ciclo: acontece logo após o cadastro, antes de
  // existir qualquer responsável. Quem agenda é a CS Comercial; na
  // ausência dela, o admin.
  const scheduleKickoffCall = async (clientId, byName, at, meetLink) => {
    if (!at) return { success: false, error: 'Defina a data e a hora da call.' };
    try {
      const client = clients.find(c => c.id === clientId);
      if (!client) return { success: false, error: 'Cliente não encontrado.' };
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

  // Kick Off realizado: abre o staffing. O card travado aparece na
  // aba de Onboarding da CS Operacional e só os líderes de cada setor
  // conseguem indicar quem fica com o cliente.
  const confirmKickoffCall = async (clientId, byName) => {
    try {
      const client = clients.find(c => c.id === clientId);
      if (!client) return { success: false, error: 'Cliente não encontrado.' };
      if (!client.kickoffCall?.at) {
        return { success: false, error: 'Agende a call antes de marcá-la como realizada.' };
      }
      const now = new Date().toISOString();
      await updateDoc(doc(db, 'clients', clientId), {
        stage: 'staffing',
        active: false,
        'kickoffCall.pending': false,
        'kickoffCall.confirmedAt': now,
        'kickoffCall.confirmedBy': byName || null,
        'staffing.startedAt': now,
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
      const client = clients.find(c => c.id === clientId);
      if (client && pendingSectorsOf(client).length > 0) {
        return { success: false, error: 'Ainda faltam responsáveis. A call de onboarding só abre com o quadro completo.' };
      }
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

  // ── Renomear cliente ────────────────────────────────────────
  // `clientName` está desnormalizado em `tasks`, `requests` e
  // `documents`. Renomear só o doc do cliente deixaria o nome velho
  // colado em card, solicitação e documento já criados — então a
  // troca propaga para as três coleções na mesma chamada.
  const renameClient = async (clientId, newName, byName) => {
    const nome = String(newName || '').trim();
    if (!nome) return { success: false, error: 'O nome não pode ficar vazio.' };
    const client = clients.find(c => c.id === clientId);
    if (client && client.name === nome) return { success: true, propagated: 0 };
    const duplicado = clients.some(c => c.id !== clientId
      && String(c.name || '').trim().toLowerCase() === nome.toLowerCase());
    if (duplicado) return { success: false, error: 'Já existe outro cliente com esse nome.' };

    // Duas etapas com try separados de propósito. A renomeação do
    // cliente é a parte que não pode falhar; a propagação para as
    // outras coleções é reparável depois. Com um try só, um erro na
    // segunda etapa devolvia `success: false` mesmo com o nome já
    // trocado — a tela mostrava erro e o usuário não sabia se algo
    // tinha sido gravado.
    try {
      await updateDoc(doc(db, 'clients', clientId), {
        name: nome,
        renameLog: arrayUnion({
          from: client?.name || '', to: nome,
          by: byName || null, at: new Date().toISOString(),
        }),
      });
    } catch (err) {
      return { success: false, error: `Não foi possível renomear: ${err.message}` };
    }

    // Propaga o nome onde ele está copiado. Em lotes de 400 porque o
    // batch do Firestore para em 500 operações.
    try {
      let propagated = 0;
      for (const col of ['tasks', 'requests', 'documents']) {
        const snap = await getDocs(query(collection(db, col), where('clientId', '==', clientId)));
        const docs = snap.docs;
        for (let i = 0; i < docs.length; i += 400) {
          const batch = writeBatch(db);
          docs.slice(i, i + 400).forEach(d => batch.update(d.ref, { clientName: nome }));
          await batch.commit();
        }
        propagated += docs.length;
      }
      return { success: true, propagated };
    } catch (err) {
      return {
        success: true,
        propagated: 0,
        warning: `O cliente foi renomeado, mas o nome antigo continua nos cards e solicitações já criados (${err.message}).`,
      };
    }
  };

  // ── Anexos avulsos do cliente ───────────────────────────────
  // Diferente do briefing e do contrato, que vêm do cadastro e são
  // fixos: aqui entra o que aparece depois — aditivo, print, planilha.
  // Vive em `anexos[]` e é visível para quem abre o modal do cliente.
  const addClientAttachment = async (clientId, file, byName) => {
    const MAX = 25 * 1024 * 1024;
    if (!clientId) return { success: false, error: 'Cliente não identificado.' };
    if (!file) return { success: false, error: 'Nenhum arquivo selecionado.' };
    if (file.size > MAX) return { success: false, error: `"${file.name}" passa de 25MB.` };
    try {
      const clean = file.name.replace(/[^a-zA-Z0-9.]/g, '_');
      const path = `anexos/${clientId}/${Date.now()}_${clean}`;
      const storageRef = ref(storage, path);
      await uploadBytes(storageRef, file);
      const anexo = {
        id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        name: file.name,
        url: await getDownloadURL(storageRef),
        path,
        type: file.type || '',
        size: file.size,
        by: byName || null,
        at: new Date().toISOString(),
      };
      await updateDoc(doc(db, 'clients', clientId), { anexos: arrayUnion(anexo) });
      return { success: true, file: anexo };
    } catch (err) { return { success: false, error: err.message }; }
  };

  // Remove o anexo do doc e, se der, o arquivo do Storage. A ordem
  // importa: primeiro o doc, porque é o que a tela lê. Se o Storage
  // falhar, sobra um arquivo órfão — barato — em vez de um link morto.
  const removeClientAttachment = async (clientId, anexo) => {
    if (!anexo) return { success: false, error: 'Anexo inválido.' };
    try {
      await updateDoc(doc(db, 'clients', clientId), { anexos: arrayRemove(anexo) });
      if (anexo.path) {
        try { await deleteObject(ref(storage, anexo.path)); }
        catch { /* arquivo já não existe no Storage */ }
      }
      return { success: true };
    } catch (err) { return { success: false, error: err.message }; }
  };

  // ── Contrato: renovação e encerramento ──────────────────────
  // A renovação SOMA meses ao prazo original em vez de reiniciar a
  // contagem: o cliente de 6 meses que renova por mais 6 tem um
  // contrato de 12 correndo desde o começo, e o histórico de quando
  // cada renovação foi feita fica em `renewals[]`.
  const renewContract = async (clientId, months, byName, note) => {
    const meses = Number(months);
    if (!meses || meses <= 0) return { success: false, error: 'Informe por quantos meses foi renovado.' };
    const client = clients.find(c => c.id === clientId);
    if (!client) return { success: false, error: 'Cliente não encontrado.' };

    const atual = contractState(client);
    if (!atual.baseMonths) {
      return { success: false, error: 'Este cliente não tem prazo de contrato no cadastro. Preencha a duração antes de renovar.' };
    }

    const addedMonths = Number(atual.addedMonths || 0) + meses;
    // Prazo resultante, só para deixar registrado no histórico.
    const simulado = contractState({
      ...client,
      contract: { ...(client.contract || {}), addedMonths, status: 'active' },
    });

    try {
      await updateDoc(doc(db, 'clients', clientId), {
        'contract.addedMonths': addedMonths,
        'contract.status': 'active',
        'contract.baseMonths': atual.baseMonths,
        'contract.closedAt': null,
        'contract.closedBy': null,
        'contract.closeReason': '',
        'contract.renewals': arrayUnion({
          months: meses,
          by: byName || null,
          at: new Date().toISOString(),
          until: simulado.endAt || null,
          note: String(note || '').trim(),
        }),
      });
      return { success: true, endAt: simulado.endAt };
    } catch (err) { return { success: false, error: err.message }; }
  };

  // Encerramento. NÃO mexe em `active`: desativar o cliente aqui o
  // sumiria de todos os painéis de uma vez, inclusive com task aberta
  // em produção. Quem decide desativar é o admin, na tela de clientes.
  const closeContract = async (clientId, byName, reason) => {
    const client = clients.find(c => c.id === clientId);
    if (!client) return { success: false, error: 'Cliente não encontrado.' };
    const atual = contractState(client);
    try {
      await updateDoc(doc(db, 'clients', clientId), {
        'contract.status': 'closed',
        'contract.baseMonths': atual.baseMonths || 0,
        'contract.addedMonths': atual.addedMonths || 0,
        'contract.closedAt': new Date().toISOString(),
        'contract.closedBy': byName || null,
        'contract.closeReason': String(reason || '').trim(),
      });
      return { success: true };
    } catch (err) { return { success: false, error: err.message }; }
  };

  // Reabre um contrato encerrado por engano.
  const reopenContract = async (clientId) => {
    try {
      await updateDoc(doc(db, 'clients', clientId), {
        'contract.status': 'active',
        'contract.closedAt': null,
        'contract.closedBy': null,
        'contract.closeReason': '',
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
    wdAddService, wdRemoveService,
    idvMoveToProduction, idvMoveBackToOnboarding, idvUpdateChecklist, idvUpdateNotes, idvMoveStatus,
    addDelivery, updateBrandbook,
    addBrandMaterial, removeBrandMaterial,
    setSectorResponsibles, scheduleOnboarding, cancelStaffing,
    scheduleKickoffCall, cancelKickoffCall, confirmKickoffCall,
    pendingSectorsOf, uploadClientFile, nudgeSectorLeader,
    renameClient, addClientAttachment, removeClientAttachment,
    renewContract, closeContract, reopenContract,
  };
}
