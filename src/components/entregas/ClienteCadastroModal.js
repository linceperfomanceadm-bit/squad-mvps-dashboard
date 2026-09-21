import React, { useState, useMemo } from 'react';
import { Paperclip, Trash2, Plus, FileCheck2, X } from 'lucide-react';
import {
  SECTORS, SALE_SERVICES, ENTREGAVEIS, ENTREGA_SECTORS, CADASTRO_PENDENCIAS, contractState,
} from '../../lib/firebase';
import {
  cadastroPendencias, escopoParaEditar, inicioNovaVersao, mesChave, rotuloMes, novoIdItem, versoesDoEscopo,
} from '../../lib/entregas';
import { Overlay, ModalHeader, MODAL, LBL, INP, fmtDate } from '../commercial/ui';
import { Tag } from '../shared/ui';

/*
 * COMPLETAR CADASTRO — editar os dados de contrato de qualquer cliente.
 *
 * Nasceu porque os clientes antigos entraram antes de o cadastro ter
 * prazo, anexos, serviços e escopo. Sem isso a base fica "quebrada":
 * metade dos clientes sem as informações que os painéis leem. Quem
 * edita: CS, líder da CS e admin.
 *
 * O ARQUIVO DO CONTRATO nunca é exibido (tem CPF, CNPJ e valores):
 * aqui só aparece que ele foi anexado, quando e por quem.
 *
 * O escopo mensal segue a regra da agência: o primeiro escopo vale já;
 * mudança num escopo existente vale a partir do próximo dia 1.
 */

const toInputDate = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

