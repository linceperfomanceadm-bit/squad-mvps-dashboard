import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  LayoutGrid, AlertTriangle, Award, HeartPulse, Volume2, Check, ChevronDown,
  Flame, Eye, RotateCw, Target, BadgeCheck, Zap, Users, Calendar, Layers,
  Trophy, Gem, PauseCircle,
} from 'lucide-react';
import { useTVData } from '../hooks/useTVData';

/*
 * TVPanel — painel de parede da agência (rota pública /tv).
 *
 * Desenhado num palco fixo de 1920×1080 escalado para caber na tela:
 * o layout fica idêntico em qualquer resolução. Por isso as medidas
 * usam cqw/cqh (unidades de container) e o CSS vive num <style> —
 * keyframes e container queries não existem em estilo inline.
 *
 * Cinco cenas. Quatro giram sozinhas; a quinta ("A semana da Lince") é
 * o MODO VISITA: só entra quando o admin liga, e mostra apenas o que é
 * bom — sem atraso, sem farol, sem refação, sem nome de cliente e sem
 * porcentagem (todo percentual abaixo de 100 tem um complemento
 * negativo que a visita calcula sozinha).
 *
 * DECISÃO DE PRODUTO: a TV mostra SÓ operação. Nenhum R$, nenhuma meta
 * de venda, nenhum número do comercial.
 */

const SQUAD = {
  socialmedia: { squad: 'Supernovas',  setor: 'Social Media', logo: '/logos/socialmedia.png', c: '#FF4E85' },
  webdesign:   { squad: 'MVPS',        setor: 'WebDesign',    logo: '/logos/webdesign.png',   c: '#FF4453' },
  videomaker:  { squad: 'Outliers',    setor: 'VideoMaker',   logo: '/logos/videomaker.png',  c: '#6E6EFF' },
  design:      { squad: 'Dream Team',  setor: 'Design',       logo: '/logos/design.png',      c: '#FD2534' },
  trafego:     { squad: 'Challengers', setor: 'Tráfego Pago', logo: '/logos/trafego.png',     c: '#FFCE33' },
  cs:          { squad: 'Sentinels',   setor: 'CS',           logo: '/logos/cs.png',          c: '#5CFFFF' },
  comercial:   { squad: 'Comercial',   setor: 'Comercial',    logo: '/logos/comercial.png',   c: '#8F96FF' },
};

const ROTATION = [
  { id: 'today',      title: 'Operacional',         duration: 22000 },
  { id: 'alert',      title: 'Zona de atenção',     duration: 22000 },
  { id: 'highlights', title: 'Destaques da semana', duration: 20000 },
  { id: 'health',     title: 'Saúde da carteira',   duration: 20000 },
];
const VISIT = { id: 'visit', title: 'A semana da Lince', duration: 0 };

const HEALTH = {
  green:  { label: 'Em dia',  desc: 'sem atraso e sem alerta', color: '#4ade80' },
  yellow: { label: 'Atenção', desc: '1 task atrasada',          color: '#ffc257' },
  orange: { label: 'Alerta',  desc: '2 tasks atrasadas',        color: '#ff9a5c' },
  red:    { label: 'Crítico', desc: '3 ou mais atrasadas',      color: '#ff5c6c' },
};

const METRIC_ICON = { entregas: Layers, primeira: BadgeCheck, prazo: Target, velocidade: Zap, cobertura: Users, constancia: Calendar };
const DIAS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
const CONFETTI = ['#EE3363', '#4ade80', '#5cc8ff', '#ffc257', '#b79cff', '#5CFFFF'];

