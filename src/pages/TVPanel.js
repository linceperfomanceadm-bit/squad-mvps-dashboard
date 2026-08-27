import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  CheckCircle2, Zap, Eye, AlarmClock, Flame, RotateCw,
  Target, BadgeCheck, TrendingUp, Gem, Trophy, PauseCircle, Volume2,
} from 'lucide-react';
import { HEALTH_LEVELS_4 } from '../hooks/useClientHealth';
import { useTVData } from '../hooks/useTVData';

/*
 * TVPanel — painel de parede da agência (rota pública /tv).
 *
 * Pensado para uma TV 16:9 1080p em tela cheia, sem ninguém operando:
 * abre, dá F11 e esquece. As cenas giram sozinhas e os dados chegam em
 * tempo real via onSnapshot.
 *
 * DECISÃO DE PRODUTO: a TV mostra SÓ operação. Nenhum valor em R$,
 * nenhuma meta de vendas, nenhum número do comercial — cliente e
 * visitante enxergam essa tela.
 *
 * SOBRE O DIMENSIONAMENTO: o painel é desenhado num palco fixo de
 * 1920×1080 que é escalado para caber na tela. Isso garante que o
 * layout fica idêntico em qualquer resolução, em vez de quebrar em
 * telas fora do padrão. Por isso as medidas usam cqw/cqh (unidades de
 * container) e o CSS vive num bloco <style> — keyframes e container
 * queries não existem em estilo inline.
 *
 * SOBRE AS CORES: as barras usam uma paleta própria da TV, mais
 * saturada que a de SECTORS. Os tons originais somem no preto quando
 * viram barra fina a 5 metros de distância.
 */

// Squads: nome do time, mascote (já no repo) e gradiente da barra.
const SQUAD = {
  socialmedia: { squad: 'Supernovas',  logo: '/logos/socialmedia.png', c1: '#FF4E85', c2: '#8E1E3E' },
  webdesign:   { squad: 'MVPS',        logo: '/logos/webdesign.png',   c1: '#FF4453', c2: '#8A1520' },
  videomaker:  { squad: 'Outliers',    logo: '/logos/videomaker.png',  c1: '#5B5BF5', c2: '#22226E' },
  design:      { squad: 'Dream Team',  logo: '/logos/design.png',      c1: '#FD2534', c2: '#7E121A' },
  trafego:     { squad: 'Challengers', logo: '/logos/trafego.png',     c1: '#FFCE33', c2: '#8A6604' },
  cs:          { squad: 'Sentinels',   logo: '/logos/cs.png',          c1: '#5CFFFF', c2: '#127474' },
  comercial:   { squad: 'Comercial',   logo: '/logos/comercial.png',   c1: '#8F96FF', c2: '#373C7A' },
};

const SCENES = [
  { id: 'today',      title: 'Operacional',         duration: 22000 },
  { id: 'alert',      title: 'Zona de Atenção',     duration: 22000 },
  { id: 'highlights', title: 'Destaques da Semana', duration: 20000 },
  { id: 'health',     title: 'Saúde da Carteira',   duration: 20000 },
];

const BADGE_ICON = { target: Target, badge: BadgeCheck, rotate: RotateCw, zap: Zap, trend: TrendingUp };

const CONFETTI = ['#EE3363', '#22c55e', '#38bdf8', '#f5a623', '#a78bfa', '#3EFFFF'];

const pad2 = n => String(n).padStart(2, '0');

const STOP = new Set(['de', 'da', 'do', 'e']);
const capitalize = s => s.split(/(\s+|-)/)
  .map(w => (STOP.has(w.toLowerCase()) ? w : w.replace(/^([a-zà-ú])/, c => c.toUpperCase())))
  .join('');

