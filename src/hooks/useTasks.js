import { useState, useEffect, useRef } from 'react';
import {
  collection, onSnapshot, addDoc, updateDoc,
  deleteDoc, doc, serverTimestamp, query, orderBy,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
 
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
            deliveredBy: null,
            deliveredBySector: null,
            approvalAt: null,
          }).catch(() => {}); // silencioso: se falhar, tenta na próxima carga
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
  // deliveredBy = who actually did the work (current responsible before handoff)
  const moveToApproval = async (taskId, approverName, approverSector, updatedLinks) => {
    try {
      const task = tasks.find(t => t.id === taskId);
      if (!task) throw new Error('Task não encontrada');
      // Guarda: sem aprovador explícito, não envia (evita gravar o
      // próprio executor como aprovador — origem do bug).
      if (!approverName || !approverSector) {
        return { success: false, error: 'Selecione quem vai aprovar antes de enviar.' };
      }
      const now = new Date().toISOString();
      const timeline = [...(task.timeline || []), {
        action: 'sent_for_approval',
        by: task.responsibleName,
        sector: task.responsibleSector,
        to: approverName,
        at: now,
      }];
      await updateDoc(doc(db, 'tasks', taskId), {
        status: 'approval',
        approvalAt: now,
        // Save who delivered before changing responsible to approver
        deliveredBy: task.responsibleName,
        deliveredBySector: task.responsibleSector,
        responsibleName: approverName,
        responsibleSector: approverSector,
        links: updatedLinks || task.links,
        timeline,
      });
      return { success: true };
    } catch (err) { return { success: false, error: err.message }; }
  };
 
  // ── Approve (complete) task ──────────────────────────────────
  const approveTask = async (taskId) => {
    try {
      const task = tasks.find(t => t.id === taskId);
      if (!task) throw new Error('Task não encontrada');
      const now = new Date().toISOString();
      const timeline = [...(task.timeline || []), {
        action: 'completed',
        by: task.responsibleName,
        sector: task.responsibleSector,
        at: now,
      }];
      await updateDoc(doc(db, 'tasks', taskId), {
        status: 'done',
        completedAt: now,
        isRework: false,
        timeline,
      });
      return { success: true };
    } catch (err) { return { success: false, error: err.message }; }
  };
 
  // ── Reject (send back for rework) ───────────────────────────
  const rejectTask = async (taskId, reworkNote, newResponsibleName, newResponsibleSector) => {
    try {
      const task = tasks.find(t => t.id === taskId);
      if (!task) throw new Error('Task não encontrada');
      const now = new Date().toISOString();
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
        note: reworkNote,
        newResponsible: newResponsibleName,
        at: now,
      }];
      await updateDoc(doc(db, 'tasks', taskId), {
        status: 'doing',
        isRework: true,
        reworkCount,
        responsibleName: newResponsibleName,
        responsibleSector: newResponsibleSector,
        // Reset deliveredBy so next approval cycle tracks correctly
        deliveredBy: null,
        deliveredBySector: null,
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
