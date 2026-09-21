import { useState, useEffect, useMemo, useRef } from 'react';
import { collection, onSnapshot, doc } from 'firebase/firestore';
import { onAuthStateChanged, signInAnonymously } from 'firebase/auth';
import { db, auth } from '../lib/firebase';
import { mesChave } from '../lib/entregas';
import { resumoComercial } from '../lib/comercial';
import { COMERCIAL_DEFAULTS, MES_VAZIO, docDoMes } from './useComercial';

/*
 * useComercialTVData — alimenta a TV da sala comercial (/tv/comercial).
 *
 * Mesmas decisões da TV operacional (useTVData):
 *   · login anônimo, sem tela de login;
 *   · somente leitura;
 *   · controles ao vivo vindos de app_config/comercial (pausa, cena
 *     travada, modo visita, rádio, reload remoto).
 *
 * Diferença de propósito: esta TV fica na sala do comercial e MOSTRA
 * valores (meta em R$, vendas). O modo visita esconde todo R$ e toda
 * cena de alerta.
 */
export function useComercialTVData() {
  const [authReady, setAuthReady] = useState(false);
  const [authError, setAuthError] = useState('');
  const [online, setOnline] = useState(true);
  const [config, setConfig] = useState(COMERCIAL_DEFAULTS);
  const [dadosMes, setDadosMes] = useState(MES_VAZIO);
  const [clients, setClients] = useState([]);
  const [loadingMes, setLoadingMes] = useState(true);
  const [loadingClients, setLoadingClients] = useState(true);
  const [celebration, setCelebration] = useState(null);

  // Relógio de minuto: vira o mês, envelhece o ritmo.
  const [nowTs, setNowTs] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNowTs(Date.now()), 60000);
    return () => clearInterval(id);
  }, []);
  const mes = mesChave(new Date(nowTs));

  const seenVendasRef = useRef(null);
  const reloadTokenRef = useRef(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      if (u) { setAuthReady(true); return; }
      signInAnonymously(auth).catch((err) => {
        setAuthError(err.code === 'auth/operation-not-allowed'
          ? 'Login anônimo desabilitado no Firebase.'
          : 'Falha ao autenticar o painel.');
        setAuthReady(false);
      });
    });
    return unsub;
  }, []);

  // ── Controles da TV + time ───────────────────────────────────
  useEffect(() => {
    if (!authReady) return undefined;
    return onSnapshot(doc(db, 'app_config', 'comercial'), snap => {
      const d = snap.exists() ? snap.data() : {};
      setConfig({ ...COMERCIAL_DEFAULTS, ...d });
      const token = d.tvReloadToken || 0;
      if (reloadTokenRef.current === null) reloadTokenRef.current = token;
      else if (token > reloadTokenRef.current) window.location.reload();
    }, () => { /* falha na config nunca apaga a TV */ });
  }, [authReady]);

  // ── Lançamentos do mês ───────────────────────────────────────
  useEffect(() => {
    if (!authReady) return undefined;
    seenVendasRef.current = null; // mês novo: não comemora a carga inicial
    return onSnapshot(doc(db, 'app_config', docDoMes(mes)), snap => {
      const d = { ...MES_VAZIO, ...(snap.exists() ? snap.data() : {}) };
      const vendas = Array.isArray(d.vendas) ? d.vendas : [];
      const ids = new Set(vendas.map(v => v.id));
      if (seenVendasRef.current === null) {
        seenVendasRef.current = ids;
      } else {
        const nova = vendas.find(v => v.id && !seenVendasRef.current.has(v.id));
        seenVendasRef.current = ids;
        if (nova) setCelebration({ key: `${nova.id}_${Date.now()}`, ...nova });
      }
      setDadosMes(d);
      setLoadingMes(false);
      setOnline(true);
    }, () => { setLoadingMes(false); setOnline(false); });
  }, [authReady, mes]);

  // ── Clientes (carteira, contratos, churn registrado pela CS) ─
  useEffect(() => {
    if (!authReady) return undefined;
    return onSnapshot(collection(db, 'clients'), snap => {
      setClients(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoadingClients(false);
      setOnline(true);
    }, () => { setLoadingClients(false); setOnline(false); });
  }, [authReady]);

  const resumo = useMemo(
    () => resumoComercial({ config, dadosMes, clients, mes, agora: new Date(nowTs) }),
    [config, dadosMes, clients, mes, nowTs]
  );

  return {
    ...resumo,
    config,
    authError,
    online,
    loading: !authError && (!authReady || loadingMes || loadingClients),
    celebration: config.tvCelebrations !== false ? celebration : null,
    dismissCelebration: () => setCelebration(null),
  };
}
