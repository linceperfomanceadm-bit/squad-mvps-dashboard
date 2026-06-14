import { useState, useEffect } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

/*
 * Scripts de WhatsApp do SDR — cada SDR mantém os seus.
 * Documento: sdr_scripts/{authUid} = { scripts: [{id,title,text}] }
 *
 * Variáveis suportadas no texto: {nome_lead} e {nome_sdr}.
 */
export function useSDRScripts(authUid) {
  const [scripts, setScripts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authUid) { setLoading(false); return; }
    const ref = doc(db, 'sdr_scripts', authUid);
    return onSnapshot(ref, snap => {
      setScripts(snap.exists() ? (snap.data().scripts || []) : []);
      setLoading(false);
    });
  }, [authUid]);

  const save = async (next) => {
    try {
      await setDoc(doc(db, 'sdr_scripts', authUid), { scripts: next }, { merge: true });
      return { success: true };
    } catch (err) { return { success: false, error: err.message }; }
  };

  const addScript = (title, text) =>
    save([...scripts, { id: `s_${Date.now()}`, title: title.trim(), text: text.trim() }]);

  const updateScript = (id, patch) =>
    save(scripts.map(s => s.id === id ? { ...s, ...patch } : s));

  const removeScript = (id) =>
    save(scripts.filter(s => s.id !== id));

  return { scripts, loading, addScript, updateScript, removeScript };
}

// Injeta variáveis no texto do script.
export function fillScript(text, { leadName, sdrName }) {
  return (text || '')
    .replace(/\{nome_lead\}/gi, leadName || '')
    .replace(/\{nome_sdr\}/gi, sdrName || '');
}

// Monta a URL wa.me com texto pré-preenchido.
export function waLink(phoneDigits, message) {
  const base = `https://wa.me/${phoneDigits || ''}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}
