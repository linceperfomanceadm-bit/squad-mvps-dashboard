import { useState, useEffect, useMemo, useRef } from 'react';
import { collection, query, where, onSnapshot, doc } from 'firebase/firestore';
import { onAuthStateChanged, signInAnonymously } from 'firebase/auth';
import { db, auth } from '../lib/firebase';
import { mesChave } from '../lib/entregas';
import { resumoComercial } from '../lib/comercial';
import { COMERCIAL_DEFAULTS, MES_VAZIO, docDoMes, DOC_FOTOS } from './useComercial';
import { isTaskOverdue, overdueDays } from './useClientHealth';

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
 *
 * Tasks em atraso: mesmo listener estreito da TV operacional (só status
 * em aberto, sem orderBy) e a mesma régua de atraso (isTaskOverdue), para
 * o número bater com o que a operação vê.
 */

const OPEN_STATUSES = ['todo', 'doing', 'approval'];

// Clientes com task atrasada: quantas tasks e o maior atraso, do pior
// para o melhor. Task sem cliente fica de fora — o card é por cliente.
function atrasosPorCliente(tasks, clients, now) {
  const nomes = {};
  clients.forEach(c => { nomes[c.id] = c.name; });
  const mapa = {};
  tasks.forEach(t => {
    if (!isTaskOverdue(t, now)) return;
    const chave = t.clientId || t.clientName;
    if (!chave) return;
    if (!mapa[chave]) mapa[chave] = { id: chave, nome: nomes[t.clientId] || t.clientName || 'Cliente', tasks: 0, dias: 0 };
    mapa[chave].tasks += 1;
    mapa[chave].dias = Math.max(mapa[chave].dias, overdueDays(t, now));
  });
  return Object.values(mapa).sort((a, b) => b.tasks - a.tasks || b.dias - a.dias || a.nome.localeCompare(b.nome));
}
export function useComercialTVData() {
  const [authReady, setAuthReady] = useState(false);
  const [authError, setAuthError] = useState('');
  const [online, setOnline] = useState(true);
  const [config, setConfig] = useState(COMERCIAL_DEFAULTS);
  const [dadosMes, setDadosMes] = useState(MES_VAZIO);
  const [clients, setClients] = useState([]);
  const [openTasks, setOpenTasks] = useState([]);
  const [fotos, setFotos] = useState({});
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

  // ── Tasks em aberto (card "Tasks em atraso" do Sinal vermelho) ─
  useEffect(() => {
    if (!authReady) return undefined;
    const q = query(collection(db, 'tasks'), where('status', 'in', OPEN_STATUSES));
    return onSnapshot(q, snap => {
      setOpenTasks(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, () => { /* sem tasks, o card só fica vazio */ });
  }, [authReady]);

  // ── Fotos do time (pódio e comemoração) ──────────────────────
  useEffect(() => {
    if (!authReady) return undefined;
    return onSnapshot(doc(db, 'app_config', DOC_FOTOS), snap => {
      setFotos(snap.exists() ? snap.data() : {});
    }, () => { /* sem foto, o pódio usa as iniciais */ });
  }, [authReady]);

  const resumo = useMemo(
    () => resumoComercial({ config, dadosMes, clients, mes, agora: new Date(nowTs) }),
    [config, dadosMes, clients, mes, nowTs]
  );

  const atrasos = useMemo(() => atrasosPorCliente(openTasks, clients, new Date(nowTs)), [openTasks, clients, nowTs]);

  return {
    ...resumo,
    atrasos,
    fotos,
    config,
    authError,
    online,
    loading: !authError && (!authReady || loadingMes || loadingClients),
    celebration: config.tvCelebrations !== false ? celebration : null,
    dismissCelebration: () => setCelebration(null),
  };
}
