import { useState, useEffect } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

/*
 * Config global do app. Documento app_config/general.
 * Por enquanto guarda a URL pública da agenda (Google Calendar embed).
 */
export function useAppConfig() {
  const [config, setConfig] = useState({ agendaEmbedUrl: '' });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const ref = doc(db, 'app_config', 'general');
    return onSnapshot(ref, snap => {
      if (snap.exists()) setConfig({ agendaEmbedUrl: '', ...snap.data() });
      setLoading(false);
    }, () => setLoading(false));
  }, []);

  const saveConfig = async (patch) => {
    try {
      await setDoc(doc(db, 'app_config', 'general'), patch, { merge: true });
      return { success: true };
    } catch (err) { return { success: false, error: err.message }; }
  };

  return { config, loading, saveConfig };
}