const pad2 = n => String(n).padStart(2, '0');
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
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
.tv-root{position:fixed;inset:0;background:#0a0709;overflow:hidden;font-family:'Lexend',sans-serif;color:#f5eff2}
.tv-stage{position:absolute;top:50%;left:50%;width:1920px;height:1080px;container-type:size;overflow:hidden;display:flex;
  background:radial-gradient(1200px 900px at 78% 8%,#3a1f2b 0%,transparent 60%),radial-gradient(900px 700px at 10% 100%,#2a1520 0%,transparent 55%),linear-gradient(160deg,#1d1319 0%,#120d12 100%)}
@keyframes tvblink{0%,100%{opacity:1}50%{opacity:.25}}
@keyframes tvfade{from{opacity:0;transform:translateY(.6cqw)}to{opacity:1;transform:none}}
@keyframes tvpop{0%{opacity:0;transform:scale(.9)}60%{transform:scale(1.02)}100%{opacity:1;transform:scale(1)}}
@keyframes tvfall{0%{transform:translateY(-12cqh) rotate(0);opacity:1}100%{transform:translateY(106cqh) rotate(720deg);opacity:0}}
@keyframes tvprog{from{width:0}to{width:100%}}

.tv-rail{width:4cqw;flex-shrink:0;margin:1.6cqw 0 1.6cqw 1.6cqw;border-radius:1.4cqw;background:rgba(255,255,255,.035);border:1px solid rgba(255,255,255,.09);display:flex;flex-direction:column;align-items:center;padding:1.3cqw 0;gap:.9cqw}
.tv-mark{width:2.2cqw;height:2.2cqw;border-radius:.7cqw;background:#EE3363;display:flex;align-items:center;justify-content:center;font-family:'Unbounded',sans-serif;font-weight:700;font-size:1.1cqw;color:#fff;margin-bottom:.8cqw;box-shadow:0 0 30px rgba(238,51,99,.45)}
.tv-ic{width:2.3cqw;height:2.3cqw;border-radius:.7cqw;display:flex;align-items:center;justify-content:center;color:#8a7b83;transition:.3s}
.tv-ic.on{background:rgba(255,255,255,.09);color:#f5eff2;border:1px solid rgba(255,255,255,.14)}
.tv-live{width:.5cqw;height:.5cqw;border-radius:50%;background:#4ade80;box-shadow:0 0 10px #4ade80;animation:tvblink 2.4s ease-in-out infinite}
.tv-live.off{background:#ff5c6c;box-shadow:0 0 10px #ff5c6c;animation:none}
.tv-prog{position:absolute;top:0;left:0;right:0;height:3px;z-index:9}
.tv-prog>div{height:100%;background:linear-gradient(90deg,#ff3d77,#EE3363);box-shadow:0 0 12px rgba(238,51,99,.7)}

.tv-main{flex:1;display:flex;flex-direction:column;padding:1.6cqw 1.6cqw 1.6cqw 1.3cqw;min-width:0;transition:transform 1s ease}
.tv-hdr{display:flex;align-items:center;justify-content:space-between;margin-bottom:.9cqw;flex-shrink:0}
.tv-hdr h1{font-family:'Unbounded',sans-serif;font-size:2.3cqw;font-weight:500;letter-spacing:-.01em;margin:0}
.tv-right{display:flex;align-items:center;gap:.8cqw}
.tv-pill{background:rgba(255,255,255,.055);border:1px solid rgba(255,255,255,.09);border-radius:999px;padding:.55cqw 1cqw;font-size:.85cqw;color:#c9bcc3}
.tv-clock{font-family:'Unbounded',sans-serif;font-size:2.1cqw;font-weight:400;line-height:1;margin-left:.6cqw}
.tv-logo{height:1.9cqw;opacity:.95}

.tv-grid{flex:1;display:grid;grid-template-columns:1.62fr 1fr;grid-template-rows:24.5cqw 1fr;gap:1cqw;min-height:0;animation:tvfade .5s ease both}
.tv-grid.alert,.tv-grid.highlights{grid-template-rows:1fr 15cqw}
.tv-grid.health{grid-template-rows:27cqw 1fr}
.tv-card{background:rgba(255,255,255,.055);border:1px solid rgba(255,255,255,.09);border-radius:1.5cqw;-webkit-backdrop-filter:blur(30px);backdrop-filter:blur(30px);position:relative;overflow:hidden;min-height:0}
.tv-card::before{content:'';position:absolute;inset:0;border-radius:inherit;pointer-events:none;background:linear-gradient(160deg,rgba(255,255,255,.07),transparent 40%)}
.tv-t{font-size:1cqw;font-weight:400;display:flex;align-items:center;gap:.5cqw;margin:0}
.tv-cnt{margin-left:auto;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.09);border-radius:999px;padding:.25cqw .7cqw;font-family:'Unbounded',sans-serif;font-size:.8cqw}
.tv-col{grid-row:1;grid-column:2;display:grid;grid-template-rows:1fr 1fr;gap:1cqw;min-height:0}
.tv-small{padding:1cqw 1.4cqw;display:flex;flex-direction:column;min-height:0}
.tv-wide{grid-row:2;grid-column:1/3;padding:1.1cqw 1.8cqw .9cqw;display:flex;flex-direction:column;min-height:0}
.tv-top{display:flex;align-items:center;justify-content:space-between;margin-bottom:.5cqw}
.tv-top h3{font-size:1.05cqw;font-weight:400;margin:0}
.tv-sel{background:rgba(255,255,255,.055);border:1px solid rgba(255,255,255,.09);border-radius:.7cqw;padding:.5cqw .9cqw;font-size:.8cqw;color:#c9bcc3;display:flex;align-items:center;gap:.6cqw}
.tv-dot{width:.45cqw;height:.45cqw;border-radius:50%;display:inline-block;flex-shrink:0}
.tv-thumb{width:2.4cqw;height:2.4cqw;border-radius:.7cqw;background:rgba(0,0,0,.35);border:1px solid rgba(255,255,255,.09);display:flex;align-items:center;justify-content:center;flex-shrink:0}
.tv-thumb img{max-width:82%;max-height:82%;object-fit:contain}
.tv-thumb.sm{width:1.9cqw;height:1.9cqw}

.tv-hero{grid-row:1;grid-column:1;padding:2cqw 2.4cqw 1.6cqw;display:flex;flex-direction:column;justify-content:space-between}
.tv-glow{position:absolute;right:2cqw;top:-8cqw;width:30cqw;height:30cqw;border-radius:50%;background:radial-gradient(closest-side,rgba(238,51,99,.42),rgba(238,51,99,.08) 55%,transparent 72%);filter:blur(10px)}
.tv-hero .mascot{position:absolute;right:2.4cqw;top:.6cqw;height:18cqw;filter:drop-shadow(0 30px 50px rgba(0,0,0,.55));z-index:1}
.tv-fade{position:absolute;left:0;right:0;bottom:0;height:11cqw;background:linear-gradient(180deg,transparent,rgba(20,13,18,.7) 55%,rgba(20,13,18,.85));z-index:2}
.tv-kicker{font-size:.8cqw;color:#c9bcc3;margin-bottom:1cqw;position:relative;z-index:3}
.tv-hero h2{font-family:'Unbounded',sans-serif;font-size:2.8cqw;font-weight:500;line-height:1.1;letter-spacing:-.02em;max-width:22cqw;position:relative;z-index:3;margin:0}
.tv-hero h2 span{display:block;color:#c9bcc3;font-weight:300}
.tv-cta{display:inline-flex;align-items:center;gap:.5cqw;background:#fff;color:#1a1216;border-radius:.7cqw;padding:.75cqw 1.3cqw;font-size:.85cqw;font-weight:500;margin-top:1.2cqw;position:relative;z-index:3;width:max-content}
.tv-kpis{display:flex;justify-content:space-between;position:relative;z-index:3;padding:0 .4cqw}
.tv-kpi{display:flex;flex-direction:column;gap:.5cqw;min-width:9cqw}
.tv-kpi .v{font-family:'Unbounded',sans-serif;font-size:2.6cqw;font-weight:500;line-height:1;letter-spacing:-.02em}
.tv-kpi .l{display:flex;align-items:center;gap:.4cqw;font-size:.8cqw;color:#c9bcc3}
.tv-kpi .u{height:2px;width:5.5cqw;border-radius:2px}
.tv-lineup{position:absolute;right:1.8cqw;top:2.6cqw;display:flex;align-items:flex-end;z-index:1}
.tv-lineup img{height:6.6cqw;margin-left:-1.5cqw;filter:drop-shadow(0 20px 36px rgba(0,0,0,.6))}
.tv-lineup img:nth-child(3){height:8.6cqw;z-index:2;margin-bottom:.3cqw}
.tv-lineup img:nth-child(2),.tv-lineup img:nth-child(4){height:7.5cqw;z-index:1}

.tv-chart{flex:1;min-height:0;margin-top:.8cqw;position:relative}
.tv-chart svg{width:100%;height:100%;overflow:visible;display:block}
.tv-chart .lbl{position:absolute;bottom:-.1cqw;font-size:.72cqw;color:#8a7b83;transform:translateX(-50%)}
.tv-chart .tag{position:absolute;background:#0f0a0d;color:#fff;font-family:'Unbounded',sans-serif;font-size:.75cqw;font-weight:600;border-radius:999px;padding:.35cqw .75cqw;transform:translate(-50%,-140%)}
.tv-last{display:grid;grid-template-columns:1fr 9cqw;gap:1cqw}
.tv-last .info{display:flex;flex-direction:column;justify-content:center;min-width:0}
.tv-last .task{font-size:1.25cqw;font-weight:500;line-height:1.25;margin-top:.7cqw;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.tv-last .client{font-size:.85cqw;color:#c9bcc3;margin-top:.35cqw}
.tv-last .by{display:flex;align-items:center;gap:.5cqw;font-size:.8cqw;color:#8a7b83;margin-top:1.1cqw;flex-wrap:wrap}
.tv-last .by b{color:#f5eff2;font-weight:500}.tv-last .ok{color:#4ade80;display:flex;align-items:center;gap:.3cqw}
.tv-tile{background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.09);border-radius:1.1cqw;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:.5cqw;padding:.8cqw}
.tv-tile img{height:4.6cqw;filter:drop-shadow(0 10px 20px rgba(0,0,0,.5))}.tv-tile span{font-size:.7cqw;color:#8a7b83}

.tv-thead{display:grid;gap:1cqw;padding:0 .8cqw .4cqw;border-bottom:1px solid rgba(255,255,255,.09);font-size:.75cqw;color:#8a7b83}
.tv-rows{flex:1;display:flex;flex-direction:column;justify-content:space-between;min-height:0;padding-top:.35cqw;gap:.3cqw}
.tv-row{display:grid;gap:1cqw;align-items:center;padding:.3cqw .8cqw;border-radius:.9cqw;background:rgba(255,255,255,.028);border:1px solid rgba(255,255,255,.05)}
.tv-who{display:flex;align-items:center;gap:.9cqw;min-width:0}
.tv-nm{font-size:.98cqw;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.tv-sec{font-size:.72cqw;color:#8a7b83;margin-top:.15cqw;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.tv-stat{display:flex;align-items:center;gap:.45cqw;font-size:.82cqw;color:#c9bcc3}
.tv-n{font-family:'Unbounded',sans-serif;font-size:1.15cqw;font-weight:500}.tv-n small{font-family:'Lexend',sans-serif;font-size:.7cqw;color:#8a7b83;font-weight:300;margin-left:.3cqw}
.tv-bar{height:.55cqw;border-radius:999px;background:rgba(255,255,255,.07);overflow:hidden}.tv-bar i{display:block;height:100%;border-radius:999px}
.c5{grid-template-columns:19cqw 1fr 9cqw 8cqw 22cqw}
.c4{grid-template-columns:19cqw 1fr 12cqw 1fr}
.c6{grid-template-columns:18cqw 8cqw 1fr 11cqw 7cqw 16cqw}

.tv-late{grid-row:1;grid-column:1;padding:1.2cqw 1.5cqw;display:flex;flex-direction:column;min-height:0}
.tv-list{flex:1;display:flex;flex-direction:column;justify-content:space-between;gap:.4cqw;margin-top:.7cqw;min-height:0}
.tv-lrow{display:grid;grid-template-columns:4.2cqw 1fr 3cqw;gap:1cqw;align-items:center;padding:.5cqw .9cqw;border-radius:.9cqw;background:rgba(255,92,108,.07);border:1px solid rgba(255,92,108,.18);flex:1 1 auto;min-height:max-content}
.tv-lrow .d{font-family:'Unbounded',sans-serif;font-size:1.5cqw;font-weight:600;color:#ff5c6c;line-height:1}
.tv-lrow .d small{display:block;font-family:'Lexend',sans-serif;font-size:.62cqw;font-weight:300;color:#8a7b83;margin-top:.2cqw}
.tv-lrow .nm{font-size:1.05cqw;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.tv-lrow .sub{font-size:.78cqw;color:#8a7b83;margin-top:.2cqw;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.tv-mrow{display:flex;align-items:center;gap:.8cqw;padding:.38cqw .75cqw;border-radius:.8cqw;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.05)}
.tv-mrow .nm{font-size:.9cqw;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.tv-mrow .sub{font-size:.72cqw;color:#8a7b83;margin-top:.15cqw;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.tv-mrow .ago{font-family:'Unbounded',sans-serif;font-size:.9cqw;font-weight:500;flex-shrink:0}
.tv-mlist{flex:1;display:flex;flex-direction:column;justify-content:space-between;gap:.3cqw;margin-top:.45cqw;min-height:0}
.tv-split{display:grid;grid-template-columns:1fr 1fr;gap:2cqw;flex:1;min-height:0;align-items:center}
.tv-stats4{display:flex;justify-content:space-around}
.tv-st{text-align:center}.tv-st .v{font-family:'Unbounded',sans-serif;font-size:2.4cqw;font-weight:500;line-height:1}.tv-st .l{font-size:.78cqw;color:#8a7b83;margin-top:.5cqw}
.tv-bars{display:flex;flex-direction:column;gap:.45cqw}
.tv-brow{display:grid;grid-template-columns:2cqw 8cqw 1fr 2.5cqw;align-items:center;gap:.8cqw;font-size:.82cqw;color:#c9bcc3}
.tv-brow img{width:1.6cqw;height:1.6cqw;object-fit:contain}
.tv-brow .n{font-family:'Unbounded',sans-serif;text-align:right;font-size:.9cqw;color:#f5eff2}
.tv-empty{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:.8cqw;color:#4ade80;text-align:center}
.tv-empty .t2{font-size:1.2cqw;font-weight:500}

.tv-five{grid-row:1;grid-column:1/3;display:grid;grid-template-columns:repeat(5,1fr);gap:1cqw;min-height:0}
.tv-hl{padding:1.3cqw 1.3cqw 1.2cqw;display:flex;flex-direction:column;align-items:center;text-align:center}
.tv-hl .tv-tile{width:100%;padding:.9cqw;flex:1;min-height:0}
.tv-hl .tv-tile img{height:auto;max-height:100%;max-width:78%;object-fit:contain}
.tv-hl .squad{font-size:1.05cqw;font-weight:500;margin-top:.9cqw}
.tv-hl .setor{font-size:.72cqw;color:#8a7b83;margin-top:.1cqw}
.tv-hl .metric{display:inline-flex;align-items:center;gap:.4cqw;font-size:.72cqw;color:#c9bcc3;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.09);border-radius:999px;padding:.3cqw .75cqw;margin-top:.9cqw}
.tv-hl .who{font-size:1.05cqw;font-weight:500;margin-top:.9cqw;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%}
.tv-hl .v{font-family:'Unbounded',sans-serif;font-size:2.7cqw;font-weight:500;line-height:1;margin-top:.5cqw}
.tv-hl .sub{font-size:.72cqw;color:#8a7b83;margin-top:.4cqw}

.tv-ring{grid-row:1;grid-column:1;padding:1.5cqw 2cqw;display:grid;grid-template-columns:19cqw 1fr;gap:2cqw;align-items:center}
.tv-ring svg{width:100%;height:auto;overflow:visible;display:block}
.tv-center{position:absolute;left:0;top:0;width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;pointer-events:none}
.tv-center .n{font-family:'Unbounded',sans-serif;font-size:3.2cqw;font-weight:500;line-height:1}
.tv-center .l{font-size:.8cqw;color:#8a7b83;margin-top:.4cqw}
.tv-legend{display:flex;flex-direction:column;gap:.8cqw}
.tv-leg{display:grid;grid-template-columns:auto 1fr auto;gap:.8cqw;align-items:center;padding:.7cqw 1cqw;border-radius:.9cqw;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.05)}
.tv-leg .nm{font-size:1cqw;font-weight:500}.tv-leg .ds{font-size:.72cqw;color:#8a7b83;margin-top:.1cqw}
.tv-leg .n{font-family:'Unbounded',sans-serif;font-size:1.8cqw;font-weight:500}
.tv-farol{display:inline-flex;align-items:center;gap:.4cqw;font-size:.82cqw;border-radius:999px;padding:.3cqw .7cqw;border:1px solid;width:max-content}

.tv-party{position:absolute;inset:0;z-index:50;background:rgba(10,7,9,.95);display:flex;align-items:center;justify-content:center;overflow:hidden;animation:tvpop .5s ease both}
.tv-cf{position:absolute;top:0;border-radius:2px;display:block}
.tv-standby{position:absolute;inset:0;z-index:60;background:#0a0709;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3cqh}
.tv-sound{position:absolute;right:2cqw;bottom:2cqw;z-index:40;display:flex;align-items:center;gap:.6cqw;background:#fff;color:#1a1216;border:none;border-radius:.8cqw;padding:.9cqw 1.4cqw;font-family:'Lexend',sans-serif;font-size:1cqw;font-weight:500;cursor:pointer;box-shadow:0 20px 50px rgba(0,0,0,.5)}
`;

// ─── Blocos ────────────────────────────────────────────────────
function Thumb({ sector, small }) {
  const s = SQUAD[sector];
  return (
    <div className={`tv-thumb ${small ? 'sm' : ''}`}>
      {s && <img src={s.logo} alt={s.squad} />}
    </div>
  );
}
const Dot = ({ color, glow, size }) => (
  <i className="tv-dot" style={{ background: color, boxShadow: glow ? `0 0 10px ${color}` : undefined, width: size, height: size }} />
);
const Kpi = ({ v, l, c }) => (
  <div className="tv-kpi">
    <div className="v" style={{ color: c }}>{v}</div>
    <div className="l"><Dot color={c} />{l}</div>
    <div className="u" style={{ background: c }} />
  </div>
);
const Stat = ({ v, l, c }) => (
  <div className="tv-st"><div className="v" style={{ color: c }}>{v}</div><div className="l">{l}</div></div>
);

// Curva suave por pontos; pontos null encerram a linha.
function smoothPath(pts) {
  const p = pts.filter(Boolean);
  if (p.length < 2) return p.length ? `M${p[0][0]},${p[0][1]}` : '';
  let d = `M${p[0][0]},${p[0][1]}`;
  for (let i = 1; i < p.length; i += 1) {
    const [x0, y0] = p[i - 1]; const [x1, y1] = p[i]; const cx = (x0 + x1) / 2;
    d += ` C${cx},${y0} ${cx},${y1} ${x1},${y1}`;
  }
  return d;
}

function LineChart({ atual, anterior, cumulative }) {
  const W = 560; const H = 190; const pad = 8;
  const vals = [...atual, ...(anterior || [])].filter(v => v !== null && v !== undefined);
  const rawMax = Math.max(4, ...vals);
  const maxV = Math.ceil(rawMax / 4) * 4;
  const x = i => pad + i * ((W - pad * 2) / 6);
  const y = v => H - pad - (v / maxV) * (H - pad * 2);
  const toPts = arr => arr.map((v, i) => (v === null || v === undefined ? null : [x(i), y(v)]));
  const pA = toPts(atual);
  const last = [...pA].reverse().find(Boolean);
  const lastIdx = pA.reduce((acc, p, i) => (p ? i : acc), 0);
  const dA = smoothPath(pA);
  const area = cumulative && pA.filter(Boolean).length >= 2
    ? `${dA} L${last[0]},${H - pad} L${pA.find(Boolean)[0]},${H - pad} Z` : '';
  const ticks = [0, maxV / 4, maxV / 2, (maxV * 3) / 4, maxV];
  return (
    <>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
        <defs>
          <linearGradient id="tvga" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#EE3363" stopOpacity=".35" />
            <stop offset="1" stopColor="#EE3363" stopOpacity="0" />
          </linearGradient>
        </defs>
        {ticks.map(v => (
          <g key={v}>
            <line x1={pad} x2={W - pad} y1={y(v)} y2={y(v)} stroke="rgba(255,255,255,.06)" />
            <text x={pad - 2} y={y(v) + 4} fill="#8a7b83" fontSize="11" fontFamily="Lexend" textAnchor="end">{Math.round(v)}</text>
          </g>
        ))}
        {anterior && <path d={smoothPath(toPts(anterior))} fill="none" stroke="rgba(255,255,255,.28)" strokeWidth="2.5" strokeLinecap="round" />}
        {area && <path d={area} fill="url(#tvga)" />}
        <path d={dA} fill="none" stroke="#EE3363" strokeWidth="3.5" strokeLinecap="round" style={{ filter: 'drop-shadow(0 0 8px rgba(238,51,99,.6))' }} />
        {last && !cumulative && <line x1={last[0]} x2={last[0]} y1={last[1]} y2={H - pad} stroke="rgba(255,255,255,.12)" strokeWidth="2" />}
        {last && <circle cx={last[0]} cy={last[1]} r="5" fill="#EE3363" stroke="#1d1319" strokeWidth="3" />}
      </svg>
      {last && (
        <div className="tag" style={{ left: `${(last[0] / W * 100).toFixed(1)}%`, top: `${(last[1] / H * 100).toFixed(1)}%` }}>
          {atual[lastIdx]}
        </div>
      )}
      {DIAS.map((d, i) => <div key={d} className="lbl" style={{ left: `${(x(i) / W * 100).toFixed(1)}%` }}>{d}</div>)}
    </>
  );
}

function Ring({ counts, total }) {
  const R = 86; const C = 2 * Math.PI * R;
  const order = ['green', 'yellow', 'orange', 'red'];
  let off = 0;
  const segs = order.map(k => {
    const n = counts[k] || 0;
    const len = total ? (C * n) / total : 0;
    const el = n > 0 ? (
      <circle key={k} r={R} cx="100" cy="100" fill="none" stroke={HEALTH[k].color} strokeWidth="18"
        strokeDasharray={`${Math.max(0, len - 4)} ${C - len + 4}`} strokeDashoffset={-off}
        strokeLinecap="round" transform="rotate(-90 100 100)" />
    ) : null;
    off += len;
    return el;
  });
  return (
    <div style={{ position: 'relative' }}>
      <svg viewBox="0 0 200 200">
        <circle r={R} cx="100" cy="100" fill="none" stroke="rgba(255,255,255,.06)" strokeWidth="18" />
        {segs}
      </svg>
      <div className="tv-center"><div className="n">{total}</div><div className="l">clientes ativos</div></div>
    </div>
  );
}

const Bars = ({ items, valueOf, colorOf, max }) => (
  <div className="tv-bars">
    {items.map(s => {
      const v = valueOf(s); const sq = SQUAD[s.id] || {};
      return (
        <div className="tv-brow" key={s.id}>
          <img src={sq.logo} alt="" /><span>{sq.squad}</span>
          <div className="tv-bar"><i style={{ width: `${max ? Math.round((v / max) * 100) : 0}%`, background: colorOf(s, v) }} /></div>
          <span className="n">{v ? pad2(v) : '—'}</span>
        </div>
      );
    })}
  </div>
);

// ─── Cena 1: Operacional ───────────────────────────────────────
function SceneToday({ d }) {
  const hero = SQUAD[d.heroSector] || SQUAD.socialmedia;
  const ultima = d.recentes[0];
  return (
    <>
      <section className="tv-card tv-hero">
        <div className="tv-glow" />
        <img className="mascot" src={hero.logo} alt="" />
        <div className="tv-fade" />
        <div>
          <div className="tv-kicker">Hoje na agência</div>
          <h2>{pad2(d.counts.doneToday)} {d.counts.doneToday === 1 ? 'entrega' : 'entregas'}<span>{d.counts.doneToday === 1 ? 'concluída' : 'concluídas'} até agora</span></h2>
          <div className="tv-cta">Média desta semana: {d.mediaDiaria} por dia</div>
        </div>
        <div className="tv-kpis">
          <Kpi v={pad2(d.counts.doneToday)} l="Entregues" c="#4ade80" />
          <Kpi v={pad2(d.counts.doing)} l="Em produção" c="#5cc8ff" />
          <Kpi v={pad2(d.counts.approval)} l="Em aprovação" c="#ffc257" />
          <Kpi v={pad2(d.counts.overdue)} l="Atrasadas" c="#ff5c6c" />
        </div>
      </section>

      <div className="tv-col">
        <section className="tv-card tv-small">
          <h3 className="tv-t">Ritmo da semana <Dot color="#ffc257" glow /></h3>
          <div className="tv-chart"><LineChart atual={d.ritmoAtual} anterior={d.ritmoAnterior} /></div>
        </section>
        <section className="tv-card tv-small tv-last">
          {ultima ? (
            <>
              <div className="info">
                <h3 className="tv-t">Última entrega</h3>
                <div className="task">{ultima.name}</div>
                <div className="client">{ultima.clientName}</div>
                <div className="by">por <b>{ultima.by}</b>{ultima.clean && <span className="ok"><Check size={13} strokeWidth={2.6} /> aprovada de primeira</span>}</div>
              </div>
              <div className="tv-tile"><img src={(SQUAD[ultima.sector] || {}).logo} alt="" /><span>{(SQUAD[ultima.sector] || {}).squad}</span></div>
            </>
          ) : (
            <div className="tv-empty" style={{ gridColumn: '1/3' }}><div className="t2">Nenhuma entrega registrada ainda.</div></div>
          )}
        </section>
      </div>

      <section className="tv-card tv-wide">
        <div className="tv-top"><h3>Carga por setor neste momento</h3><div className="tv-sel">Ordenado por volume <ChevronDown size={13} /></div></div>
        <div className="tv-thead c5"><span>Squad</span><span>Em aberto</span><span>Prazo</span><span /><span /></div>
        <div className="tv-rows">
          {d.bySector.map(s => {
            const sq = SQUAD[s.id];
            return (
              <div className="tv-row c5" key={s.id}>
                <div className="tv-who"><Thumb sector={s.id} /><div><div className="tv-nm">{sq.squad}</div><div className="tv-sec">{sq.setor}</div></div></div>
                <div className="tv-n">{pad2(s.active)}<small>tasks</small></div>
                <div className="tv-stat"><Dot color={s.overdue ? '#ff5c6c' : '#4ade80'} />{s.overdue ? `${pad2(s.overdue)} atrasada${s.overdue > 1 ? 's' : ''}` : 'em dia'}</div>
                <div />
                <div className="tv-bar"><i style={{ width: `${Math.round((s.active / d.maxSectorLoad) * 100)}%`, background: `linear-gradient(90deg,${sq.c},${sq.c}88)` }} /></div>
              </div>
            );
          })}
        </div>
      </section>
    </>
  );
}

// ─── Cena 2: Zona de atenção ───────────────────────────────────
function SceneAlert({ d }) {
  const porSquad = [...d.squadsSemana].sort((a, b) => b.overdue - a.overdue);
  return (
    <>
      <section className="tv-card tv-late">
        <h3 className="tv-t"><Flame size={18} /> Entregas atrasadas <span className="tv-cnt">{pad2(d.overdueList.length)}</span></h3>
        {d.overdueList.length === 0 ? (
          <div className="tv-empty"><Check size={44} /><div className="t2">Nenhuma entrega atrasada</div></div>
        ) : (
          <div className="tv-list">
            {d.overdueList.slice(0, 5).map(t => (
              <div className="tv-lrow" key={t.id}>
                <div className="d">{t.days}d<small>de atraso</small></div>
                <div><div className="nm">{t.name}</div><div className="sub">{t.clientName} — {t.who}</div></div>
                <Thumb sector={t.sector} />
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="tv-col">
        <section className="tv-card tv-small">
          <h3 className="tv-t"><Eye size={18} /> Paradas em aprovação <span className="tv-cnt">{pad2(d.stuckApproval.length)}</span></h3>
          <div className="tv-mlist">
            {d.stuckApproval.slice(0, 3).map(t => (
              <div className="tv-mrow" key={t.id}>
                <div style={{ flex: 1, minWidth: 0 }}><div className="nm">{t.name}</div><div className="sub">aguarda {t.who}</div></div>
                <div className="ago" style={{ color: '#ffc257' }}>{t.days}d</div>
              </div>
            ))}
            {d.stuckApproval.length === 0 && <div className="tv-mrow"><div className="sub" style={{ marginTop: 0 }}>Fila de aprovação limpa.</div></div>}
          </div>
        </section>
        <section className="tv-card tv-small">
          <h3 className="tv-t"><RotateCw size={18} /> Em refação <span className="tv-cnt">{pad2(d.reworkList.length)}</span></h3>
          <div className="tv-mlist">
            {d.reworkList.slice(0, 3).map(t => (
              <div className="tv-mrow" key={t.id}>
                <div style={{ flex: 1, minWidth: 0 }}><div className="nm">{t.name}</div><div className="sub">{t.clientName} — {t.who}</div></div>
                <div className="ago" style={{ color: '#b79cff' }}>{t.count}ª</div>
              </div>
            ))}
            {d.reworkList.length === 0 && <div className="tv-mrow"><div className="sub" style={{ marginTop: 0 }}>Nada em refação agora.</div></div>}
          </div>
        </section>
      </div>

      <section className="tv-card tv-wide">
        <div className="tv-top"><h3>Resumo do que pede atenção</h3></div>
        <div className="tv-split">
          <div className="tv-stats4">
            <Stat v={pad2(d.overdueList.length)} l="Atrasadas" c="#ff5c6c" />
            <Stat v={`${d.maxLate}d`} l="Maior atraso" c="#ff5c6c" />
            <Stat v={pad2(d.counts.approval)} l="Em aprovação" c="#ffc257" />
            <Stat v={pad2(d.reworkList.length)} l="Em refação" c="#b79cff" />
          </div>
          <Bars items={porSquad} valueOf={s => s.overdue} max={Math.max(1, ...porSquad.map(s => s.overdue))} colorOf={(s, v) => (v ? '#ff5c6c' : 'transparent')} />
        </div>
      </section>
    </>
  );
}

// ─── Cena 3: Destaques por squad ───────────────────────────────
function SceneHighlights({ d }) {
  const max = Math.max(1, ...d.squadsSemana.map(s => s.week));
  return (
    <>
      <div className="tv-five">
        {d.highlights.map(h => {
          const sq = SQUAD[h.sector]; const Icon = METRIC_ICON[h.metricId] || Award; const vazio = !h.name;
          return (
            <section className="tv-card tv-hl" key={h.sector} style={{ opacity: vazio ? .6 : 1 }}>
              <div className="tv-tile"><img src={sq.logo} alt="" /></div>
              <div className="squad">{sq.squad}</div><div className="setor">{sq.setor}</div>
              <div className="metric"><Icon size={13} /> {h.metricLabel}</div>
              <div className="who">{h.name || 'Sem destaque ainda'}</div>
              <div className="v" style={{ color: vazio ? '#8a7b83' : sq.c }}>{h.value}</div>
              <div className="sub">{h.caption}</div>
            </section>
          );
        })}
      </div>
      <section className="tv-card tv-wide">
        <div className="tv-top"><h3>A semana da agência</h3><div className="tv-sel">Desde segunda-feira</div></div>
        <div className="tv-split">
          <div className="tv-stats4">
            <Stat v={pad2(d.weekStats.total)} l="Entregas" c="#f5eff2" />
            <Stat v={`${d.weekStats.cleanRate}%`} l="De primeira" c="#4ade80" />
            <Stat v={`${d.weekStats.onTime}%`} l="No prazo" c="#5cc8ff" />
            <Stat v={pad2(d.weekStats.clients)} l="Clientes atendidos" c="#EE3363" />
          </div>
          <Bars items={d.squadsSemana} valueOf={s => s.week} max={max} colorOf={s => `linear-gradient(90deg,${SQUAD[s.id].c},${SQUAD[s.id].c}88)`} />
        </div>
      </section>
    </>
  );
}

// ─── Cena 4: Saúde da carteira ─────────────────────────────────
function SceneHealth({ d }) {
  const order = ['green', 'yellow', 'orange', 'red'];
  return (
    <>
      <section className="tv-card tv-ring">
        <Ring counts={d.healthCount} total={d.totalClients} />
        <div className="tv-legend">
          {order.map(k => (
            <div className="tv-leg" key={k}>
              <Dot color={HEALTH[k].color} glow size=".6cqw" />
              <div><div className="nm">{HEALTH[k].label}</div><div className="ds">{HEALTH[k].desc}</div></div>
              <div className="n" style={{ color: HEALTH[k].color }}>{pad2(d.healthCount[k] || 0)}</div>
            </div>
          ))}
        </div>
      </section>

      <div className="tv-col">
        <section className="tv-card tv-small">
          <h3 className="tv-t">Pedem atenção agora <span className="tv-cnt">{pad2(d.criticalClients.length)}</span></h3>
          <div className="tv-mlist">
            {d.criticalClients.slice(0, 3).map(c => (
              <div className="tv-mrow" key={c.id}>
                <Dot color={HEALTH[c.level].color} glow />
                <div style={{ flex: 1, minWidth: 0 }}><div className="nm">{c.name}</div><div className="sub">{c.reason}</div></div>
                <Thumb sector={c.sector} small />
              </div>
            ))}
            {d.criticalClients.length === 0 && <div className="tv-mrow"><div className="sub" style={{ marginTop: 0, color: '#4ade80' }}>Carteira inteira em dia.</div></div>}
          </div>
        </section>
        <section className="tv-card tv-small">
          <h3 className="tv-t">Por responsável de CS</h3>
          <div className="tv-mlist">
            {d.porCS.slice(0, 3).map(p => (
              <div className="tv-mrow" key={p.name}>
                <div style={{ flex: 1, minWidth: 0 }}><div className="nm">{p.name}</div><div className="sub">{p.total} {p.total === 1 ? 'cliente' : 'clientes'}</div></div>
                <div style={{ display: 'flex', gap: '.4cqw' }}>
                  <span className="tv-farol" style={{ color: '#ff5c6c', borderColor: 'rgba(255,92,108,.3)' }}>{pad2(p.red)}</span>
                  <span className="tv-farol" style={{ color: '#ff9a5c', borderColor: 'rgba(255,154,92,.3)' }}>{pad2(p.orange)}</span>
                  <span className="tv-farol" style={{ color: '#4ade80', borderColor: 'rgba(74,222,128,.3)' }}>{pad2(p.green)}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="tv-card tv-wide">
        <div className="tv-top"><h3>Clientes em alerta ou crítico</h3><div className="tv-sel">Ordenado por gravidade <ChevronDown size={13} /></div></div>
        {d.criticalClients.length === 0 ? (
          <div className="tv-empty"><Check size={44} /><div className="t2">Nenhum cliente em alerta ou crítico.</div></div>
        ) : (
          <>
            <div className="tv-thead c6"><span>Cliente</span><span>Farol</span><span>Motivo</span><span>Responsável CS</span><span>Atraso</span><span>Setor envolvido</span></div>
            <div className="tv-rows">
              {d.criticalClients.slice(0, 5).map(c => {
                const lv = HEALTH[c.level]; const sq = SQUAD[c.sector];
                return (
                  <div className="tv-row c6" key={c.id}>
                    <div className="tv-nm">{c.name}</div>
                    <span className="tv-farol" style={{ color: lv.color, borderColor: `${lv.color}55` }}><Dot color={lv.color} />{lv.label}</span>
                    <div className="tv-sec" style={{ fontSize: '.85cqw', color: '#c9bcc3' }}>{c.reason}</div>
                    <div className="tv-sec" style={{ fontSize: '.85cqw', color: '#c9bcc3' }}>{c.cs || '—'}</div>
                    <div className="tv-n" style={{ color: c.daysLate ? '#ff5c6c' : '#8a7b83' }}>{c.daysLate ? `${c.daysLate}d` : '—'}</div>
                    <div className="tv-who"><Thumb sector={c.sector} /><div className="tv-sec">{sq ? sq.squad : '—'}</div></div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </section>
    </>
  );
}

// ─── Cena 5: Modo visita — só coisa boa, sem cliente, sem % ────
function SceneVisit({ d }) {
  const max = Math.max(1, ...d.squadsSemana.map(s => s.week));
  return (
    <>
      <section className="tv-card tv-hero">
        <div className="tv-glow" style={{ right: '-4cqw', top: '-10cqw', width: '40cqw', height: '40cqw' }} />
        <div className="tv-lineup">
          {['trafego', 'webdesign', 'socialmedia', 'videomaker', 'design'].map(id => <img key={id} src={SQUAD[id].logo} alt="" />)}
        </div>
        <div className="tv-fade" />
        <div>
          <div className="tv-kicker">Cinco squads, uma operação</div>
          <h2>{pad2(d.weekStats.total)} entregas<span>nesta semana</span></h2>
          <div className="tv-cta"><Check size={14} strokeWidth={2.6} /> Recorde do mês: {d.monthStats.recordeDia} entregas num dia</div>
        </div>
        <div className="tv-kpis">
          <Kpi v={pad2(d.counts.doneToday)} l="Entregues hoje" c="#4ade80" />
          <Kpi v={pad2(d.weekStats.total)} l="Nesta semana" c="#5cc8ff" />
          <Kpi v={String(d.monthStats.total)} l="Neste mês" c="#f5eff2" />
          <Kpi v={pad2(d.weekStats.clients)} l="Clientes atendidos" c="#EE3363" />
        </div>
      </section>

      <div className="tv-col">
        <section className="tv-card tv-small">
          <h3 className="tv-t">Acumulado da semana <Dot color="#EE3363" glow /></h3>
          <div className="tv-chart"><LineChart atual={d.acumulado} cumulative /></div>
        </section>
        <section className="tv-card tv-small">
          <h3 className="tv-t">Entregas mais recentes</h3>
          <div className="tv-mlist">
            {d.recentes.map(r => (
              <div className="tv-mrow" key={r.id}>
                <Thumb sector={r.sector} small />
                <div style={{ flex: 1, minWidth: 0 }}><div className="nm">{r.name}</div><div className="sub">{r.by} — {(SQUAD[r.sector] || {}).squad || ''}</div></div>
                <div className="sub" style={{ margin: 0, flexShrink: 0 }}>{ago(r.completedAt, d.nowTs)}</div>
              </div>
            ))}
            {d.recentes.length === 0 && <div className="tv-mrow"><div className="sub" style={{ marginTop: 0 }}>Nenhuma entrega registrada ainda.</div></div>}
          </div>
        </section>
      </div>

      <section className="tv-card tv-wide">
        <div className="tv-top"><h3>Os squads nesta semana</h3><div className="tv-sel">Desde segunda-feira</div></div>
        <div className="tv-thead c4"><span>Squad</span><span>Nesta semana</span><span>Neste mês</span><span /></div>
        <div className="tv-rows">
          {d.squadsSemana.map(s => {
            const sq = SQUAD[s.id];
            return (
              <div className="tv-row c4" key={s.id}>
                <div className="tv-who"><Thumb sector={s.id} /><div><div className="tv-nm">{sq.squad}</div><div className="tv-sec">{sq.setor}</div></div></div>
                <div className="tv-n">{pad2(s.week)}<small>entregas</small></div>
                <div className="tv-n">{s.month}<small>entregas</small></div>
                <div className="tv-bar"><i style={{ width: `${Math.round((s.week / max) * 100)}%`, background: `linear-gradient(90deg,${sq.c},${sq.c}88)` }} /></div>
              </div>
            );
          })}
        </div>
      </section>
    </>
  );
}

// ─── Comemoração ───────────────────────────────────────────────
function Celebration({ data, hideClient }) {
  const pieces = useMemo(() => Array.from({ length: 70 }, (_, i) => ({
    id: i, left: Math.random() * 100, delay: Math.random() * 1.6,
    dur: 2.6 + Math.random() * 2.2, size: 8 + Math.random() * 12, color: CONFETTI[i % CONFETTI.length],
  })), []);
  const sq = SQUAD[data.sector] || {}; const color = sq.c || '#EE3363';
  return (
    <div className="tv-party">
      {pieces.map(p => (
        <span key={p.id} className="tv-cf" style={{ left: `${p.left}%`, width: p.size, height: p.size * 0.5, background: p.color, animation: `tvfall ${p.dur}s linear ${p.delay}s infinite` }} />
      ))}
      <div style={{ position: 'relative', textAlign: 'center', padding: '0 6cqw' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '.9cqw', color: '#4ade80', marginBottom: '2.2cqh' }}>
          <Trophy size={40} strokeWidth={2} />
          <span style={{ fontSize: '1.5cqw', fontWeight: 500, letterSpacing: '.06em' }}>Entrega concluída</span>
          <Trophy size={40} strokeWidth={2} />
        </div>
        <div style={{ fontFamily: "'Unbounded',sans-serif", fontSize: '3.2cqw', fontWeight: 500, lineHeight: 1.18, marginBottom: '1.4cqh', letterSpacing: '-.02em' }}>{data.taskName}</div>
        {!hideClient && data.clientName && <div style={{ fontSize: '1.5cqw', fontWeight: 300, color: '#8a7b83', marginBottom: '3.2cqh' }}>{data.clientName}</div>}
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '.9cqw', background: `${color}1f`, border: `1px solid ${color}66`, borderRadius: '.9cqw', padding: '1.7cqh 2.2cqw', boxShadow: `0 0 50px -12px ${color}`, marginTop: hideClient ? '2cqh' : 0 }}>
          {sq.logo && <img src={sq.logo} alt="" style={{ height: '7cqh', objectFit: 'contain' }} />}
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontSize: '.82cqw', fontWeight: 300, color: '#8a7b83' }}>Entregue por</div>
            <div style={{ fontFamily: "'Unbounded',sans-serif", fontSize: '1.9cqw', fontWeight: 500, color }}>{data.by}</div>
          </div>
        </div>
        {data.clean && (
          <div style={{ marginTop: '2.4cqh', fontSize: '1.2cqw', fontWeight: 500, color: '#4ade80', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '.45cqw' }}>
            <Gem size={22} strokeWidth={2.2} /> Aprovada de primeira
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Painel ────────────────────────────────────────────────────
export default function TVPanel() {
  const d = useTVData();
  const [sceneIndex, setSceneIndex] = useState(0);
  const [now, setNow] = useState(new Date());
  const [scale, setScale] = useState(1);
  const [audioBlocked, setAudioBlocked] = useState(false);
  const audioRef = useRef(null);

  // Prioridade: pausa > modo visita > cena travada > rotação.
  const visita = d.tvVisitMode === true;
  const lockedIndex = !visita && d.tvLockScene ? ROTATION.findIndex(s => s.id === d.tvLockScene) : -1;
  const activeIndex = lockedIndex >= 0 ? lockedIndex : sceneIndex;
  const scene = visita ? VISIT : ROTATION[activeIndex];
  const girando = !visita && lockedIndex < 0 && !d.tvPaused && !d.celebration;

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

  // ── Rádio (URL, play/pause e volume vêm do admin) ────────────
  useEffect(() => {
    const el = audioRef.current; if (!el) return;
    const v = Number(d.tvRadioVolume);
    el.volume = Math.min(1, Math.max(0, (Number.isFinite(v) ? v : 50) / 100));
  }, [d.tvRadioVolume, d.tvRadioUrl]);

  useEffect(() => {
    const el = audioRef.current; if (!el) return;
    if (!d.tvRadioUrl || !d.tvRadioPlaying) { el.pause(); setAudioBlocked(false); return; }
    el.play().then(() => setAudioBlocked(false)).catch(() => setAudioBlocked(true));
  }, [d.tvRadioUrl, d.tvRadioPlaying]);

  const liberarSom = () => {
    const el = audioRef.current; if (!el) return;
    el.play().then(() => setAudioBlocked(false)).catch(() => setAudioBlocked(true));
  };

  const shift = (activeIndex % 4) * 3; // anti burn-in
  const dateLabel = cap(now.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }));
  const timeLabel = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="tv-root">
      <style>{CSS}</style>
      {d.tvRadioUrl && <audio key={d.tvRadioUrl} ref={audioRef} src={d.tvRadioUrl} preload="none" />}

      <div className="tv-stage" style={{ transform: `translate(-50%,-50%) scale(${scale})` }}>
        <div className="tv-prog">
          <div key={`${scene.id}_${girando ? 'r' : 'p'}`} style={{ animation: girando ? `tvprog ${scene.duration}ms linear forwards` : 'none', width: girando ? undefined : '100%' }} />
        </div>

        {d.authError ? (
          <div className="tv-standby" style={{ gap: '2cqh' }}>
            <div style={{ fontSize: '1.8cqw', fontWeight: 500, color: '#ff5c6c' }}>{d.authError}</div>
            <div style={{ fontSize: '1.1cqw', color: '#8a7b83' }}>Habilite o provedor Anônimo em Authentication → Sign-in method no Firebase.</div>
          </div>
        ) : d.loading ? (
          <div className="tv-standby"><div style={{ color: '#8a7b83', fontSize: '1.4cqw' }}>Carregando o painel…</div></div>
        ) : (
          <>
            <aside className="tv-rail">
              <div className="tv-mark">L</div>
              {[LayoutGrid, AlertTriangle, Award, HeartPulse].map((Icon, i) => (
                <div key={ROTATION[i].id} className={`tv-ic ${!visita && i === activeIndex ? 'on' : ''}`}><Icon size={19} strokeWidth={1.8} /></div>
              ))}
              <div style={{ flex: 1 }} />
              <div className="tv-ic" style={{ color: d.tvRadioPlaying && !audioBlocked ? '#f5eff2' : '#8a7b83' }}><Volume2 size={19} strokeWidth={1.8} /></div>
              <div className={`tv-live ${d.online ? '' : 'off'}`} />
            </aside>

            <main className="tv-main" style={{ transform: `translate(${shift}px,${shift}px)` }}>
              <header className="tv-hdr">
                <h1>{scene.title}</h1>
                <div className="tv-right">
                  <img className="tv-logo" src="/agencia.png" alt="Lince Performance" />
                  <div className="tv-pill">{dateLabel}</div>
                  <div className="tv-clock">{timeLabel}</div>
                </div>
              </header>
              <div className={`tv-grid ${scene.id}`} key={scene.id}>
                {scene.id === 'today' && <SceneToday d={d} />}
                {scene.id === 'alert' && <SceneAlert d={d} />}
                {scene.id === 'highlights' && <SceneHighlights d={d} />}
                {scene.id === 'health' && <SceneHealth d={d} />}
                {scene.id === 'visit' && <SceneVisit d={d} />}
              </div>
            </main>
          </>
        )}

        {d.celebration && <Celebration data={d.celebration} hideClient={visita} key={d.celebration.key} />}

        {audioBlocked && (
          <button className="tv-sound" onClick={liberarSom}><Volume2 size={22} strokeWidth={2.2} /> Ligar som</button>
        )}

        {d.tvPaused && (
          <div className="tv-standby">
            <img src="/agencia.png" alt="Lince Performance" style={{ height: '7cqh', opacity: .9 }} />
            <div style={{ fontFamily: "'Unbounded',sans-serif", fontSize: '5cqw', fontWeight: 400 }}>{timeLabel}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '.8cqw', color: '#8a7b83', fontSize: '1.3cqw' }}>
              <PauseCircle size={26} />{d.tvPauseMessage || 'Painel em manutenção'}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
