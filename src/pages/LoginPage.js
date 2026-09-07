import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Eye, EyeOff, ArrowLeft } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useSectorTheme } from '../contexts/ThemeContext';
import { SECTORS, ADMIN_CONFIG } from '../lib/firebase';
import './Login.css';

// ─── Login + Primeiro Acesso ──────────────────────────────────
// Um card só, dois estados. A pessoa entra com ID e senha (a
// temporária, se for o primeiro acesso); se o login devolver
// firstAccess, o painel colorido desliza e o formulário de nova
// senha entra no lugar. Não existe caminho manual para o primeiro
// acesso — é o próprio login que decide.
//
// /first-access continua existindo (FirstAccessPage renderiza este
// componente com forceFirst) para quem já está logado e recarregou.

const SECTOR_CONFIG = { ...SECTORS, admin: ADMIN_CONFIG };

// Versão da cor do emblema calibrada para preencher o painel grande:
// todos os setores na mesma claridade, texto branco sempre legível.
const DEEP = {
  webdesign: '#591421', design: '#2D2F3A', socialmedia: '#591232',
  videomaker: '#222278', cs: '#14333D', trafego: '#382D15', admin: '#5C1428',
};

export default function LoginPage({ forceFirst = false }) {
  const params = useParams();
  const { user, loginCollaborator, loginAdmin, changePassword } = useAuth();
  const navigate = useNavigate();

  const sectorId = params.sectorId || user?.sector || 'admin';
  const isAdmin = sectorId === 'admin';
  const sector = SECTOR_CONFIG[sectorId] || SECTOR_CONFIG.admin;
  useSectorTheme(sectorId);

  const [view, setView] = useState(forceFirst ? 'first' : 'login');
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    document.documentElement.style.setProperty('--deep', DEEP[sectorId] || DEEP.admin);
  }, [sectorId]);

  const home = () => navigate(user?.isAdmin || isAdmin ? '/admin' : `/${sectorId === 'cs' ? 'cs' : sectorId}`);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!loginId.trim() || !password) { setError('Preencha todos os campos.'); return; }
    setLoading(true); setError('');
    const res = isAdmin
      ? await loginAdmin(loginId, password)
      : await loginCollaborator(sectorId, loginId, password);
    setLoading(false);
    if (!res.success) { setError(res.error || 'Credenciais inválidas.'); return; }
    if (res.firstAccess) { setPassword(''); setView('first'); return; }
    navigate(isAdmin ? '/admin' : `/${sectorId}`);
  };

  const handleFirst = async (e) => {
    e.preventDefault();
    if (newPass.length < 6) { setError('A senha deve ter pelo menos 6 caracteres.'); return; }
    if (newPass !== confirm) { setError('As senhas não coincidem.'); return; }
    setLoading(true); setError('');
    const res = await changePassword(newPass);
    setLoading(false);
    if (!res.success) { setError(res.error); return; }
    home();
  };

  const title = <>{sector.label}<i>.</i></>;
  const Spinner = () => <span className="spinner" style={{ width: 16, height: 16, borderTopColor: 'var(--on)', borderColor: 'rgba(255,255,255,.3)' }} />;

  return (
    <div className="lg-page">
      <div className="lg-grid" />
      <div className="lg-glow" />

      <div className="lg-wrap">
        {view === 'login' && (
          <button className="lg-back" onClick={() => navigate('/')}><ArrowLeft size={14} /> Voltar</button>
        )}

        <div className="lg-card">
          <div className={`lg-bg${view === 'login' ? ' login' : ''}`} />

          {/* painel do modo LOGIN — direita */}
          <div className={`lg-hero login${view === 'login' ? ' active' : ''}`}>
            <img src={sector.logo} alt={sector.label} />
            <h2>{title}</h2>
            <div className="tag">ACESSO RESTRITO</div>
            <p>Primeira vez entrando? Use aqui mesmo a senha temporária que o admin te passou — a senha nova a gente pede logo em seguida.</p>
          </div>

          {/* formulário do modo LOGIN — esquerda */}
          <div className={`lg-form login${view === 'login' ? ' active' : ''}`}>
            <h2>Entrar</h2>
            <p className="sub">Use o ID cadastrado pelo administrador.</p>
            <form onSubmit={handleLogin}>
              <div className="lg-field">
                <label htmlFor="lg-id">ID DE ACESSO</label>
                <input id="lg-id" type="text" value={loginId} onChange={e => setLoginId(e.target.value)} placeholder="Seu ID" autoComplete="username" autoFocus />
              </div>
              <div className="lg-field">
                <label htmlFor="lg-pw">SENHA</label>
                <div className="wrap">
                  <input id="lg-pw" style={{ paddingRight: 44 }} type={show ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" autoComplete="current-password" />
                  <button type="button" className="lg-eye" onClick={() => setShow(!show)} aria-label={show ? 'Ocultar senha' : 'Mostrar senha'}>
                    {show ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>
              {error && view === 'login' && <p className="lg-err">{error}</p>}
              <button type="submit" className="lg-btn" disabled={loading}>{loading ? <Spinner /> : 'ENTRAR'}</button>
            </form>
          </div>

          {/* painel do modo PRIMEIRO ACESSO — esquerda */}
          <div className={`lg-hero first${view === 'first' ? ' active' : ''}`}>
            <img src={sector.logo} alt={sector.label} />
            <h2>{title}</h2>
            <div className="tag">PRIMEIRO ACESSO</div>
            <p>Senha temporária conferida. Agora defina a sua senha pessoal para concluir o acesso.</p>
          </div>

          {/* formulário do modo PRIMEIRO ACESSO — direita */}
          <div className={`lg-form first${view === 'first' ? ' active' : ''}`}>
            <h2>Primeiro Acesso</h2>
            <p className="sub">Crie sua senha pessoal para continuar. Ela não poderá ser recuperada, guarde-a bem.</p>
            <form onSubmit={handleFirst}>
              <div className="lg-field">
                <label htmlFor="lg-new">NOVA SENHA</label>
                <div className="wrap">
                  <input id="lg-new" style={{ paddingRight: 44 }} type={show ? 'text' : 'password'} value={newPass} onChange={e => setNewPass(e.target.value)} placeholder="Mínimo 6 caracteres" autoComplete="new-password" />
                  <button type="button" className="lg-eye" onClick={() => setShow(!show)} aria-label={show ? 'Ocultar senha' : 'Mostrar senha'}>
                    {show ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>
              <div className="lg-field">
                <label htmlFor="lg-conf">CONFIRMAR SENHA</label>
                <input id="lg-conf" type="password" value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="Repita a senha" autoComplete="new-password" />
              </div>
              {error && view === 'first' && <p className="lg-err">{error}</p>}
              <button type="submit" className="lg-btn" disabled={loading}>{loading ? <Spinner /> : 'DEFINIR SENHA E ENTRAR'}</button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
