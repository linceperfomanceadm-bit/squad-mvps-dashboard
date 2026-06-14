import React, { useState } from 'react';
import { Calendar, ExternalLink, Save } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useAppConfig } from '../../hooks/useAppConfig';

/*
 * Agenda global — incorpora o Google Calendar público da agência via
 * iframe (somente leitura). A URL de incorporação é definida uma vez
 * pelo admin e fica visível para todos os painéis.
 *
 * Como obter a URL: Google Calendar → Configurações do calendário →
 * "Integrar agenda" → copie o src do código <iframe> (Incorporar).
 * O calendário precisa estar público para todos conseguirem ver.
 */
export default function AgendaView() {
  const { user } = useAuth();
  const { config, loading, saveConfig } = useAppConfig();
  const [editing, setEditing] = useState(false);
  const [url, setUrl] = useState('');

  const isAdmin = user?.isAdmin;
  const embedUrl = config.agendaEmbedUrl;

  const startEdit = () => { setUrl(embedUrl || ''); setEditing(true); };
  const save = async () => {
    await saveConfig({ agendaEmbedUrl: url.trim() });
    setEditing(false);
  };

  return (
    <div className="fade-up">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: '#fff', letterSpacing: '-.5px', marginBottom: 4 }}>Agenda</h1>
          <p style={{ fontSize: 13, color: 'var(--muted)' }}>Calendário da semana, em tempo real.</p>
        </div>
        {isAdmin && !editing && (
          <button onClick={startEdit} style={BTN_SOFT}><Calendar size={14} /> {embedUrl ? 'Alterar agenda' : 'Configurar agenda'}</button>
        )}
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><div className="spinner" style={{ width: 30, height: 30 }} /></div>
      ) : editing ? (
        <div style={CARD}>
          <label style={LBL}>URL DE INCORPORAÇÃO DO GOOGLE CALENDAR</label>
          <p style={{ fontSize: 12, color: 'var(--muted)', margin: '6px 0 10px', lineHeight: 1.5 }}>
            No Google Calendar: Configurações → seu calendário → "Integrar agenda" → copie o
            endereço dentro de <span style={{ fontFamily: 'var(--fm)', color: 'var(--text)' }}>src="..."</span> do código de incorporação.
            O calendário precisa estar público.
          </p>
          <textarea value={url} onChange={e => setUrl(e.target.value)} rows={3} placeholder="https://calendar.google.com/calendar/embed?src=..." style={{ ...INP, fontFamily: 'var(--fm)', fontSize: 12, resize: 'vertical' }} />
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button onClick={save} style={BTN_PRIMARY}><Save size={14} /> Salvar</button>
            <button onClick={() => setEditing(false)} style={BTN_SOFT}>Cancelar</button>
          </div>
        </div>
      ) : embedUrl ? (
        <div style={{ borderRadius: 14, overflow: 'hidden', border: '1px solid var(--border)', background: '#fff' }}>
          <iframe
            title="Agenda da Agência"
            src={embedUrl}
            style={{ width: '100%', height: 'calc(100vh - 200px)', minHeight: 520, border: 'none', display: 'block' }}
          />
        </div>
      ) : (
        <div style={{ ...CARD, textAlign: 'center', padding: '48px 24px' }}>
          <Calendar size={36} color="var(--muted)" style={{ marginBottom: 12 }} />
          <p style={{ fontSize: 14, color: 'var(--text)', fontWeight: 600, marginBottom: 6 }}>Agenda ainda não configurada</p>
          <p style={{ fontSize: 13, color: 'var(--muted)', maxWidth: 420, margin: '0 auto', lineHeight: 1.6 }}>
            {isAdmin ? 'Clique em "Configurar agenda" e cole a URL de incorporação do Google Calendar.' : 'Peça ao admin para configurar a agenda da agência.'}
          </p>
        </div>
      )}
    </div>
  );
}

const LBL = { fontSize: 10, letterSpacing: '.14em', color: 'var(--muted)', fontWeight: 600, fontFamily: 'var(--fm)' };
const INP = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 9, padding: '10px 13px', color: 'var(--text)', fontSize: 13, outline: 'none', width: '100%', fontFamily: 'var(--f)' };
const CARD = { background: 'rgba(12,12,24,.88)', border: '1px solid var(--border)', borderRadius: 14, padding: 18 };
const BTN_PRIMARY = { display: 'flex', alignItems: 'center', gap: 8, background: 'linear-gradient(135deg,var(--neon),#c41f4a)', border: 'none', borderRadius: 10, padding: '10px 18px', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' };
const BTN_SOFT = { display: 'flex', alignItems: 'center', gap: 8, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 16px', color: 'var(--text)', fontSize: 13, fontWeight: 600, cursor: 'pointer' };
