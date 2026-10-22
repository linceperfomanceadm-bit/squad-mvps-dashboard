import React, { useMemo, useState, useEffect, useRef } from 'react';
import { Plus, Minus, Trash2, X, Save, Pencil, Camera } from 'lucide-react';
import { SALE_SERVICES, SDR_PONTOS } from '../../lib/firebase';
import { rotuloMes } from '../../lib/entregas';
import { resumoComercial, chaveSdr } from '../../lib/comercial';
import { Grid, Kpi, Card, Empty, Goal } from '../shared/ui';
import { LBL, INP, money, fmtDate } from './ui';

const hoje = () => {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

// Reduz a foto para 480×720 (em pé, 2:3 — o formato do card do pódio da
// TV). Corta o excesso pelo centro na largura e mais embaixo do que em
// cima na altura, para não cortar a cabeça. Sai um JPEG pequeno, porque
// fica gravado dentro do Firestore (ver useComercial).
function reduzirFoto(file) {
  return new Promise((resolve, reject) => {
    if (!file || !/^image\//.test(file.type)) { reject(new Error('Escolha um arquivo de imagem.')); return; }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const W = 480; const H = 720;
      const alvo = W / H;
      let sw = img.width; let sh = img.height; let sx = 0; let sy = 0;
      if (img.width / img.height > alvo) { sw = img.height * alvo; sx = (img.width - sw) / 2; }
      else { sh = img.width / alvo; sy = (img.height - sh) * 0.15; }
      const cv = document.createElement('canvas');
      cv.width = W; cv.height = H;
      cv.getContext('2d').drawImage(img, sx, sy, sw, sh, 0, 0, W, H);
      URL.revokeObjectURL(url);
      let q = 0.82;
      let out = cv.toDataURL('image/jpeg', q);
      while (out.length > 110000 && q > 0.5) { q -= 0.08; out = cv.toDataURL('image/jpeg', q); }
      resolve(out);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Não foi possível ler essa imagem.')); };
    img.src = url;
  });
}

/*
 * LANÇAMENTOS DO COMERCIAL — onde o líder alimenta a TV da sala
 * comercial. Tudo manual (o CRM é externo), em blocos na ordem do dia a
 * dia: meta e time (uma vez por mês), vendas e agendamentos (todo dia),
 * churn (quando acontece).
 *
 * Venda é lançada uma a uma — é o que gera o ranking, o feed e a
 * comemoração na TV. O SDR que agendou a call é opcional na venda e
 * alimenta o "vendas geradas" dele. Venda lançada pode ser corrigida
 * (editar não comemora de novo na TV).
 */
export default function ComercialLancamentos({ com, clients, mes, me, toast }) {
  const { config, dadosMes } = com;
  const r = useMemo(() => resumoComercial({ config, dadosMes, clients, mes }), [config, dadosMes, clients, mes]);
  const nomesClientes = useMemo(() => [...new Set(clients.map(c => c.name).filter(Boolean))].sort(), [clients]);

  const aviso = (res, ok) => {
    if (res?.success) { if (ok) toast(ok); return true; }
    toast(res?.error || 'Não foi possível salvar.', 'e');
    return false;
  };

  return (
    <div>
      <Grid cols={4}>
        <Kpi value={money(r.vendido)} label={r.meta ? `Vendido de ${money(r.meta)}` : 'Vendido no mês'} tone={r.meta && r.vendido >= r.meta ? 'good' : undefined}>
          {r.meta > 0 && <Goal pct={(r.vendido / r.meta) * 100}>{r.pct}% da meta</Goal>}
        </Kpi>
        <Kpi value={r.nVendas} label="Vendas lançadas" />
        <Kpi value={r.funil.agendados} label="Reuniões agendadas pelos SDRs" />
        <Kpi value={r.churn.length} label="Churn no mês" tone={r.churn.length ? 'bad' : undefined} />
      </Grid>

      <div style={S.duas}>
        <MetaBloco dadosMes={dadosMes} mes={mes} closers={config.closers || []} sdrs={config.sdrs || []} onSave={async (patch) => aviso(await com.saveMes(patch), 'Metas do mês salvas.')} />
        <TimeBloco
          config={config}
          fotos={com.fotos || {}}
          onSave={async (patch) => aviso(await com.saveConfig(patch), 'Time atualizado.')}
          onFoto={async (nome, url) => aviso(await com.saveFoto(nome, url), 'Foto salva. Ela já aparece na TV.')}
          onRemoveFoto={async (nome, avisar = true) => aviso(await com.removeFoto(nome), avisar ? 'Foto removida.' : '')}
          toast={toast}
        />
      </div>

      <VendasBloco
        config={config}
        vendas={Array.isArray(dadosMes.vendas) ? dadosMes.vendas : []}
        nomesClientes={nomesClientes}
        onAdd={async (v) => aviso(await com.addVenda(v, me), 'Venda lançada. A TV já está comemorando.')}
        onUpdate={async (id, v) => aviso(await com.updateVenda(id, v, me), 'Venda corrigida.')}
        onRemove={async (v) => aviso(await com.removeVenda(v), 'Venda removida.')}
      />

      <SdrBloco
        sdrs={r.sdrs}
        onAjustar={async (nome, campo, delta) => aviso(await com.ajustarSdr(nome, campo, delta))}
      />

      <ChurnBloco
        churn={r.churn}
        manual={dadosMes.churn || []}
        onAdd={async (c) => aviso(await com.addChurn(c, me), 'Churn registrado.')}
        onRemove={async (c) => aviso(await com.removeChurn(c), 'Registro removido.')}
      />
    </div>
  );
}

// Meta do mês, leads e a meta individual de cada Closer — tudo do mês,
// salvo junto. A meta individual aparece no ranking da TV com a barra de
// atingimento.
const metasParaTexto = (m) => Object.fromEntries(Object.entries(m || {}).map(([k, v]) => [k, v ? String(v) : '']));

function MetaBloco({ dadosMes, mes, closers, sdrs, onSave }) {
  const [meta, setMeta] = useState(dadosMes.meta ? String(dadosMes.meta) : '');
  const [leads, setLeads] = useState(dadosMes.leads ? String(dadosMes.leads) : '');
  const metasJson = JSON.stringify(dadosMes.metasCloser || {});
  const [ind, setInd] = useState(() => metasParaTexto(dadosMes.metasCloser));
  // Os dados do mês chegam depois da tela montar (listener).
  useEffect(() => { setMeta(dadosMes.meta ? String(dadosMes.meta) : ''); }, [dadosMes.meta]);
  useEffect(() => { setLeads(dadosMes.leads ? String(dadosMes.leads) : ''); }, [dadosMes.leads]);
  // Compara pelo conteúdo: o objeto muda a cada lançamento do mês e
  // apagaria o que o líder está digitando.
  useEffect(() => { setInd(metasParaTexto(JSON.parse(metasJson))); }, [metasJson]);
  const metasSdrJson = JSON.stringify(dadosMes.metasSdr || {});
  const [indSdr, setIndSdr] = useState(() => metasParaTexto(dadosMes.metasSdr));
  useEffect(() => { setIndSdr(metasParaTexto(JSON.parse(metasSdrJson))); }, [metasSdrJson]);

  const salvas = JSON.parse(metasJson);
  const salvasSdr = JSON.parse(metasSdrJson);
  const mudouInd = closers.some(n => String(ind[chaveSdr(n)] || '') !== String(salvas[chaveSdr(n)] || ''))
    || sdrs.some(n => String(indSdr[chaveSdr(n)] || '') !== String(salvasSdr[chaveSdr(n)] || ''));
  const mudou = String(meta) !== String(dadosMes.meta || '') || String(leads) !== String(dadosMes.leads || '') || mudouInd;
  const somaSdr = sdrs.reduce((t, n) => t + (Number(indSdr[chaveSdr(n)]) || 0), 0);
  const soma = closers.reduce((t, n) => t + (Number(ind[chaveSdr(n)]) || 0), 0);

  const salvar = () => onSave({
    meta: Number(meta) || 0,
    leads: Number(leads) || 0,
    metasCloser: Object.fromEntries(closers.map(n => [chaveSdr(n), Number(ind[chaveSdr(n)]) || 0])),
    metasSdr: Object.fromEntries(sdrs.map(n => [chaveSdr(n), Number(indSdr[chaveSdr(n)]) || 0])),
  });

  return (
    <Card title={`Meta de ${rotuloMes(mes, true).toLowerCase()}`} sub="aparece na barra do topo e no ranking da TV">
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
        <div>
          <p style={LBL}>META EM VENDAS (R$)</p>
          <input type="number" min={0} value={meta} onChange={e => setMeta(e.target.value)} placeholder="Ex: 120000" style={{ ...INP, marginTop: 6, fontFamily: 'var(--fm)' }} />
        </div>
        <div>
          <p style={LBL}>LEADS RECEBIDOS NO MÊS</p>
          <input type="number" min={0} value={leads} onChange={e => setLeads(e.target.value)} placeholder="Topo do funil" style={{ ...INP, marginTop: 6, fontFamily: 'var(--fm)' }} />
        </div>
      </div>

      <p style={{ ...LBL, marginTop: 16 }}>META INDIVIDUAL DOS CLOSERS (R$)</p>
      {closers.length === 0 ? (
        <p style={{ ...S.nota, marginTop: 6 }}>Cadastre os Closers em "Time comercial".</p>
      ) : (
        <>
          <div style={S.metasInd}>
            {closers.map(n => (
              <label key={n} style={S.metaInd}>
                <span style={S.titulo}>{n}</span>
                <input
                  type="number" min={0}
                  value={ind[chaveSdr(n)] || ''}
                  onChange={e => { const v = e.target.value; setInd(x => ({ ...x, [chaveSdr(n)]: v })); }}
                  placeholder="Sem meta"
                  style={{ ...INP, fontFamily: 'var(--fm)' }}
                />
              </label>
            ))}
          </div>
          <p style={{ ...S.nota, marginTop: 8 }}>
            Soma das metas individuais: <span style={{ fontFamily: 'var(--fm)', color: 'var(--text)' }}>{money(soma)}</span>
            {Number(meta) > 0 && <> de {money(Number(meta))} da meta do mês</>}
          </p>
        </>
      )}

      <p style={{ ...LBL, marginTop: 16 }}>META DE AGENDAMENTOS DOS SDRS (CALLS)</p>
      {sdrs.length === 0 ? (
        <p style={{ ...S.nota, marginTop: 6 }}>Cadastre os SDRs em "Time comercial".</p>
      ) : (
        <>
          <div style={S.metasInd}>
            {sdrs.map(n => (
              <label key={n} style={S.metaInd}>
                <span style={S.titulo}>{n}</span>
                <input
                  type="number" min={0}
                  value={indSdr[chaveSdr(n)] || ''}
                  onChange={e => { const v = e.target.value; setIndSdr(x => ({ ...x, [chaveSdr(n)]: v })); }}
                  placeholder="Sem meta"
                  style={{ ...INP, fontFamily: 'var(--fm)' }}
                />
              </label>
            ))}
          </div>
          <p style={{ ...S.nota, marginTop: 8 }}>
            Soma das metas de agendamento: <span style={{ fontFamily: 'var(--fm)', color: 'var(--text)' }}>{somaSdr}</span> calls
          </p>
        </>
      )}

      <button
        type="button"
        className="ui-btn primary"
        style={{ marginTop: 14, opacity: mudou ? 1 : 0.5 }}
        disabled={!mudou}
        onClick={salvar}
      >
        <Save size={14} /> Salvar
      </button>
    </Card>
  );
}

function TimeBloco({ config, fotos, onSave, onFoto, onRemoveFoto, toast }) {
  const [closer, setCloser] = useState('');
  const [sdr, setSdr] = useState('');
  const [alvo, setAlvo] = useState(null);      // pessoa cuja foto está sendo trocada
  const [enviando, setEnviando] = useState('');
  const inputRef = useRef(null);

  const add = (campo, nome, limpar) => {
    const n = nome.trim();
    if (!n || (config[campo] || []).includes(n)) return;
    onSave({ [campo]: [...(config[campo] || []), n] });
    limpar('');
  };
  const del = (campo, nome) => {
    onSave({ [campo]: (config[campo] || []).filter(x => x !== nome) });
    // Quem sai do time leva a foto junto, a não ser que esteja na outra lista.
    const outra = campo === 'closers' ? 'sdrs' : 'closers';
    if (fotos[chaveSdr(nome)] && !(config[outra] || []).includes(nome)) onRemoveFoto(nome, false);
    if (alvo === nome) setAlvo(null);
  };

  const escolher = (nome) => {
    setAlvo(nome);
    if (!fotos[chaveSdr(nome)]) inputRef.current?.click();
  };

  const aoEscolherArquivo = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !alvo) return;
    setEnviando(alvo);
    try {
      const url = await reduzirFoto(file);
      await onFoto(alvo, url);
      setAlvo(null);
    } catch (err) {
      toast(err.message || 'Não foi possível usar essa foto.', 'e');
    }
    setEnviando('');
  };

  // Função, e não componente: um componente declarado aqui dentro
  // seria recriado a cada tecla e o campo perderia o foco.
  const lista = (campo, valor, setValor, rotulo) => (
    <div style={{ marginTop: 12 }}>
      <p style={LBL}>{rotulo}</p>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '8px 0' }}>
        {(config[campo] || []).length === 0 && <span style={S.nota}>Ninguém cadastrado.</span>}
        {(config[campo] || []).map(n => {
          const foto = fotos[chaveSdr(n)];
          return (
            <span key={n} style={{ ...S.chip, ...(alvo === n ? { borderColor: 'var(--c-border)' } : null) }}>
              <button
                type="button"
                onClick={() => escolher(n)}
                style={S.fotoBtn}
                title={foto ? 'Trocar ou remover a foto' : 'Colocar foto'}
                aria-label={foto ? `Foto de ${n}` : `Colocar foto de ${n}`}
              >
                {enviando === n
                  ? <span className="spinner" style={{ width: 12, height: 12 }} />
                  : foto
                    ? <img src={foto} alt="" style={S.fotoImg} />
                    : <Camera size={12} />}
              </button>
              {n}
              <button type="button" onClick={() => del(campo, n)} style={S.chipX} aria-label={`Remover ${n}`}><X size={11} /></button>
            </span>
          );
        })}
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <input value={valor} onChange={e => setValor(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') add(campo, valor, setValor); }} placeholder="Nome" style={INP} />
        <button type="button" className="ui-btn small" onClick={() => add(campo, valor, setValor)}><Plus size={13} /> Adicionar</button>
      </div>
    </div>
  );

  return (
    <Card title="Time comercial" sub="vale para todos os meses">
      <p style={{ ...S.nota, marginTop: 6 }}>Toque na bolinha ao lado do nome para colocar a foto que aparece no pódio da TV. Foto em pé fica melhor.</p>
      {lista('closers', closer, setCloser, 'CLOSERS')}
      {lista('sdrs', sdr, setSdr, 'SDRS')}
      {alvo && fotos[chaveSdr(alvo)] && (
        <div style={S.fotoMenu}>
          <img src={fotos[chaveSdr(alvo)]} alt="" style={S.fotoPrev} />
          <span style={{ ...S.titulo, flex: 1 }}>Foto de {alvo}</span>
          <button type="button" className="ui-btn small" onClick={() => inputRef.current?.click()}><Camera size={13} /> Trocar</button>
          <button type="button" className="ui-btn small" style={{ color: 'var(--red)' }} onClick={() => { onRemoveFoto(alvo); setAlvo(null); }}><Trash2 size={13} /> Remover</button>
          <button type="button" style={S.iconBtn} onClick={() => setAlvo(null)} aria-label="Fechar"><X size={13} /></button>
        </div>
      )}
      <input ref={inputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={aoEscolherArquivo} />
    </Card>
  );
}

// Campos da venda — os mesmos para lançar e para corrigir. Componente de
// topo (e não declarado dentro do bloco) para os campos não perderem o
// foco a cada tecla.
function CamposVenda({ f, setF, closers, sdrs }) {
  return (
    <>
      <select value={f.closer} onChange={e => setF(x => ({ ...x, closer: e.target.value }))} aria-label="Closer">
        <option value="">Closer</option>
        {closers.map(n => <option key={n} value={n}>{n}</option>)}
      </select>
      <select value={f.sdr} onChange={e => setF(x => ({ ...x, sdr: e.target.value }))} aria-label="SDR que agendou">
        <option value="">SDR (opcional)</option>
        {sdrs.map(n => <option key={n} value={n}>{n}</option>)}
      </select>
      <input list="com_clientes" value={f.cliente} onChange={e => setF(x => ({ ...x, cliente: e.target.value }))} placeholder="Cliente" style={INP} />
      <input type="number" min={0} value={f.valor} onChange={e => setF(x => ({ ...x, valor: e.target.value }))} placeholder="Valor (R$)" style={{ ...INP, fontFamily: 'var(--fm)' }} />
      <select value={f.servico} onChange={e => setF(x => ({ ...x, servico: e.target.value }))} aria-label="Serviço">
        <option value="">Serviço</option>
        {SALE_SERVICES.map(s => <option key={s.id} value={s.label}>{s.label}</option>)}
        {f.servico && !SALE_SERVICES.some(s => s.label === f.servico) && <option value={f.servico}>{f.servico}</option>}
      </select>
      <input type="date" value={f.data} onChange={e => setF(x => ({ ...x, data: e.target.value }))} style={{ ...INP, colorScheme: 'dark light' }} />
    </>
  );
}

// Inclui na lista quem não está mais no time, para a venda antiga
// continuar aparecendo certa no formulário de correção.
const comAtual = (lista, atual) => (atual && !lista.includes(atual) ? [...lista, atual] : lista);

function VendasBloco({ config, vendas, nomesClientes, onAdd, onUpdate, onRemove }) {
  const [f, setF] = useState({ closer: '', sdr: '', cliente: '', valor: '', servico: '', data: hoje() });
  const [busy, setBusy] = useState(false);
  const [apagar, setApagar] = useState(null);
  const [editando, setEditando] = useState(null);
  const [fe, setFe] = useState(null);
  const lista = [...vendas].sort((a, b) => String(b.at || '').localeCompare(String(a.at || '')));
  const closers = config.closers || [];
  const sdrs = config.sdrs || [];

  const lancar = async () => {
    setBusy(true);
    const ok = await onAdd({ ...f, valor: Number(f.valor) });
    setBusy(false);
    if (ok) setF(x => ({ ...x, cliente: '', valor: '', servico: '', sdr: '' }));
  };

  const abrirEdicao = (v) => {
    setApagar(null);
    setEditando(v.id);
    setFe({ closer: v.closer || '', sdr: v.sdr || '', cliente: v.cliente || '', valor: String(v.valor || ''), servico: v.servico || '', data: v.data || '' });
  };

  const salvarEdicao = async () => {
    setBusy(true);
    const ok = await onUpdate(editando, { ...fe, valor: Number(fe.valor) });
    setBusy(false);
    if (ok) { setEditando(null); setFe(null); }
  };

  return (
    <Card title="Vendas" sub="cada venda lançada entra no ranking e comemora na TV" style={{ marginBottom: 14 }}>
      <div style={S.formVenda}>
        <CamposVenda f={f} setF={setF} closers={closers} sdrs={sdrs} />
        <button type="button" className="ui-btn primary" disabled={busy || !f.closer || !f.cliente.trim() || !Number(f.valor)} onClick={lancar}>
          <Plus size={14} /> {busy && !editando ? 'Lançando...' : 'Lançar venda'}
        </button>
      </div>
      <datalist id="com_clientes">{nomesClientes.map(n => <option key={n} value={n} />)}</datalist>
      {closers.length === 0 && <p style={{ ...S.nota, marginTop: 8 }}>Cadastre os Closers em "Time comercial" para lançar vendas.</p>}

      <div style={{ marginTop: 14 }}>
        {lista.length === 0 ? <Empty>Nenhuma venda lançada neste mês.</Empty> : lista.map(v => (editando === v.id && fe ? (
          <div key={v.id} style={{ ...S.formVenda, padding: '10px 0', marginTop: 0, borderBottom: '1px solid var(--border)' }}>
            <CamposVenda f={fe} setF={setFe} closers={comAtual(closers, v.closer)} sdrs={comAtual(sdrs, v.sdr)} />
            <div style={{ display: 'flex', gap: 6 }}>
              <button type="button" className="ui-btn small primary" disabled={busy || !fe.closer || !fe.cliente.trim() || !Number(fe.valor)} onClick={salvarEdicao}>
                <Save size={13} /> {busy ? 'Salvando...' : 'Salvar'}
              </button>
              <button type="button" className="ui-btn small" onClick={() => { setEditando(null); setFe(null); }}>Cancelar</button>
            </div>
          </div>
        ) : (
          <div key={v.id} style={S.linha}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <p style={S.titulo}>{v.cliente}</p>
              <p style={S.nota}>
                {v.closer}{v.sdr ? ` · SDR ${v.sdr}` : ''}{v.servico ? ` · ${v.servico}` : ''}{v.data ? ` · ${fmtDate(`${v.data}T12:00:00`)}` : ''}
                {v.editedAt ? ' · corrigida' : ''}
              </p>
            </div>
            <span style={{ fontFamily: 'var(--fm)', fontSize: 13, color: 'var(--text)' }}>{money(v.valor)}</span>
            {apagar === v.id ? (
              <>
                <button type="button" className="ui-btn small" style={{ color: 'var(--red)' }} onClick={() => { onRemove(v); setApagar(null); }}>Apagar</button>
                <button type="button" className="ui-btn small" onClick={() => setApagar(null)}>Manter</button>
              </>
            ) : (
              <>
                <button type="button" style={S.iconBtn} onClick={() => abrirEdicao(v)} aria-label="Corrigir venda" title="Corrigir venda"><Pencil size={13} /></button>
                <button type="button" style={S.iconBtn} onClick={() => setApagar(v.id)} aria-label="Apagar venda" title="Apagar venda"><Trash2 size={13} /></button>
              </>
            )}
          </div>
        )))}
      </div>
    </Card>
  );
}

function SdrBloco({ sdrs, onAjustar }) {
  const cont = (nome, campo, valor, cor) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <button type="button" style={S.iconBtn} disabled={!valor} onClick={() => onAjustar(nome, campo, -1)} aria-label="Diminuir"><Minus size={12} /></button>
      <span style={{ fontFamily: 'var(--fm)', fontSize: 14, minWidth: 26, textAlign: 'center', color: cor || 'var(--text)' }}>{valor}</span>
      <button type="button" style={{ ...S.iconBtn, background: 'var(--c-dim)', borderColor: 'var(--c-border)', color: 'var(--c)' }} onClick={() => onAjustar(nome, campo, 1)} aria-label="Aumentar"><Plus size={12} /></button>
    </div>
  );
  return (
    <Card title="Agendamentos e pontos dos SDRs" sub="some a cada reunião marcada, realizada ou que o cliente faltou" style={{ marginBottom: 14 }}>
      <p style={{ ...S.nota, margin: '6px 0 4px' }}>
        Pontos: {SDR_PONTOS.realizada} por reunião realizada e {SDR_PONTOS.assistencia} por assistência.
        Assistência é a venda lançada com o SDR marcado, em "Vendas" (dá para corrigir uma venda antiga pelo lápis e incluir o SDR).
      </p>
      {sdrs.length === 0 ? <Empty>Cadastre os SDRs em "Time comercial".</Empty> : (
        <div style={{ overflowX: 'auto' }}>
          <div style={{ ...S.sdrHead }}>
            <span>SDR</span><span>Agendados</span><span>Realizados</span><span>No-show</span><span>Comparec.</span><span>Assistências</span><span>Pontos</span>
          </div>
          {sdrs.map(s => (
            <div key={s.nome} style={S.sdrLinha}>
              <div style={{ minWidth: 0 }}>
                <p style={S.titulo}>{s.nome}</p>
                <p style={S.nota}>{s.meta ? `${s.agendados} de ${s.meta} agendamentos · ${s.ating}%` : 'sem meta de agendamentos'}</p>
              </div>
              {cont(s.nome, 'agendados', s.agendados)}
              {cont(s.nome, 'realizados', s.realizados)}
              {cont(s.nome, 'noShow', s.noShow, s.noShow ? 'var(--red)' : undefined)}
              <span style={{ fontFamily: 'var(--fm)', fontSize: 13, color: 'var(--muted)' }}>{s.comparecimento == null ? '—' : `${s.comparecimento}%`}</span>
              <span style={{ fontFamily: 'var(--fm)', fontSize: 13, color: 'var(--text)' }}>{s.vendas}</span>
              <span style={{ fontFamily: 'var(--fm)', fontSize: 15, fontWeight: 600, color: 'var(--c)' }}>{s.pontos} pts</span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function ChurnBloco({ churn, manual, onAdd, onRemove }) {
  const [f, setF] = useState({ cliente: '', valorMensal: '', motivo: '', data: hoje() });
  const [busy, setBusy] = useState(false);
  const idsManual = new Set(manual.map(m => m.id));
  const registrar = async () => {
    setBusy(true);
    const ok = await onAdd(f);
    setBusy(false);
    if (ok) setF({ cliente: '', valorMensal: '', motivo: '', data: hoje() });
  };
  return (
    <Card title="Churn do mês" sub="entra na cena de alerta da TV">
      <p style={{ ...S.nota, margin: '6px 0 12px' }}>
        Contratos encerrados pela CS no mês já entram sozinhos. Lance aqui para registrar o valor mensal perdido ou um cancelamento que ainda não passou pela CS.
      </p>
      <div style={S.formChurn}>
        <input list="com_clientes" value={f.cliente} onChange={e => setF(x => ({ ...x, cliente: e.target.value }))} placeholder="Cliente" style={INP} />
        <input type="number" min={0} value={f.valorMensal} onChange={e => setF(x => ({ ...x, valorMensal: e.target.value }))} placeholder="Valor mensal (R$)" style={{ ...INP, fontFamily: 'var(--fm)' }} />
        <input value={f.motivo} onChange={e => setF(x => ({ ...x, motivo: e.target.value }))} placeholder="Motivo" style={INP} />
        <input type="date" value={f.data} onChange={e => setF(x => ({ ...x, data: e.target.value }))} style={{ ...INP, colorScheme: 'dark light' }} />
        <button type="button" className="ui-btn" disabled={busy || !f.cliente.trim()} onClick={registrar}>
          <Plus size={14} /> Registrar
        </button>
      </div>
      <div style={{ marginTop: 14 }}>
        {churn.length === 0 ? <Empty>Nenhum churn neste mês.</Empty> : churn.map(c => (
          <div key={c.id} style={S.linha}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <p style={S.titulo}>{c.cliente}</p>
              <p style={S.nota}>{c.auto ? 'Contrato encerrado pela CS' : 'Lançado no comercial'}{c.motivo ? ` · ${c.motivo}` : ''}</p>
            </div>
            {c.valorMensal > 0 && <span style={{ fontFamily: 'var(--fm)', fontSize: 13, color: 'var(--red)' }}>{money(c.valorMensal)}/mês</span>}
            {idsManual.has(c.id) && (
              <button type="button" style={S.iconBtn} onClick={() => onRemove(manual.find(m => m.id === c.id))} aria-label="Apagar registro"><Trash2 size={13} /></button>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}

const S = {
  duas: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))', gap: 14, marginBottom: 14 },
  nota: { fontSize: 11.5, color: 'var(--muted)', lineHeight: 1.45 },
  titulo: { fontSize: 13, fontWeight: 500, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  chip: { display: 'inline-flex', alignItems: 'center', gap: 6, height: 30, padding: '0 6px 0 3px', borderRadius: 99, background: 'var(--bg3)', border: '1px solid var(--border)', fontSize: 12.5, color: 'var(--text)' },
  fotoBtn: { width: 24, height: 24, flexShrink: 0, borderRadius: 99, border: '1px dashed var(--border-h)', background: 'var(--soft)', color: 'var(--muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0, overflow: 'hidden' },
  fotoImg: { width: '100%', height: '100%', objectFit: 'cover', objectPosition: '50% 20%' },
  fotoMenu: { display: 'flex', alignItems: 'center', gap: 8, marginTop: 14, padding: 10, borderRadius: 'var(--r)', background: 'var(--bg3)', border: '1px solid var(--border)' },
  fotoPrev: { width: 34, height: 51, borderRadius: 6, objectFit: 'cover' },
  metasInd: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))', gap: 8, marginTop: 8 },
  metaInd: { display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 110px', alignItems: 'center', gap: 8 },
  chipX: { width: 20, height: 20, borderRadius: 99, border: 'none', background: 'var(--soft)', color: 'var(--muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' },
  formVenda: { display: 'grid', gridTemplateColumns: '130px 140px minmax(160px,1.4fr) 110px 160px 140px auto', gap: 8, marginTop: 12, alignItems: 'center' },
  formChurn: { display: 'grid', gridTemplateColumns: '1.4fr 160px 1.4fr 150px auto', gap: 8, alignItems: 'center' },
  linha: { display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--border)' },
  iconBtn: { width: 30, height: 30, flexShrink: 0, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg3)', color: 'var(--muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' },
  sdrHead: { display: 'grid', gridTemplateColumns: 'minmax(170px,1fr) 120px 120px 120px 80px 90px 80px', gap: 12, fontSize: 11, color: 'var(--muted)', padding: '10px 0 8px', borderBottom: '1px solid var(--border)', minWidth: 860 },
  sdrLinha: { display: 'grid', gridTemplateColumns: 'minmax(170px,1fr) 120px 120px 120px 80px 90px 80px', gap: 12, alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--border)', minWidth: 860 },
};
