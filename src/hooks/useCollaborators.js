import { useState, useEffect } from 'react';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, query, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';

export function useCollaborators(sectorFilter = null) {
  const [collaborators, setCollaborators] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'collaborators'), orderBy('createdAt', 'asc'));
    return onSnapshot(q, snap => {
      let data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      if (sectorFilter) data = data.filter(c => c.sector === sectorFilter);
      setCollaborators(data);
      setLoading(false);
    });
  }, [sectorFilter]);

  const addCollaborator = async (data) => {
    try {
      await addDoc(collection(db, 'collaborators'), { ...data, active: true, firstAccess: true, createdAt: serverTimestamp() });
      return { success: true };
    } catch (err) { return { success: false, error: err.message }; }
  };

  const updateCollaborator = async (id, data) => {
    try { await updateDoc(doc(db, 'collaborators', id), data); return { success: true }; }
    catch (err) { return { success: false, error: err.message }; }
  };

  const deleteCollaborator = async (id) => {
    try { await deleteDoc(doc(db, 'collaborators', id)); return { success: true }; }
    catch (err) { return { success: false, error: err.message }; }
  };

  return { collaborators, loading, addCollaborator, updateCollaborator, deleteCollaborator };
}
