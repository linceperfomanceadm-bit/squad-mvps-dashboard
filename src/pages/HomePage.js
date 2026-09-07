import React, { useState } from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme, useBrandLogo } from '../contexts/ThemeContext';
import { useNavigate } from 'react-router-dom';

// ─── Sector config ─────────────────────────────────────────────
// Para trocar a logo: coloque o arquivo em /public/logos/ e atualize o campo `logo`
// Ex: logo: '/logos/webdesign.png'
const SECTORS = [
  { id: 'webdesign',   label: 'WebDesign',    route: '/login/webdesign',   color: '#FD2534', emoji: '🌐', logo: '/logos/webdesign.png' },
  { id: 'videomaker',  label: 'VideoMaker',   route: '/login/videomaker',  color: '#3636D1', emoji: '🎬', logo: '/logos/videomaker.png' },
  { id: 'socialmedia', label: 'Social Media', route: '/login/socialmedia', color: '#E91E63', emoji: '📱', logo: '/logos/socialmedia.png' },
  { id: 'design',      label: 'Design',       route: '/login/design',      color: '#8F97A0', emoji: '🎨', logo: '/logos/design.png' },
  { id: 'cs',          label: 'CS',           route: '/login/cs',          color: '#3EFFFF', emoji: '🎧', logo: '/logos/cs.png' },
  { id: 'trafego',     label: 'Tráfego Pago', route: '/login/trafego',     color: '#FFC107', emoji: '📊', logo: '/logos/trafego.png' },
];

export default function HomePage() {
  const brand = useBrandLogo();
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();
  const [hovered, setHovered] = useState(null);

  // Split: 3 setores por linha, centralizados
  const row1 = SECTORS.slice(0, 3);
  const row2 = SECTORS.slice(3);

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
          fontSize: 15, fontWeight: 600,
          color: isHov ? 'var(--text)' : 'var(--muted)',
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

      {/* Tema: aqui e no login, porque quem entra já escolhe como quer ver o app */}
      <button
        onClick={toggle}
        title={theme === 'light' ? 'Mudar para o tema escuro' : 'Mudar para o tema claro'}
        style={{ position: 'absolute', top: 20, right: 20, width: 38, height: 38, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg2)', border: '1px solid var(--border)', color: 'var(--muted)', cursor: 'pointer', zIndex: 2 }}
      >
        {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
      </button>

      <div style={S.content}>
        <div style={{ textAlign: 'center' }}>
          <img src={brand} alt="Lince Performance" style={{ width: 180, objectFit: 'contain', marginBottom: 8 }} />
          <p style={S.sub}>Selecione seu setor para acessar o dashboard</p>
        </div>

        {/* Row 1 — 3 sectors */}
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
  page: { minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' },
  // Mesmo fundo do login: um halo largo, sem grade.
  grid: { display: 'none' },
  glow: { position: 'fixed', inset: 0, pointerEvents: 'none', background: 'radial-gradient(58% 44% at 50% 42%, var(--neon-dim), transparent 72%)' },
  content: { position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 48, padding: '40px 32px', width: '100%' },
  title: { fontSize: 40, fontWeight: 600, color: 'var(--text)', letterSpacing: '-1px', marginBottom: 10 },
  sub: { fontSize: 14, color: 'var(--muted)' },
  adminLink: { background: 'none', border: 'none', color: 'var(--muted)', fontSize: 11, letterSpacing: '.1em', fontFamily: 'var(--fm)', cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 3, transition: 'color .2s' },
};
