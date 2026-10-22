import { useState, useEffect } from 'react';
import { doc, onSnapshot, arrayUnion, arrayRemove, deleteField } from 'firebase/firestore';
// Gravações passam pela trava contra loop (lib/gravacoes.js).
import { setDoc, updateDoc, runTransaction } from '../lib/gravacoes';
import { db } from '../lib/firebase';
import { chaveSdr } from '../lib/comercial';

/*
 * useComercial — dados do time comercial (Hunters) lançados à mão pelo
 * líder do comercial. O CRM é externo; aqui entra só o que a TV da
 * sala comercial e o painel precisam.
 *
 * Documentos (em `app_config`, que a TV anônima já pode ler):
 *
 *   app_config/comercial — controles da TV e o time:
 *     tvPaused, tvPauseMessage, tvLockScene, tvCelebrations, tvReloadToken,
 *     tvRadioUrl, tvRadioPlaying, tvRadioVolume, tvVisitMode,
 *     closers: [nome], sdrs: [nome]
 *
 *   app_config/comercial_AAAA-MM — um por mês:
 *     meta (R$), leads (qtd),
 *     metasCloser: { [chaveSdr(nome)]: R$ },  meta individual do mês
 *     metasSdr: { [chaveSdr(nome)]: qtd },    meta de agendamentos do SDR
 *     vendas: [{ id, closer, sdr?, cliente, valor, servico, data, by, at,
 *                editedBy?, editedAt? }],
 *     sdr: { [chaveSdr(nome)]: { agendados, realizados, noShow } },
 *     churn: [{ id, cliente, valorMensal, motivo, data, by, at }]
 *
 *   app_config/comercial_fotos — { [chaveSdr(nome)]: dataURL JPEG }
 *     Foto de cada pessoa do time para o pódio da TV. Fica num documento
 *     à parte (e não em app_config/comercial) para a TV não baixar as
 *     fotos de novo a cada pausa ou troca de rádio. Vai como imagem
 *     reduzida dentro do Firestore, e não no Storage, porque a TV entra
 *     anônima e já tem leitura em app_config — sem regra nova.
 *
 * O mês é o do calendário, como no resto do app.
 */

export const COMERCIAL_DEFAULTS = {
  tvPaused: false,
  tvPauseMessage: '',
  tvLockScene: '',
  tvCelebrations: true,
  tvReloadToken: 0,
  tvRadioUrl: '',
  tvRadioPlaying: false,
  tvRadioVolume: 50,
  tvVisitMode: false,
  closers: [],
  sdrs: [],
};

export const MES_VAZIO = { meta: 0, leads: 0, vendas: [], sdr: {}, churn: [] };

export const docDoMes = (mes) => `comercial_${mes}`;
export const DOC_FOTOS = 'comercial_fotos';

