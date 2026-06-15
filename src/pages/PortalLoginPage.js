import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Package } from 'lucide-react';
import { usePortalAuth } from '../contexts/PortalAuthContext';

const ACCENT = '#EE3363';

/*
 * Porta de login do CLIENTE do Portal de Coleta. Totalmente separada
 * da tela de login da agência. Rota: /portal/login
 */
export default function PortalLoginPage() {
  const { login } = usePortalAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setBusy(true);
    const r = await login(username, password);
    setBusy(false);
    if (r.success) navigate('/portal');
    else setError(r.error);
  };

  return (
    <div style={S.page}>
      <div style={S.grid} />
      <div style={{ ...S.glow, background: `radial-gradient(circle,${ACCENT}14 0%,transparent 65%)` }} />

      <div style={S.wrap}>
        <div style={{ ...S.card, border: `1px solid ${ACCENT}28`, boxShadow: `0 0 60px ${ACCENT}10,0 24px 64px rgba(0,0,0,0.6)` }}>
          <div style={S.logoArea}>
            <div style={{
              width: 110, height: 110, borderRadius: 20,
              background: `radial-gradient(circle at 40% 35%,${ACCENT}25,${ACCENT}08)`,
              border: `2px solid ${ACCENT}30`, boxShadow: `0 0 28px ${ACCENT}20`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Package size={48} color={ACCENT} />
            </div>
          </div>

          <div style={{ textAlign: 'center', marginBottom: 28 }}>
            <h1 style={S.title}>Portal do Cliente<span style={{ color: ACCENT }}>.</span></h1>
            <p style={S.sub}>Cadastre seus produtos</p>
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16, width: '100%' }}>
            <div style={S.field}>
              <label style={S.label}>USUÁRIO</label>
              <input style={S.input} type="text" value={username} onChange={e => setUsername(e.target.value)} placeholder="Seu usuário" autoFocus />
            </div>
            <div style={S.field}>
              <label style={S.label}>SENHA</label>
              <div style={{ position: 'relative' }}>
                <input style={{ ...S.input, paddingRight: 44 }} type={show ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" />
                <button type="button" style={S.eye} onClick={() => setShow(!show)}>
                  {show ? <EyeOff size={15} color="#8b8b9e" /> : <Eye size={15} color="#8b8b9e" />}
                </button>
              </div>
            </div>

            {error && <p style={{ fontSize: 13, color: ACCENT, textAlign: 'center' }}>{error}</p>}

            <button type="submit" disabled={busy} style={{ ...S.submit, background: `linear-gradient(135deg,${ACCENT},#c41f4a)`, opacity: busy ? 0.7 : 1 }}>
              {busy ? 'Entrando...' : 'Entrar'}
            </button>
          </form>

          <p style={{ fontSize: 11, color: '#6b6b80', textAlign: 'center', marginTop: 22, lineHeight: 1.5 }}>
            Acesso fornecido pela sua agência.<br />Problemas para entrar? Fale com seu contato.
          </p>
        </div>
      </div>
    </div>
  );
}

const S = {
  page: { minHeight: '100vh', background: '#07070e', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden', fontFamily: "'Outfit',sans-serif" },
  grid: { position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(255,255,255,.02) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.02) 1px,transparent 1px)', backgroundSize: '40px 40px' },
  glow: { position: 'absolute', width: 600, height: 600, top: '50%', left: '50%', transform: 'translate(-50%,-50%)', pointerEvents: 'none' },
  wrap: { position: 'relative', zIndex: 1, width: '100%', maxWidth: 380, padding: 20 },
  card: { background: 'rgba(14,14,28,.9)', backdropFilter: 'blur(20px)', borderRadius: 24, padding: '36px 32px', display: 'flex', flexDirection: 'column', alignItems: 'center' },
  logoArea: { marginBottom: 20 },
  title: { fontSize: 24, fontWeight: 800, color: '#fff', letterSpacing: '-.5px' },
  sub: { fontSize: 12, color: '#8b8b9e', fontFamily: "'JetBrains Mono',monospace", letterSpacing: '.1em', marginTop: 4, textTransform: 'uppercase' },
  field: { display: 'flex', flexDirection: 'column', gap: 6 },
  label: { fontSize: 10, letterSpacing: '.14em', color: '#8b8b9e', fontWeight: 600, fontFamily: "'JetBrains Mono',monospace" },
  input: { background: 'rgba(20,20,38,.8)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 10, padding: '12px 14px', color: '#fff', fontSize: 14, outline: 'none', width: '100%', fontFamily: "'Outfit',sans-serif" },
  eye: { position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex' },
  submit: { border: 'none', borderRadius: 10, padding: '13px', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', marginTop: 4 },
};
