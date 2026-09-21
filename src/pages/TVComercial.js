import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Trophy, Target, Flame, Users, CalendarClock, HeartCrack, TrendingUp, TrendingDown,
  Volume2, PauseCircle, Check, UserX, BadgeDollarSign,
} from 'lucide-react';
import { useComercialTVData } from '../hooks/useComercialTVData';
import { COMERCIAL_TEAM } from '../lib/firebase';
import { rotuloMes } from '../lib/entregas';

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
 * o time precisa ver o tempo inteiro.
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
.hc-t{font-size:1cqw;color:#c3c9d2;display:flex;align-items:center;gap:.5cqw;margin:0}
.hc-cnt{margin-left:auto;font-family:'Unbounded',sans-serif;font-size:.85cqw;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.09);border-radius:999px;padding:.2cqw .7cqw}

.hc-meta{flex-shrink:0;display:grid;grid-template-columns:22cqw 1fr 30cqw;gap:2cqw;align-items:center;padding:1.3cqw 1.8cqw;margin-bottom:1cqw}
.hc-meta .lbl{font-size:.85cqw;color:#a3aab5}
.hc-meta .big{font-family:'Unbounded',sans-serif;font-size:2.7cqw;font-weight:500;letter-spacing:-.02em;line-height:1.05;margin-top:.35cqw}
.hc-meta .de{font-size:.95cqw;color:#a3aab5;margin-top:.3cqw}
.hc-barwrap{position:relative}
.hc-bar{height:1.5cqw;border-radius:999px;background:rgba(255,255,255,.07);overflow:hidden;position:relative}
.hc-bar i{display:block;height:100%;border-radius:999px;background:linear-gradient(90deg,#8a6a10,${GOLD});position:relative;overflow:hidden}
.hc-bar i::after{content:'';position:absolute;top:0;bottom:0;width:25%;background:linear-gradient(90deg,transparent,rgba(255,255,255,.35),transparent);animation:hcshine 3.5s ease-in-out infinite}
.hc-mark{position:absolute;top:-.5cqw;width:2px;height:2.5cqw;background:#f4f6f9;border-radius:2px}
.hc-mark span{position:absolute;top:-1.5cqw;left:50%;transform:translateX(-50%);font-size:.7cqw;color:#a3aab5;white-space:nowrap}
.hc-pct{display:flex;justify-content:space-between;align-items:baseline;margin-top:.7cqw}
.hc-pct b{font-family:'Unbounded',sans-serif;font-size:1.9cqw;font-weight:500}
.hc-pct span{font-size:.85cqw;color:#a3aab5}
.hc-mstats{display:grid;grid-template-columns:repeat(3,1fr);gap:1.2cqw}
.hc-ms .v{font-family:'Unbounded',sans-serif;font-size:1.45cqw;font-weight:500;line-height:1.1}
.hc-ms .l{font-size:.75cqw;color:#a3aab5;margin-top:.35cqw}

.hc-grid{flex:1;display:grid;gap:1cqw;min-height:0;animation:hcfade .5s ease both}
.hc-grid.meta{grid-template-columns:1.5fr 1fr}
.hc-grid.closers{grid-template-rows:1.25fr 1fr}
.hc-grid.sdrs{grid-template-columns:1.55fr 1fr}
.hc-grid.carteira{grid-template-columns:1fr 1.25fr}
.hc-grid.alerta{grid-template-columns:repeat(3,1fr)}
.hc-grid.visit{grid-template-columns:1fr}
.hc-pad{padding:1.3cqw 1.6cqw;display:flex;flex-direction:column;min-height:0}

.hc-chart{flex:1;min-height:0;margin-top:1cqw;position:relative}
.hc-chart svg{width:100%;height:100%;display:block;overflow:visible}
.hc-legend{display:flex;gap:1.4cqw;font-size:.78cqw;color:#a3aab5;margin-top:.6cqw}
.hc-legend i{display:inline-block;width:1.2cqw;height:.25cqw;border-radius:2px;margin-right:.4cqw;vertical-align:middle}
.hc-col{display:grid;grid-template-rows:repeat(3,1fr);gap:1cqw;min-height:0}
.hc-tile{padding:1.2cqw 1.6cqw;display:flex;flex-direction:column;justify-content:center}
.hc-tile .v{font-family:'Unbounded',sans-serif;font-size:2.6cqw;font-weight:500;line-height:1;letter-spacing:-.02em}
.hc-tile .l{font-size:.9cqw;color:#a3aab5;margin-top:.6cqw;display:flex;align-items:center;gap:.45cqw}

.hc-podium{display:grid;grid-template-columns:1fr 1.15fr 1fr;gap:1cqw;align-items:end;min-height:0}
.hc-pod{padding:1.4cqw 1.4cqw 1.2cqw;display:flex;flex-direction:column;align-items:center;text-align:center;justify-content:flex-end;height:88%}
.hc-pod.first{height:100%;border-color:rgba(230,180,34,.45);background:linear-gradient(180deg,rgba(230,180,34,.14),rgba(255,255,255,.04))}
.hc-pos{font-family:'Unbounded',sans-serif;font-size:1cqw;color:#a3aab5;border:1px solid rgba(255,255,255,.14);border-radius:999px;padding:.25cqw .9cqw}
.hc-pod.first .hc-pos{color:#1a1405;background:${GOLD};border-color:${GOLD}}
.hc-pod .nm{font-size:1.7cqw;font-weight:500;margin-top:1.1cqw;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%}
.hc-pod .v{font-family:'Unbounded',sans-serif;font-size:2.5cqw;font-weight:500;margin-top:.5cqw;letter-spacing:-.02em}
.hc-pod.first .v{color:${GOLD};font-size:3cqw}
.hc-pod .s{font-size:.85cqw;color:#a3aab5;margin-top:.45cqw}

.hc-rows{flex:1;display:flex;flex-direction:column;gap:.45cqw;margin-top:.9cqw;min-height:0}
.hc-row{display:grid;align-items:center;gap:1cqw;padding:.55cqw 1cqw;border-radius:.9cqw;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.05)}
.hc-row .nm{font-size:1.05cqw;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.hc-row .n{font-family:'Unbounded',sans-serif;font-size:1.2cqw;font-weight:500}
.hc-row .n small{font-family:'Lexend',sans-serif;font-size:.72cqw;color:#8b919c;font-weight:300;margin-left:.3cqw}
.hc-thead{display:grid;gap:1cqw;padding:0 1cqw .4cqw;font-size:.75cqw;color:#8b919c;border-bottom:1px solid rgba(255,255,255,.08);margin-top:.9cqw}
.c-cl{grid-template-columns:2.2cqw 1fr 12cqw 8cqw 1fr}
.c-sd{grid-template-columns:2.2cqw 1fr 8cqw 8cqw 7cqw 9cqw}
.hc-bar2{height:.55cqw;border-radius:999px;background:rgba(255,255,255,.07);overflow:hidden}
.hc-bar2 i{display:block;height:100%;border-radius:999px;background:linear-gradient(90deg,#6b7280,#cfd5dd)}
.hc-rk{font-family:'Unbounded',sans-serif;font-size:.95cqw;color:#8b919c}

.hc-funil{display:flex;flex-direction:column;gap:.8cqw;margin-top:1.2cqw;flex:1;justify-content:center}
.hc-fstep{border-radius:1cqw;padding:.9cqw 1.3cqw;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.08);display:flex;align-items:center;justify-content:space-between;margin:0 auto}
.hc-fstep .l{font-size:1cqw;color:#c3c9d2}
.hc-fstep .v{font-family:'Unbounded',sans-serif;font-size:1.7cqw;font-weight:500}
.hc-conv{text-align:center;font-size:.8cqw;color:#8b919c}

.hc-feed{flex:1;display:flex;flex-direction:column;gap:.5cqw;margin-top:.9cqw;min-height:0}
.hc-fi{display:grid;grid-template-columns:1fr auto auto;gap:1.2cqw;align-items:center;padding:.7cqw 1cqw;border-radius:.9cqw;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.05)}
.hc-fi .nm{font-size:1.05cqw;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.hc-fi .sub{font-size:.78cqw;color:#8b919c;margin-top:.2cqw}
.hc-fi .v{font-family:'Unbounded',sans-serif;font-size:1.2cqw;font-weight:500}
.hc-fi .t{font-size:.8cqw;color:#8b919c;min-width:5cqw;text-align:right}

.hc-alert{border-color:rgba(255,92,108,.22);background:linear-gradient(180deg,rgba(255,92,108,.07),rgba(255,255,255,.03))}
.hc-alert.warn{border-color:rgba(255,194,87,.22);background:linear-gradient(180deg,rgba(255,194,87,.06),rgba(255,255,255,.03))}
.hc-anum{font-family:'Unbounded',sans-serif;font-size:4.2cqw;font-weight:500;line-height:1;margin-top:1cqw}
.hc-asub{font-size:.95cqw;color:#a3aab5;margin-top:.5cqw}
.hc-alist{flex:1;display:flex;flex-direction:column;gap:.4cqw;margin-top:1.1cqw;min-height:0;overflow:hidden}
.hc-ai{display:flex;justify-content:space-between;gap:1cqw;padding:.5cqw .9cqw;border-radius:.8cqw;background:rgba(0,0,0,.2);font-size:.95cqw}
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

.hc-party{position:absolute;inset:0;z-index:50;background:rgba(8,9,11,.95);display:flex;align-items:center;justify-content:center;overflow:hidden;animation:hcpop .5s ease both}
.hc-cf{position:absolute;top:0;border-radius:2px;display:block}
.hc-standby{position:absolute;inset:0;z-index:60;background:#08090b;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3cqh}
.hc-sound{position:absolute;right:2cqw;bottom:2cqw;z-index:40;display:flex;align-items:center;gap:.6cqw;background:#fff;color:#111;border:none;border-radius:.8cqw;padding:.9cqw 1.4cqw;font-family:'Lexend',sans-serif;font-size:1cqw;font-weight:500;cursor:pointer}
`;

// ─── Gráfico: acumulado do mês contra o ritmo da meta ─────────
function Curva({ acumulado, diasNoMes, meta }) {
  const W = 1000; const H = 320; const pad = 10;
  const maxV = Math.max(meta, ...acumulado.filter(v => v != null), 1) * 1.08;
  const x = (i) => pad + (i / Math.max(1, diasNoMes - 1)) * (W - pad * 2);
  const y = (v) => H - pad - (v / maxV) * (H - pad * 2);
  const pts = acumulado.map((v, i) => (v == null ? null : [x(i), y(v)])).filter(Boolean);
  const linha = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
  const area = pts.length > 1 ? `${linha} L${pts[pts.length - 1][0]},${H - pad} L${pts[0][0]},${H - pad} Z` : '';
  const last = pts[pts.length - 1];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
      <defs>
        <linearGradient id="hcga" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={GOLD} stopOpacity=".32" />
          <stop offset="1" stopColor={GOLD} stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0.25, 0.5, 0.75, 1].map(f => (
        <line key={f} x1={pad} x2={W - pad} y1={y(maxV * f / 1.08)} y2={y(maxV * f / 1.08)} stroke="rgba(255,255,255,.05)" />
      ))}
      {meta > 0 && (
        <line x1={x(0)} y1={y(0)} x2={x(diasNoMes - 1)} y2={y(meta)} stroke="rgba(207,213,221,.45)" strokeWidth="2.5" strokeDasharray="8 8" />
      )}
      {area && <path d={area} fill="url(#hcga)" />}
      {linha && <path d={linha} fill="none" stroke={GOLD} strokeWidth="4" strokeLinejoin="round" strokeLinecap="round" />}
      {last && <circle cx={last[0]} cy={last[1]} r="7" fill={GOLD} stroke="#0b0c0f" strokeWidth="3" />}
    </svg>
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
        <div className="lbl">Meta de {rotuloMes(d.mes, true).toLowerCase()}</div>
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

// ─── Cenas ────────────────────────────────────────────────────
function SceneMeta({ d }) {
  return (
    <>
      <section className="hc-card hc-pad">
        <h3 className="hc-t"><TrendingUp size={18} /> Curva do mês</h3>
        <div className="hc-chart"><Curva acumulado={d.curva.acumulado} diasNoMes={d.curva.diasNoMes} meta={d.meta} /></div>
        <div className="hc-legend">
          <span><i style={{ background: GOLD }} />Vendido acumulado</span>
          <span><i style={{ background: 'rgba(207,213,221,.6)' }} />Ritmo para bater a meta</span>
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
  const [p1, p2, p3, ...resto] = d.closers;
  const pod = (c, pos) => (c ? (
    <section className={`hc-card hc-pod ${pos === 1 ? 'first' : ''}`}>
      <span className="hc-pos">{pos}º</span>
      {pos === 1 && <Trophy size={44} color={GOLD} strokeWidth={1.8} style={{ marginTop: '1cqw' }} />}
      <div className="nm">{c.nome}</div>
      <div className="v">{brl(c.valor)}</div>
      <div className="s">{c.qtd} {c.qtd === 1 ? 'venda' : 'vendas'}{c.qtd ? ` · ticket ${brl(c.ticket)}` : ''}</div>
    </section>
  ) : <div />);
  const max = Math.max(1, ...d.closers.map(c => c.valor));
  if (!d.closers.length) {
    return <section className="hc-card hc-pad"><div className="hc-empty" style={{ color: '#a3aab5' }}>Cadastre os Closers e lance as vendas no painel da CS.</div></section>;
  }
  return (
    <>
      <div className="hc-podium">{pod(p2, 2)}{pod(p1, 1)}{pod(p3, 3)}</div>
      <section className="hc-card hc-pad">
        <h3 className="hc-t"><Users size={18} /> Time completo</h3>
        {resto.length === 0 ? (
          <div className="hc-empty" style={{ color: '#a3aab5' }}>O pódio é o time inteiro este mês.</div>
        ) : (
          <div className="hc-rows">
            {resto.slice(0, 5).map((c, i) => (
              <div className="hc-row c-cl" key={c.nome}>
                <span className="hc-rk">{i + 4}º</span>
                <span className="nm">{c.nome}</span>
                <span className="n">{brl(c.valor)}</span>
                <span className="n">{c.qtd}<small>{c.qtd === 1 ? 'venda' : 'vendas'}</small></span>
                <div className="hc-bar2"><i style={{ width: `${(c.valor / max) * 100}%` }} /></div>
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}

function SceneSdrs({ d }) {
  const max = Math.max(1, ...d.sdrs.map(s => s.agendados));
  const f = d.funil;
  const etapas = [
    { l: 'Leads', v: f.leads, w: 100 },
    { l: 'Agendados', v: f.agendados, w: 84, conv: f.taxaAgendamento },
    { l: 'Realizados', v: f.realizados, w: 68, conv: f.taxaComparecimento, convLabel: 'compareceram' },
    { l: 'Vendas', v: f.vendas, w: 52, conv: f.taxaFechamento, convLabel: 'fecharam' },
  ];
  return (
    <>
      <section className="hc-card hc-pad">
        <h3 className="hc-t"><CalendarClock size={18} /> Agendamentos por SDR</h3>
        {d.sdrs.length === 0 ? (
          <div className="hc-empty" style={{ color: '#a3aab5' }}>Cadastre os SDRs no painel da CS.</div>
        ) : (
          <>
            <div className="hc-thead c-sd"><span /><span>SDR</span><span>Agendados</span><span>Realizados</span><span>No-show</span><span>Comparecimento</span></div>
            <div className="hc-rows" style={{ marginTop: '.5cqw' }}>
              {d.sdrs.slice(0, 7).map((s, i) => (
                <div className="hc-row c-sd" key={s.nome} style={i === 0 && s.agendados ? { borderColor: 'rgba(230,180,34,.35)' } : undefined}>
                  <span className="hc-rk" style={i === 0 && s.agendados ? { color: GOLD } : undefined}>{i + 1}º</span>
                  <div style={{ minWidth: 0 }}>
                    <div className="nm">{s.nome}</div>
                    <div className="hc-bar2" style={{ marginTop: '.4cqw' }}><i style={{ width: `${(s.agendados / max) * 100}%` }} /></div>
                  </div>
                  <span className="n">{s.agendados}</span>
                  <span className="n">{s.realizados}</span>
                  <span className="n" style={{ color: s.noShow ? '#ff5c6c' : '#eef1f5' }}>{s.noShow}</span>
                  <span className="n">{s.comparecimento == null ? '—' : `${s.comparecimento}%`}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </section>
      <section className="hc-card hc-pad">
        <h3 className="hc-t"><Target size={18} /> Funil do mês</h3>
        <div className="hc-funil">
          {etapas.map((e, i) => (
            <React.Fragment key={e.l}>
              {i > 0 && (
                <div className="hc-conv">{e.conv == null ? '—' : `${e.conv}%`}{e.convLabel ? ` ${e.convLabel}` : ''}</div>
              )}
              <div className="hc-fstep" style={{ width: `${e.w}%` }}>
                <span className="l">{e.l}</span>
                <span className="v" style={e.l === 'Vendas' ? { color: GOLD } : undefined}>{e.v}</span>
              </div>
            </React.Fragment>
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
                <div style={{ minWidth: 0 }}>
                  <div className="nm">{v.cliente}</div>
                  <div className="sub">{v.closer}{v.servico ? ` · ${v.servico}` : ''}</div>
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

function SceneAlerta({ d }) {
  return (
    <>
      <section className="hc-card hc-pad hc-alert">
        <h3 className="hc-t"><HeartCrack size={18} /> Churn do mês</h3>
        <div className="hc-anum" style={{ color: d.churn.length ? '#ff5c6c' : '#4ade80' }}>{pad2(d.churn.length)}</div>
        <div className="hc-asub">
          {d.churn.length ? `${d.churn.length === 1 ? 'cliente saiu' : 'clientes saíram'}${d.mrrPerdido ? ` · ${brl(d.mrrPerdido)}/mês perdidos` : ''}` : 'nenhum cliente saiu neste mês'}
        </div>
        <div className="hc-alist">
          {d.churn.slice(0, 6).map(c => (
            <div className="hc-ai" key={c.id}><span>{c.cliente}</span><span>{c.motivo || (c.auto ? 'contrato encerrado' : '')}</span></div>
          ))}
        </div>
      </section>
      <section className="hc-card hc-pad hc-alert warn">
        <h3 className="hc-t"><CalendarClock size={18} /> Contratos vencendo</h3>
        <div className="hc-anum" style={{ color: d.vencendo.length ? '#ffc257' : '#4ade80' }}>{pad2(d.vencendo.length)}</div>
        <div className="hc-asub">nos próximos 30 dias ou já vencidos — hora de renovar</div>
        <div className="hc-alist">
          {d.vencendo.slice(0, 6).map(v => (
            <div className="hc-ai" key={v.id}>
              <span>{v.nome}</span>
              <span>{v.dias < 0 ? `venceu há ${Math.abs(v.dias)}d` : v.dias === 0 ? 'vence hoje' : `em ${v.dias}d`}</span>
            </div>
          ))}
        </div>
      </section>
      <section className="hc-card hc-pad hc-alert">
        <h3 className="hc-t"><Flame size={18} /> Clientes em risco</h3>
        <div className="hc-anum" style={{ color: d.emRisco.length ? '#ff5c6c' : '#4ade80' }}>{pad2(d.emRisco.length)}</div>
        <div className="hc-asub">
          avaliação da CS em alerta ou crítico
          {d.noShows ? ` · ${d.noShows} no-show${d.noShows === 1 ? '' : 's'} de reunião no mês` : ''}
        </div>
        <div className="hc-alist">
          {d.emRisco.slice(0, 6).map(c => (
            <div className="hc-ai" key={c.id}><span>{c.nome}</span><span>{c.nivel === 'red' ? 'crítico' : 'alerta'}</span></div>
          ))}
          {d.noShows > 0 && d.emRisco.length === 0 && (
            <div className="hc-ai"><span style={{ display: 'flex', alignItems: 'center', gap: '.4cqw' }}><UserX size={16} /> No-shows no mês</span><span>{d.noShows}</span></div>
          )}
        </div>
      </section>
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
function Celebration({ data, visita }) {
  const pieces = useMemo(() => Array.from({ length: 80 }, (_, i) => ({
    id: i, left: Math.random() * 100, delay: Math.random() * 1.6,
    dur: 2.6 + Math.random() * 2.2, size: 8 + Math.random() * 12, color: CONFETTI[i % CONFETTI.length],
  })), []);
  return (
    <div className="hc-party">
      {pieces.map(p => (
        <span key={p.id} className="hc-cf" style={{ left: `${p.left}%`, width: p.size, height: p.size * 0.5, background: p.color, animation: `hcfall ${p.dur}s linear ${p.delay}s infinite` }} />
      ))}
      <div style={{ position: 'relative', textAlign: 'center', padding: '0 6cqw' }}>
        <img src={COMERCIAL_TEAM.logo} alt="" style={{ height: '20cqh', filter: 'drop-shadow(0 20px 40px rgba(0,0,0,.6))' }} />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '.9cqw', color: GOLD, margin: '2.4cqh 0 1.6cqh' }}>
          <Trophy size={40} strokeWidth={2} />
          <span style={{ fontSize: '1.6cqw', fontWeight: 500, letterSpacing: '.04em' }}>Venda fechada</span>
          <Trophy size={40} strokeWidth={2} />
        </div>
        <div style={{ fontFamily: "'Unbounded',sans-serif", fontSize: '4.2cqw', fontWeight: 500, lineHeight: 1.1, letterSpacing: '-.02em', color: GOLD }}>{data.closer}</div>
        <div style={{ fontSize: '1.7cqw', fontWeight: 300, color: '#c3c9d2', marginTop: '1.6cqh' }}>{data.cliente}</div>
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

            <MetaBar d={d} visita={visita} />

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

        {d.celebration && <Celebration data={d.celebration} visita={visita} key={d.celebration.key} />}

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
