import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const SECTORS = [
  {
    id: 'webdesign',
    label: 'WebDesign',
    route: '/login/webdesign',
    color: '#EE3363',
    // Substitua o src abaixo pelo caminho da sua logo: ex: '/logos/webdesign.png'
    logo: '/webdesign.png',
    emoji: '🌐',
  },
  {
    id: 'videomaker',
    label: 'Videomaker',
    route: '/login/videomaker',
    color: '#a78bfa',
    logo: '/videomaker.png',
    emoji: '🎬',
  },
  {
    id: 'socialmedia',
    label: 'Social Media',
    route: '/login/socialmedia',
    color: '#38bdf8',
    logo: '/socialmedia.png',
    emoji: '📱',
  },
  {
    id: 'design',
    label: 'Design',
    route: '/login/design',
    color: '#fb923c',
    logo: '/design.png',
    emoji: '🎨',
  },
];

export default function HomePage() {
  const navigate = useNavigate();
  const [hovered, setHovered] = useState(null);

  return (
    <div style={S.page}>
      <div style={S.grid} />

      {/* Radial glow center */}
      <div style={S.glowCenter} />

      <div style={S.content}>
        {/* Title */}
        <div style={S.titleWrap}>
          <h1 style={S.title}>
            Squad <span style={{ color: 'var(--neon)' }}>MVPs</span>
          </h1>
          <p style={S.sub}>Selecione seu setor para acessar o dashboard</p>
        </div>

        {/* Sector cards */}
        <div style={S.cardsRow}>
          {SECTORS.map((sector) => {
            const isHov = hovered === sector.id;
            return (
              <button
                key={sector.id}
                style={{
                  ...S.card,
                  boxShadow: isHov
                    ? `0 0 60px ${sector.color}30, 0 12px 40px rgba(0,0,0,0.5)`
                    : '0 4px 24px rgba(0,0,0,0.3)',
                  transform: isHov ? 'translateY(-6px) scale(1.03)' : 'translateY(0) scale(1)',
                }}
                onClick={() => navigate(sector.route)}
                onMouseEnter={() => setHovered(sector.id)}
                onMouseLeave={() => setHovered(null)}
              >
                {/* Logo area */}
                <div style={S.logoWrap}>
                  {sector.logo ? (
                    <img
                      src={sector.logo}
                      alt={sector.label}
                      style={{
                        ...S.logoImg,
                        filter: isHov
                          ? `drop-shadow(0 0 20px ${sector.color}90)`
                          : `drop-shadow(0 0 8px ${sector.color}40)`,
                      }}
                    />
                  ) : (
                    /* Placeholder — substitua por <img> quando tiver a logo */
                    <div style={{
                      ...S.logoPlaceholder,
                      background: `radial-gradient(circle at 40% 35%, ${sector.color}30, ${sector.color}08)`,
                      border: `2px solid ${sector.color}35`,
                      boxShadow: isHov ? `0 0 32px ${sector.color}30` : 'none',
                    }}>
                      <span style={{ fontSize: 56 }}>{sector.emoji}</span>
                    </div>
                  )}
                </div>

                {/* Label */}
                <span style={{
                  ...S.cardLabel,
                  color: isHov ? '#fff' : 'rgba(255,255,255,0.75)',
                }}>
                  {sector.label}
                </span>
              </button>
            );
          })}
        </div>

        {/* Admin link */}
        <button style={S.adminLink} onClick={() => navigate('/login/admin')}>
          acesso administrativo
        </button>
      </div>
    </div>
  );
}

const S = {
  page: {
    minHeight: '100vh',
    background: '#07070e',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  grid: {
    position: 'fixed', inset: 0, pointerEvents: 'none',
    backgroundImage:
      'linear-gradient(rgba(238,51,99,.025) 1px,transparent 1px),' +
      'linear-gradient(90deg,rgba(238,51,99,.025) 1px,transparent 1px)',
    backgroundSize: '32px 32px',
  },
  glowCenter: {
    position: 'fixed',
    width: 800, height: 800, borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(238,51,99,.06) 0%, transparent 65%)',
    top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
    pointerEvents: 'none',
  },
  content: {
    position: 'relative', zIndex: 1,
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', gap: 56,
    padding: '40px 32px',
    width: '100%',
  },
  titleWrap: { textAlign: 'center' },
  title: {
    fontSize: 40, fontWeight: 800, color: '#fff',
    letterSpacing: '-1px', marginBottom: 10,
  },
  sub: { fontSize: 14, color: 'var(--muted)' },

  cardsRow: {
    display: 'flex',
    gap: 40,
    alignItems: 'flex-end',
    justifyContent: 'center',
    flexWrap: 'wrap',
  },
  card: {
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', gap: 16,
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    transition: 'transform .25s ease, box-shadow .25s ease',
    padding: 0,
  },
  logoWrap: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  logoImg: {
    width: 200, height: 200,
    objectFit: 'contain',
    transition: 'filter .25s ease',
  },
  logoPlaceholder: {
    width: 200, height: 200,
    borderRadius: 24,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    transition: 'all .25s ease',
  },
  cardLabel: {
    fontSize: 16, fontWeight: 700,
    transition: 'color .2s',
    fontFamily: 'var(--f)',
  },
  adminLink: {
    background: 'none', border: 'none',
    color: 'rgba(255,255,255,0.18)',
    fontSize: 11, letterSpacing: '.1em',
    fontFamily: 'var(--fm)',
    cursor: 'pointer',
    textDecoration: 'underline',
    textUnderlineOffset: 3,
    transition: 'color .2s',
  },
};
