import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

// ─── Sector config ─────────────────────────────────────────────
// Para trocar a logo: coloque o arquivo em /public/logos/ e atualize o campo `logo`
// Ex: logo: '/logos/webdesign.png'
const SECTORS = [
  { id: 'webdesign',   label: 'WebDesign',    route: '/login/webdesign',   color: '#EE3363', emoji: '🌐', logo: null },
  { id: 'videomaker',  label: 'VideoMaker',   route: '/login/videomaker',  color: '#fb923c', emoji: '🎬', logo: null },
  { id: 'socialmedia', label: 'Social Media', route: '/login/socialmedia', color: '#38bdf8', emoji: '📱', logo: null },
  { id: 'design',      label: 'Design',       route: '/login/design',      color: '#a78bfa', emoji: '🎨', logo: null },
  { id: 'cs',          label: 'CS',           route: '/login/cs',          color: '#22c55e', emoji: '🎧', logo: null },
  { id: 'trafego',     label: 'Tráfego Pago', route: '/login/trafego',     color: '#f59e0b', emoji: '📊', logo: null },
  { id: 'comercial',   label: 'Comercial',    route: '/login/comercial',   color: '#e879f9', emoji: '💼', logo: null },
];

export default function HomePage() {
  const navigate = useNavigate();
  const [hovered, setHovered] = useState(null);

  // Split: first row 4, second row 3 centered
  const row1 = SECTORS.slice(0, 4);
  const row2 = SECTORS.slice(4);

  const SectorCard = ({ sector }) => {
    const isHov = hovered === sector.id;
    return (
      <button
        style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14,
          background: 'transparent', border: 'none', cursor: 'pointer', padding: 0,
          transition: 'transform .25s ease',
          transform: isHov ? 'translateY(-6px) scale(1.04)' : 'translateY(0) scale(1)',
        }}
        onClick={() => navigate(sector.route)}
        onMouseEnter={() => setHovered(sector.id)}
        onMouseLeave={() => setHovered(null)}
      >
        <div style={{ position: 'relative' }}>
          {sector.logo ? (
            <img
              src={sector.logo}
              alt={sector.label}
              style={{
                width: 160, height: 160, objectFit: 'contain',
                filter: isHov
                  ? `drop-shadow(0 0 24px ${sector.color}90)`
                  : `drop-shadow(0 0 8px ${sector.color}35)`,
                transition: 'filter .25s ease',
              }}
            />
          ) : (
            <div style={{
              width: 160, height: 160, borderRadius: 20,
              background: `radial-gradient(circle at 40% 35%, ${sector.color}28, ${sector.color}08)`,
              border: `2px solid ${sector.color}${isHov ? '50' : '25'}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 52,
              boxShadow: isHov ? `0 0 36px ${sector.color}30` : 'none',
              transition: 'all .25s ease',
            }}>
              {sector.emoji}
            </div>
          )}
        </div>
        <span style={{
          fontSize: 15, fontWeight: 700,
          color: isHov ? '#fff' : 'rgba(255,255,255,0.7)',
          transition: 'color .2s',
        }}>
          {sector.label}
        </span>
      </button>
    );
  };

  return (
    <div style={S.page}>
      <div style={S.grid} />
      <div style={S.glow} />

      <div style={S.content}>
        <div style={{ textAlign: 'center' }}>
          <h1 style={S.title}>Squad <span style={{ color: 'var(--neon)' }}>MVPs</span></h1>
          <p style={S.sub}>Selecione seu setor para acessar o dashboard</p>
        </div>

        {/* Row 1 — 4 sectors */}
        <div style={{ display: 'flex', gap: 40, alignItems: 'flex-end', justifyContent: 'center', flexWrap: 'wrap' }}>
          {row1.map(s => <SectorCard key={s.id} sector={s} />)}
        </div>

        {/* Row 2 — 3 sectors centered */}
        <div style={{ display: 'flex', gap: 40, alignItems: 'flex-end', justifyContent: 'center', flexWrap: 'wrap' }}>
          {row2.map(s => <SectorCard key={s.id} sector={s} />)}
        </div>

        <button style={S.adminLink} onClick={() => navigate('/login/admin')}>
          acesso administrativo
        </button>
      </div>
    </div>
  );
}

const S = {
  page: { minHeight: '100vh', background: '#07070e', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' },
  grid: { position: 'fixed', inset: 0, pointerEvents: 'none', backgroundImage: 'linear-gradient(rgba(238,51,99,.025) 1px,transparent 1px),linear-gradient(90deg,rgba(238,51,99,.025) 1px,transparent 1px)', backgroundSize: '32px 32px' },
  glow: { position: 'fixed', width: 800, height: 800, borderRadius: '50%', background: 'radial-gradient(circle,rgba(238,51,99,.06) 0%,transparent 65%)', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', pointerEvents: 'none' },
  content: { position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 48, padding: '40px 32px', width: '100%' },
  title: { fontSize: 40, fontWeight: 800, color: '#fff', letterSpacing: '-1px', marginBottom: 10 },
  sub: { fontSize: 14, color: 'var(--muted)' },
  adminLink: { background: 'none', border: 'none', color: 'rgba(255,255,255,.18)', fontSize: 11, letterSpacing: '.1em', fontFamily: 'var(--fm)', cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 3, transition: 'color .2s' },
};
