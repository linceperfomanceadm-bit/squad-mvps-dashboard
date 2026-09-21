import React, { useMemo, useState, useEffect } from 'react';
import { Plus, Minus, Trash2, X, Save } from 'lucide-react';
import { SALE_SERVICES } from '../../lib/firebase';
import { rotuloMes } from '../../lib/entregas';
import { resumoComercial } from '../../lib/comercial';
import { Grid, Kpi, Card, Empty, Goal } from '../shared/ui';
import { LBL, INP, money, fmtDate } from './ui';

const hoje = () => {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

/*
 * LANÇAMENTOS DO COMERCIAL — onde o líder alimenta a TV da sala
 * comercial. Tudo manual (o CRM é externo), em blocos na ordem do dia a
 * dia: meta e time (uma vez por mês), vendas e agendamentos (todo dia),
 * churn (quando acontece).
 *
 * Venda é lançada uma a uma — é o que gera o ranking, o feed e a
 * comemoração na TV.
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
        <MetaBloco dadosMes={dadosMes} mes={mes} onSave={async (patch) => aviso(await com.saveMes(patch), 'Meta do mês salva.')} />
        <TimeBloco config={config} onSave={async (patch) => aviso(await com.saveConfig(patch), 'Time atualizado.')} />
      </div>

      <VendasBloco
        config={config}
        vendas={Array.isArray(dadosMes.vendas) ? dadosMes.vendas : []}
        nomesClientes={nomesClientes}
        onAdd={async (v) => aviso(await com.addVenda(v, me), 'Venda lançada. A TV já está comemorando.')}
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

function MetaBloco({ dadosMes, mes, onSave }) {
  const [meta, setMeta] = useState(dadosMes.meta ? String(dadosMes.meta) : '');
  const [leads, setLeads] = useState(dadosMes.leads ? String(dadosMes.leads) : '');
  // Os dados do mês chegam depois da tela montar (listener).
  useEffect(() => { setMeta(dadosMes.meta ? String(dadosMes.meta) : ''); }, [dadosMes.meta]);
  useEffect(() => { setLeads(dadosMes.leads ? String(dadosMes.leads) : ''); }, [dadosMes.leads]);
  const mudou = String(meta) !== String(dadosMes.meta || '') || String(leads) !== String(dadosMes.leads || '');
  return (
    <Card title={`Meta de ${rotuloMes(mes, true).toLowerCase()}`} sub="aparece na barra do topo da TV">
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
      <button
        type="button"
        className="ui-btn primary"
        style={{ marginTop: 14, opacity: mudou ? 1 : 0.5 }}
        disabled={!mudou}
        onClick={() => onSave({ meta: Number(meta) || 0, leads: Number(leads) || 0 })}
      >
        <Save size={14} /> Salvar
      </button>
    </Card>
  );
}

function TimeBloco({ config, onSave }) {
  const [closer, setCloser] = useState('');
  const [sdr, setSdr] = useState('');
  const add = (campo, nome, limpar) => {
    const n = nome.trim();
    if (!n || (config[campo] || []).includes(n)) return;
    onSave({ [campo]: [...(config[campo] || []), n] });
    limpar('');
  };
  const del = (campo, nome) => onSave({ [campo]: (config[campo] || []).filter(x => x !== nome) });

  // Função, e não componente: um componente declarado aqui dentro
  // seria recriado a cada tecla e o campo perderia o foco.
  const lista = (campo, valor, setValor, rotulo) => (
    <div style={{ marginTop: 12 }}>
      <p style={LBL}>{rotulo}</p>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '8px 0' }}>
        {(config[campo] || []).length === 0 && <span style={S.nota}>Ninguém cadastrado.</span>}
        {(config[campo] || []).map(n => (
          <span key={n} style={S.chip}>
            {n}
            <button type="button" onClick={() => del(campo, n)} style={S.chipX} aria-label={`Remover ${n}`}><X size={11} /></button>
          </span>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <input value={valor} onChange={e => setValor(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') add(campo, valor, setValor); }} placeholder="Nome" style={INP} />
        <button type="button" className="ui-btn small" onClick={() => add(campo, valor, setValor)}><Plus size={13} /> Adicionar</button>
      </div>
    </div>
  );

  return (
    <Card title="Time comercial" sub="vale para todos os meses">
      {lista('closers', closer, setCloser, 'CLOSERS')}
      {lista('sdrs', sdr, setSdr, 'SDRS')}
    </Card>
  );
}

function VendasBloco({ config, vendas, nomesClientes, onAdd, onRemove }) {
  const [f, setF] = useState({ closer: '', cliente: '', valor: '', servico: '', data: hoje() });
  const [busy, setBusy] = useState(false);
  const [apagar, setApagar] = useState(null);
  const lista = [...vendas].sort((a, b) => String(b.at || '').localeCompare(String(a.at || '')));
  const closers = config.closers || [];

  const lancar = async () => {
    setBusy(true);
    const ok = await onAdd({ ...f, valor: Number(f.valor) });
    setBusy(false);
    if (ok) setF(x => ({ ...x, cliente: '', valor: '', servico: '' }));
  };

  return (
    <Card title="Vendas" sub="cada venda lançada entra no ranking e comemora na TV" style={{ marginBottom: 14 }}>
      <div style={S.formVenda}>
        <select value={f.closer} onChange={e => setF(x => ({ ...x, closer: e.target.value }))} aria-label="Closer">
          <option value="">Closer</option>
          {closers.map(n => <option key={n} value={n}>{n}</option>)}
        </select>
        <input list="com_clientes" value={f.cliente} onChange={e => setF(x => ({ ...x, cliente: e.target.value }))} placeholder="Cliente" style={INP} />
        <input type="number" min={0} value={f.valor} onChange={e => setF(x => ({ ...x, valor: e.target.value }))} placeholder="Valor (R$)" style={{ ...INP, fontFamily: 'var(--fm)' }} />
        <select value={f.servico} onChange={e => setF(x => ({ ...x, servico: e.target.value }))} aria-label="Serviço">
          <option value="">Serviço</option>
          {SALE_SERVICES.map(s => <option key={s.id} value={s.label}>{s.label}</option>)}
        </select>
        <input type="date" value={f.data} onChange={e => setF(x => ({ ...x, data: e.target.value }))} style={{ ...INP, colorScheme: 'dark light' }} />
        <button type="button" className="ui-btn primary" disabled={busy || !f.closer || !f.cliente.trim() || !Number(f.valor)} onClick={lancar}>
          <Plus size={14} /> {busy ? 'Lançando...' : 'Lançar venda'}
        </button>
      </div>
      <datalist id="com_clientes">{nomesClientes.map(n => <option key={n} value={n} />)}</datalist>
      {closers.length === 0 && <p style={{ ...S.nota, marginTop: 8 }}>Cadastre os Closers em "Time comercial" para lançar vendas.</p>}

      <div style={{ marginTop: 14 }}>
        {lista.length === 0 ? <Empty>Nenhuma venda lançada neste mês.</Empty> : lista.map(v => (
          <div key={v.id} style={S.linha}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <p style={S.titulo}>{v.cliente}</p>
              <p style={S.nota}>{v.closer}{v.servico ? ` · ${v.servico}` : ''}{v.data ? ` · ${fmtDate(`${v.data}T12:00:00`)}` : ''}</p>
            </div>
            <span style={{ fontFamily: 'var(--fm)', fontSize: 13, color: 'var(--text)' }}>{money(v.valor)}</span>
            {apagar === v.id ? (
              <>
                <button type="button" className="ui-btn small" style={{ color: 'var(--red)' }} onClick={() => { onRemove(v); setApagar(null); }}>Apagar</button>
                <button type="button" className="ui-btn small" onClick={() => setApagar(null)}>Manter</button>
              </>
            ) : (
              <button type="button" style={S.iconBtn} onClick={() => setApagar(v.id)} aria-label="Apagar venda"><Trash2 size={13} /></button>
            )}
          </div>
        ))}
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
    <Card title="Agendamentos dos SDRs" sub="some a cada reunião marcada, realizada ou que o cliente faltou" style={{ marginBottom: 14 }}>
      {sdrs.length === 0 ? <Empty>Cadastre os SDRs em "Time comercial".</Empty> : (
        <div style={{ overflowX: 'auto' }}>
          <div style={{ ...S.sdrHead }}>
            <span>SDR</span><span>Agendados</span><span>Realizados</span><span>No-show</span><span>Comparecimento</span>
          </div>
          {sdrs.map(s => (
            <div key={s.nome} style={S.sdrLinha}>
              <span style={S.titulo}>{s.nome}</span>
              {cont(s.nome, 'agendados', s.agendados)}
              {cont(s.nome, 'realizados', s.realizados)}
              {cont(s.nome, 'noShow', s.noShow, s.noShow ? 'var(--red)' : undefined)}
              <span style={{ fontFamily: 'var(--fm)', fontSize: 13, color: 'var(--muted)' }}>{s.comparecimento == null ? '—' : `${s.comparecimento}%`}</span>
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
  chip: { display: 'inline-flex', alignItems: 'center', gap: 6, height: 28, padding: '0 6px 0 12px', borderRadius: 99, background: 'var(--bg3)', border: '1px solid var(--border)', fontSize: 12.5, color: 'var(--text)' },
  chipX: { width: 20, height: 20, borderRadius: 99, border: 'none', background: 'var(--soft)', color: 'var(--muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' },
  formVenda: { display: 'grid', gridTemplateColumns: '150px 1.4fr 130px 170px 150px auto', gap: 8, marginTop: 12, alignItems: 'center' },
  formChurn: { display: 'grid', gridTemplateColumns: '1.4fr 160px 1.4fr 150px auto', gap: 8, alignItems: 'center' },
  linha: { display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--border)' },
  iconBtn: { width: 30, height: 30, flexShrink: 0, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg3)', color: 'var(--muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' },
  sdrHead: { display: 'grid', gridTemplateColumns: 'minmax(140px,1fr) 130px 130px 130px 120px', gap: 12, fontSize: 11, color: 'var(--muted)', padding: '10px 0 8px', borderBottom: '1px solid var(--border)', minWidth: 660 },
  sdrLinha: { display: 'grid', gridTemplateColumns: 'minmax(140px,1fr) 130px 130px 130px 120px', gap: 12, alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--border)', minWidth: 660 },
};
