import { useState, useEffect, useRef } from 'react';
import {
  collection, onSnapshot, addDoc, updateDoc,
  deleteDoc, doc, serverTimestamp, query, orderBy,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { businessMsBetween, isDeliveryOnTime, taskTimeStats } from '../lib/taskTime';

// ─── Auto-reparo de tasks presas em aprovação ──────────────────
// Bug histórico: ao enviar para aprovação sem escolher aprovador, a
// task gravava o próprio executor como aprovador (deliveredBy ===
// responsibleName) e ficava presa. Esta função detecta essas tasks e
// as devolve para "Em Produção" com o responsável original, uma única
// vez. É idempotente: se não há nada corrompido, não faz nada.
function isStuckApproval(t) {
  if (t.status !== 'approval') return false;
  const tl = Array.isArray(t.timeline) ? t.timeline : [];
  const lastApproval = [...tl].reverse().find(e => e && e.action === 'sent_for_approval');
  const selfDeliver = t.deliveredBy && t.deliveredBy === t.responsibleName;
  const selfHandoff = lastApproval && lastApproval.by && lastApproval.to && lastApproval.by === lastApproval.to;
  const noApprover  = !t.responsibleName;
  return selfDeliver || selfHandoff || noApprover;
}

// Detecta o desalinhamento singular/plural: responsibleName foi
// atualizado (ex.: aprovador), mas responsibleNames ficou com o valor
// antigo. Isso faz a task sumir do kanban de quem deveria vê-la.
function hasNameMismatch(t) {
  if (!t.responsibleName) return false;
  const names = Array.isArray(t.responsibleNames) ? t.responsibleNames : [];
  // Se o array não contém o responsável singular, está dessincronizado.
  return !names.includes(t.responsibleName);
}

// ─── Responsáveis adicionais (depois da task já criada) ────────
// Só o CRIADOR da task (requestedBy) e o admin chamam esta função —
// a permissão é validada na UI (TaskModal).
//
// REGRA IMPORTANTE: o responsável PRINCIPAL (responsibleName) é sempre
// preservado como primeiro item do array. Ele é quem entrega, quem vira
// deliveredBy e quem conta nas métricas (Hall da Fama, Extrato,
// Relatórios). Aqui só se somam/removem responsáveis EXTRAS. Isso
// mantém intactos o fluxo de aprovação/refação e o auto-reparo de
// dessincronização (hasNameMismatch) definido acima.
//
// É uma função solta (não faz parte do hook) para que o TaskModal possa
// usá-la direto, sem precisar passar prop nova por TaskKanban, pelos 5
// dashboards e pelo AdminFeed.
export async function updateTaskResponsibles(task, extraPeople, byName, bySector) {
  try {
    if (!task || !task.id) return { success: false, error: 'Task não encontrada.' };

    const principal = task.responsibleName
      || (Array.isArray(task.responsibleNames) ? task.responsibleNames[0] : null);
    if (!principal) return { success: false, error: 'Task sem responsável principal.' };

    // Normaliza a lista de extras: sem vazios, sem duplicados e sem
    // repetir o principal.
    const seen = new Set([principal]);
    const extras = [];
    (extraPeople || []).forEach(p => {
      const name = String(p?.name || '').trim();
      if (!name || seen.has(name)) return;
      seen.add(name);
      extras.push({ name, sector: p?.sector || null });
    });

    const names = [principal, ...extras.map(p => p.name)];
    const sectors = [task.responsibleSector, ...extras.map(p => p.sector)].filter(Boolean);
    const uniqueSectors = Array.from(new Set(sectors));

    const before = (Array.isArray(task.responsibleNames) && task.responsibleNames.length)
      ? task.responsibleNames
      : [principal];

    // Nada mudou — não escreve nem polui o chat com comentário repetido.
    const unchanged = before.length === names.length && before.every((n, i) => n === names[i]);
    if (unchanged) return { success: true, unchanged: true };

    const now = new Date().toISOString();
    const added   = names.filter(n => !before.includes(n));
    const removed = before.filter(n => !names.includes(n));

    const parts = [];
    if (added.length)   parts.push(`entrou: ${added.join(', ')}`);
    if (removed.length) parts.push(`saiu: ${removed.join(', ')}`);

    const timeline = [...(task.timeline || []), {
      action: 'responsibles_changed',
      by: byName,
      sector: bySector,
      at: now,
      added,
      removed,
      to: names,
    }];

    const comments = [...(task.comments || []), {
      id: `c_${Date.now()}`,
      author: byName,
      sector: bySector,
      text: `👥 Responsáveis atualizados (${parts.join(' · ')}). Agora: ${names.join(', ')}.`,
      createdAt: now,
      isSystem: true,
    }];

    await updateDoc(doc(db, 'tasks', task.id), {
      responsibleName: principal,        // principal nunca muda por aqui
      responsibleNames: names,
      responsibleSectors: uniqueSectors, // novo: todos os setores envolvidos
      timeline,
      comments,
    });
    return { success: true };
  } catch (err) { return { success: false, error: err.message }; }
}

export function useTasks() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  // Garante que o auto-reparo rode só uma vez por sessão do hook.
  const repairedRef = useRef(false);

  useEffect(() => {
    const q = query(collection(db, 'tasks'), orderBy('createdAt', 'desc'));
    return onSnapshot(q, snap => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setTasks(list);
      setLoading(false);

      // Auto-reparo (uma vez). Corrige no Firestore; o snapshot propaga
      // o resultado para todos os usuários automaticamente.
      if (!repairedRef.current) {
        repairedRef.current = true;

        // (a) Tasks presas em aprovação com executor = aprovador.
        const stuck = list.filter(isStuckApproval);
        stuck.forEach(t => {
          const tl = Array.isArray(t.timeline) ? t.timeline : [];
          const lastApproval = [...tl].reverse().find(e => e && e.action === 'sent_for_approval');
          const restoreName   = t.deliveredBy || (lastApproval && lastApproval.by) || t.responsibleName || null;
          const restoreSector = t.deliveredBySector || (lastApproval && lastApproval.sector) || t.responsibleSector || null;
          updateDoc(doc(db, 'tasks', t.id), {
            status: 'doing',
            responsibleName: restoreName,
            responsibleSector: restoreSector,
            responsibleNames: restoreName ? [restoreName] : [],
            deliveredBy: null,
            deliveredBySector: null,
            approvalAt: null,
            // Sai do congelamento junto — senão a task volta para
            // produção com o relógio de prazo ainda parado.
            approvalStartedAt: null,
          }).catch(() => {});
        });

        // (b) Tasks com responsibleNames dessincronizado do singular
        //     (causa da task sumir do kanban do responsável correto).
        //     Só corrige o que NÃO caiu no reparo (a) acima.
        const stuckIds = new Set(stuck.map(t => t.id));
        list.filter(t => !stuckIds.has(t.id) && hasNameMismatch(t)).forEach(t => {
          updateDoc(doc(db, 'tasks', t.id), {
            responsibleNames: [t.responsibleName],
          }).catch(() => {});
        });
      }
    });
  }, []);

  // ── Create task ──────────────────────────────────────────────
  const createTask = async ({ name, clientId, clientName, deadline, priority, responsibleSector, responsibleName, responsibleNames, requestedBy, requestedBySector, comment, links }) => {
    try {
      const now = new Date().toISOString();
      // responsibleNames: lista de todos os responsáveis. responsibleName
      // (singular) = principal, mantido para a lógica de entrega/métricas.
      const names = (responsibleNames && responsibleNames.length) ? responsibleNames : (responsibleName ? [responsibleName] : []);
      await addDoc(collection(db, 'tasks'), {
        name,
        clientId,
        clientName,
        deadline,
        priority,
        responsibleSector,
        responsibleName: names[0] || responsibleName,
        responsibleNames: names,
        // deliveredBy tracks who actually did the work (set when moved to approval)
        deliveredBy: null,
        deliveredBySector: null,
        requestedBy,
        requestedBySector,
        status: 'todo',
        isRework: false,
        reworkCount: 0,
        links: links || [],
        comments: comment ? [{
          id: `c_${Date.now()}`,
          author: requestedBy,
          sector: requestedBySector,
          text: comment,
          createdAt: now,
        }] : [],
        timeline: [{
          action: 'created',
          by: requestedBy,
          sector: requestedBySector,
          at: now,
        }],
        startedAt: null,
        approvalAt: null,
        completedAt: null,
        // ── Controle de prazo ──────────────────────────────────
        // pausedMs: tempo ÚTIL que a task passou congelada em
        // aprovação. É devolvido ao prazo se ela voltar para ajuste.
        pausedMs: 0,
        approvalStartedAt: null,
        deliveredAt: null,
        deliveredOnTime: null,
        firstDeliveredAt: null,
        firstDeliveredOnTime: null,
        timeStats: null,
        createdAt: serverTimestamp(),
      });
      return { success: true };
    } catch (err) { return { success: false, error: err.message }; }
  };

  // ── Move to Em Produção ──────────────────────────────────────
  const moveToProduction = async (taskId, updatedLinks) => {
    try {
      const task = tasks.find(t => t.id === taskId);
      if (!task) throw new Error('Task não encontrada');
      const now = new Date().toISOString();
      const timeline = [...(task.timeline || []), {
        action: 'started',
        by: task.responsibleName,
        sector: task.responsibleSector,
        at: now,
      }];
      await updateDoc(doc(db, 'tasks', taskId), {
        status: 'doing',
        startedAt: task.startedAt || now,
        links: updatedLinks || task.links,
        timeline,
      });
      return { success: true };
    } catch (err) { return { success: false, error: err.message }; }
  };

  // ── Move to Em Aprovação ─────────────────────────────────────
  // deliveredBy = quem realmente fez o trabalho (responsável atual
  // antes do handoff).
  //
  // É AQUI que o prazo congela. O que define se o colaborador entregou
  // no prazo é ESTE instante — não a data em que o aprovador resolveu
  // clicar. Enquanto a task estiver em aprovação ela não acumula
  // atraso; se voltar para ajuste, o tempo parado volta para o prazo.
  const moveToApproval = async (taskId, approverName, approverSector, updatedLinks) => {
    try {
      const task = tasks.find(t => t.id === taskId);
      if (!task) throw new Error('Task não encontrada');
      // Guarda: sem aprovador explícito, não envia (evita gravar o
      // próprio executor como aprovador — origem do bug).
      if (!approverName || !approverSector) {
        return { success: false, error: 'Selecione quem vai aprovar antes de enviar.' };
      }
      const at = new Date();
      const now = at.toISOString();
      const onTime = isDeliveryOnTime(task, at);

      const timeline = [...(task.timeline || []), {
        action: 'sent_for_approval',
        by: task.responsibleName,
        sector: task.responsibleSector,
        to: approverName,
        at: now,
        onTime,
      }];

      const patch = {
        status: 'approval',
        approvalAt: now,
        // Marca o início do congelamento do prazo.
        approvalStartedAt: now,
        deliveredAt: now,
        deliveredOnTime: onTime,
        // Save who delivered before changing responsible to approver
        deliveredBy: task.responsibleName,
        deliveredBySector: task.responsibleSector,
        responsibleName: approverName,
        responsibleSector: approverSector,
        // Sincroniza o array plural — a UI (card, filtros do kanban,
        // isResponsible) lê responsibleNames; sem isto a task some do
        // kanban do aprovador e continua no de quem entregou.
        responsibleNames: [approverName],
        responsibleSectors: [approverSector],
        links: updatedLinks || task.links,
        timeline,
      };

      // A primeira entrega é o que conta no KPI do colaborador —
      // gravada uma única vez, imune a rodadas de ajuste posteriores.
      if (!task.firstDeliveredAt) {
        patch.firstDeliveredAt = now;
        patch.firstDeliveredOnTime = onTime;
      }

      await updateDoc(doc(db, 'tasks', taskId), patch);
      return { success: true };
    } catch (err) { return { success: false, error: err.message }; }
  };

  // ── Approve (complete) task ──────────────────────────────────
  // Fecha o congelamento e grava o retrato do tempo no próprio doc,
  // para o Extrato e os Relatórios não precisarem recalcular a
  // timeline inteira a cada render.
  const approveTask = async (taskId) => {
    try {
      const task = tasks.find(t => t.id === taskId);
      if (!task) throw new Error('Task não encontrada');
      const at = new Date();
      const now = at.toISOString();
      const timeline = [...(task.timeline || []), {
        action: 'completed',
        by: task.responsibleName,
        sector: task.responsibleSector,
        at: now,
      }];

      const pausedMs = (Number(task.pausedMs) || 0) + (
        task.approvalStartedAt ? businessMsBetween(task.approvalStartedAt, at) : 0
      );

      // Calcula em cima do estado FINAL da task (com o evento de
      // conclusão já incluído), senão o último trecho fica de fora.
      const stats = taskTimeStats(
        { ...task, timeline, status: 'done', completedAt: now },
        at
      );

      await updateDoc(doc(db, 'tasks', taskId), {
        status: 'done',
        completedAt: now,
        isRework: false,
        approvalStartedAt: null,
        pausedMs,
        timeline,
        timeStats: {
          totalMs: stats.totalMs,
          queueMs: stats.queueMs,
          workMs: stats.workMs,
          reworkMs: stats.reworkMs,
          approvalMs: stats.approvalMs,
          byPerson: stats.byPerson,
          computedAt: now,
        },
      });
      return { success: true };
    } catch (err) { return { success: false, error: err.message }; }
  };

  // ── Reject (send back for rework) ───────────────────────────
  // Encerra o congelamento e devolve ao prazo o tempo útil que a task
  // passou esperando aprovação. Quem vai ajustar não herda o atraso de
  // quem demorou para revisar.
  const rejectTask = async (taskId, reworkNote, newResponsibleName, newResponsibleSector) => {
    try {
      const task = tasks.find(t => t.id === taskId);
      if (!task) throw new Error('Task não encontrada');
      const at = new Date();
      const now = at.toISOString();
      const reworkCount = (task.reworkCount || 0) + 1;
      const reworkComment = {
        id: `c_${Date.now()}`,
        author: task.responsibleName,
        sector: task.responsibleSector,
        text: `🔄 Ajuste necessário: ${reworkNote}`,
        createdAt: now,
        isRework: true,
      };
      const timeline = [...(task.timeline || []), {
        action: 'rejected',
        by: task.responsibleName,
        sector: task.responsibleSector,
        note: reworkNote,
        newResponsible: newResponsibleName,
        newResponsibleSector: newResponsibleSector,
        at: now,
      }];

      const pausedMs = (Number(task.pausedMs) || 0) + (
        task.approvalStartedAt ? businessMsBetween(task.approvalStartedAt, at) : 0
      );

      await updateDoc(doc(db, 'tasks', taskId), {
        status: 'doing',
        isRework: true,
        reworkCount,
        responsibleName: newResponsibleName,
        responsibleSector: newResponsibleSector,
        // Mantém o array plural em sincronia com o singular.
        responsibleNames: [newResponsibleName],
        responsibleSectors: [newResponsibleSector],
        // Reset deliveredBy so next approval cycle tracks correctly
        deliveredBy: null,
        deliveredBySector: null,
        // Sai do congelamento: o relógio do prazo volta a correr, já
        // descontado o tempo que ficou parado.
        approvalAt: null,
        approvalStartedAt: null,
        pausedMs,
        comments: [...(task.comments || []), reworkComment],
        timeline,
      });
      return { success: true };
    } catch (err) { return { success: false, error: err.message }; }
  };

  // ── Add comment ──────────────────────────────────────────────
  const addComment = async (taskId, author, sector, text) => {
    try {
      const task = tasks.find(t => t.id === taskId);
      if (!task) throw new Error('Task não encontrada');
      const newComment = {
        id: `c_${Date.now()}`,
        author, sector, text,
        createdAt: new Date().toISOString(),
        isRework: false,
      };
      await updateDoc(doc(db, 'tasks', taskId), {
        comments: [...(task.comments || []), newComment],
      });
      return { success: true };
    } catch (err) { return { success: false, error: err.message }; }
  };

  // ── Update links ─────────────────────────────────────────────
  const updateLinks = async (taskId, links) => {
    try {
      await updateDoc(doc(db, 'tasks', taskId), { links });
      return { success: true };
    } catch (err) { return { success: false, error: err.message }; }
  };

  // ── Alterar data de entrega (com justificativa) ─────────────
  // Registra na timeline E como comentário no chat da task.
  const changeDeadline = async (taskId, newDeadline, reason, byName, bySector) => {
    try {
      const task = tasks.find(t => t.id === taskId);
      if (!task) return { success: false, error: 'Task não encontrada.' };
      if (!reason || !reason.trim()) return { success: false, error: 'Justifique a mudança de data.' };
      const now = new Date().toISOString();
      const oldDeadline = task.deadline || '—';
      const timeline = [...(task.timeline || []), {
        action: 'deadline_changed',
        by: byName,
        sector: bySector,
        at: now,
        from: oldDeadline,
        to: newDeadline,
        reason: reason.trim(),
      }];
      const comments = [...(task.comments || []), {
        id: `c_${Date.now()}`,
        author: byName,
        sector: bySector,
        text: `📅 Data de entrega alterada de ${oldDeadline} para ${newDeadline}. Motivo: ${reason.trim()}`,
        createdAt: now,
        isSystem: true,
      }];
      await updateDoc(doc(db, 'tasks', taskId), { deadline: newDeadline, timeline, comments });
      return { success: true };
    } catch (err) { return { success: false, error: err.message }; }
  };

  // ── Delete task ──────────────────────────────────────────────
  const deleteTask = async (taskId) => {
    try {
      await deleteDoc(doc(db, 'tasks', taskId));
      return { success: true };
    } catch (err) { return { success: false, error: err.message }; }
  };

  // ── Helper: tasks visible to a user ─────────────────────────
  const getMyTasks = (userName) => {
    return tasks.filter(t =>
      t.responsibleName === userName ||
      (Array.isArray(t.responsibleNames) && t.responsibleNames.includes(userName)) ||
      t.requestedBy === userName ||
      t.deliveredBy === userName
    );
  };

  return {
    tasks, loading,
    createTask, moveToProduction, moveToApproval,
    approveTask, rejectTask, addComment, updateLinks, deleteTask,
    changeDeadline, getMyTasks,
  };
}
