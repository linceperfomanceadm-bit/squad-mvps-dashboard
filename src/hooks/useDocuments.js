import { useState, useEffect } from 'react';
import {
  collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc,
  serverTimestamp, query, orderBy,
} from 'firebase/firestore';
import { db } from '../lib/firebase';

// ─────────────────────────────────────────────────────────────
// Lince Docs — persistência
//
// Coleção `documents`. O documento inteiro (dados dos campos, slides
// extras, seções opcionais e pendências) vive num único registro:
// é o que o protótipo salvava em .json e agora atravessa sessões,
// máquinas e pessoas.
//
// Snapshot de versão a cada PDF gerado, na subcoleção `versions`.
//
// Como no Kanban, a lista é ao vivo e o editor lê o documento do
// array — assim uma edição feita por outra pessoa aparece na hora,
// sem um segundo listener.
// ─────────────────────────────────────────────────────────────

export const DOC_STATUS = {
  rascunho: { id: 'rascunho', label: 'Rascunho', color: '#52526e' },
  revisao: { id: 'revisao', label: 'Em Revisão', color: '#f59e0b' },
  aprovado: { id: 'aprovado', label: 'Aprovado', color: '#22c55e' },
  entregue: { id: 'entregue', label: 'Entregue', color: '#EE3363' },
};

export function useDocuments() {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'documents'), orderBy('updatedAt', 'desc'));
    return onSnapshot(q, (snap) => {
      setDocuments(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, () => setLoading(false));
  }, []);

  const createDocument = async ({ tipo, clientId, clientName, titulo, autorName, autorSector }) => {
    try {
      if (!tipo) return { success: false, error: 'Escolha o tipo de documento.' };
      if (!clientId) return { success: false, error: 'Escolha o cliente.' };
      const novo = {
        tipo,
        clientId,
        clientName: clientName || '',
        titulo: titulo || '',
        status: 'rascunho',
        // Conteúdo do documento
        dados: {},
        extras: [],
        opcionais: {},
        pendencias: [],
        // Janelas comparadas — regra 3.7, só o relatório usa
        periodoInicio: null,
        periodoFim: null,
        comparadoInicio: null,
        comparadoFim: null,
        // Autoria
        autorName: autorName || null,
        autorSector: autorSector || 'socialmedia',
        updatedByName: autorName || null,
        versionCount: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      const ref = await addDoc(collection(db, 'documents'), novo);
      return { success: true, id: ref.id };
    } catch (err) { return { success: false, error: err.message }; }
  };

  // Salvamento incremental. Quem chama controla o intervalo (o editor
  // usa debounce), então aqui não há espera nem fila.
  const updateDocument = async (id, patch, byName) => {
    try {
      await updateDoc(doc(db, 'documents', id), {
        ...patch,
        updatedAt: serverTimestamp(),
        ...(byName ? { updatedByName: byName } : {}),
      });
      return { success: true };
    } catch (err) { return { success: false, error: err.message }; }
  };

  const deleteDocument = async (id) => {
    try { await deleteDoc(doc(db, 'documents', id)); return { success: true }; }
    catch (err) { return { success: false, error: err.message }; }
  };

  // Congelamento a cada exportação: guarda o conteúdo daquele momento
  // para que a versão entregue ao cliente continue recuperável.
  const saveVersion = async (documento, byName) => {
    try {
      if (!documento?.id) return { success: false, error: 'Documento sem id.' };
      const numero = (documento.versionCount || 0) + 1;
      await addDoc(collection(db, 'documents', documento.id, 'versions'), {
        numero,
        dados: documento.dados || {},
        extras: documento.extras || [],
        opcionais: documento.opcionais || {},
        pendencias: documento.pendencias || [],
        autorName: byName || null,
        createdAt: serverTimestamp(),
      });
      await updateDoc(doc(db, 'documents', documento.id), {
        versionCount: numero,
        lastExportAt: new Date().toISOString(),
        lastExportBy: byName || null,
        updatedAt: serverTimestamp(),
      });
      return { success: true, numero };
    } catch (err) { return { success: false, error: err.message }; }
  };

  return { documents, loading, createDocument, updateDocument, deleteDocument, saveVersion };
}
