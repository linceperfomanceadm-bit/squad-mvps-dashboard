import React, { useState, useEffect } from 'react';
import { Monitor, Play, Pause, RefreshCw, PartyPopper, ExternalLink, Lock, Radio, Volume2, Save } from 'lucide-react';
import { useAppConfig } from '../../hooks/useAppConfig';

/*
 * Aba "Painel de TV" no Admin. Controla em tempo real o painel que roda
 * na parede da agência (/tv). Como o painel escuta app_config/general
 * via onSnapshot, qualquer alteração aqui chega na TV em menos de um
 * segundo — sem precisar ir até lá.
 */

const CENAS = [
  { id: '',           label: 'Rodar todas (padrão)' },
  { id: 'today',      label: 'Travar em Operacional' },
  { id: 'alert',      label: 'Travar em Zona de Atenção' },
  { id: 'highlights', label: 'Travar em Destaques da Semana' },
  { id: 'health',     label: 'Travar em Saúde da Carteira' },
];

export default function AdminTVControl({ toast }) {
  const { config, loading, saveConfig } = useAppConfig();
  const [msg, setMsg] = useState('');
  const [saving, setSaving] = useState('');
  const [radioUrl, setRadioUrl] = useState('');
  const [volume, setVolume] = useState(50);

  useEffect(() => { setMsg(config.tvPauseMessage || ''); }, [config.tvPauseMessage]);
  useEffect(() => { setRadioUrl(config.tvRadioUrl || ''); }, [config.tvRadioUrl]);
  useEffect(() => {
    setVolume(typeof config.tvRadioVolume === 'number' ? config.tvRadioVolume : 50);
  }, [config.tvRadioVolume]);

  const pausado = config.tvPaused === true;
  const comemora = config.tvCelebrations !== false;
  const cena = config.tvLockScene || '';
  const tocando = config.tvRadioPlaying === true;
  const urlMudou = radioUrl.trim() !== (config.tvRadioUrl || '');
  const tvUrl = `${window.location.origin}/tv`;

  const aplicar = async (patch, ok, chave) => {
    setSaving(chave);
    const r = await saveConfig(patch);
    setSaving('');
    if (r.success) toast(ok);
    else toast(r.error, 'e');
  };

  const togglePause = () => aplicar(
    { tvPaused: !pausado, tvPauseMessage: msg.trim() },
    pausado ? 'Painel retomado. A TV já voltou ao normal.' : 'Painel pausado. A TV está em modo espera.',
    'pause'
  );

  const toggleFesta = () => aplicar(
    { tvCelebrations: !comemora },
    comemora ? 'Comemorações desligadas.' : 'Comemorações ligadas.',
    'party'
  );

  const trocarCena = (id) => aplicar(
    { tvLockScene: id },
    id ? 'Cena travada na TV.' : 'Rotação normal retomada.',
    'scene'
  );

  const recarregar = () => aplicar(
    { tvReloadToken: Date.now() },
    'Comando enviado. As TVs vão recarregar em instantes.',
    'reload'
  );

  const salvarRadio = () => aplicar(
    { tvRadioUrl: radioUrl.trim() },
    radioUrl.trim() ? 'Rádio salva. A TV já está com o novo endereço.' : 'Rádio removida da TV.',
    'radiourl'
  );

  const toggleRadio = () => aplicar(
    { tvRadioPlaying: !tocando, tvRadioUrl: radioUrl.trim() },
    tocando ? 'Rádio pausada.' : 'Rádio no ar. Se for a primeira vez do dia, toque em "Ligar som" na TV.',
    'radio'
  );

  const salvarVolume = () => {
    if (volume === config.tvRadioVolume) return;
    saveConfig({ tvRadioVolume: volume });
  };

  if (loading) return null;

  return (
    <div className="fade-up">
      <div style={{ marginBottom: 22 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, color: '#fff', letterSpacing: '-.5px', marginBottom: 4 }}>
          Painel de TV
        </h1>
        <p style={{ fontSize: 13, color: 'var(--muted)' }}>
          Controle o painel da parede em tempo real. Toda alteração chega na TV em menos de um segundo.
        </p>
      </div>

      {/* Status + endereço */}
      <div style={{
        ...S.box,
        background: pausado ? 'rgba(245,158,11,.06)' : 'rgba(34,197,94,.06)',
        borderColor: pausado ? 'rgba(245,158,11,.25)' : 'rgba(34,197,94,.25)',
        display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18,
      }}>
        <div style={{
          width: 44, height: 44, borderRadius: 11, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: pausado ? 'rgba(245,158,11,.14)' : 'rgba(34,197,94,.14)',
        }}>
          <Monitor size={22} color={pausado ? 'var(--amber)' : 'var(--green)'} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: pausado ? 'var(--amber)' : 'var(--green)' }}>
            {pausado ? 'Painel pausado' : 'Painel no ar'}
          </p>
          <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
            {pausado ? 'A TV está mostrando a tela de espera.' : 'As cenas estão girando normalmente na parede.'}
          </p>
        </div>
        <a href={tvUrl} target="_blank" rel="noopener noreferrer" style={S.link}>
          <ExternalLink size={13} /> Abrir /tv
        </a>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        {/* Pausar */}
        <div style={S.box}>
          <p style={S.boxTitle}>Pausar o painel</p>
          <p style={S.boxText}>
            Troca tudo por uma tela de espera com o relógio. Use quando o dado estiver errado
            ou quando houver visita que não deve ver a operação.
          </p>
          <input
            value={msg}
            onChange={e => setMsg(e.target.value)}
            placeholder="Mensagem na tela de espera (opcional)"
            style={S.input}
          />
          <button
            onClick={togglePause}
            disabled={saving === 'pause'}
            style={{ ...S.btn, ...(pausado ? S.btnGreen : S.btnAmber) }}
          >
            {pausado ? <Play size={15} /> : <Pause size={15} />}
            {pausado ? 'Retomar painel' : 'Pausar painel'}
          </button>
        </div>

        {/* Recarregar */}
        <div style={S.box}>
          <p style={S.boxTitle}>Recarregar as TVs</p>
          <p style={S.boxText}>
            Manda todas as telas darem refresh sozinhas. Use depois de publicar uma
            correção, ou como primeira tentativa quando alguma TV travar.
          </p>
          <button
            onClick={recarregar}
            disabled={saving === 'reload'}
            style={{ ...S.btn, ...S.btnBlue, marginTop: 'auto' }}
          >
            <RefreshCw size={15} /> Recarregar agora
          </button>
        </div>

        {/* Cena travada */}
        <div style={S.box}>
          <p style={S.boxTitle}>Travar numa cena</p>
          <p style={S.boxText}>
            Se só uma cena estiver com problema, trave o painel numa das outras
            em vez de derrubar tudo.
          </p>
          <select value={cena} onChange={e => trocarCena(e.target.value)} style={S.select}>
            {CENAS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
          {cena && (
            <p style={{ ...S.boxText, color: 'var(--amber)', display: 'flex', alignItems: 'center', gap: 6, marginTop: 10, marginBottom: 0 }}>
              <Lock size={13} /> A rotação está parada.
            </p>
          )}
        </div>

        {/* Comemorações */}
        <div style={S.box}>
          <p style={S.boxTitle}>Comemorações</p>
          <p style={S.boxText}>
            O confete que toma a tela quando alguém conclui uma entrega. Desligue durante
            reunião com cliente ou quando alguém for mexer em várias tasks de uma vez.
          </p>
          <button
            onClick={toggleFesta}
            disabled={saving === 'party'}
            style={{ ...S.btn, ...(comemora ? S.btnGhost : S.btnGreen), marginTop: 'auto' }}
          >
            <PartyPopper size={15} />
            {comemora ? 'Desligar comemorações' : 'Ligar comemorações'}
          </button>
        </div>

        {/* Rádio */}
        <div style={{ ...S.box, gridColumn: '1 / -1' }}>
          <p style={{ ...S.boxTitle, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Radio size={16} color={tocando ? 'var(--green)' : 'var(--muted)'} />
            Rádio da TV
          </p>
          <p style={S.boxText}>
            Cole o endereço do stream — o link direto do áudio (.mp3, .aac ou .m3u8), não a página
            do player. Trocar a rádio aqui já muda o som na parede.
          </p>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
            <input
              value={radioUrl}
              onChange={e => setRadioUrl(e.target.value)}
              placeholder="https://exemplo.com/stream.mp3"
              style={{ ...S.input, flex: '1 1 320px', marginBottom: 0, fontFamily: 'var(--fm)', fontSize: 12.5 }}
            />
            <button
              onClick={salvarRadio}
              disabled={saving === 'radiourl' || !urlMudou}
              style={{ ...S.btn, ...S.btnGhost, width: 'auto', opacity: urlMudou ? 1 : .45 }}
            >
              <Save size={15} /> Salvar endereço
            </button>
          </div>

          <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              onClick={toggleRadio}
              disabled={saving === 'radio' || !radioUrl.trim()}
              style={{ ...S.btn, ...(tocando ? S.btnAmber : S.btnGreen), width: 'auto', opacity: radioUrl.trim() ? 1 : .45 }}
            >
              {tocando ? <Pause size={15} /> : <Play size={15} />}
              {tocando ? 'Pausar música' : 'Tocar música'}
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: '1 1 240px' }}>
              <Volume2 size={16} color="var(--muted)" style={{ flexShrink: 0 }} />
              <input
                type="range"
                min={0}
                max={100}
                value={volume}
                onChange={e => setVolume(Number(e.target.value))}
                onPointerUp={salvarVolume}
                onKeyUp={salvarVolume}
                style={{ flex: 1, accentColor: '#EE3363', cursor: 'pointer' }}
              />
              <span style={{ fontSize: 12, color: 'var(--muted)', fontFamily: 'var(--fm)', width: 34, textAlign: 'right', flexShrink: 0 }}>
                {volume}%
              </span>
            </div>
          </div>

          <p style={{ ...S.boxText, marginTop: 12, marginBottom: 0 }}>
            O navegador não deixa nenhum site tocar som sozinho. Na primeira vez que a rádio entra
            no ar, a TV mostra um botão <strong style={{ color: 'var(--text)' }}>Ligar som</strong> no
            canto — um clique e o áudio segue sozinho até o reload das 4h.
          </p>
        </div>
      </div>

      <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 16, lineHeight: 1.6 }}>
        Na TV: abra <span style={{ fontFamily: 'var(--fm)', color: 'var(--neon)' }}>{tvUrl}</span> no Chrome
        e pressione F11 para tela cheia. O painel se recarrega sozinho às 4h da manhã.
      </p>
    </div>
  );
}