const novoId = (p) => `${p}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export function useComercial(mes) {
  const [config, setConfig] = useState(COMERCIAL_DEFAULTS);
  const [dadosMes, setDadosMes] = useState(MES_VAZIO);
  const [fotos, setFotos] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => onSnapshot(doc(db, 'app_config', 'comercial'), snap => {
    setConfig({ ...COMERCIAL_DEFAULTS, ...(snap.exists() ? snap.data() : {}) });
    setLoading(false);
  }, () => setLoading(false)), []);

  useEffect(() => onSnapshot(doc(db, 'app_config', DOC_FOTOS), snap => {
    setFotos(snap.exists() ? snap.data() : {});
  }, () => setFotos({})), []);

  useEffect(() => {
    if (!mes) return undefined;
    return onSnapshot(doc(db, 'app_config', docDoMes(mes)), snap => {
      setDadosMes({ ...MES_VAZIO, ...(snap.exists() ? snap.data() : {}) });
    }, () => setDadosMes(MES_VAZIO));
  }, [mes]);

  const ok = () => ({ success: true });
  const falha = (err) => ({ success: false, error: err.message });
  const refMes = () => doc(db, 'app_config', docDoMes(mes));

  const saveConfig = async (patch) => {
    try { await setDoc(doc(db, 'app_config', 'comercial'), patch, { merge: true }); return ok(); }
    catch (err) { return falha(err); }
  };

  const saveMes = async (patch) => {
    try { await setDoc(refMes(), patch, { merge: true }); return ok(); }
    catch (err) { return falha(err); }
  };

  const addVenda = async (venda, byName) => {
    const valor = Number(venda?.valor);
    if (!venda?.closer) return { success: false, error: 'Escolha o Closer.' };
    if (!String(venda?.cliente || '').trim()) return { success: false, error: 'Informe o cliente.' };
    if (!valor || valor <= 0) return { success: false, error: 'Informe o valor da venda.' };
    const item = {
      id: novoId('v'),
      closer: venda.closer,
      sdr: venda.sdr || '',
      cliente: String(venda.cliente).trim(),
      valor,
      servico: venda.servico || '',
      data: venda.data || '',
      by: byName || null,
      at: new Date().toISOString(),
    };
    try {
      await setDoc(refMes(), { vendas: arrayUnion(item) }, { merge: true });
      return ok();
    } catch (err) { return falha(err); }
  };

  // Editar reescreve o array inteiro numa transação (o Firestore não
  // atualiza um item de array no lugar). O id não muda, então a TV não
  // comemora de novo uma venda corrigida.
  const updateVenda = async (id, venda, byName) => {
    const valor = Number(venda?.valor);
    if (!venda?.closer) return { success: false, error: 'Escolha o Closer.' };
    if (!String(venda?.cliente || '').trim()) return { success: false, error: 'Informe o cliente.' };
    if (!valor || valor <= 0) return { success: false, error: 'Informe o valor da venda.' };
    try {
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(refMes());
        const lista = Array.isArray(snap.data()?.vendas) ? snap.data().vendas : [];
        if (!lista.some(v => v.id === id)) throw new Error('Essa venda não existe mais. Atualize a página.');
        const nova = lista.map(v => (v.id !== id ? v : {
          ...v,
          closer: venda.closer,
          sdr: venda.sdr || '',
          cliente: String(venda.cliente).trim(),
          valor,
          servico: venda.servico || '',
          data: venda.data || '',
          editedBy: byName || null,
          editedAt: new Date().toISOString(),
        }));
        tx.update(refMes(), { vendas: nova });
      });
      return ok();
    } catch (err) { return falha(err); }
  };

  const removeVenda = async (venda) => {
    try { await updateDoc(refMes(), { vendas: arrayRemove(venda) }); return ok(); }
    catch (err) { return falha(err); }
  };

  const addChurn = async (churn, byName) => {
    if (!String(churn?.cliente || '').trim()) return { success: false, error: 'Informe o cliente.' };
    const item = {
      id: novoId('c'),
      cliente: String(churn.cliente).trim(),
      valorMensal: Number(churn.valorMensal) || 0,
      motivo: String(churn.motivo || '').trim(),
      data: churn.data || '',
      by: byName || null,
      at: new Date().toISOString(),
    };
    try {
      await setDoc(refMes(), { churn: arrayUnion(item) }, { merge: true });
      return ok();
    } catch (err) { return falha(err); }
  };

  const removeChurn = async (item) => {
    try { await updateDoc(refMes(), { churn: arrayRemove(item) }); return ok(); }
    catch (err) { return falha(err); }
  };

  // Contadores do SDR (+1 / −1) em transação, para dois cliques juntos
  // não se sobrescreverem. Nunca fica negativo.
  const ajustarSdr = async (nome, campo, delta) => {
    try {
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(refMes());
        const k = chaveSdr(nome);
        const atual = Number(snap.exists() ? snap.data()?.sdr?.[k]?.[campo] || 0 : 0);
        const novo = Math.max(0, atual + Number(delta || 0));
        if (snap.exists()) tx.update(refMes(), { [`sdr.${k}.${campo}`]: novo });
        else tx.set(refMes(), { sdr: { [k]: { [campo]: novo } } }, { merge: true });
      });
      return ok();
    } catch (err) { return falha(err); }
  };

  const saveFoto = async (nome, dataUrl) => {
    try { await setDoc(doc(db, 'app_config', DOC_FOTOS), { [chaveSdr(nome)]: dataUrl }, { merge: true }); return ok(); }
    catch (err) { return falha(err); }
  };

  const removeFoto = async (nome) => {
    try { await setDoc(doc(db, 'app_config', DOC_FOTOS), { [chaveSdr(nome)]: deleteField() }, { merge: true }); return ok(); }
    catch (err) { return falha(err); }
  };

  return {
    config, dadosMes, fotos, loading,
    saveConfig, saveMes, addVenda, updateVenda, removeVenda, addChurn, removeChurn, ajustarSdr,
    saveFoto, removeFoto,
  };
}
