import React from 'react';
import { Check, X, Trash2, Plus, Repeat, CircleDot, Lock } from 'lucide-react';
import { SECTORS, ENTREGAVEIS, ENTREGA_SECTORS } from '../../lib/firebase';
import { novoIdItem } from '../../lib/entregas';
import { asArray } from '../../lib/wdJobs';
import { LBL, INP } from '../commercial/ui';

/*
 * Peças do formulário único de cadastro (ClienteForm). Ficam aqui para
 * o formulário ler como uma lista de seções, e porque o seletor de
 * responsáveis e o editor de escopo podem voltar a aparecer sozinhos
 * em outra tela.
 *
 * Tudo neutro: o item escolhido usa a cor do painel (`--c`), não a cor
 * do setor — no tema claro algumas cores de setor somem sobre o branco.
 */

export function Bloco({ titulo, hint, children }) {
  return (
    <div style={S.bloco}>
      {titulo && <p style={{ ...LBL, color: 'var(--text)' }}>{titulo}</p>}
      {hint && <p style={S.hint}>{hint}</p>}
      {children}
    </div>
  );
}

export function Campo({ label, value, onChange, placeholder, area, rows = 3, type, obrigatorio }) {
  return (
    <div style={{ minWidth: 0 }}>
      <p style={LBL}>{label.toUpperCase()}{obrigatorio ? ' *' : ''}</p>
      {area
        ? <textarea rows={rows} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={{ ...INP, marginTop: 6, resize: 'vertical' }} />
        : <input type={type || 'text'} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={{ ...INP, marginTop: 6, ...(type === 'date' ? { colorScheme: 'dark light' } : null) }} />}
    </div>
  );
}

// Campo sensível na edição (CPF, CNPJ): nunca mostra o que está
// gravado. Diz se já existe e aceita um valor novo por cima.
export function CampoSensivel({ label, value, onChange, preenchido, placeholder, obrigatorio }) {
  return (
    <div style={{ minWidth: 0 }}>
      <p style={{ ...LBL, display: 'flex', alignItems: 'center', gap: 5 }}>
        {label.toUpperCase()}{obrigatorio ? ' *' : ''}
        {preenchido && <Lock size={10} color="var(--dim)" />}
      </p>
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={preenchido ? 'Já cadastrado · digite para substituir' : (placeholder || 'Não informado')}
        style={{ ...INP, marginTop: 6 }}
        autoComplete="off"
      />
    </div>
  );
}

