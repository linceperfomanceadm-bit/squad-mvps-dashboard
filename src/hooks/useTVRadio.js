import { useState, useEffect, useRef, useCallback } from 'react';

/*
 * useTVRadio — o som das TVs (/tv e /tv/comercial).
 *
 * URL, play/pause e volume vêm do admin (app_config). Este hook só cuida
 * de fazer o <audio> obedecer, e de três coisas que a parede exige:
 *
 * 1. DESBLOQUEIO PELO CONTROLE. O navegador não deixa site nenhum tocar
 *    som sem um gesto de quem está na frente da tela. Antes, só um clique
 *    no botão "Ligar som" valia — e no controle remoto da TV o botão nunca
 *    ganhava foco, então apertar OK, setas ou números não fazia nada.
 *    Agora qualquer tecla, toque ou clique em qualquer lugar da página
 *    serve de gesto. Os eventos são os que o Chrome aceita como gesto
 *    (keydown, mousedown, pointerdown/up, touchend, click) — touchstart
 *    e keyup não contam, por isso ficam de fora.
 *
 * 2. BLOQUEIO ≠ LINK QUEBRADO. Antes, qualquer falha virava "Ligar som",
 *    e se o problema era o stream (link da página do player, http sem
 *    https, formato que o navegador não toca) o botão ficava ali para
 *    sempre sem efeito. Só NotAllowedError é bloqueio; o resto é
 *    "sem sinal".
 *
 * 3. RECONEXÃO. Stream de rádio cai. Sem sinal, a TV tenta de novo a
 *    cada 20 s sozinha — ninguém precisa ir até a parede.
 *
 * status: 'parado' | 'tocando' | 'bloqueado' | 'sem-sinal'
 */

const EVENTOS_GESTO = ['keydown', 'mousedown', 'pointerdown', 'pointerup', 'touchend', 'click'];
const RETENTAR_MS = 20000;

export function useTVRadio({ url, playing, volume }) {
  const audioRef = useRef(null);
  const [status, setStatus] = useState('parado');
  const ativo = !!url && playing === true;

  const tocar = useCallback(() => {
    const el = audioRef.current; if (!el) return;
    // Depois de um erro o <audio> não sai do lugar sem um load() novo.
    if (el.error) el.load();
    const p = el.play();
    if (!p || typeof p.then !== 'function') return; // navegador antigo de TV
    p.then(() => setStatus('tocando')).catch(err => {
      const nome = err && err.name;
      // AbortError = o próprio app pausou/trocou a rádio no meio; não é falha.
      if (nome === 'AbortError') return;
      setStatus(nome === 'NotAllowedError' ? 'bloqueado' : 'sem-sinal');
    });
  }, []);

  // Volume (0–100 no admin → 0–1 no <audio>). Reaplica quando a rádio troca,
  // porque o <audio> é recriado (key={url}).
  useEffect(() => {
    const el = audioRef.current; if (!el) return;
    const v = Number(volume);
    el.volume = Math.min(1, Math.max(0, (Number.isFinite(v) ? v : 50) / 100));
  }, [volume, url]);

  // Play/pause comandado pelo admin.
  useEffect(() => {
    const el = audioRef.current;
    if (!ativo) { if (el) el.pause(); setStatus('parado'); return; }
    tocar();
  }, [ativo, url, tocar]);

  // O stream avisa quando volta a tocar ou quando cai.
  useEffect(() => {
    const el = audioRef.current;
    if (!el || !ativo) return undefined;
    const voltou = () => setStatus('tocando');
    const caiu = () => setStatus('sem-sinal');
    el.addEventListener('playing', voltou);
    el.addEventListener('error', caiu);
    el.addEventListener('ended', caiu); // rádio ao vivo não "acaba": se acabou, caiu
    return () => {
      el.removeEventListener('playing', voltou);
      el.removeEventListener('error', caiu);
      el.removeEventListener('ended', caiu);
    };
  }, [ativo, url]);

  // Bloqueado: qualquer botão do controle (ou clique/toque) libera o som.
  useEffect(() => {
    if (status !== 'bloqueado') return undefined;
    const destravar = () => tocar();
    EVENTOS_GESTO.forEach(ev => window.addEventListener(ev, destravar, true));
    return () => EVENTOS_GESTO.forEach(ev => window.removeEventListener(ev, destravar, true));
  }, [status, tocar]);

  // Sem sinal: tenta reconectar sozinho enquanto a rádio estiver ligada no admin.
  useEffect(() => {
    if (status !== 'sem-sinal' || !ativo) return undefined;
    const id = setInterval(tocar, RETENTAR_MS);
    return () => clearInterval(id);
  }, [status, ativo, tocar]);

  return { audioRef, status, liberarSom: tocar };
}
