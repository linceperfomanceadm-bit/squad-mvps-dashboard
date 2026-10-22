import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Trophy, Target, Flame, Users, CalendarClock, HeartCrack, TrendingUp, TrendingDown,
  Volume2, PauseCircle, Check, UserX, BadgeDollarSign, AlarmClock, ChevronRight,
} from 'lucide-react';
import { useComercialTVData } from '../hooks/useComercialTVData';
import { COMERCIAL_TEAM, SDR_PONTOS } from '../lib/firebase';
import { chaveSdr } from '../lib/comercial';

/*
 * TVComercial — painel de parede da sala comercial (rota /tv/comercial).
 *
 * Irmão da TV operacional (/tv): mesmo palco fixo de 1920×1080
 * escalado, mesmas unidades de container, mesmos controles remotos
 * (pausa, cena travada, modo visita, rádio, reload). Identidade própria
 * do time Hunters: grafite, prata e o dourado do emblema — que aparece
 * só onde é conquista (meta, 1º lugar, venda fechada).
 *
 * DIFERENÇA DELIBERADA: esta TV fica na sala do comercial e mostra R$.
 * O modo visita trava numa tela institucional sem nenhum valor e sem
 * nada da cena de alerta (churn, risco, contrato vencendo).
 *
 * A barra da meta fica fixa no topo em todas as cenas: é o número que
 * o time precisa ver o tempo inteiro. Exceção: na cena dos SDRs o funil
 * do mês ocupa esse lugar — é o número que importa para quem agenda.
 *
 * Pódio (Closers e SDRs): card em pé com a foto inteira da pessoa, a
 * pata da Lince no lugar do troféu (ouro, prata, bronze), o nome sobre a
 * foto e o valor encaixado na borda de baixo. Sem foto, as iniciais
 * ocupam o fundo do card. O ranking completo fica ao lado do pódio — em
 * pé, os cards não cabem com o ranking embaixo.
 */

const ROTATION = [
  { id: 'meta',     title: 'Meta do mês',        duration: 22000 },
  { id: 'closers',  title: 'Ranking de Closers',  duration: 20000 },
  { id: 'sdrs',     title: 'Ranking de SDRs',     duration: 20000 },
  { id: 'carteira', title: 'Carteira e vendas',   duration: 18000 },
  { id: 'alerta',   title: 'Sinal vermelho',      duration: 20000 },
];
const VISIT = { id: 'visit', title: 'Time comercial', duration: 0 };

const GOLD = '#E6B422';
const CONFETTI = [GOLD, '#f4f6f9', '#cfd5dd', '#ffd966', '#9aa3ae'];