export default function ClienteCadastroModal({ client, onClose, onSaveCadastro, onSaveEscopo, onUpload, toast }) {
  const contrato = client.contrato || {};
  const estado = contractState(client);
  const pendencias = cadastroPendencias(client);

  const inicial = useMemo(() => {
    const servicos = contrato.servicos || client.services || [];
    const versao = escopoParaEditar(client);
    return {
      contractMonths: estado.baseMonths ? String(estado.baseMonths) : '',
      contractStart: toInputDate(client.contract?.startAt),
      contactName: contrato.contactName || client.contactName || '',
      contactPhone: contrato.contactPhone || client.contactPhone || '',
      contactEmail: contrato.contactEmail || client.contactEmail || '',
      briefing: contrato.briefing || client.briefing || '',
      servicos: Object.fromEntries((Array.isArray(servicos) ? servicos : []).map(sv => [sv.id, sv.desc || ''])),
      itens: (versao?.itens || []).map(it => ({ ...it, qtd: String(it.qtd) })),
      semRecorrencia: client.escopo?.semRecorrencia === true,
    };
  }, [client]); // eslint-disable-line react-hooks/exhaustive-deps

  const [f, setF] = useState(inicial);
  const [anexoBriefing, setAnexoBriefing] = useState(null);
  const [anexoContrato, setAnexoContrato] = useState(null);
  const [enviando, setEnviando] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  const set = (k, v) => setF(x => ({ ...x, [k]: v }));
  const desdeNovo = inicioNovaVersao(client);
  const temVersoes = versoesDoEscopo(client).length > 0;

  const enviar = async (kind, file) => {
    if (!file) return;
    setErro('');
    setEnviando(kind);
    const r = await onUpload(kind, file);
    setEnviando('');
    if (!r?.success) { setErro(r?.error || 'Não foi possível enviar o arquivo.'); return; }
    if (kind === 'contrato') setAnexoContrato(r.file);
    else setAnexoBriefing(r.file);
  };

  // ── Escopo ────────────────────────────────────────────────
  const addItem = () => setF(x => ({
    ...x,
    semRecorrencia: false,
    itens: [...x.itens, { id: novoIdItem(), sector: ENTREGA_SECTORS[0], label: '', qtd: '' }],
  }));
  const setItem = (id, k, v) => setF(x => ({ ...x, itens: x.itens.map(it => (it.id === id ? { ...it, [k]: v } : it)) }));
  const delItem = (id) => setF(x => ({ ...x, itens: x.itens.filter(it => it.id !== id) }));

  const toggleServico = (id) => setF(x => {
    const s = { ...x.servicos };
    if (id in s) delete s[id]; else s[id] = '';
    return { ...x, servicos: s };
  });

  const salvar = async () => {
    setErro('');
    const dados = {};
    if (f.contractMonths !== inicial.contractMonths) dados.contractMonths = f.contractMonths;
    if (f.contractStart !== inicial.contractStart) dados.contractStart = f.contractStart;
    ['contactName', 'contactPhone', 'contactEmail', 'briefing'].forEach(k => {
      if (f[k].trim() !== inicial[k].trim()) dados[k] = f[k];
    });
    if (JSON.stringify(f.servicos) !== JSON.stringify(inicial.servicos)) {
      dados.servicos = Object.entries(f.servicos).map(([id, desc]) => ({
        id, desc, label: SALE_SERVICES.find(s => s.id === id)?.label || id,
      }));
    }
    if (anexoBriefing) dados.anexoBriefing = anexoBriefing;
    if (anexoContrato) dados.anexoContrato = anexoContrato;

    const itensLimpos = f.itens
      .map(it => ({ ...it, label: it.label.trim(), qtd: Math.round(Number(it.qtd) || 0) }))
      .filter(it => it.label || it.qtd);
    if (itensLimpos.some(it => !it.label || it.qtd <= 0)) {
      setErro('Cada entrega precisa de nome e quantidade maior que zero.');
      return;
    }
    const escopoMudou = f.semRecorrencia !== inicial.semRecorrencia
      || JSON.stringify(itensLimpos.map(({ id, sector, label, qtd }) => ({ id, sector, label, qtd })))
        !== JSON.stringify(inicial.itens.map(({ id, sector, label, qtd }) => ({ id, sector, label, qtd: Number(qtd) })));

    if (!Object.keys(dados).length && !escopoMudou) { onClose(); return; }

    setSalvando(true);
    if (Object.keys(dados).length) {
      const r = await onSaveCadastro(dados);
      if (!r?.success) { setSalvando(false); setErro(r?.error || 'Não foi possível salvar.'); return; }
    }
    let desde = null;
    if (escopoMudou) {
      const r = await onSaveEscopo({ itens: itensLimpos, semRecorrencia: f.semRecorrencia && !itensLimpos.length });
      if (!r?.success) { setSalvando(false); setErro(r?.error || 'Não foi possível salvar o escopo.'); return; }
      desde = r.desde;
    }
    setSalvando(false);
    if (toast) {
      toast(desde && desde > mesChave()
        ? `Cadastro salvo. O novo escopo vale a partir de ${rotuloMes(desde, true).toLowerCase()}.`
        : 'Cadastro salvo.');
    }
    onClose();
  };

  const briefingAtual = anexoBriefing || contrato.anexoBriefing;
  const contratoAtual = anexoContrato || contrato.anexoContrato;

  return (
    <Overlay onClose={onClose}>
      <div style={{ ...MODAL, maxWidth: 680 }}>
        <ModalHeader title={`Cadastro · ${client.name}`} onClose={onClose} />

        {pendencias.length > 0 ? (
          <div style={S.aviso}>
            <p style={{ fontSize: 12.5, color: 'var(--text)', marginBottom: 8 }}>Falta completar:</p>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {pendencias.map(p => <Tag key={p} tone="warn">{CADASTRO_PENDENCIAS[p]?.label || p}</Tag>)}
            </div>
          </div>
        ) : (
          <p style={{ ...S.hint, marginBottom: 14 }}>Cadastro completo. Você pode revisar qualquer campo.</p>
        )}

        {/* ── Contrato ─────────────────────────────── */}
        <h4 style={S.sec}>Contrato</h4>
        <div style={S.grid2}>
          <div>
            <p style={LBL}>DURAÇÃO (MESES)</p>
            <input type="number" min={0} value={f.contractMonths} onChange={e => set('contractMonths', e.target.value)} placeholder="Ex: 6" style={{ ...INP, marginTop: 6 }} />
            {estado.addedMonths > 0 && (
              <p style={{ ...S.hint, marginTop: 6 }}>+ {estado.addedMonths} {estado.addedMonths === 1 ? 'mês' : 'meses'} de renovação somados a esta duração.</p>
            )}
          </div>
          <div>
            <p style={LBL}>INÍCIO DO CONTRATO</p>
            <input type="date" value={f.contractStart} onChange={e => set('contractStart', e.target.value)} style={{ ...INP, marginTop: 6, colorScheme: 'dark light' }} />
            <p style={{ ...S.hint, marginTop: 6 }}>
              Em branco, conta a partir da call de onboarding realizada
              {client.kickoff?.confirmedAt ? ` (${fmtDate(client.kickoff.confirmedAt)})` : ''}.
            </p>
          </div>
        </div>

        <div style={{ marginTop: 12 }}>
          <p style={LBL}>ARQUIVO DO CONTRATO</p>
          <div style={S.arquivo}>
            {contratoAtual ? (
              <>
                <FileCheck2 size={16} color="var(--green)" />
                <span style={{ flex: 1, fontSize: 12.5, color: 'var(--text)' }}>
                  Contrato anexado{contratoAtual.at ? ` em ${fmtDate(contratoAtual.at)}` : anexoContrato ? ' agora' : ''}
                  {contratoAtual.by ? ` por ${contratoAtual.by}` : ''}
                </span>
              </>
            ) : (
              <span style={{ flex: 1, fontSize: 12.5, color: 'var(--muted)' }}>Nenhum contrato anexado.</span>
            )}
            <label className="ui-btn small" style={{ cursor: 'pointer' }}>
              <Paperclip size={13} /> {enviando === 'contrato' ? 'Enviando...' : contratoAtual ? 'Substituir' : 'Anexar'}
              <input type="file" accept=".pdf,.doc,.docx,image/*" style={{ display: 'none' }} onChange={e => { enviar('contrato', e.target.files?.[0]); e.target.value = ''; }} />
            </label>
          </div>
          <p style={{ ...S.hint, marginTop: 6 }}>Por ter CPF, CNPJ e valores, o contrato fica só guardado — não abre em nenhuma tela do app.</p>
        </div>

        {/* ── Contato ──────────────────────────────── */}
        <h4 style={S.sec}>Responsável do cliente</h4>
        <div style={S.grid3}>
          <Campo label="Nome" value={f.contactName} onChange={v => set('contactName', v)} />
          <Campo label="Telefone" value={f.contactPhone} onChange={v => set('contactPhone', v)} />
          <Campo label="E-mail" value={f.contactEmail} onChange={v => set('contactEmail', v)} />
        </div>

        {/* ── Serviços ─────────────────────────────── */}
        <h4 style={S.sec}>Serviços contratados</h4>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {SALE_SERVICES.map(s => {
            const on = s.id in f.servicos;
            return (
              <button key={s.id} type="button" onClick={() => toggleServico(s.id)} className={`ui-btn small ${on ? 'on' : ''}`} style={on ? { borderColor: 'var(--c-border)', color: 'var(--c)' } : undefined}>
                {s.label}
              </button>
            );
          })}
        </div>
        {Object.keys(f.servicos).map(id => (
          <div key={id} style={{ marginTop: 10 }}>
            <p style={LBL}>{(SALE_SERVICES.find(s => s.id === id)?.label || id).toUpperCase()} — O QUE FOI VENDIDO</p>
            <textarea
              rows={2}
              value={f.servicos[id]}
              onChange={e => setF(x => ({ ...x, servicos: { ...x.servicos, [id]: e.target.value } }))}
              style={{ ...INP, marginTop: 6, resize: 'vertical' }}
            />
          </div>
        ))}

        {/* ── Briefing ─────────────────────────────── */}
        <h4 style={S.sec}>Briefing</h4>
        <textarea rows={4} value={f.briefing} onChange={e => set('briefing', e.target.value)} placeholder="Contexto do cliente, objetivos, público, tom de voz..." style={{ ...INP, resize: 'vertical' }} />
        <div style={{ ...S.arquivo, marginTop: 8 }}>
          {briefingAtual ? (
            <a href={briefingAtual.url} target="_blank" rel="noreferrer" style={{ flex: 1, fontSize: 12.5, color: 'var(--c)', textDecoration: 'none' }}>
              {briefingAtual.name || 'Arquivo do briefing'}
            </a>
          ) : (
            <span style={{ flex: 1, fontSize: 12.5, color: 'var(--muted)' }}>Nenhum arquivo de briefing.</span>
          )}
          <label className="ui-btn small" style={{ cursor: 'pointer' }}>
            <Paperclip size={13} /> {enviando === 'briefing' ? 'Enviando...' : briefingAtual ? 'Substituir' : 'Anexar'}
            <input type="file" style={{ display: 'none' }} onChange={e => { enviar('briefing', e.target.files?.[0]); e.target.value = ''; }} />
          </label>
        </div>

        {/* ── Escopo mensal ────────────────────────── */}
        <h4 style={S.sec}>Entregas mensais do contrato</h4>
        <p style={{ ...S.hint, marginBottom: 10 }}>
          {temVersoes
            ? `Mudanças aqui valem a partir de ${rotuloMes(desdeNovo, true).toLowerCase()}. O mês em andamento e o histórico não mudam.`
            : 'Este é o primeiro escopo do cliente: vale já para este mês.'}
          {' '}Site e ID Visual não entram aqui — eles aparecem sozinhos a partir dos painéis de Web e Design.
        </p>

        {f.itens.map(it => (
          <div key={it.id} style={S.itemLinha}>
            <select value={it.sector} onChange={e => setItem(it.id, 'sector', e.target.value)} style={{ ...INP, width: 150, flexShrink: 0 }} aria-label="Setor">
              {ENTREGA_SECTORS.map(sid => <option key={sid} value={sid}>{SECTORS[sid]?.label || sid}</option>)}
            </select>
            <input
              list={`sug_${it.sector}`}
              value={it.label}
              onChange={e => setItem(it.id, 'label', e.target.value)}
              placeholder="Ex: Artes de feed"
              style={{ ...INP, flex: 1 }}
              aria-label="Entrega"
            />
            <input
              type="number"
              min={1}
              value={it.qtd}
              onChange={e => setItem(it.id, 'qtd', e.target.value)}
              placeholder="Qtd"
              style={{ ...INP, width: 76, flexShrink: 0, fontFamily: 'var(--fm)' }}
              aria-label="Quantidade por mês"
            />
            <button type="button" onClick={() => delItem(it.id)} style={S.iconBtn} title="Remover entrega" aria-label="Remover entrega">
              <Trash2 size={14} />
            </button>
          </div>
        ))}
        {ENTREGA_SECTORS.map(sid => (
          <datalist key={sid} id={`sug_${sid}`}>
            {(ENTREGAVEIS[sid] || []).map(n => <option key={n} value={n} />)}
          </datalist>
        ))}

        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginTop: 4 }}>
          <button type="button" className="ui-btn small" onClick={addItem}>
            <Plus size={13} /> Adicionar entrega
          </button>
          {f.itens.length === 0 && (
            <label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12.5, color: 'var(--muted)', cursor: 'pointer' }}>
              <input type="checkbox" checked={f.semRecorrencia} onChange={e => set('semRecorrencia', e.target.checked)} />
              Cliente sem entregas mensais
            </label>
          )}
        </div>

        {erro && (
          <p style={{ fontSize: 12.5, color: 'var(--red)', marginTop: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
            <X size={13} /> {erro}
          </p>
        )}

        <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
          <button type="button" className="ui-btn primary" style={{ flex: 1, justifyContent: 'center' }} disabled={salvando || !!enviando} onClick={salvar}>
            {salvando ? 'Salvando...' : 'Salvar cadastro'}
          </button>
          <button type="button" className="ui-btn" onClick={onClose}>Cancelar</button>
        </div>
      </div>
    </Overlay>
  );
}

function Campo({ label, value, onChange }) {
  return (
    <div>
      <p style={LBL}>{label.toUpperCase()}</p>
      <input value={value} onChange={e => onChange(e.target.value)} style={{ ...INP, marginTop: 6 }} />
    </div>
  );
}

const S = {
  aviso: { background: 'var(--amber-dim)', border: '1px solid var(--amber-b)', borderRadius: 12, padding: '12px 14px', marginBottom: 16 },
  sec: { fontSize: 14, fontWeight: 500, color: 'var(--text)', margin: '20px 0 10px' },
  hint: { fontSize: 11.5, color: 'var(--muted)', lineHeight: 1.5 },
  grid2: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 12 },
  grid3: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', gap: 12 },
  arquivo: { display: 'flex', alignItems: 'center', gap: 10, background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 10, padding: '8px 8px 8px 12px', marginTop: 6 },
  itemLinha: { display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 },
  iconBtn: { width: 34, height: 34, flexShrink: 0, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg3)', color: 'var(--muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' },
};
