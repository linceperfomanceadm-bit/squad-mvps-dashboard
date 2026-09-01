import { useState, useEffect } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

/*
 * Config global do app. Documento app_config/general.
 * Guarda a URL pública da agenda (Google Calendar embed) e os
 * controles do painel de TV da parede (/tv), que reage em tempo real.
 */
const DEFAULTS = {
  agendaEmbedUrl: '',
  tvPaused: false,        // true = TV mostra tela de espera
  tvPauseMessage: '',     // texto exibido na tela de espera
  tvLockScene: '',        // '' = rotação normal; id da cena = travado
  tvCelebrations: true,   // confete ao concluir entrega
  tvReloadToken: 0,       // muda de valor = todas as TVs recarregam
  tvRadioUrl: '',         // stream da rádio (mp3/aac/m3u8 direto)
  tvRadioPlaying: false,  // false = som parado na TV
  tvRadioVolume: 50,      // 0 a 100
  tvVisitMode: false,     // true = TV travada na tela de visita (só coisa boa)
  // Métrica de honra de cada squad na cena de Destaques. Cada squad é
  // comparado só consigo mesmo, na métrica que faz sentido pro ofício.
  tvHonorMetrics: {
    socialmedia: 'cobertura',
    webdesign: 'prazo',
    videomaker: 'primeira',
    design: 'entregas',
    trafego: 'constancia',
  },
};
export function useAppConfig() {
  const [config, setConfig] = useState(DEFAULTS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const ref = doc(db, 'app_config', 'general');
    return onSnapshot(ref, snap => {
      if (snap.exists()) setConfig({ ...DEFAULTS, ...snap.data() });
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