const brl = (n) => (Number(n) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const pad2 = (n) => String(n).padStart(2, '0');
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const iniciais = (nome) => String(nome || '?').trim().split(/\s+/).slice(0, 2).map(p => p[0]).join('').toUpperCase();
const ago = (iso, nowTs) => {
  if (!iso) return '';
  const m = Math.round((nowTs - new Date(iso).getTime()) / 60000);
  if (m < 1) return 'agora';
  if (m < 60) return `há ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `há ${h} h`;
  return `há ${Math.floor(h / 24)} d`;
};

const CSS = `
.hc-root{position:fixed;inset:0;background:#08090b;overflow:hidden;font-family:'Lexend',sans-serif;color:#eef1f5}
.hc-stage{position:absolute;top:50%;left:50%;width:1920px;height:1080px;container-type:size;overflow:hidden;display:flex;flex-direction:column;padding:1.6cqw 1.8cqw;
  background:radial-gradient(1100px 800px at 85% -10%,#1d2330 0%,transparent 60%),radial-gradient(900px 600px at 0% 110%,#231d0c 0%,transparent 55%),linear-gradient(170deg,#121419 0%,#0b0c0f 100%)}
@keyframes hcfade{from{opacity:0;transform:translateY(.6cqw)}to{opacity:1;transform:none}}
@keyframes hcpop{0%{opacity:0;transform:scale(.92)}60%{transform:scale(1.02)}100%{opacity:1;transform:scale(1)}}
@keyframes hcfall{0%{transform:translateY(-12cqh) rotate(0);opacity:1}100%{transform:translateY(106cqh) rotate(720deg);opacity:0}}
@keyframes hcprog{from{width:0}to{width:100%}}
@keyframes hcblink{0%,100%{opacity:1}50%{opacity:.25}}
@keyframes hcshine{0%{transform:translateX(-100%)}100%{transform:translateX(400%)}}

.hc-prog{position:absolute;top:0;left:0;right:0;height:3px;z-index:9}
.hc-prog>div{height:100%;background:linear-gradient(90deg,#9aa3ae,${GOLD})}

.hc-hdr{display:flex;align-items:center;gap:1.2cqw;flex-shrink:0;margin-bottom:1cqw}
.hc-logo{height:4.4cqw;filter:drop-shadow(0 8px 20px rgba(0,0,0,.6))}
.hc-kick{font-size:.82cqw;color:#a3aab5;letter-spacing:.02em}
.hc-hdr h1{font-family:'Unbounded',sans-serif;font-size:2.2cqw;font-weight:500;letter-spacing:-.01em;margin:.2cqw 0 0}
.hc-dots{display:flex;gap:.45cqw;margin-top:.55cqw}
.hc-dots i{width:1.6cqw;height:.28cqw;border-radius:99px;background:rgba(255,255,255,.12)}
.hc-dots i.on{background:${GOLD}}
.hc-right{margin-left:auto;display:flex;align-items:center;gap:.9cqw}
.hc-pill{background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.08);border-radius:999px;padding:.55cqw 1cqw;font-size:.85cqw;color:#c3c9d2}
.hc-clock{font-family:'Unbounded',sans-serif;font-size:2.1cqw;font-weight:400;line-height:1}
.hc-live{width:.5cqw;height:.5cqw;border-radius:50%;background:#4ade80;box-shadow:0 0 10px #4ade80;animation:hcblink 2.4s ease-in-out infinite}
.hc-live.off{background:#ff5c6c;box-shadow:0 0 10px #ff5c6c;animation:none}

.hc-card{background:rgba(255,255,255,.045);border:1px solid rgba(255,255,255,.08);border-radius:1.4cqw;position:relative;overflow:hidden;min-height:0}
@keyframes hcrise{from{opacity:0;transform:translateY(1.2cqw)}to{opacity:1;transform:none}}
.hc-t{font-size:1cqw;color:#c3c9d2;display:flex;align-items:center;gap:.5cqw;margin:0}
.hc-cnt{margin-left:auto;font-family:'Unbounded',sans-serif;font-size:.85cqw;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.09);border-radius:999px;padding:.2cqw .7cqw}

.hc-meta{flex-shrink:0;display:grid;grid-template-columns:22cqw 1fr 30cqw;gap:2cqw;align-items:center;padding:1.3cqw 1.8cqw;margin-bottom:1cqw;min-height:8.2cqw}
.hc-meta .lbl{font-size:.85cqw;color:#a3aab5}
.hc-meta .big{font-family:'Unbounded',sans-serif;font-size:2.7cqw;font-weight:500;letter-spacing:-.02em;line-height:1.05;margin-top:.35cqw}
.hc-meta .de{font-size:.95cqw;color:#a3aab5;margin-top:.3cqw}
.hc-barwrap{position:relative}
.hc-bar{height:1.5cqw;border-radius:999px;background:rgba(255,255,255,.07);overflow:hidden;position:relative}
.hc-bar i{display:block;height:100%;border-radius:999px;background:linear-gradient(90deg,#8a6a10,${GOLD});position:relative;overflow:hidden}
.hc-bar i::after{content:'';position:absolute;top:0;bottom:0;width:25%;background:linear-gradient(90deg,transparent,rgba(255,255,255,.35),transparent);animation:hcshine 3.5s ease-in-out infinite}
.hc-bar.silver i{background:linear-gradient(90deg,#4b515b,#cfd5dd)}
.hc-mark{position:absolute;top:-.5cqw;width:2px;height:2.5cqw;background:#f4f6f9;border-radius:2px}
.hc-mark span{position:absolute;top:-1.5cqw;left:50%;transform:translateX(-50%);font-size:.7cqw;color:#a3aab5;white-space:nowrap}
.hc-pct{display:flex;justify-content:space-between;align-items:baseline;margin-top:.7cqw}
.hc-pct b{font-family:'Unbounded',sans-serif;font-size:1.9cqw;font-weight:500}
.hc-pct span{font-size:.85cqw;color:#a3aab5}
.hc-mstats{display:grid;grid-template-columns:repeat(3,1fr);gap:1.2cqw}
.hc-ms .v{font-family:'Unbounded',sans-serif;font-size:1.45cqw;font-weight:500;line-height:1.1}
.hc-ms .l{font-size:.75cqw;color:#a3aab5;margin-top:.35cqw}

.hc-funbar{grid-template-columns:1fr 7.5cqw 1fr 7.5cqw 1fr 7.5cqw 1fr;gap:1.2cqw}
.hc-fb .big{display:flex;align-items:baseline;gap:.6cqw}
.hc-fb .big small{font-family:'Lexend',sans-serif;font-size:.8cqw;font-weight:300;color:#8b919c;letter-spacing:0}
.hc-fb .hc-bar{height:.55cqw;margin-top:.8cqw}
.hc-fc{display:flex;flex-direction:column;align-items:center;gap:.2cqw;color:#5d636d}
.hc-fc b{font-family:'Unbounded',sans-serif;font-size:1.15cqw;font-weight:500;color:#eef1f5}
.hc-fc span{font-size:.72cqw;color:#8b919c}

.hc-grid{flex:1;display:grid;gap:1cqw;min-height:0;animation:hcfade .5s ease both}
.hc-grid.meta{grid-template-columns:1.5fr 1fr}
.hc-grid.closers,.hc-grid.sdrs{grid-template-columns:minmax(0,1.42fr) minmax(0,1fr)}
.hc-grid.carteira{grid-template-columns:1fr 1.25fr}
.hc-grid.alerta{grid-template-columns:repeat(4,1fr)}
.hc-grid.visit{grid-template-columns:1fr}
.hc-pad{padding:1.3cqw 1.6cqw;display:flex;flex-direction:column;min-height:0}

.hc-chart{flex:1;min-height:0;margin-top:1cqw;position:relative}
.hc-chart svg{position:absolute;inset:0;width:100%;height:100%;display:block;overflow:visible}
.hc-chart .tag{position:absolute;transform:translate(-50%,-150%);background:${GOLD};color:#1a1405;font-family:'Unbounded',sans-serif;font-size:.85cqw;font-weight:600;border-radius:999px;padding:.35cqw .8cqw;white-space:nowrap;box-shadow:0 6px 18px rgba(0,0,0,.45)}
.hc-chart .tag small{font-family:'Lexend',sans-serif;font-weight:400;font-size:.7cqw;margin-left:.35cqw;opacity:.75}
.hc-chart .goal{position:absolute;transform:translate(-100%,-150%);font-size:.78cqw;color:#c3c9d2;white-space:nowrap}
.hc-chart .goal b{font-family:'Unbounded',sans-serif;font-weight:500;margin-left:.3cqw}
.hc-legend{display:flex;gap:1.4cqw;font-size:.78cqw;color:#a3aab5;margin-top:.6cqw}
.hc-legend i{display:inline-block;width:1.2cqw;height:.25cqw;border-radius:2px;margin-right:.4cqw;vertical-align:middle}
.hc-col{display:grid;grid-template-rows:repeat(3,1fr);gap:1cqw;min-height:0}
.hc-tile{padding:1.2cqw 1.6cqw;display:flex;flex-direction:column;justify-content:center}
.hc-tile .v{font-family:'Unbounded',sans-serif;font-size:2.6cqw;font-weight:500;line-height:1;letter-spacing:-.02em}
.hc-tile .l{font-size:.9cqw;color:#a3aab5;margin-top:.6cqw;display:flex;align-items:center;gap:.45cqw}

.hc-podium{display:grid;grid-template-columns:1fr 1.12fr 1fr;gap:1.2cqw;min-height:0;align-items:end}
.hc-slot{display:flex;flex-direction:column;align-items:center;min-width:0;animation:hcrise .6s ease both}
.hc-slot.first{animation-delay:.12s}
.hc-slot.p3{animation-delay:.24s}
.hc-pc{position:relative;width:100%;aspect-ratio:2/3;border-radius:1.4cqw;overflow:hidden;background:radial-gradient(120% 90% at 50% 18%,#232832 0%,#0d0e11 70%);border:1px solid rgba(255,255,255,.1);box-shadow:0 1.2cqw 3cqw rgba(0,0,0,.5)}
.hc-slot.first .hc-pc{border:2px solid rgba(230,180,34,.65);box-shadow:0 0 2.4cqw rgba(230,180,34,.16),0 1.2cqw 3cqw rgba(0,0,0,.5)}
.hc-pc::after{content:'';position:absolute;inset:0;background:linear-gradient(180deg,rgba(8,9,11,0) 48%,rgba(8,9,11,.82) 100%);pointer-events:none}
.hc-pcph{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:50% 30%}
.hc-pcav{position:absolute;left:50%;top:42%;transform:translate(-50%,-50%);font-family:'Unbounded',sans-serif;font-size:7cqw;font-weight:700;letter-spacing:-.03em;color:rgba(207,213,221,.13);line-height:1}
.hc-slot.first .hc-pcav{color:rgba(230,180,34,.2)}
.hc-paw{position:absolute;top:1.1cqw;left:1.1cqw;z-index:2;width:4.4cqw;height:auto;filter:drop-shadow(0 .35cqw .8cqw rgba(0,0,0,.6))}
.hc-slot.first .hc-paw{width:5cqw}
.hc-pcnm{position:absolute;left:0;right:0;bottom:2.1cqw;z-index:2;padding:0 1cqw;text-align:center;font-family:'Unbounded',sans-serif;font-weight:700;font-size:2.2cqw;letter-spacing:-.02em;line-height:1.05;color:#fff;text-shadow:0 .3cqw 1.4cqw rgba(0,0,0,.65);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.hc-slot.first .hc-pcnm{font-size:2.5cqw;bottom:2.4cqw}
.hc-pcv{position:relative;z-index:3;margin-top:-1.2cqw;font-family:'Unbounded',sans-serif;font-weight:600;font-size:2.4cqw;line-height:1;letter-spacing:-.02em;color:#eef1f5;text-shadow:0 .3cqw 1.4cqw rgba(0,0,0,.75);display:flex;align-items:baseline;gap:.5cqw;white-space:nowrap}
.hc-slot.first .hc-pcv{color:${GOLD};font-size:2.9cqw;margin-top:-1.45cqw}
.hc-pcv small{font-family:'Lexend',sans-serif;font-size:.95cqw;font-weight:300;color:#a3aab5;letter-spacing:0;text-shadow:none}
.hc-pcs{display:flex;flex-direction:column;align-items:center;gap:.5cqw;margin-top:.6cqw;font-size:.85cqw;color:#a3aab5;white-space:nowrap}
.hc-chip{font-size:.8cqw;color:#c3c9d2;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);border-radius:999px;padding:.22cqw .8cqw}
.hc-chip b{font-family:'Unbounded',sans-serif;font-weight:500;margin-right:.3cqw;color:#eef1f5}
.hc-chip.gold{background:rgba(230,180,34,.14);border-color:rgba(230,180,34,.45)}
.hc-chip.gold b{color:${GOLD}}

.hc-rlist{flex:1;display:flex;flex-direction:column;gap:.6cqw;margin-top:1cqw;min-height:0}
.hc-ri{flex:1 1 0;min-height:0;max-height:7cqw;display:grid;grid-template-columns:2cqw 2.8cqw minmax(0,1fr);gap:.9cqw;align-items:center;padding:.5cqw 1.2cqw;border-radius:1cqw;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.05)}
.hc-ri.lead{border-color:rgba(230,180,34,.35)}
.hc-ri.lead .hc-rk{color:${GOLD}}
.hc-ri .top{display:flex;align-items:baseline;justify-content:space-between;gap:1cqw;min-width:0}
.hc-ri .nm{font-size:1.15cqw;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.hc-ri .val{font-family:'Unbounded',sans-serif;font-size:1.35cqw;font-weight:500;white-space:nowrap}
.hc-ri .val small{font-family:'Lexend',sans-serif;font-size:.75cqw;font-weight:300;color:#8b919c;margin-left:.35cqw}
.hc-ri .sub{font-size:.78cqw;color:#8b919c;margin-top:.4cqw;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.hc-ri .sub b{font-weight:400;color:#c3c9d2}
.hc-ri .sub .red{color:#ff5c6c}
.hc-ating{display:flex;align-items:center;gap:.9cqw;min-width:0;margin-top:.55cqw}
.hc-abar{position:relative;flex:1}
.hc-abar .hc-bar{height:.75cqw}
.hc-tick{position:absolute;top:-.3cqw;bottom:-.3cqw;width:2px;border-radius:2px;background:rgba(244,246,249,.75)}
.hc-ating b{font-family:'Unbounded',sans-serif;font-size:1.05cqw;font-weight:500;min-width:3.8cqw;text-align:right}
.hc-bar2{height:.45cqw;border-radius:999px;background:rgba(255,255,255,.07);overflow:hidden}
.hc-bar2 i{display:block;height:100%;border-radius:999px;background:linear-gradient(90deg,#6b7280,#cfd5dd)}
.hc-rk{font-family:'Unbounded',sans-serif;font-size:.95cqw;color:#8b919c}
.hc-mav{width:2.8cqw;height:2.8cqw;border-radius:50%;flex-shrink:0;object-fit:cover;object-position:50% 18%;border:1px solid rgba(255,255,255,.14);background:radial-gradient(circle at 30% 25%,#2b3039,#121418 70%);display:grid;place-items:center;font-family:'Unbounded',sans-serif;font-size:.95cqw;font-weight:500;color:#cfd5dd}
.hc-legrow{display:flex;align-items:center;gap:.5cqw;margin-left:auto;font-size:.75cqw;color:#8b919c}
.hc-legrow i{display:inline-block;width:2px;height:.9cqw;background:rgba(244,246,249,.75);border-radius:2px}

.hc-feed{flex:1;display:flex;flex-direction:column;gap:.5cqw;margin-top:.9cqw;min-height:0}
.hc-fi{display:grid;grid-template-columns:4cqw 1fr auto auto;gap:1.1cqw;align-items:center;padding:.55cqw 1cqw;border-radius:.9cqw;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.05)}
.hc-fi .nm{font-size:1.05cqw;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.hc-fi .sub{font-size:.78cqw;color:#8b919c;margin-top:.2cqw;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.hc-fi .sub em{font-style:normal;color:#c3c9d2}
.hc-duo{position:relative;width:4cqw;height:2.9cqw}
.hc-duo .hc-mav:first-child{width:2.9cqw;height:2.9cqw;position:absolute;left:0;top:0;font-size:.85cqw}
.hc-duo .hc-mav+.hc-mav{width:1.75cqw;height:1.75cqw;position:absolute;right:0;bottom:-.2cqw;font-size:.6cqw;border:2px solid #121419}
.hc-fi .v{font-family:'Unbounded',sans-serif;font-size:1.2cqw;font-weight:500}
.hc-fi .t{font-size:.8cqw;color:#8b919c;min-width:5cqw;text-align:right}

.hc-alert{border-color:rgba(255,92,108,.22);background:linear-gradient(180deg,rgba(255,92,108,.07),rgba(255,255,255,.03))}
.hc-alert.warn{border-color:rgba(255,194,87,.22);background:linear-gradient(180deg,rgba(255,194,87,.06),rgba(255,255,255,.03))}
.hc-alert.ok{border-color:rgba(255,255,255,.08);background:rgba(255,255,255,.045)}
.hc-anum{font-family:'Unbounded',sans-serif;font-size:4.2cqw;font-weight:500;line-height:1;margin-top:1cqw}
.hc-asub{font-size:.95cqw;color:#a3aab5;margin-top:.5cqw;min-height:2.6cqw}
.hc-alist{flex:1;display:flex;flex-direction:column;gap:.4cqw;margin-top:1.1cqw;min-height:0;overflow:hidden}
.hc-ai{display:flex;justify-content:space-between;align-items:center;gap:1cqw;padding:.55cqw .9cqw;border-radius:.8cqw;background:rgba(0,0,0,.2);font-size:.95cqw}
.hc-ai b{font-family:'Unbounded',sans-serif;font-weight:500;color:#ff5c6c;margin-left:.4cqw}
.hc-ai span:first-child{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.hc-ai span:last-child{color:#a3aab5;white-space:nowrap;font-size:.85cqw}
.hc-empty{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:.8cqw;color:#4ade80;text-align:center;font-size:1.1cqw}

.hc-visit{display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:2cqw}
.hc-visit img{height:26cqh;filter:drop-shadow(0 30px 60px rgba(0,0,0,.6))}
.hc-visit h2{font-family:'Unbounded',sans-serif;font-size:3.2cqw;font-weight:500;margin:2cqh 0 .6cqh;letter-spacing:-.02em}
.hc-visit p{font-size:1.2cqw;color:#a3aab5}
.hc-vstats{display:flex;gap:5cqw;margin-top:5cqh}
.hc-vstats .v{font-family:'Unbounded',sans-serif;font-size:3.6cqw;font-weight:500;line-height:1}
.hc-vstats .l{font-size:1cqw;color:#a3aab5;margin-top:1cqh}

.hc-party{position:absolute;inset:0;z-index:50;background:rgba(8,9,11,.97);display:flex;align-items:center;justify-content:center;overflow:hidden;animation:hcpop .5s ease both}
.hc-cf{position:absolute;top:0;border-radius:2px;display:block}
.hc-cph{height:38cqh;aspect-ratio:3/4;object-fit:cover;object-position:50% 20%;display:block;margin:0 auto;
  -webkit-mask-image:linear-gradient(180deg,#000 55%,transparent 98%),linear-gradient(90deg,transparent 0,#000 22%,#000 78%,transparent 100%);-webkit-mask-composite:source-in;
  mask-image:linear-gradient(180deg,#000 55%,transparent 98%),linear-gradient(90deg,transparent 0,#000 22%,#000 78%,transparent 100%);mask-composite:intersect}
.hc-standby{position:absolute;inset:0;z-index:60;background:#08090b;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3cqh}
.hc-sound{position:absolute;right:2cqw;bottom:2cqw;z-index:40;display:flex;align-items:center;gap:.6cqw;background:#fff;color:#111;border:none;border-radius:.8cqw;padding:.9cqw 1.4cqw;font-family:'Lexend',sans-serif;font-size:1cqw;font-weight:500;cursor:pointer}
`;

// ─── Gráfico: acumulado do mês contra o ritmo da meta ─────────
// Desenhado no tamanho real do quadro (mede o container), em vez de
// esticar um viewBox fixo: assim a bolinha fica redonda e o traço tem a
// mesma espessura em todo o gráfico. A linha tem o mesmo dourado e o
// mesmo brilho que corre na barra da meta.
const PASSOS = [5000, 10000, 20000, 25000, 50000, 100000, 200000, 500000, 1000000];

function Curva({ acumulado, ritmo, diasNoMes, hojeDia, meta, vendido }) {
  const ref = useRef(null);
  const [tam, setTam] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const medir = () => setTam({ w: el.clientWidth, h: el.clientHeight });
    medir();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const W = tam.w; const H = tam.h;
  const pts = acumulado.map((v, i) => (v == null ? null : i)).filter(i => i != null);
  if (!W || !H || !pts.length) return <div className="hc-chart" ref={ref} />;

  const padL = 64; const padR = 14; const padT = 36; const padB = 30;
  const topo = Math.max(meta, ...acumulado.filter(v => v != null), 1) * 1.08;
  const passo = PASSOS.find(p => topo / p <= 5) || PASSOS[PASSOS.length - 1];
  const x = (i) => padL + (i / Math.max(1, diasNoMes - 1)) * (W - padL - padR);
  const y = (v) => H - padB - (v / topo) * (H - padT - padB);
  const linha = pts.map((i, k) => `${k ? 'L' : 'M'}${x(i).toFixed(1)},${y(acumulado[i]).toFixed(1)}`).join(' ');
  const ult = pts[pts.length - 1];
  const lx = x(ult); const ly = y(acumulado[ult]);
  const area = `${linha} L${lx},${H - padB} L${x(pts[0])},${H - padB} Z`;
  const rit = ritmo.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const grade = [];
  for (let v = passo; v < topo; v += passo) grade.push(v);
  const dias = [...new Set([1, 5, 10, 15, 20, 25, diasNoMes])];
  const faixa = Math.max(40, (lx - padL) * 0.28);
  const rotuloGrade = (v) => (v >= 1000000 ? `${(v / 1000000).toLocaleString('pt-BR')} mi` : `${v / 1000} mil`);

  return (
    <div className="hc-chart" ref={ref}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Vendido acumulado no mês contra o ritmo da meta">
        <defs>
          <linearGradient id="hcLinha" gradientUnits="userSpaceOnUse" x1={padL} y1="0" x2={Math.max(lx, padL + 1)} y2="0">
            <stop offset="0" stopColor="#8a6a10" />
            <stop offset="1" stopColor={GOLD} />
          </linearGradient>
          <linearGradient id="hcArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={GOLD} stopOpacity=".3" />
            <stop offset="1" stopColor={GOLD} stopOpacity="0" />
          </linearGradient>
          <linearGradient id="hcBrilho" gradientUnits="userSpaceOnUse" x1={padL - faixa} y1="0" x2={padL} y2="0">
            <stop offset="0" stopColor="#fff" stopOpacity="0" />
            <stop offset=".5" stopColor="#fff" stopOpacity=".7" />
            <stop offset="1" stopColor="#fff" stopOpacity="0" />
            <animateTransform attributeName="gradientTransform" type="translate" values={`0 0;${Math.round(lx - padL + faixa * 2)} 0`} dur="3.5s" calcMode="spline" keyTimes="0;1" keySplines=".42 0 .58 1" repeatCount="indefinite" />
          </linearGradient>
        </defs>
        {grade.map(v => (
          <g key={v}>
            <line x1={padL} x2={W - padR} y1={y(v)} y2={y(v)} stroke="rgba(255,255,255,.05)" />
            <text x={padL - 12} y={y(v) + 4} textAnchor="end" fill="#6f7680" fontSize="13" fontFamily="Lexend,sans-serif">{rotuloGrade(v)}</text>
          </g>
        ))}
        <line x1={padL} x2={W - padR} y1={H - padB} y2={H - padB} stroke="rgba(255,255,255,.08)" />
        {dias.map(n => (
          <text key={n} x={x(n - 1)} y={H - 8} textAnchor="middle" fill={n === hojeDia ? '#c3c9d2' : '#6f7680'} fontSize="13" fontFamily="Lexend,sans-serif">{n}</text>
        ))}
        {meta > 0 && rit && (
          <>
            <path d={rit} fill="none" stroke="rgba(207,213,221,.45)" strokeWidth="2.5" strokeDasharray="8 8" strokeLinejoin="round" />
            <circle cx={x(diasNoMes - 1)} cy={y(meta)} r="5" fill="#cfd5dd" />
          </>
        )}
        {pts.length > 1 && <path d={area} fill="url(#hcArea)" />}
        <line x1={lx} x2={lx} y1={ly} y2={H - padB} stroke="rgba(230,180,34,.35)" strokeDasharray="3 5" />
        <path d={linha} fill="none" stroke="url(#hcLinha)" strokeWidth="5" strokeLinejoin="round" strokeLinecap="round" />
        <path d={linha} fill="none" stroke="url(#hcBrilho)" strokeWidth="5" strokeLinejoin="round" strokeLinecap="round" />
        <circle cx={lx} cy={ly} r="9" fill="none" stroke={GOLD} strokeWidth="2">
          <animate attributeName="r" values="9;22" dur="2.4s" repeatCount="indefinite" />
          <animate attributeName="opacity" values=".7;0" dur="2.4s" repeatCount="indefinite" />
        </circle>
        <circle cx={lx} cy={ly} r="9" fill={GOLD} />
      </svg>
      <div className="tag" style={{ left: lx, top: ly }}>{brl(vendido)}<small>hoje</small></div>
      {meta > 0 && <div className="goal" style={{ left: x(diasNoMes - 1) + 4, top: y(meta) }}>meta<b>{brl(meta)}</b></div>}
    </div>
  );
}

// ─── Barra fixa da meta ───────────────────────────────────────
function MetaBar({ d, visita }) {
  if (visita) {
    return (
      <section className="hc-card hc-meta" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
        <div><div className="lbl">Clientes ativos na Lince</div><div className="big">{d.carteira.ativos}</div></div>
        <div><div className="lbl">Clientes novos no mês</div><div className="big">{pad2(d.carteira.entraramNoMes)}</div></div>
        <div><div className="lbl">Vendas fechadas no mês</div><div className="big">{pad2(d.nVendas)}</div></div>
      </section>
    );
  }
  const pct = d.meta ? Math.min(100, (d.vendido / d.meta) * 100) : 0;
  const marca = Math.min(100, d.fracao * 100);
  return (
    <section className="hc-card hc-meta">
      <div>
        <div className="lbl">Meta de novos negócios</div>
        <div className="big" style={{ color: d.meta && d.vendido >= d.meta ? GOLD : '#eef1f5' }}>{brl(d.vendido)}</div>
        <div className="de">{d.meta ? `de ${brl(d.meta)}` : 'meta ainda não definida'}</div>
      </div>
      <div className="hc-barwrap">
        <div className="hc-bar"><i style={{ width: `${pct}%` }} /></div>
        {d.meta > 0 && marca > 0 && marca < 100 && (
          <div className="hc-mark" style={{ left: `${marca}%` }}><span>ritmo de hoje</span></div>
        )}
        <div className="hc-pct">
          <b style={{ color: d.pct >= 100 ? GOLD : '#eef1f5' }}>{d.pct == null ? '—' : `${d.pct}%`}</b>
          <span>
            {d.meta
              ? (d.noRitmo ? 'no ritmo da meta' : `${brl(d.esperadoHoje - d.vendido)} abaixo do ritmo`)
              : 'defina a meta no painel da CS'}
          </span>
        </div>
      </div>
      <div className="hc-mstats">
        <div className="hc-ms"><div className="v">{brl(d.faltam)}</div><div className="l">Faltam</div></div>
        <div className="hc-ms"><div className="v">{d.porDiaUtil == null ? '—' : brl(d.porDiaUtil)}</div><div className="l">Por dia útil</div></div>
        <div className="hc-ms"><div className="v">{d.diasRestantes ?? '—'}</div><div className="l">Dias úteis restantes</div></div>
      </div>
    </section>
  );
}

// Cena dos SDRs: o funil do mês no lugar da barra da meta. A barrinha
// de cada etapa é proporcional aos leads; a de vendas é dourada.
function FunilBar({ d }) {
  const f = d.funil;
  const w = (v) => (f.leads ? Math.max(2, Math.min(100, (v / f.leads) * 100)) : 0);
  const passo = (l, v, extra, ouro) => (
    <div className="hc-fb">
      <div className="lbl">{l}</div>
      <div className="big" style={{ color: ouro ? GOLD : '#eef1f5' }}>{v}{extra ? <small>{extra}</small> : null}</div>
      <div className={`hc-bar ${ouro ? '' : 'silver'}`}><i style={{ width: `${w(v)}%` }} /></div>
    </div>
  );
  const conv = (p, l) => (
    <div className="hc-fc"><ChevronRight size={24} strokeWidth={2.2} /><b>{p == null ? '—' : `${p}%`}</b><span>{l}</span></div>
  );
  return (
    <section className="hc-card hc-meta hc-funbar">
      {passo('Leads do mês', f.leads)}
      {conv(f.taxaAgendamento, 'agendaram')}
      {passo('Agendados', f.agendados)}
      {conv(f.taxaComparecimento, 'compareceram')}
      {passo('Realizados', f.realizados)}
      {conv(f.taxaFechamento, 'fecharam')}
      {passo('Vendas', f.vendas, f.taxaTotal == null ? '' : `${f.taxaTotal}% dos leads`, true)}
    </section>
  );
}

// ─── Peças das pessoas ────────────────────────────────────────
const fotoDe = (fotos, nome) => (nome ? fotos?.[chaveSdr(nome)] || null : null);

function Avatar({ nome, fotos }) {
  const f = fotoDe(fotos, nome);
  return f ? <img className="hc-mav" src={f} alt="" /> : <span className="hc-mav">{iniciais(nome)}</span>;
}

// Card do pódio — o mesmo para Closer e SDR.
function CardPodio({ p, pos, fotos, valor, info, chip }) {
  if (!p) return <div />;
  const f = fotoDe(fotos, p.nome);
  return (
    <div className={`hc-slot ${pos === 1 ? 'first' : `p${pos}`}`}>
      <section className="hc-pc">
        {f ? <img className="hc-pcph" src={f} alt="" /> : <span className="hc-pcav">{iniciais(p.nome)}</span>}
        <img className="hc-paw" src={COMERCIAL_TEAM.patas[pos]} alt={`${pos}º lugar`} />
        <div className="hc-pcnm">{p.nome}</div>
      </section>
      <div className="hc-pcv">{valor}</div>
      <div className="hc-pcs">{info}{chip}</div>
    </div>
  );
}

function Podio({ itens, fotos, corpo }) {
  const [p1, p2, p3] = itens;
  const card = (p, pos) => (p ? <CardPodio p={p} pos={pos} fotos={fotos} {...corpo(p)} /> : <div />);
  return <div className="hc-podium">{card(p2, 2)}{card(p1, 1)}{card(p3, 3)}</div>;
}

// ─── Cenas ────────────────────────────────────────────────────
function SceneMeta({ d }) {
  return (
    <>
      <section className="hc-card hc-pad">
        <h3 className="hc-t"><TrendingUp size={18} /> Curva do mês</h3>
        <Curva {...d.curva} meta={d.meta} vendido={d.vendido} />
        <div className="hc-legend">
          <span><i style={{ background: `linear-gradient(90deg,#8a6a10,${GOLD})` }} />Vendido acumulado</span>
          <span><i style={{ background: 'rgba(207,213,221,.6)' }} />Ritmo para bater a meta (dias úteis)</span>
        </div>
      </section>
      <div className="hc-col">
        <section className="hc-card hc-tile">
          <div className="v">{pad2(d.nVendas)}</div>
          <div className="l"><BadgeDollarSign size={16} /> Vendas fechadas no mês</div>
        </section>
        <section className="hc-card hc-tile">
          <div className="v">{brl(d.ticket)}</div>
          <div className="l"><Target size={16} /> Ticket médio</div>
        </section>
        <section className="hc-card hc-tile">
          <div className="v" style={{ color: d.meta ? (d.noRitmo ? '#4ade80' : '#ffc257') : '#eef1f5', fontSize: '2cqw' }}>
            {d.meta ? (d.noRitmo ? 'No ritmo' : 'Abaixo do ritmo') : '—'}
          </div>
          <div className="l">
            {d.noRitmo ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
            {d.meta ? `Esperado até hoje: ${brl(d.esperadoHoje)}` : 'Sem meta definida'}
          </div>
        </section>
      </div>
    </>
  );
}

function SceneClosers({ d }) {
  if (!d.closers.length) {
    return <section className="hc-card hc-pad" style={{ gridColumn: '1 / -1' }}><div className="hc-empty" style={{ color: '#a3aab5' }}>Cadastre os Closers e lance as vendas no painel da CS.</div></section>;
  }
  const max = Math.max(1, ...d.closers.map(c => c.valor));
  const ritmo = Math.min(100, d.fracao * 100);
  const corpo = (c) => ({
    valor: brl(c.valor),
    info: <span>{c.qtd} {c.qtd === 1 ? 'venda' : 'vendas'}{c.qtd ? ` · ticket ${brl(c.ticket)}` : ''}</span>,
    chip: c.ating == null ? null : <span className={`hc-chip ${c.ating >= 100 ? 'gold' : ''}`}><b>{c.ating}%</b>da meta</span>,
  });
  return (
    <>
      <Podio itens={d.closers} fotos={d.fotos} corpo={corpo} />
      <section className="hc-card hc-pad">
        <h3 className="hc-t"><Target size={18} /> Meta individual do mês <span className="hc-legrow"><i />ritmo de hoje</span></h3>
        <div className="hc-rlist">
          {d.closers.slice(0, 6).map((c, i) => (
            <div className={`hc-ri ${i === 0 && c.valor ? 'lead' : ''}`} key={c.nome}>
              <span className="hc-rk">{i + 1}º</span>
              <Avatar nome={c.nome} fotos={d.fotos} />
              <div style={{ minWidth: 0 }}>
                <div className="top"><span className="nm">{c.nome}</span><span className="val">{brl(c.valor)}</span></div>
                <div className="hc-ating">
                  <div className="hc-abar">
                    {c.meta ? (
                      <>
                        <div className="hc-bar"><i style={{ width: `${Math.min(100, c.ating)}%` }} /></div>
                        {ritmo > 0 && ritmo < 100 && <span className="hc-tick" style={{ left: `${ritmo}%` }} />}
                      </>
                    ) : (
                      <div className="hc-bar silver"><i style={{ width: `${(c.valor / max) * 100}%` }} /></div>
                    )}
                  </div>
                  <b style={{ color: c.ating >= 100 ? GOLD : '#eef1f5' }}>{c.ating == null ? '—' : `${c.ating}%`}</b>
                </div>
                <div className="sub">
                  {c.meta ? <>meta <b>{brl(c.meta)}</b> · </> : 'sem meta individual · '}
                  {c.qtd} {c.qtd === 1 ? 'venda' : 'vendas'}
                  {c.qtd ? <> · ticket <b>{brl(c.ticket)}</b></> : null}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

// SDRs: o ranking é por pontos (SDR_PONTOS — reunião realizada e
// assistência). Ao lado, a meta de agendamentos do mês com a marca do
// ritmo de hoje, igual à meta individual dos Closers.
function SceneSdrs({ d }) {
  if (!d.sdrs.length) {
    return <section className="hc-card hc-pad" style={{ gridColumn: '1 / -1' }}><div className="hc-empty" style={{ color: '#a3aab5' }}>Cadastre os SDRs no painel da CS.</div></section>;
  }
  const max = Math.max(1, ...d.sdrs.map(s => s.agendados));
  const ritmo = Math.min(100, d.fracao * 100);
  const assist = (n) => `${n} ${n === 1 ? 'assistência' : 'assistências'}`;
  const corpo = (s) => ({
    valor: <>{s.pontos}<small>pontos</small></>,
    info: <span>{s.realizados} {s.realizados === 1 ? 'realizada' : 'realizadas'} · {assist(s.vendas)}</span>,
    chip: s.ating == null
      ? <span className="hc-chip"><b>{s.agendados}</b>agendados</span>
      : <span className={`hc-chip ${s.ating >= 100 ? 'gold' : ''}`}><b>{s.ating}%</b>da meta de agendamentos</span>,
  });
  return (
    <>
      <Podio itens={d.sdrs} fotos={d.fotos} corpo={corpo} />
      <section className="hc-card hc-pad">
        <h3 className="hc-t">
          <CalendarClock size={18} /> Pontos e meta de agendamentos
          <span className="hc-legrow">{SDR_PONTOS.realizada} pt por realizada · {SDR_PONTOS.assistencia} pts por assistência</span>
        </h3>
        <div className="hc-rlist">
          {d.sdrs.slice(0, 6).map((s, i) => (
            <div className={`hc-ri ${i === 0 && s.pontos ? 'lead' : ''}`} key={s.nome}>
              <span className="hc-rk">{i + 1}º</span>
              <Avatar nome={s.nome} fotos={d.fotos} />
              <div style={{ minWidth: 0 }}>
                <div className="top"><span className="nm">{s.nome}</span><span className="val">{s.pontos}<small>pts</small></span></div>
                <div className="hc-ating">
                  <div className="hc-abar">
                    {s.meta ? (
                      <>
                        <div className="hc-bar"><i style={{ width: `${Math.min(100, s.ating)}%` }} /></div>
                        {ritmo > 0 && ritmo < 100 && <span className="hc-tick" style={{ left: `${ritmo}%` }} />}
                      </>
                    ) : (
                      <div className="hc-bar silver"><i style={{ width: `${(s.agendados / max) * 100}%` }} /></div>
                    )}
                  </div>
                  <b style={{ color: s.ating >= 100 ? GOLD : '#eef1f5' }}>{s.ating == null ? '—' : `${s.ating}%`}</b>
                </div>
                <div className="sub">
                  {s.meta ? <><b>{s.agendados}</b> de {s.meta} agendados</> : <><b>{s.agendados}</b> agendados · sem meta</>}
                  {' · '}<b>{s.realizados}</b> realizados · <span className={s.noShow ? 'red' : ''}>{s.noShow} no-show</span>
                  {' · '}<b>{s.vendas}</b> {s.vendas === 1 ? 'assistência' : 'assistências'}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

function SceneCarteira({ d, nowTs }) {
  return (
    <>
      <div className="hc-col">
        <section className="hc-card hc-tile">
          <div className="v">{d.carteira.ativos}</div>
          <div className="l"><Users size={16} /> Clientes ativos na base</div>
        </section>
        <section className="hc-card hc-tile">
          <div className="v" style={{ color: '#4ade80' }}>{pad2(d.carteira.entraramNoMes)}</div>
          <div className="l"><Check size={16} /> Entraram na base neste mês</div>
        </section>
        <section className="hc-card hc-tile">
          <div className="v">{pad2(d.carteira.emEntrada)}</div>
          <div className="l"><CalendarClock size={16} /> Em Kick Off e onboarding</div>
        </section>
      </div>
      <section className="hc-card hc-pad">
        <h3 className="hc-t"><BadgeDollarSign size={18} /> Últimas vendas <span className="hc-cnt">{pad2(d.nVendas)}</span></h3>
        {d.vendasRecentes.length === 0 ? (
          <div className="hc-empty" style={{ color: '#a3aab5' }}>Nenhuma venda lançada neste mês ainda.</div>
        ) : (
          <div className="hc-feed">
            {d.vendasRecentes.map(v => (
              <div className="hc-fi" key={v.id}>
                <div className="hc-duo">
                  <Avatar nome={v.closer} fotos={d.fotos} />
                  {v.sdr ? <Avatar nome={v.sdr} fotos={d.fotos} /> : null}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div className="nm">{v.cliente}</div>
                  <div className="sub">
                    <em>{v.closer}</em> fechou{v.sdr ? <> · <em>{v.sdr}</em> agendou</> : null}{v.servico ? ` · ${v.servico}` : ''}
                  </div>
                </div>
                <span className="v">{brl(v.valor)}</span>
                <span className="t">{ago(v.at, nowTs)}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}

function AlertaCard({ tom, icone, titulo, n, cor, sub, children }) {
  return (
    <section className={`hc-card hc-pad hc-alert ${n ? tom : 'ok'}`}>
      <h3 className="hc-t">{icone} {titulo}</h3>
      <div className="hc-anum" style={{ color: n ? cor : '#4ade80' }}>{pad2(n)}</div>
      <div className="hc-asub">{sub}</div>
      <div className="hc-alist">{children}</div>
    </section>
  );
}

function SceneAlerta({ d }) {
  const totalTasks = d.atrasos.reduce((s, a) => s + a.tasks, 0);
  return (
    <>
      <AlertaCard
        tom="" icone={<HeartCrack size={18} />} titulo="Churn do mês" n={d.churn.length} cor="#ff5c6c"
        sub={d.churn.length ? `${d.churn.length === 1 ? 'cliente saiu' : 'clientes saíram'}${d.mrrPerdido ? ` · ${brl(d.mrrPerdido)}/mês perdidos` : ''}` : 'nenhum cliente saiu neste mês'}
      >
        {d.churn.slice(0, 6).map(c => (
          <div className="hc-ai" key={c.id}><span>{c.cliente}</span><span>{c.motivo || (c.auto ? 'contrato encerrado' : '')}</span></div>
        ))}
      </AlertaCard>
      <AlertaCard
        tom="warn" icone={<CalendarClock size={18} />} titulo="Contratos vencendo" n={d.vencendo.length} cor="#ffc257"
        sub="nos próximos 30 dias ou já vencidos, hora de renovar"
      >
        {d.vencendo.slice(0, 6).map(v => (
          <div className="hc-ai" key={v.id}>
            <span>{v.nome}</span>
            <span>{v.dias < 0 ? `venceu há ${Math.abs(v.dias)}d` : v.dias === 0 ? 'vence hoje' : `em ${v.dias}d`}</span>
          </div>
        ))}
      </AlertaCard>
      <AlertaCard
        tom="" icone={<Flame size={18} />} titulo="Clientes em risco" n={d.emRisco.length} cor="#ff5c6c"
        sub={`avaliação da CS em alerta ou crítico${d.noShows ? ` · ${d.noShows} no-show${d.noShows === 1 ? '' : 's'} de reunião no mês` : ''}`}
      >
        {d.emRisco.slice(0, 6).map(c => (
          <div className="hc-ai" key={c.id}><span>{c.nome}</span><span>{c.nivel === 'red' ? 'crítico' : 'alerta'}</span></div>
        ))}
        {d.noShows > 0 && d.emRisco.length === 0 && (
          <div className="hc-ai"><span style={{ display: 'flex', alignItems: 'center', gap: '.4cqw' }}><UserX size={16} /> No-shows no mês</span><span>{d.noShows}</span></div>
        )}
      </AlertaCard>
      <AlertaCard
        tom="" icone={<AlarmClock size={18} />} titulo="Tasks em atraso" n={d.atrasos.length} cor="#ff5c6c"
        sub={d.atrasos.length
          ? `${d.atrasos.length === 1 ? 'cliente com entrega atrasada' : 'clientes com entrega atrasada'} · ${totalTasks} ${totalTasks === 1 ? 'task' : 'tasks'} no total`
          : 'nenhuma entrega atrasada'}
      >
        {d.atrasos.slice(0, 6).map(a => (
          <div className="hc-ai" key={a.id}>
            <span>{a.nome}</span>
            <span>{a.tasks} {a.tasks === 1 ? 'task' : 'tasks'}<b>{a.dias}d</b></span>
          </div>
        ))}
      </AlertaCard>
    </>
  );
}

function SceneVisit({ d }) {
  return (
    <section className="hc-visit">
      <img src={COMERCIAL_TEAM.logo} alt={COMERCIAL_TEAM.label} />
      <h2>{COMERCIAL_TEAM.label}</h2>
      <p>Time comercial da Lince Performance</p>
      <div className="hc-vstats">
        <div><div className="v">{d.carteira.ativos}</div><div className="l">clientes ativos</div></div>
        <div><div className="v">{pad2(d.carteira.entraramNoMes)}</div><div className="l">clientes novos no mês</div></div>
      </div>
    </section>
  );
}

// ─── Comemoração de venda ─────────────────────────────────────
// Com foto do Closer, ela entra no lugar do emblema do time.
function Celebration({ data, visita, fotos }) {
  const pieces = useMemo(() => Array.from({ length: 80 }, (_, i) => ({
    id: i, left: Math.random() * 100, delay: Math.random() * 1.6,
    dur: 2.6 + Math.random() * 2.2, size: 8 + Math.random() * 12, color: CONFETTI[i % CONFETTI.length],
  })), []);
  const foto = fotoDe(fotos, data.closer);
  return (
    <div className="hc-party">
      {pieces.map(p => (
        <span key={p.id} className="hc-cf" style={{ left: `${p.left}%`, width: p.size, height: p.size * 0.5, background: p.color, animation: `hcfall ${p.dur}s linear ${p.delay}s infinite` }} />
      ))}
      <div style={{ position: 'relative', textAlign: 'center', padding: '0 6cqw' }}>
        {foto
          ? <img className="hc-cph" src={foto} alt="" />
          : <img src={COMERCIAL_TEAM.logo} alt="" style={{ height: '20cqh', filter: 'drop-shadow(0 20px 40px rgba(0,0,0,.6))' }} />}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '.9cqw', color: GOLD, margin: foto ? '-2cqh 0 1.4cqh' : '2.4cqh 0 1.6cqh', position: 'relative' }}>
          <Trophy size={40} strokeWidth={2} />
          <span style={{ fontSize: '1.6cqw', fontWeight: 500, letterSpacing: '.04em' }}>Venda fechada</span>
          <Trophy size={40} strokeWidth={2} />
        </div>
        <div style={{ fontFamily: "'Unbounded',sans-serif", fontSize: '4.2cqw', fontWeight: 500, lineHeight: 1.1, letterSpacing: '-.02em', color: GOLD }}>{data.closer}</div>
        <div style={{ fontSize: '1.7cqw', fontWeight: 300, color: '#c3c9d2', marginTop: '1.6cqh' }}>{data.cliente}</div>
        {data.sdr && (
          <div style={{ fontSize: '1.15cqw', color: '#8b919c', marginTop: '1cqh' }}>agendada por <span style={{ color: '#c3c9d2' }}>{data.sdr}</span></div>
        )}
        {!visita && (
          <div style={{ fontFamily: "'Unbounded',sans-serif", fontSize: '3cqw', fontWeight: 500, marginTop: '3cqh' }}>{brl(data.valor)}</div>
        )}
      </div>
    </div>
  );
}

// ─── Painel ───────────────────────────────────────────────────
export default function TVComercial() {
  const d = useComercialTVData();
  const cfg = d.config;
  const [sceneIndex, setSceneIndex] = useState(0);
  const [now, setNow] = useState(new Date());
  const [scale, setScale] = useState(1);
  const [audioBlocked, setAudioBlocked] = useState(false);
  const audioRef = useRef(null);

  // Prioridade: pausa > modo visita > cena travada > rotação.
  const visita = cfg.tvVisitMode === true;
  const lockedIndex = !visita && cfg.tvLockScene ? ROTATION.findIndex(s => s.id === cfg.tvLockScene) : -1;
  const activeIndex = lockedIndex >= 0 ? lockedIndex : sceneIndex;
  const scene = visita ? VISIT : ROTATION[activeIndex];
  const girando = !visita && lockedIndex < 0 && !cfg.tvPaused && !d.celebration;

  useEffect(() => {
    const fit = () => setScale(Math.min(window.innerWidth / 1920, window.innerHeight / 1080));
    fit(); window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, []);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!girando) return undefined;
    const id = setTimeout(() => setSceneIndex(i => (i + 1) % ROTATION.length), scene.duration);
    return () => clearTimeout(id);
  }, [sceneIndex, scene.duration, girando]);

  useEffect(() => {
    if (!d.celebration) return undefined;
    const id = setTimeout(() => d.dismissCelebration(), 12000);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d.celebration]);

  // Reload automático às 4h — navegador aberto por semanas degrada.
  useEffect(() => {
    const alvo = new Date(); alvo.setHours(4, 0, 0, 0);
    if (alvo <= new Date()) alvo.setDate(alvo.getDate() + 1);
    const id = setTimeout(() => window.location.reload(), alvo.getTime() - Date.now());
    return () => clearTimeout(id);
  }, []);

  // ── Rádio ────────────────────────────────────────────────────
  useEffect(() => {
    const el = audioRef.current; if (!el) return;
    const v = Number(cfg.tvRadioVolume);
    el.volume = Math.min(1, Math.max(0, (Number.isFinite(v) ? v : 50) / 100));
  }, [cfg.tvRadioVolume, cfg.tvRadioUrl]);

  useEffect(() => {
    const el = audioRef.current; if (!el) return;
    if (!cfg.tvRadioUrl || !cfg.tvRadioPlaying) { el.pause(); setAudioBlocked(false); return; }
    el.play().then(() => setAudioBlocked(false)).catch(() => setAudioBlocked(true));
  }, [cfg.tvRadioUrl, cfg.tvRadioPlaying]);

  const liberarSom = () => {
    const el = audioRef.current; if (!el) return;
    el.play().then(() => setAudioBlocked(false)).catch(() => setAudioBlocked(true));
  };

  const dateLabel = cap(now.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }));
  const timeLabel = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="hc-root">
      <style>{CSS}</style>
      {cfg.tvRadioUrl && <audio key={cfg.tvRadioUrl} ref={audioRef} src={cfg.tvRadioUrl} preload="none" />}

      <div className="hc-stage" style={{ transform: `translate(-50%,-50%) scale(${scale})` }}>
        <div className="hc-prog">
          <div key={`${scene.id}_${girando ? 'r' : 'p'}`} style={{ animation: girando ? `hcprog ${scene.duration}ms linear forwards` : 'none', width: girando ? undefined : '100%' }} />
        </div>

        {d.authError ? (
          <div className="hc-standby" style={{ gap: '2cqh' }}>
            <div style={{ fontSize: '1.8cqw', fontWeight: 500, color: '#ff5c6c' }}>{d.authError}</div>
            <div style={{ fontSize: '1.1cqw', color: '#8b919c' }}>Habilite o provedor Anônimo em Authentication → Sign-in method no Firebase.</div>
          </div>
        ) : d.loading ? (
          <div className="hc-standby"><div style={{ color: '#8b919c', fontSize: '1.4cqw' }}>Carregando o painel…</div></div>
        ) : (
          <>
            <header className="hc-hdr">
              <img className="hc-logo" src={COMERCIAL_TEAM.logo} alt={COMERCIAL_TEAM.label} />
              <div>
                <div className="hc-kick">{COMERCIAL_TEAM.label} · Time comercial</div>
                <h1>{scene.title}</h1>
                {!visita && (
                  <div className="hc-dots">
                    {ROTATION.map((s, i) => <i key={s.id} className={i === activeIndex ? 'on' : ''} />)}
                  </div>
                )}
              </div>
              <div className="hc-right">
                {cfg.tvRadioPlaying && !audioBlocked && <Volume2 size={22} color="#c3c9d2" />}
                <img src="/agencia.png" alt="Lince Performance" style={{ height: '1.9cqw', opacity: 0.9 }} />
                <div className="hc-pill">{dateLabel}</div>
                <div className="hc-clock">{timeLabel}</div>
                <div className={`hc-live ${d.online ? '' : 'off'}`} />
              </div>
            </header>

            {scene.id === 'sdrs' ? <FunilBar d={d} /> : <MetaBar d={d} visita={visita} />}

            <div className={`hc-grid ${scene.id}`} key={scene.id}>
              {scene.id === 'meta' && <SceneMeta d={d} />}
              {scene.id === 'closers' && <SceneClosers d={d} />}
              {scene.id === 'sdrs' && <SceneSdrs d={d} />}
              {scene.id === 'carteira' && <SceneCarteira d={d} nowTs={now.getTime()} />}
              {scene.id === 'alerta' && <SceneAlerta d={d} />}
              {scene.id === 'visit' && <SceneVisit d={d} />}
            </div>
          </>
        )}

        {d.celebration && <Celebration data={d.celebration} visita={visita} fotos={d.fotos} key={d.celebration.key} />}

        {audioBlocked && (
          <button className="hc-sound" onClick={liberarSom}><Volume2 size={22} strokeWidth={2.2} /> Ligar som</button>
        )}

        {cfg.tvPaused && (
          <div className="hc-standby">
            <img src={COMERCIAL_TEAM.logo} alt={COMERCIAL_TEAM.label} style={{ height: '22cqh', opacity: 0.95 }} />
            <div style={{ fontFamily: "'Unbounded',sans-serif", fontSize: '5cqw', fontWeight: 400 }}>{timeLabel}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '.8cqw', color: '#8b919c', fontSize: '1.3cqw' }}>
              <PauseCircle size={26} />{cfg.tvPauseMessage || 'Painel em manutenção'}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