const CSS = `
.tvroot{position:fixed;inset:0;background:#050508;overflow:hidden;
  font-family:'Lexend',sans-serif;color:#fff}
.tvstage{position:absolute;top:50%;left:50%;width:1920px;height:1080px;
  container-type:size;background:#050508;overflow:hidden;display:flex;flex-direction:column}
.tvbar{height:4px;background:rgba(255,255,255,.05);flex-shrink:0}
.tvbar>div{height:100%;background:linear-gradient(90deg,#ff3d77,#EE3363);box-shadow:0 0 14px rgba(238,51,99,.8)}
@keyframes tvprog{from{width:0}to{width:100%}}
@keyframes tvfade{from{opacity:0;transform:translateY(1cqh)}to{opacity:1;transform:none}}
@keyframes tvblink{0%,100%{opacity:1}50%{opacity:.2}}
@keyframes tvglow{0%,100%{box-shadow:0 0 10px -2px var(--c1)}50%{box-shadow:0 0 22px 0 var(--c1),0 0 44px -10px var(--c1)}}
@keyframes tvpop{0%{opacity:0;transform:scale(.9)}60%{transform:scale(1.02)}100%{opacity:1;transform:scale(1)}}
@keyframes tvfall{0%{transform:translateY(-12cqh) rotate(0);opacity:1}100%{transform:translateY(106cqh) rotate(720deg);opacity:0}}

.tvbody{flex:1;display:flex;flex-direction:column;padding:2.6cqh 2.08cqw;min-height:0;transition:transform 1s ease}
.tvhdr{display:flex;align-items:flex-start;justify-content:space-between;flex-shrink:0}
.tvlogo{height:3.9cqh;width:auto;display:block}
.tvclock{font-family:'Unbounded',sans-serif;font-size:4.06cqw;font-weight:400;line-height:.9;text-align:right}
.tvdateline{display:flex;align-items:center;justify-content:flex-end;gap:.5cqw;margin-top:.8cqh}
.tvdate{font-size:.89cqw;font-weight:400;color:#e4e4ef}
.tvlive{width:.42cqw;height:.42cqw;border-radius:50%;background:#22c55e;box-shadow:0 0 9px #22c55e;animation:tvblink 2.4s ease-in-out infinite}
.tvlive.off{background:#ef4444;box-shadow:0 0 9px #ef4444}

.tvtitle{font-family:'Unbounded',sans-serif;font-size:3.02cqw;font-weight:700;letter-spacing:-.02em;margin:1.65cqh 0 1.1cqh;flex-shrink:0;line-height:1.1}
.tvsect{font-family:'Unbounded',sans-serif;font-size:3.23cqw;font-weight:700;letter-spacing:-.02em;margin:4.26cqh 0 1.3cqh;flex-shrink:0;line-height:1.1}
.tvscene{animation:tvfade .5s ease both;flex:1;display:flex;flex-direction:column;min-height:0}

.tvstats{display:flex;gap:2.7cqw;flex-shrink:0}
.tvcard{position:relative;flex:1;min-width:0;border-radius:1.04cqw;padding:2.4cqh 1.56cqw;overflow:hidden;
  display:flex;flex-direction:column;justify-content:center;
  background:linear-gradient(145deg,rgba(255,255,255,.10) 0%,rgba(255,255,255,.025) 46%,rgba(255,255,255,.055) 100%);
  -webkit-backdrop-filter:blur(24px) saturate(170%);backdrop-filter:blur(24px) saturate(170%);
  border:1px solid rgba(255,255,255,.11);
  box-shadow:inset 0 1px 0 rgba(255,255,255,.26),inset 0 -1px 0 rgba(255,255,255,.05),0 18px 44px rgba(0,0,0,.5)}
.tvcard::before{content:'';position:absolute;left:-14%;top:-70%;width:80%;height:130%;border-radius:50%;
  background:radial-gradient(closest-side,rgba(255,255,255,.13),transparent 70%);pointer-events:none}
.tvlbl{position:relative;display:flex;align-items:center;gap:.55cqw;font-size:1.35cqw;font-weight:500;letter-spacing:.045em;text-transform:uppercase;white-space:nowrap}
.tvnum{position:relative;font-family:'Unbounded',sans-serif;font-size:5.73cqw;font-weight:700;line-height:1;margin-top:.9cqh;letter-spacing:-.015em}

.tvloads{flex:1;display:flex;flex-direction:column;justify-content:space-between;min-height:0}
.tvlrow{display:flex;align-items:center;gap:1.15cqw}
.tvmascot{width:4.6cqw;height:4.6cqw;flex-shrink:0;display:flex;align-items:center;justify-content:center}
.tvmascot img{max-width:100%;max-height:100%;object-fit:contain;filter:drop-shadow(0 3px 8px rgba(0,0,0,.9))}
.tvtrack{flex:1;min-width:0;height:2.78cqh;border-radius:6px;position:relative;background:#6a6a72}
.tvfill{position:absolute;left:0;top:0;bottom:0;border-radius:6px;
  background:linear-gradient(90deg,var(--c1) 0%,var(--c2) 100%);
  transition:width 1.6s cubic-bezier(.22,1,.36,1);animation:tvglow 4s ease-in-out infinite}
.tvlnum{width:2.4cqw;flex-shrink:0;text-align:right;font-size:1.77cqw;font-weight:600;line-height:1}
.tvlflag{width:5cqw;flex-shrink:0;text-align:right;font-size:.83cqw;font-weight:400}

.tvs2{display:flex;align-items:center;gap:.45cqw;font-size:1.25cqw;font-weight:600;letter-spacing:.04em;text-transform:uppercase;margin-bottom:1.4cqh}
.tvitm{border-radius:.6cqw;padding:1.2cqh 1cqw;display:flex;align-items:center;gap:.9cqw;flex:1 1 auto;min-height:max-content}
.tvitm .nm{font-size:1.25cqw;line-height:1.35;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.tvitm .sub{font-size:.92cqw;line-height:1.4;font-weight:300;color:#8b8b9e;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:.3cqh}
.tvmini{border-radius:.6cqw;padding:1.1cqh .9cqw;flex:1 1 auto;min-height:max-content;display:flex;flex-direction:column;justify-content:center}
.tvmini .nm{font-size:1.12cqw;line-height:1.35;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.tvmini .sub{font-size:.86cqw;line-height:1.4;font-weight:300;color:#8b8b9e;margin-top:.3cqh}
.tvdays{font-family:'Unbounded',sans-serif;font-size:2cqw;font-weight:700;color:#ef4444;width:4cqw;text-align:center;flex-shrink:0;line-height:1}
.tvtag{font-size:.75cqw;font-weight:500;border-radius:.35cqw;padding:.3cqh .55cqw;white-space:nowrap}
.tvstrip{height:14.5cqh;flex-direction:row;align-items:center;padding:0 1.6cqw;flex-shrink:0}
.tvstat{flex:1;text-align:center}
.tvstat .v{font-family:'Unbounded',sans-serif;font-size:2.4cqw;font-weight:700;line-height:1}
.tvstat .l{font-size:.85cqw;font-weight:400;color:#8b8b9e;margin-top:.6cqh;text-transform:uppercase;letter-spacing:.06em}

.tvparty{position:absolute;inset:0;z-index:50;background:rgba(5,5,8,.95);display:flex;align-items:center;justify-content:center;overflow:hidden;animation:tvpop .5s ease both}
.tvcf{position:absolute;top:0;border-radius:2px;display:block}
.tvstandby{position:absolute;inset:0;z-index:60;background:#050508;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3cqh}

.tvsound{position:absolute;right:2.08cqw;bottom:2.6cqh;z-index:70;display:flex;align-items:center;gap:.6cqw;
  background:rgba(255,255,255,.09);border:1px solid rgba(255,255,255,.2);border-radius:99px;
  padding:1.1cqh 1.5cqw;color:#fff;font-family:'Lexend',sans-serif;font-size:1cqw;font-weight:500;cursor:pointer;
  -webkit-backdrop-filter:blur(16px);backdrop-filter:blur(16px)}
`;

