import React, { useState, useEffect } from 'react';
import { Monitor, Play, Pause, RefreshCw, PartyPopper, ExternalLink, Lock, Radio, Volume2, Save, Eye, EyeOff } from 'lucide-react';
import { useComercial } from '../../hooks/useComercial';
import { mesChave } from '../../lib/entregas';

/*
 * Controle da TV da sala comercial (/tv/comercial). Mesmo desenho do
 * controle da TV operacional (AdminTVControl), mas grava em
 * app_config/comercial — as duas TVs são independentes: pausar uma não
 * pausa a outra, cada uma tem a sua rádio.
 */

const CENAS = [
  { id: '',         label: 'Rodar todas (padrão)' },
  { id: 'meta',     label: 'Travar em Meta do mês' },
  { id: 'closers',  label: 'Travar em Ranking de Closers' },
  { id: 'sdrs',     label: 'Travar em Ranking de SDRs' },
  { id: 'carteira', label: 'Travar em Carteira e vendas' },
  { id: 'alerta',   label: 'Travar em Sinal vermelho' },
];

export default function ComercialTVControl({ config, saveConfig, toast }) {
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
  const visita = config.tvVisitMode === true;
  const tocando = config.tvRadioPlaying === true;
  const urlMudou = radioUrl.trim() !== (config.tvRadioUrl || '');
  const tvUrl = `${window.location.origin}/tv/comercial`;

  const aplicar = async (patch, ok, chave) => {
    setSaving(chave);
    const r = await saveConfig(patch);
    setSaving('');
    if (r.success) toast(ok);
    else toast(r.error, 'e');
  };

  const salvarVolume = () => {
    if (volume === config.tvRadioVolume) return;
    saveConfig({ tvRadioVolume: volume });
  };

  const cor = pausado ? 'var(--amber)' : visita ? 'var(--blue)' : 'var(--green)';

  return (
    <div>
      <div className="ui-card" style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
        <div style={{ width: 44, height: 44, borderRadius: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--soft)' }}>
          <Monitor size={22} color={cor} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 14, fontWeight: 500, color: cor }}>
            {pausado ? 'Painel pausado' : visita ? 'Modo visita ligado' : 'Painel no ar'}
          </p>
          <p style={S.txt}>
            {pausado ? 'A TV está mostrando a tela de espera.'
              : visita ? 'A TV está na tela institucional, sem nenhum valor e sem alertas.'
              : 'As cenas estão girando normalmente na sala comercial.'}
          </p>
        </div>
        <a href={tvUrl} target="_blank" rel="noopener noreferrer" className="ui-btn small" style={{ textDecoration: 'none' }}>
          <ExternalLink size={13} /> Abrir /tv/comercial
        </a>
      </div>

      <div className="ui-card" style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 14, borderColor: visita ? 'var(--blue-b)' : undefined }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={S.tit}>{visita ? <EyeOff size={15} color="var(--blue)" /> : <Eye size={15} color="var(--muted)" />} Modo visita</p>
          <p style={S.txt}>
            Trava a TV numa tela institucional do time: clientes ativos e clientes novos no mês. Some todo
            valor em R$, a meta, os rankings e a cena de alerta. Use quando tiver cliente ou visitante na sala.
          </p>
        </div>
        <button
          type="button"
          className={`ui-btn ${visita ? '' : 'primary'}`}
          disabled={saving === 'visita'}
          onClick={() => aplicar({ tvVisitMode: !visita }, visita ? 'Modo visita desligado.' : 'Modo visita ligado.', 'visita')}
        >
          {visita ? <Eye size={15} /> : <EyeOff size={15} />} {visita ? 'Voltar ao normal' : 'Ligar modo visita'}
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 14 }}>
        <div className="ui-card" style={S.box}>
          <p style={S.tit}>Pausar o painel</p>
          <p style={S.txt}>Troca tudo por uma tela de espera com o relógio. Use quando algum número estiver errado.</p>
          <input value={msg} onChange={e => setMsg(e.target.value)} placeholder="Mensagem na tela de espera (opcional)" style={S.input} />
          <button
            type="button"
            className="ui-btn"
            style={{ marginTop: 'auto', color: pausado ? 'var(--green)' : 'var(--amber)' }}
            disabled={saving === 'pause'}
            onClick={() => aplicar({ tvPaused: !pausado, tvPauseMessage: msg.trim() }, pausado ? 'Painel retomado.' : 'Painel pausado.', 'pause')}
          >
            {pausado ? <Play size={15} /> : <Pause size={15} />} {pausado ? 'Retomar painel' : 'Pausar painel'}
          </button>
        </div>

        <div className="ui-card" style={S.box}>
          <p style={S.tit}>Recarregar a TV</p>
          <p style={S.txt}>Manda a tela dar refresh sozinha. Primeira tentativa quando a TV travar.</p>
          <button
            type="button"
            className="ui-btn"
            style={{ marginTop: 'auto' }}
            disabled={saving === 'reload'}
            onClick={() => aplicar({ tvReloadToken: Date.now() }, 'Comando enviado. A TV vai recarregar em instantes.', 'reload')}
          >
            <RefreshCw size={15} /> Recarregar agora
          </button>
        </div>

        <div className="ui-card" style={S.box}>
          <p style={S.tit}>Travar numa cena</p>
          <p style={S.txt}>Para mostrar só uma cena — por exemplo, o ranking na reunião do time.</p>
          <select value={cena} onChange={e => aplicar({ tvLockScene: e.target.value }, e.target.value ? 'Cena travada na TV.' : 'Rotação normal retomada.', 'scene')} style={{ width: '100%' }}>
            {CENAS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
          {cena && <p style={{ ...S.txt, color: 'var(--amber)', display: 'flex', alignItems: 'center', gap: 6, marginTop: 10 }}><Lock size={13} /> A rotação está parada.</p>}
        </div>

        <div className="ui-card" style={S.box}>
          <p style={S.tit}>Comemoração de venda</p>
          <p style={S.txt}>A tela cheia com o nome do Closer a cada venda lançada. Desligue se for lançar várias vendas de uma vez.</p>
          <button
            type="button"
            className="ui-btn"
            style={{ marginTop: 'auto' }}
            disabled={saving === 'party'}
            onClick={() => aplicar({ tvCelebrations: !comemora }, comemora ? 'Comemorações desligadas.' : 'Comemorações ligadas.', 'party')}
          >
            <PartyPopper size={15} /> {comemora ? 'Desligar comemorações' : 'Ligar comemorações'}
          </button>
        </div>

        <div className="ui-card" style={{ ...S.box, gridColumn: '1 / -1' }}>
          <p style={S.tit}><Radio size={15} color={tocando ? 'var(--green)' : 'var(--muted)'} /> Rádio da sala</p>
          <p style={S.txt}>Cole o link direto do áudio (.mp3, .aac ou .m3u8), não a página do player.</p>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
            <input value={radioUrl} onChange={e => setRadioUrl(e.target.value)} placeholder="https://exemplo.com/stream.mp3" style={{ ...S.input, flex: '1 1 320px', marginBottom: 0, fontFamily: 'var(--fm)' }} />
            <button
              type="button"
              className="ui-btn"
              style={{ opacity: urlMudou ? 1 : 0.45 }}
              disabled={saving === 'radiourl' || !urlMudou}
              onClick={() => aplicar({ tvRadioUrl: radioUrl.trim() }, radioUrl.trim() ? 'Rádio salva.' : 'Rádio removida.', 'radiourl')}
            >
              <Save size={15} /> Salvar endereço
            </button>
          </div>
          <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="ui-btn"
              style={{ opacity: radioUrl.trim() ? 1 : 0.45 }}
              disabled={saving === 'radio' || !radioUrl.trim()}
              onClick={() => aplicar({ tvRadioPlaying: !tocando, tvRadioUrl: radioUrl.trim() }, tocando ? 'Rádio pausada.' : 'Rádio no ar. Se for a primeira vez do dia, toque em "Ligar som" na TV.', 'radio')}
            >
              {tocando ? <Pause size={15} /> : <Play size={15} />} {tocando ? 'Pausar música' : 'Tocar música'}
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: '1 1 240px' }}>
              <Volume2 size={16} color="var(--muted)" />
              <input type="range" min={0} max={100} value={volume} onChange={e => setVolume(Number(e.target.value))} onPointerUp={salvarVolume} onKeyUp={salvarVolume} style={{ flex: 1, accentColor: 'var(--c)', cursor: 'pointer' }} aria-label="Volume da rádio" />
              <span style={{ fontSize: 12, color: 'var(--muted)', fontFamily: 'var(--fm)', width: 34, textAlign: 'right' }}>{volume}%</span>
            </div>
          </div>
        </div>
      </div>

      <p style={{ ...S.txt, marginTop: 16 }}>
        Na TV: abra <span style={{ fontFamily: 'var(--fm)', color: 'var(--c)' }}>{tvUrl}</span> no Chrome e pressione F11.
        O painel se recarrega sozinho às 4h da manhã.
      </p>
    </div>
  );
}

const S = {
  box: { display: 'flex', flexDirection: 'column' },
  tit: { fontSize: 14, fontWeight: 500, color: 'var(--text)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 8 },
  txt: { fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.6, marginBottom: 12 },
  input: { background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 9, padding: '10px 12px', color: 'var(--text)', fontSize: 13, outline: 'none', fontFamily: 'var(--f)', marginBottom: 10, width: '100%' },
};

// Versão que busca os próprios dados — usada no admin, dentro da aba
// "Painel de TV", onde não há a página do comercial em volta.
export function ComercialTVControlConectado({ toast }) {
  const { config, loading, saveConfig } = useComercial(mesChave());
  if (loading) return <div className="spinner" style={{ margin: '40px auto' }} />;
  return <ComercialTVControl config={config} saveConfig={saveConfig} toast={toast} />;
}