export function Selecao({ label, value, onChange, opcoes, vazio = 'Selecionar...', obrigatorio }) {
  return (
    <div style={{ minWidth: 0 }}>
      {label && <p style={LBL}>{label.toUpperCase()}{obrigatorio ? ' *' : ''}</p>}
      <select value={value} onChange={e => onChange(e.target.value)} style={{ ...INP, marginTop: label ? 6 : 0, cursor: 'pointer' }}>
        <option value="">{vazio}</option>
        {opcoes.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

// Botão-pílula liga/desliga (serviços, setores, tipo de contratante).
export function Chip({ ativo, onClick, children, title }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`ui-btn small ${ativo ? 'on' : ''}`}
      style={ativo ? { borderColor: 'var(--c-border)', color: 'var(--c)', background: 'var(--c-dim)' } : undefined}
      aria-pressed={ativo}
    >
      {ativo && <Check size={12} />} {children}
    </button>
  );
}

// Por que um nome gravado no cliente não aparece entre as opções do
// setor: a pessoa foi excluída, está inativa ou mudou de setor.
function motivoFora(nome, collaborators) {
  const c = collaborators.find(x => x.name === nome);
  if (!c) return 'saiu do app';
  if (c.active === false) return 'inativo';
  return 'outro setor';
}

/*
 * Responsáveis de um setor (chips). Veio do antigo "Editar Cliente" do
 * admin. Nomes gravados no cliente que não estão entre as opções
 * (ex-colaborador, inativo) aparecem à parte, riscados, com X para
 * tirar — senão ficavam invisíveis e eram regravados a cada salvar.
 */
export function ResponsaveisSetor({ sectorId, collaborators, selected, onChange, obrigatorio }) {
  const sector = SECTORS[sectorId];
  const opcoes = collaborators.filter(c => c.sector === sectorId && c.active !== false);
  const sel = asArray(selected);
  const fora = sel.filter(n => !opcoes.some(c => c.name === n));
  const toggle = (nome) => onChange(sel.includes(nome) ? sel.filter(n => n !== nome) : [...sel, nome]);

  return (
    <div style={S.respLinha}>
      <span style={S.respSetor}>
        {sector?.label || sectorId}{obrigatorio ? ' *' : ''}
      </span>
      <div style={{ flex: 1, display: 'flex', flexWrap: 'wrap', gap: 6, minWidth: 0 }}>
        {fora.map(nome => (
          <button key={`fora-${nome}`} type="button" onClick={() => toggle(nome)} title="Clique para tirar deste cliente" className="ui-btn small" style={S.fora}>
            <span style={{ textDecoration: 'line-through' }}>{nome}</span>
            <span style={{ fontSize: 11 }}>· {motivoFora(nome, collaborators)}</span>
            <X size={11} />
          </button>
        ))}
        {opcoes.length === 0
          ? (fora.length === 0 && <span style={{ ...S.hint, paddingTop: 7 }}>Sem colaboradores neste setor</span>)
          : opcoes.map(c => (
            <Chip key={c.id} ativo={sel.includes(c.name)} onClick={() => toggle(c.name)}>{c.name}</Chip>
          ))}
      </div>
    </div>
  );
}

/*
 * Editor do escopo de entregas. Cada linha é MENSAL (N por mês) ou
 * ÚNICA (entrega uma vez só, quantidade 1 fixa — ex.: Google Meu
 * Negócio). Site e ID Visual não entram: o painel conclui sozinho.
 */
export function EscopoEditor({ itens, semRecorrencia, onChange }) {
  const set = (lista, sem = semRecorrencia) => onChange({ itens: lista, semRecorrencia: sem });
  const setItem = (id, k, v) => set(itens.map(it => (it.id === id ? { ...it, [k]: v } : it)));
  const toggleUnica = (id) => set(itens.map(it => (it.id === id ? { ...it, unica: !it.unica, qtd: !it.unica ? '1' : it.qtd } : it)));
  const add = () => set([...itens, { id: novoIdItem(), sector: ENTREGA_SECTORS[0], label: '', qtd: '', unica: false }], false);
  const del = (id) => set(itens.filter(it => it.id !== id));

  return (
    <div>
      {itens.map(it => (
        <div key={it.id} style={S.itemLinha}>
          <select value={it.sector} onChange={e => setItem(it.id, 'sector', e.target.value)} style={{ ...INP, width: 140, flexShrink: 0 }} aria-label="Setor">
            {ENTREGA_SECTORS.map(sid => <option key={sid} value={sid}>{SECTORS[sid]?.label || sid}</option>)}
          </select>
          <input
            list={`sug_${it.sector}`}
            value={it.label}
            onChange={e => setItem(it.id, 'label', e.target.value)}
            placeholder="Ex: Artes de feed"
            style={{ ...INP, flex: 1, minWidth: 0 }}
            aria-label="Entrega"
          />
          <input
            type="number"
            min={1}
            value={it.unica ? '1' : it.qtd}
            disabled={it.unica}
            onChange={e => setItem(it.id, 'qtd', e.target.value)}
            placeholder="Qtd"
            style={{ ...INP, width: 64, flexShrink: 0, fontFamily: 'var(--fm)', opacity: it.unica ? 0.5 : 1 }}
            aria-label="Quantidade por mês"
            title={it.unica ? 'Entrega única: sempre 1' : 'Quantidade por mês'}
          />
          <button
            type="button"
            onClick={() => toggleUnica(it.id)}
            className={`ui-btn small ${it.unica ? 'on' : ''}`}
            style={{ ...S.tipo, ...(it.unica ? { borderColor: 'var(--c-border)', color: 'var(--c)' } : null) }}
            aria-pressed={it.unica}
            title={it.unica ? 'Entrega única — clique para voltar a mensal' : 'Mensal — clique para marcar como entrega única'}
          >
            {it.unica ? <CircleDot size={13} /> : <Repeat size={13} />}
            {it.unica ? 'Única' : 'Mensal'}
          </button>
          <button type="button" onClick={() => del(it.id)} style={S.iconBtn} title="Remover entrega" aria-label="Remover entrega">
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
        <button type="button" className="ui-btn small" onClick={add}>
          <Plus size={13} /> Adicionar entrega
        </button>
        {itens.length === 0 && (
          <label style={S.check}>
            <input type="checkbox" checked={semRecorrencia} onChange={e => set(itens, e.target.checked)} />
            Cliente sem entregas mensais
          </label>
        )}
      </div>
    </div>
  );
}

const S = {
  bloco: { background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 12, padding: 14, display: 'flex', flexDirection: 'column', gap: 10 },
  hint: { fontSize: 11.5, color: 'var(--muted)', lineHeight: 1.5 },
  respLinha: { display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--border)' },
  respSetor: { fontSize: 13, color: 'var(--text)', fontWeight: 500, width: 120, flexShrink: 0, paddingTop: 7 },
  fora: { background: 'var(--red-dim)', color: 'var(--red)', borderColor: 'var(--red-b)', gap: 5 },
  itemLinha: { display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 },
  tipo: { width: 86, flexShrink: 0, justifyContent: 'center', height: 'auto', alignSelf: 'stretch' },
  iconBtn: { width: 34, height: 34, flexShrink: 0, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg2)', color: 'var(--muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' },
  check: { display: 'flex', alignItems: 'center', gap: 7, fontSize: 12.5, color: 'var(--muted)', cursor: 'pointer' },
};
