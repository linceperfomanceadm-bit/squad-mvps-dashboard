import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SECTORS } from '../lib/firebase';

const SECTOR_CONFIGS = [
  { ...SECTORS.webdesign,   route: '/login/webdesign',   bg: 'rgba(238,51,99,0.08)',   border: 'rgba(238,51,99,0.3)',   glow: 'rgba(238,51,99,0.15)' },
  { ...SECTORS.design,      route: '/login/design',      bg: 'rgba(167,139,250,0.08)', border: 'rgba(167,139,250,0.3)', glow: 'rgba(167,139,250,0.15)' },
  { ...SECTORS.socialmedia, route: '/login/socialmedia', bg: 'rgba(56,189,248,0.08)',  border: 'rgba(56,189,248,0.3)',  glow: 'rgba(56,189,248,0.15)' },
  { ...SECTORS.videomaker,  route: '/login/videomaker',  bg: 'rgba(251,146,60,0.08)',  border: 'rgba(251,146,60,0.3)',  glow: 'rgba(251,146,60,0.15)' },
];

export default function HomePage() {
  const navigate = useNavigate();
  const [hovered, setHovered] = useState(null);

  return (
    <div style={S.page}>
      <div style={S.grid} />
      <div style={S.glow} />

      <div style={S.content} className="fade-up">
        <div style={S.header}>
          <h1 style={S.title}>Squad <span style={{ color: 'var(--neon)' }}>MVPs</span></h1>
          <p style={S.sub}>Selecione seu setor para acessar o dashboard</p>
        </div>

        <div style={S.cardsGrid}>
          {SECTOR_CONFIGS.map(sector => (
            <button
              key={sector.id}
              style={{
                ...S.card,
                background: hovered === sector.id ? sector.bg : 'rgba(12,12,24,0.8)',
                border: `1px solid ${hovered === sector.id ? sector.border : 'rgba(255,255,255,0.07)'}`,
                boxShadow: hovered === sector.id ? `0 0 40px ${sector.glow}, 0 8px 32px rgba(0,0,0,0.4)` : '0 4px 24px rgba(0,0,0,0.3)',
                transform: hovered === sector.id ? 'translateY(-4px)' : 'translateY(0)',
              }}
              onClick={() => navigate(sector.route)}
              onMouseEnter={() => setHovered(sector.id)}
              onMouseLeave={() => setHovered(null)}
            >
              <div style={{ ...S.cardIcon, background: sector.bg, border: `1px solid ${sector.border}`, boxShadow: `0 0 20px ${sector.glow}` }}>
                <span style={{ fontSize: 36 }}>{sector.emoji}</span>
              </div>
              <div style={S.cardLabel}>{sector.label}</div>
              <div style={{ ...S.cardArrow, color: sector.color, opacity: hovered === sector.id ? 1 : 0 }}>Entrar →</div>
            </button>
          ))}
        </div>

        <button style={S.adminLink} onClick={() => navigate('/login/admin')}>
          acesso administrativo
        </button>
      </div>
    </div>
  );
}

const S = {
  page: { minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' },
  grid: { position: 'fixed', inset: 0, backgroundImage: 'linear-gradient(rgba(238,51,99,.025) 1px,transparent 1px),linear-gradient(90deg,rgba(238,51,99,.025) 1px,transparent 1px)', backgroundSize: '32px 32px', pointerEvents: 'none' },
  glow: { position: 'fixed', width: 600, height: 600, borderRadius: '50%', background: 'radial-gradient(circle,rgba(238,51,99,.07) 0%,transparent 65%)', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', pointerEvents: 'none' },
  content: { position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 48, padding: 32 },
  header: { textAlign: 'center' },
  title: { fontSize: 42, fontWeight: 800, color: '#fff', letterSpacing: '-1px', marginBottom: 10 },
  sub: { fontSize: 15, color: 'var(--muted)' },
  cardsGrid: { display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 20, maxWidth: 600, width: '100%' },
  card: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, padding: '36px 24px', borderRadius: 20, cursor: 'pointer', transition: 'all .25s ease', backdropFilter: 'blur(12px)' },
  cardIcon: { width: 80, height: 80, borderRadius: 20, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  cardLabel: { fontSize: 16, fontWeight: 700, color: '#fff' },
  cardArrow: { fontSize: 13, fontWeight: 600, transition: 'opacity .2s', fontFamily: 'var(--fm)' },
  adminLink: { background: 'none', border: 'none', color: 'rgba(255,255,255,0.2)', fontSize: 11, letterSpacing: '.1em', fontFamily: 'var(--fm)', cursor: 'pointer', transition: 'color .2s', textDecoration: 'underline', textUnderlineOffset: 3 },
};