const S = {
  box: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 16, display: 'flex', flexDirection: 'column' },
  boxTitle: { fontSize: 14, fontWeight: 700, color: '#fff', marginBottom: 6 },
  boxText: { fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.6, marginBottom: 12 },
  input: { background: '#12121f', border: '1px solid var(--border)', borderRadius: 9, padding: '10px 12px', color: 'var(--text)', fontSize: 13, outline: 'none', fontFamily: 'var(--f)', marginBottom: 10, width: '100%' },
  select: { background: '#12121f', border: '1px solid var(--border)', borderRadius: 9, padding: '10px 12px', color: 'var(--text)', fontSize: 13, outline: 'none', cursor: 'pointer', fontFamily: 'var(--f)', width: '100%' },
  btn: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, border: '1px solid transparent', borderRadius: 9, padding: '10px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer', width: '100%' },
  btnAmber: { background: 'rgba(245,158,11,.14)', borderColor: 'rgba(245,158,11,.35)', color: 'var(--amber)' },
  btnGreen: { background: 'rgba(34,197,94,.14)', borderColor: 'rgba(34,197,94,.35)', color: 'var(--green)' },
  btnBlue: { background: 'rgba(56,189,248,.14)', borderColor: 'rgba(56,189,248,.35)', color: 'var(--blue)' },
  btnGhost: { background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text)' },
  link: { display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--neon)', textDecoration: 'none', fontWeight: 600, flexShrink: 0 },
};