// ─── Blocos reutilizáveis ──────────────────────────────────────
function Card({ children, className = '', style }) {
  return <div className={`tvcard ${className}`} style={style}>{children}</div>;
}

function Stat({ value, label, color }) {
  return (
    <div className="tvstat">
      <div className="v" style={{ color }}>{value}</div>
      <div className="l">{label}</div>
    </div>
  );
}

function Dot({ color, size = '.85cqw' }) {
  return (
    <span style={{
      width: size, height: size, borderRadius: '50%', background: color,
      boxShadow: `0 0 10px ${color}`, flexShrink: 0, display: 'inline-block',
    }} />
  );
}

function Mascot({ sectorId }) {
  const s = SQUAD[sectorId];
  if (!s) return <div className="tvmascot" />;
  return (
    <div className="tvmascot" title={s.squad}>
      <img src={s.logo} alt={s.squad} />
    </div>
  );
}

function Tag({ sectorId }) {
  const s = SQUAD[sectorId];
  if (!s) return null;
  return (
    <span className="tvtag" style={{ color: s.c1, background: `${s.c1}1f`, border: `1px solid ${s.c1}44` }}>
      {s.squad}
    </span>
  );
}

// ─── Cena 1: Operacional ───────────────────────────────────────
function SceneToday({ d }) {
  const card = (Icon, label, value, color) => (
    <Card key={label}>
      <div className="tvlbl" style={{ color }}><Icon size={24} strokeWidth={2.2} /><span>{label}</span></div>
      <div className="tvnum" style={{ color }}>{pad2(value)}</div>
    </Card>
  );

  return (
    <div className="tvscene">
      <div className="tvtitle">Operacional</div>
      <div className="tvstats" style={{ height: '21.7cqh' }}>
        {card(CheckCircle2, 'Entregues hoje', d.counts.doneToday, '#22c55e')}
        {card(Zap, 'Em produção', d.counts.doing, '#38bdf8')}
        {card(Eye, 'Em aprovação', d.counts.approval, '#f5a623')}
        {card(AlarmClock, 'Atrasadas', d.counts.overdue, '#ef4444')}
      </div>
      <div className="tvsect">Carga por Setor · Tasks em Aberto</div>
      <div className="tvloads">
        {d.bySector.map(s => {
          const sq = SQUAD[s.id] || {};
          return (
            <div className="tvlrow" key={s.id}>
              <Mascot sectorId={s.id} />
              <div className="tvtrack">
                <div
                  className="tvfill"
                  style={{
                    '--c1': sq.c1, '--c2': sq.c2,
                    width: `${Math.round((s.active / d.maxSectorLoad) * 100)}%`,
                  }}
                />
              </div>
              <div className="tvlnum">{pad2(s.active)}</div>
              <div className="tvlflag" style={{ color: s.overdue ? '#ef4444' : '#5c5c6b' }}>
                {s.overdue ? `${pad2(s.overdue)} atrasada${s.overdue > 1 ? 's' : ''}` : 'em dia'}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Cena 2: Zona de Atenção ───────────────────────────────────
function SceneAlert({ d }) {
  return (
    <div className="tvscene">
      <div className="tvtitle">Zona de Atenção</div>

      <div style={{ height: '51cqh', display: 'flex', gap: '1.6cqw', flexShrink: 0 }}>
        <div style={{ flex: 1.4, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <div className="tvs2" style={{ color: '#ef4444' }}>
            <Flame size={22} strokeWidth={2.2} /> Entregas atrasadas ({pad2(d.overdueList.length)})
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1cqh', minHeight: 0 }}>
            {d.overdueList.slice(0, 6).map(t => (
              <div className="tvitm" key={t.id}
                style={{ background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.28)' }}>
                <div className="tvdays">{t.days}d</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="nm">{t.name}</div>
                  <div className="sub">{t.clientName} · {t.who}</div>
                </div>
                <Tag sectorId={t.sector} />
              </div>
            ))}
            {d.overdueList.length === 0 && (
              <div className="tvitm" style={{ background: 'rgba(34,197,94,.08)', border: '1px solid rgba(34,197,94,.28)', justifyContent: 'center' }}>
                <CheckCircle2 size={34} color="#22c55e" />
                <div className="nm" style={{ color: '#22c55e' }}>Nenhuma entrega atrasada</div>
              </div>
            )}
          </div>
        </div>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '2.2cqh', minWidth: 0 }}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <div className="tvs2" style={{ color: '#f5a623' }}>
              <Eye size={22} strokeWidth={2.2} /> Paradas em aprovação (2d+)
            </div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '.9cqh', minHeight: 0 }}>
              {d.stuckApproval.slice(0, 3).map(t => (
                <div className="tvmini" key={t.id}
                  style={{ background: 'rgba(245,166,35,.08)', border: '1px solid rgba(245,166,35,.28)' }}>
                  <div className="nm">{t.name}</div>
                  <div className="sub">aguarda {t.who} há {t.days}d</div>
                </div>
              ))}
              {d.stuckApproval.length === 0 && (
                <div className="tvmini" style={{ background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.08)' }}>
                  <div className="sub" style={{ marginTop: 0 }}>Fila de aprovação limpa.</div>
                </div>
              )}
            </div>
          </div>

          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <div className="tvs2" style={{ color: '#a78bfa' }}>
              <RotateCw size={22} strokeWidth={2.2} /> Em ajuste / refação
            </div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '.9cqh', minHeight: 0 }}>
              {d.reworkList.slice(0, 3).map(t => (
                <div className="tvmini" key={t.id}
                  style={{ background: 'rgba(167,139,250,.08)', border: '1px solid rgba(167,139,250,.28)' }}>
                  <div className="nm">{t.name}</div>
                  <div className="sub">{t.clientName} · {t.who} · {t.count}ª volta</div>
                </div>
              ))}
              {d.reworkList.length === 0 && (
                <div className="tvmini" style={{ background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.08)' }}>
                  <div className="sub" style={{ marginTop: 0 }}>Nada em refação agora.</div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <Card className="tvstrip" style={{ marginTop: '2.6cqh' }}>
        <Stat value={pad2(d.overdueList.length)} label="Entregas atrasadas" color="#ef4444" />
        <Stat value={`${d.maxLate}d`} label="Maior atraso" color="#ef4444" />
        <Stat value={pad2(d.counts.approval)} label="Aguardando aprovação" color="#f5a623" />
        <Stat value={pad2(d.reworkList.length)} label="Em refação" color="#a78bfa" />
      </Card>
    </div>
  );
}

// ─── Cena 3: Destaques da Semana ───────────────────────────────
function SceneHighlights({ d }) {
  return (
    <div className="tvscene">
      <div className="tvtitle">Destaques da Semana</div>

      <div style={{ display: 'flex', gap: '1.3cqw', height: '49cqh', flexShrink: 0 }}>
        {d.highlights.map(h => {
          const Icon = BADGE_ICON[h.icon] || Target;
          const vazio = !h.name;
          return (
            <Card
              key={h.badge}
              style={{
                justifyContent: 'flex-start',
                textAlign: 'center',
                padding: '2.4cqh 1.1cqw',
                borderColor: vazio ? 'rgba(255,255,255,.08)' : `${h.accent}3d`,
                boxShadow: vazio
                  ? 'inset 0 1px 0 rgba(255,255,255,.15), 0 18px 44px rgba(0,0,0,.5)'
                  : `inset 0 1px 0 rgba(255,255,255,.26), 0 18px 44px rgba(0,0,0,.5), 0 0 46px -18px ${h.accent}`,
                opacity: vazio ? 0.5 : 1,
              }}
            >
              <div style={{ position: 'relative', display: 'flex', justifyContent: 'center' }}>
                <Icon size={46} strokeWidth={1.9} color={vazio ? '#6b6b7d' : h.accent} />
              </div>
              <div style={{
                position: 'relative', fontSize: '.88cqw', fontWeight: 600, letterSpacing: '.09em',
                textTransform: 'uppercase', color: vazio ? '#6b6b7d' : h.accent, marginTop: '.9cqh', lineHeight: 1.3,
              }}>{h.badge}</div>

              <div style={{
                position: 'relative', height: '9cqh', display: 'flex', alignItems: 'center',
                justifyContent: 'center', margin: '1.6cqh 0 1.1cqh',
              }}>
                {h.sector && SQUAD[h.sector] && (
                  <img src={SQUAD[h.sector].logo} alt=""
                    style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', filter: 'drop-shadow(0 3px 10px rgba(0,0,0,.9))' }} />
                )}
              </div>

              <div style={{
                position: 'relative', fontSize: '1.32cqw', fontWeight: 600, lineHeight: 1.2,
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>{h.name || 'Sem destaque'}</div>
              <div style={{ position: 'relative', fontSize: '.8cqw', fontWeight: 300, color: '#8b8b9e', marginTop: '.3cqh' }}>
                {h.sector && SQUAD[h.sector] ? SQUAD[h.sector].squad : '—'}
              </div>

              <div style={{
                position: 'relative', fontFamily: "'Unbounded',sans-serif", fontSize: '2.5cqw',
                fontWeight: 700, color: vazio ? '#6b6b7d' : h.accent, lineHeight: 1, marginTop: '1.8cqh',
              }}>{h.value}</div>
              <div style={{ position: 'relative', fontSize: '.8cqw', fontWeight: 300, color: '#8b8b9e', marginTop: '.6cqh' }}>
                {h.caption}
              </div>
            </Card>
          );
        })}
      </div>

      <Card className="tvstrip" style={{ marginTop: '3.2cqh' }}>
        <Stat value={pad2(d.weekStats.total)} label="Entregas na semana" color="#fff" />
        <Stat value={`${d.weekStats.cleanRate}%`} label="Aprovadas de primeira" color="#22c55e" />
        <Stat value={`${d.weekStats.onTime}%`} label="Dentro do prazo" color="#38bdf8" />
        <Stat value={pad2(d.weekStats.clients)} label="Clientes atendidos" color="#EE3363" />
      </Card>
    </div>
  );
}

// ─── Cena 4: Saúde da Carteira ─────────────────────────────────
function SceneHealth({ d }) {
  const order = ['green', 'yellow', 'orange', 'red'];
  return (
    <div className="tvscene">
      <div className="tvtitle">Saúde da Carteira</div>

      <div className="tvstats" style={{ height: '21.7cqh' }}>
        {order.map(k => {
          const lv = HEALTH_LEVELS_4[k];
          return (
            <Card key={k}>
              <div className="tvlbl" style={{ color: lv.color, fontSize: '1.2cqw' }}>
                <Dot color={lv.color} /> {lv.label}
              </div>
              <div className="tvnum" style={{ color: lv.color, fontSize: '4.6cqw' }}>
                {pad2(d.healthCount[k] || 0)}
              </div>
            </Card>
          );
        })}
      </div>

      <div style={{ flex: 1, minHeight: 0, marginTop: '4cqh', display: 'flex', flexDirection: 'column' }}>
        <div className="tvs2">Clientes que pedem atenção · {d.totalClients} ativos na carteira</div>
        {d.criticalClients.length === 0 ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1.5cqh', color: '#22c55e' }}>
            <CheckCircle2 size={90} strokeWidth={1.5} />
            <div style={{ fontSize: '2.2cqw', fontWeight: 700 }}>Carteira inteira em dia.</div>
          </div>
        ) : (
          <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1cqh 1.4cqw', alignContent: 'start' }}>
            {d.criticalClients.slice(0, 8).map(c => {
              const lv = HEALTH_LEVELS_4[c.level];
              return (
                <div className="tvitm" key={c.id}
                  style={{ background: 'rgba(255,255,255,.04)', border: `1px solid ${lv.color}33`, flex: '0 0 auto' }}>
                  <Dot color={lv.color} size=".9cqw" />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="nm">{c.name}</div>
                    <div className="sub">{c.reason}{c.cs ? ` · CS: ${c.cs}` : ''}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Comemoração de entrega ────────────────────────────────────
function Celebration({ data }) {
  const pieces = useMemo(() => Array.from({ length: 70 }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    delay: Math.random() * 1.6,
    dur: 2.6 + Math.random() * 2.2,
    size: 8 + Math.random() * 12,
    color: CONFETTI[i % CONFETTI.length],
  })), []);

  const sq = SQUAD[data.sector] || {};
  const color = sq.c1 || '#EE3363';

  return (
    <div className="tvparty">
      {pieces.map(p => (
        <span key={p.id} className="tvcf" style={{
          left: `${p.left}%`, width: p.size, height: p.size * 0.5, background: p.color,
          animation: `tvfall ${p.dur}s linear ${p.delay}s infinite`,
        }} />
      ))}

      <div style={{ position: 'relative', textAlign: 'center', padding: '0 6cqw' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '.9cqw', color: '#22c55e', marginBottom: '2.2cqh' }}>
          <Trophy size={40} strokeWidth={2} />
          <span style={{ fontSize: '1.5cqw', fontWeight: 600, letterSpacing: '.1em', textTransform: 'uppercase' }}>
            Entrega concluída
          </span>
          <Trophy size={40} strokeWidth={2} />
        </div>

        <div style={{ fontFamily: "'Unbounded',sans-serif", fontSize: '3.2cqw', fontWeight: 700, lineHeight: 1.18, marginBottom: '1.4cqh', letterSpacing: '-.02em' }}>
          {data.taskName}
        </div>
        <div style={{ fontSize: '1.5cqw', fontWeight: 300, color: '#8b8b9e', marginBottom: '3.2cqh' }}>
          {data.clientName}
        </div>

        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: '.9cqw',
          background: `${color}1f`, border: `1px solid ${color}66`,
          borderRadius: '.9cqw', padding: '1.7cqh 2.2cqw', boxShadow: `0 0 50px -12px ${color}`,
        }}>
          {sq.logo && <img src={sq.logo} alt="" style={{ height: '7cqh', objectFit: 'contain' }} />}
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontSize: '.82cqw', fontWeight: 300, color: '#8b8b9e', textTransform: 'uppercase', letterSpacing: '.08em' }}>
              Entregue por
            </div>
            <div style={{ fontFamily: "'Unbounded',sans-serif", fontSize: '1.9cqw', fontWeight: 700, color }}>
              {data.by}
            </div>
          </div>
        </div>

        {data.clean && (
          <div style={{ marginTop: '2.4cqh', fontSize: '1.2cqw', fontWeight: 500, color: '#22c55e', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '.45cqw' }}>
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

  // Cena travada pelo admin tem prioridade sobre a rotação.
  const lockedIndex = d.tvLockScene ? SCENES.findIndex(s => s.id === d.tvLockScene) : -1;
  const activeIndex = lockedIndex >= 0 ? lockedIndex : sceneIndex;
  const scene = SCENES[activeIndex];

  // Escala o palco de 1920×1080 para caber em qualquer tela.
  useEffect(() => {
    const fit = () => setScale(Math.min(window.innerWidth / 1920, window.innerHeight / 1080));
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, []);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  // Rotação. Pausa durante a comemoração para ninguém perder a festa.
  useEffect(() => {
    if (d.celebration || lockedIndex >= 0 || d.tvPaused) return undefined;
    const id = setTimeout(() => setSceneIndex(i => (i + 1) % SCENES.length), scene.duration);
    return () => clearTimeout(id);
  }, [sceneIndex, scene.duration, d.celebration, lockedIndex, d.tvPaused]);

  // Comemoração: 12s na tela e volta ao fluxo normal.
  useEffect(() => {
    if (!d.celebration) return undefined;
    const id = setTimeout(() => d.dismissCelebration(), 12000);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d.celebration]);

  // Reload automático às 4h — um navegador aberto por semanas degrada.
  useEffect(() => {
    const alvo = new Date();
    alvo.setHours(4, 0, 0, 0);
    if (alvo <= new Date()) alvo.setDate(alvo.getDate() + 1);
    const id = setTimeout(() => window.location.reload(), alvo.getTime() - Date.now());
    return () => clearTimeout(id);
  }, []);

  // ── Rádio ────────────────────────────────────────────────────
  // A URL, o play/pause e o volume vêm do painel admin e chegam aqui
  // em tempo real. O navegador não deixa tocar som sem um gesto do
  // usuário: quando ele bloqueia, aparece um botão discreto no canto
  // e um único clique libera o áudio pelo resto da sessão.
  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    const v = Number(d.tvRadioVolume);
    el.volume = Math.min(1, Math.max(0, (Number.isFinite(v) ? v : 50) / 100));
  }, [d.tvRadioVolume, d.tvRadioUrl]);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    if (!d.tvRadioUrl || !d.tvRadioPlaying) {
      el.pause();
      setAudioBlocked(false);
      return;
    }
    el.play().then(() => setAudioBlocked(false)).catch(() => setAudioBlocked(true));
  }, [d.tvRadioUrl, d.tvRadioPlaying]);

  const liberarSom = () => {
    const el = audioRef.current;
    if (!el) return;
    el.play().then(() => setAudioBlocked(false)).catch(() => setAudioBlocked(true));
  };

  // Anti burn-in: desloca o conteúdo alguns pixels a cada cena.
  const shift = (activeIndex % 4) * 3;

  const stageStyle = {
    transform: `translate(-50%,-50%) scale(${scale})`,
  };

  return (
    <div className="tvroot">
      <style>{CSS}</style>

      {d.tvRadioUrl && (
        <audio key={d.tvRadioUrl} ref={audioRef} src={d.tvRadioUrl} preload="none" />
      )}

      <div className="tvstage" style={stageStyle}>
        <div className="tvbar">
          <div key={`${activeIndex}_${d.celebration ? 'p' : 'r'}`} style={{
            animation: (d.celebration || lockedIndex >= 0 || d.tvPaused)
              ? 'none' : `tvprog ${scene.duration}ms linear forwards`,
            width: lockedIndex >= 0 ? '100%' : undefined,
          }} />
        </div>

        {d.authError ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '2cqh' }}>
            <div style={{ fontSize: '1.8cqw', fontWeight: 600, color: '#ef4444' }}>{d.authError}</div>
            <div style={{ fontSize: '1.1cqw', color: '#8b8b9e' }}>
              Habilite o provedor Anônimo em Authentication → Sign-in method no Firebase.
            </div>
          </div>
        ) : d.loading ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6b6b7d', fontSize: '1.6cqw' }}>
            Carregando o painel…
          </div>
        ) : (
          <div className="tvbody" style={{ transform: `translate(${shift}px,${shift}px)` }}>
            <div className="tvhdr">
              <img className="tvlogo" src="/agencia.png" alt="Lince Performance" />
              <div>
                <div className="tvclock">
                  {now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                </div>
                <div className="tvdateline">
                  <span className={`tvlive ${d.online ? '' : 'off'}`} />
                  <span className="tvdate">
                    {capitalize(now.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' }))}
                  </span>
                </div>
              </div>
            </div>

            {scene.id === 'today' && <SceneToday d={d} key="today" />}
            {scene.id === 'alert' && <SceneAlert d={d} key="alert" />}
            {scene.id === 'highlights' && <SceneHighlights d={d} key="highlights" />}
            {scene.id === 'health' && <SceneHealth d={d} key="health" />}
          </div>
        )}

        {d.celebration && <Celebration data={d.celebration} key={d.celebration.key} />}

        {audioBlocked && (
          <button className="tvsound" onClick={liberarSom}>
            <Volume2 size={22} strokeWidth={2.2} /> Ligar som
          </button>
        )}

        {d.tvPaused && (
          <div className="tvstandby">
            <img src="/agencia.png" alt="Lince Performance" style={{ height: '7cqh', opacity: .9 }} />
            <div style={{ fontFamily: "'Unbounded',sans-serif", fontSize: '5cqw', fontWeight: 400 }}>
              {now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '.8cqw', color: '#6b6b7d', fontSize: '1.3cqw' }}>
              <PauseCircle size={26} />
              {d.tvPauseMessage || 'Painel em manutenção'}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
