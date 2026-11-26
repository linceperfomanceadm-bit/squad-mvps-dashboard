import React, { useState } from 'react';
import { Plus, X, Search, Trash2, Check, Edit2, ClipboardCheck, UserMinus, RotateCcw, UserX, ShoppingBag, PauseCircle } from 'lucide-react';
import { SECTORS, WD_SERVICE_CONFIG, CADASTRO_PENDENCIAS, CLIENTE_FORA, stageOf, isStaffing, isInativo, situacaoFora, contractState, temTiktokShop } from '../../lib/firebase';
import { SeloTiktokShop } from '../shared/ui';
import { cadastroPendencias } from '../../lib/entregas';
import { exColaboradores } from '../../lib/responsaveis';
import ClienteFicha from '../entregas/ClienteFicha';
import ClienteForm from '../cadastro/ClienteForm';
import { Overlay, ModalHeader, MODAL, LBL, INP, fmtDate, BTN_PRIMARY, BTN_CANCEL } from '../commercial/ui';

// Normaliza responsáveis de um setor para SEMPRE um array.
// (clientes antigos guardam string; novos guardam array.)
export function asArray(val) {
  if (!val) return [];
  return Array.isArray(val) ? val : [val];
}

/*
 * Tirar da base: o cliente sai sem apagar nada. Quem tira escolhe a
 * situação — Pausado (deve voltar, contrato aberto, não é churn) ou
 * Encerrado (saiu de vez, contrato encerrado, conta no churn do mês).
 * Cliente já pausado só pode ser encerrado daqui; voltar é Reativar.
 */
const OPCOES_SAIDA = [
  {
    id: 'pausado', Icone: PauseCircle,
    texto: 'O cliente parou e deve voltar. O contrato continua aberto e não conta como churn.',
    placeholder: 'Ex: pausou por 3 meses, aguardando verba, volta em março...',
  },
  {
    id: 'encerrado', Icone: UserMinus,
    texto: 'Saiu de vez. O contrato é encerrado e conta como churn do mês.',
    placeholder: 'Ex: encerrou o contrato, trocou de agência, fechou a loja...',
  },
];

function SaidaModal({ client, tasksAbertas, onClose, onConfirm }) {
  const jaPausado = situacaoFora(client) === 'pausado';
  const contratoAberto = contractState(client).status !== 'closed';
  // Sem situação marcada de saída: é uma decisão, então nada vem
  // pré-escolhido (exceto o pausado, que só tem um caminho).
  const [tipo, setTipo] = useState(jaPausado ? 'encerrado' : null);
  const [motivo, setMotivo] = useState('');
  const [busy, setBusy] = useState(false);
  const opcoes = jaPausado ? OPCOES_SAIDA.filter(o => o.id === 'encerrado') : OPCOES_SAIDA;
  const escolhida = OPCOES_SAIDA.find(o => o.id === tipo);

  return (
    <Overlay onClose={onClose}>
      <div style={{ ...MODAL, maxWidth: 500 }}>
        <ModalHeader title={jaPausado ? `Encerrar ${client.name}` : `Pausar ou encerrar ${client.name}`} onClose={onClose} />
        <p style={MS2.texto}>
          {jaPausado
            ? `Pausado desde ${fmtDate(client.inativo.at)}. Encerrar marca que o cliente não volta.`
            : 'O cliente sai da base ativa: some das carteiras, das métricas, das entregas do mês e do Painel de TV. Nada é apagado — dá para reativar depois, com os mesmos responsáveis.'}
        </p>
        {tasksAbertas > 0 && (
          <p style={MS2.aviso}>
            {tasksAbertas === 1 ? 'Há 1 task em aberto' : `Há ${tasksAbertas} tasks em aberto`} deste cliente. Elas continuam no quadro até alguém concluir ou apagar.
          </p>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: opcoes.length > 1 ? '1fr 1fr' : '1fr', gap: 10, marginTop: 14 }}>
          {opcoes.map(({ id, Icone, texto }) => {
            const cfg = CLIENTE_FORA[id];
            const on = tipo === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setTipo(id)}
                style={{
                  ...MS2.opcao,
                  borderColor: on ? 'var(--c-border)' : 'var(--border)',
                  background: on ? 'var(--c-dim)' : 'var(--bg3)',
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
                  <Icone size={15} color={on ? 'var(--c)' : 'var(--muted)'} /> {id === 'pausado' ? 'Pausar' : 'Encerrar'}
                </span>
                <span style={{ display: 'block', fontSize: 11.5, color: 'var(--muted)', lineHeight: 1.5, marginTop: 5 }}>
                  {id === 'encerrado' && !contratoAberto ? 'Saiu de vez. O contrato já está encerrado.' : texto}
                </span>
                <span style={{ display: 'inline-block', marginTop: 8, fontSize: 9.5, fontWeight: 700, fontFamily: 'var(--fm)', letterSpacing: '.04em', padding: '2px 7px', borderRadius: 6, background: cfg.fundo, color: cfg.cor, border: `1px solid ${cfg.borda}` }}>
                  {cfg.label.toUpperCase()}
                </span>
              </button>
            );
          })}
        </div>

        <p style={{ ...LBL, marginTop: 14 }}>MOTIVO</p>
        <textarea
          rows={3}
          value={motivo}
          onChange={e => setMotivo(e.target.value)}
          placeholder={escolhida?.placeholder || 'Escolha Pausar ou Encerrar acima.'}
          style={{ ...INP, marginTop: 6, resize: 'vertical' }}
        />

        <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
          <button
            type="button"
            className="ui-btn primary"
            style={{ flex: 1, justifyContent: 'center', opacity: tipo ? 1 : 0.5 }}
            disabled={busy || !tipo}
            onClick={async () => { setBusy(true); await onConfirm({ motivo, tipo }); setBusy(false); }}
          >
            {tipo === 'pausado' ? <PauseCircle size={14} /> : <UserMinus size={14} />}
            {busy ? 'Salvando...' : tipo === 'pausado' ? 'Pausar cliente' : tipo === 'encerrado' ? 'Encerrar cliente' : 'Escolha uma opção'}
          </button>
          <button type="button" className="ui-btn" onClick={onClose}>Cancelar</button>
        </div>
      </div>
    </Overlay>
  );
}

function ReativarModal({ client, onClose, onConfirm }) {
  const ct = contractState(client);
  const fechado = ct.status === 'closed';
  // Contrato encerrado no mesmo gesto da saída volta junto por padrão;
  // encerrado antes disso é outra história e fica desmarcado.
  const [reabrir, setReabrir] = useState(fechado && !!client.inativo?.at && ct.closedAt === client.inativo.at);
  const [busy, setBusy] = useState(false);

  return (
    <Overlay onClose={onClose}>
      <div style={{ ...MODAL, maxWidth: 460 }}>
        <ModalHeader title={`Reativar ${client.name}`} onClose={onClose} />
        <p style={MS2.texto}>
          O cliente volta para a base ativa com os mesmos responsáveis e reaparece nas carteiras, métricas e no Painel de TV.
        </p>
        {client.inativo?.at && (
          <p style={{ ...MS2.texto, marginTop: 8 }}>
            {CLIENTE_FORA[situacaoFora(client)]?.desde} {fmtDate(client.inativo.at)}{client.inativo.by ? ` por ${client.inativo.by}` : ''}
            {client.inativo.motivo ? ` · ${client.inativo.motivo}` : ''}.
          </p>
        )}
        {fechado && (
          <label style={MS2.check}>
            <input type="checkbox" checked={reabrir} onChange={e => setReabrir(e.target.checked)} />
            <span>
              Reabrir o contrato
              <span style={{ display: 'block', fontSize: 11.5, color: 'var(--muted)', marginTop: 2 }}>
                Sem isso, o cliente volta com o contrato encerrado — renove pela ficha da CS.
              </span>
            </span>
          </label>
        )}
        <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
          <button
            type="button"
            className="ui-btn primary"
            style={{ flex: 1, justifyContent: 'center' }}
            disabled={busy}
            onClick={async () => { setBusy(true); await onConfirm({ reabrirContrato: reabrir }); setBusy(false); }}
          >
            <RotateCcw size={14} /> {busy ? 'Reativando...' : 'Reativar cliente'}
          </button>
          <button type="button" className="ui-btn" onClick={onClose}>Cancelar</button>
        </div>
      </div>
    </Overlay>
  );
}

export default function AdminClients({ clients, collaborators, tasks = [], me, onAdd, onDelete, onInativar, onReativar, onLimparExColaboradores, acoesEntregas, toast }) {
  const [showAdd, setShowAdd] = useState(false);
  // Ficha de contrato e entregas — guarda só o id para ler o cliente vivo.
  const [fichaId, setFichaId] = useState(null);
  const ficha = fichaId ? clients.find(c => c.id === fichaId) : null;
  // "Editar" abre o formulário único direto (aba Equipe), sem passar
  // pelo card de contrato.
  const [editarId, setEditarId] = useState(null);
  const editar = editarId ? clients.find(c => c.id === editarId) : null;
  const [search, setSearch] = useState('');
  const [delConfirm, setDelConfirm] = useState(null);
  // Aba da lista: a base (ativos e em fluxo), os pausados ou os
  // encerrados (as chaves de CLIENTE_FORA).
  const [aba, setAba] = useState('base');
  const [saidaId, setSaidaId] = useState(null);
  const [reativarId, setReativarId] = useState(null);
  const [showLimpeza, setShowLimpeza] = useState(false);
  // Soma aos outros filtros (aba e busca): mostra só quem tem TikTok Shop.
  const [soTiktok, setSoTiktok] = useState(false);

  // Nomes presos em clientes que não existem mais como colaborador.
  const orfaos = exColaboradores(clients, collaborators);
  // Sem a lista carregada ninguém é riscado (senão todo nome pareceria
  // de ex-colaborador por um instante).
  const existe = collaborators?.length ? new Set(collaborators.map(c => c.name)) : null;
  const clientesComOrfao = new Set(orfaos.flatMap(o => o.clientes.map(c => c.id))).size;

  const contaFora = {
    pausado: clients.filter(c => situacaoFora(c) === 'pausado').length,
    encerrado: clients.filter(c => situacaoFora(c) === 'encerrado').length,
  };
  const daAba = clients.filter(c => (aba === 'base' ? !isInativo(c) : situacaoFora(c) === aba));
  const tiktokNaAba = daAba.filter(temTiktokShop).length;
  const filtered = daAba
    .filter(c => !soTiktok || temTiktokShop(c))
    .filter(c => c.name?.toLowerCase().includes(search.toLowerCase()));
  const clienteSaida = saidaId ? clients.find(c => c.id === saidaId) : null;
  const clienteReativar = reativarId ? clients.find(c => c.id === reativarId) : null;

  const wdStatusLabel = s => ({ onboarding:'Onboarding', production:'Produção', inactive:'Inativo', recurrence:'Recorrência', finished:'Finalizado' }[s] || s);
  const wdStatusColor = s => ({ onboarding:'var(--blue)', production:'var(--neon)', inactive:'var(--muted)', recurrence:'var(--purple)', finished:'var(--green)' }[s] || 'var(--muted)');

  return (
    <div className="fade-up">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 21, fontWeight: 500, color: 'var(--text)', letterSpacing: '-.01em', marginBottom: 4 }}>Clientes</h1>
          <p style={{ fontSize: 13, color: 'var(--muted)' }}>
            {clients.filter(c => c.active !== false).length} ativos · {clients.filter(isStaffing).length} aguardando responsáveis · {contaFora.pausado} {contaFora.pausado === 1 ? 'pausado' : 'pausados'} · {contaFora.encerrado} {contaFora.encerrado === 1 ? 'encerrado' : 'encerrados'}
          </p>
        </div>
        <button onClick={() => setShowAdd(true)} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--grad)', border: 'none', borderRadius: 10, padding: '10px 18px', color: 'var(--on)', fontSize: 13, fontWeight: 700, boxShadow: '0 4px 20px rgba(238,51,99,.35)', cursor: 'pointer' }}>
          <Plus size={15} /> Novo Cliente
        </button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: '1 1 260px', maxWidth: 380 }}>
          <Search size={15} color="var(--muted)" style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)' }} />
          <input style={{ ...S.input, paddingLeft: 38, width: '100%' }} placeholder="Buscar cliente..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <button type="button" className={`ui-btn small ${aba === 'base' ? 'on' : ''}`} onClick={() => setAba('base')}>Base ativa</button>
        {Object.values(CLIENTE_FORA).map(f => (
          <button key={f.id} type="button" className={`ui-btn small ${aba === f.id ? 'on' : ''}`} onClick={() => setAba(f.id)}>
            {f.plural} <span style={{ fontFamily: 'var(--fm)', fontSize: 11, color: contaFora[f.id] ? 'var(--text)' : 'var(--dim)' }}>{contaFora[f.id]}</span>
          </button>
        ))}
        <span style={{ width: 1, height: 20, background: 'var(--border)' }} />
        <button type="button" className={`ui-btn small ${soTiktok ? 'on' : ''}`} onClick={() => setSoTiktok(v => !v)} title="Mostrar só os clientes com TikTok Shop contratado">
          <ShoppingBag size={13} /> TikTok Shop <span style={{ fontFamily: 'var(--fm)', fontSize: 11, color: tiktokNaAba ? 'var(--text)' : 'var(--dim)' }}>{tiktokNaAba}</span>
        </button>
      </div>

      {onLimparExColaboradores && orfaos.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', background: 'var(--amber-dim)', border: '1px solid var(--amber-b)', borderRadius: 12, padding: '12px 16px', marginBottom: 16 }}>
          <p style={{ fontSize: 13, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 8, lineHeight: 1.5 }}>
            <UserX size={15} color="var(--amber)" style={{ flexShrink: 0 }} />
            {orfaos.length === 1 ? '1 ex-colaborador continua' : `${orfaos.length} ex-colaboradores continuam`} como responsável em {clientesComOrfao} {clientesComOrfao === 1 ? 'cliente' : 'clientes'}.
          </p>
          <button type="button" className="ui-btn small" onClick={() => setShowLimpeza(true)}>Revisar e limpar</button>
        </div>
      )}

      <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}>
                {['Cliente', 'WD Status', 'Serviço WD', ...Object.values(SECTORS).map(s => s.label), 'Ações'].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 10, letterSpacing: '.1em', color: 'var(--muted)', fontWeight: 600, fontFamily: 'var(--fm)', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => (
                <tr key={c.id} style={{ borderBottom: '1px solid rgba(255,255,255,.04)' }}>
                  <td style={{ padding: '12px 14px', fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap' }}>
                    {c.name}
                    {temTiktokShop(c) && <SeloTiktokShop altura={14} style={{ marginLeft: 8, verticalAlign: 'middle' }} />}
                    {isStaffing(c) && (
                      <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 6, marginLeft: 8, background: 'var(--amber-dim)', color: 'var(--amber)', border: '1px solid var(--amber-b)', fontFamily: 'var(--fm)', verticalAlign: 'middle' }}>
                        AGUARDANDO RESPONSÁVEIS
                      </span>
                    )}
                    {isInativo(c) && (() => {
                      const fora = CLIENTE_FORA[situacaoFora(c)];
                      return (
                        <span
                          title={[c.inativo.by ? `por ${c.inativo.by}` : '', c.inativo.motivo].filter(Boolean).join(' · ') || undefined}
                          style={{ fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 6, marginLeft: 8, background: fora.fundo, color: fora.cor, border: `1px solid ${fora.borda}`, fontFamily: 'var(--fm)', verticalAlign: 'middle', cursor: c.inativo.motivo ? 'help' : 'default' }}
                        >
                          {fora.desde.toUpperCase()} {fmtDate(c.inativo.at)}
                        </span>
                      );
                    })()}
                    {c.active !== false && cadastroPendencias(c).length > 0 && (
                      <span
                        title={`Falta: ${cadastroPendencias(c).map(p => CADASTRO_PENDENCIAS[p]?.label || p).join(', ')}`}
                        style={{ fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 6, marginLeft: 8, background: 'var(--amber-dim)', color: 'var(--amber)', border: '1px solid var(--amber-b)', fontFamily: 'var(--fm)', verticalAlign: 'middle', cursor: 'help' }}
                      >
                        CADASTRO INCOMPLETO
                      </span>
                    )}
                  </td>
                  <td style={{ padding: '12px 14px' }}>
                    {c.wd?.status
                      ? <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6, background: `${wdStatusColor(c.wd.status)}15`, color: wdStatusColor(c.wd.status) }}>{wdStatusLabel(c.wd.status)}</span>
                      : <span style={{ fontSize: 11, color: 'var(--muted)' }}>—</span>}
                  </td>
                  <td style={{ padding: '12px 14px', fontSize: 12, color: 'var(--muted)' }}>
                    {c.wd?.service ? WD_SERVICE_CONFIG[c.wd.service]?.label : '—'}
                    {(c.wdJobs || []).length > 0 && (
                      <span title={(c.wdJobs || []).map(j => WD_SERVICE_CONFIG[j.service]?.label || j.service).join(', ')}
                        style={{ fontSize: 10, fontWeight: 700, marginLeft: 6, padding: '1px 6px', borderRadius: 5, background: 'var(--neon-dim)', color: 'var(--neon)', fontFamily: 'var(--fm)', cursor: 'help' }}>
                        +{c.wdJobs.length}
                      </span>
                    )}
                  </td>
                  {Object.values(SECTORS).map(s => {
                    const names = asArray(c.responsibles?.[s.id]);
                    return (
                      <td key={s.id} style={{ padding: '12px 14px', fontSize: 12, whiteSpace: 'nowrap' }}>
                        {names.length > 0
                          ? names.map((n, i) => (
                            <span key={n}>
                              {i > 0 && <span style={{ color: s.color }}>, </span>}
                              {!existe || existe.has(n)
                                ? <span style={{ color: s.color, fontWeight: 500 }}>{n}</span>
                                : <span title="Não está mais no app" style={{ color: 'var(--muted)', textDecoration: 'line-through' }}>{n}</span>}
                            </span>
                          ))
                          : <span style={{ color: 'var(--muted)' }}>—</span>}
                      </td>
                    );
                  })}
                  <td style={{ padding: '12px 14px' }}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button style={S.iconBtnBlue} onClick={() => setEditarId(c.id)} title="Editar cadastro e equipe">
                        <Edit2 size={13} />
                      </button>
                      {acoesEntregas && (
                        <button style={S.iconBtn} onClick={() => setFichaId(c.id)} title="Contrato, cadastro e entregas">
                          <ClipboardCheck size={13} />
                        </button>
                      )}
                      {onInativar && !isInativo(c) && stageOf(c) === 'live' && (
                        <button style={S.iconBtn} onClick={() => setSaidaId(c.id)} title="Pausar ou encerrar (sai da base ativa)">
                          <PauseCircle size={13} />
                        </button>
                      )}
                      {onInativar && situacaoFora(c) === 'pausado' && (
                        <button style={S.iconBtn} onClick={() => setSaidaId(c.id)} title="Encerrar cliente (não vai voltar)">
                          <UserMinus size={13} />
                        </button>
                      )}
                      {onReativar && isInativo(c) && (
                        <button style={{ ...S.iconBtn, color: 'var(--green)' }} onClick={() => setReativarId(c.id)} title="Reativar cliente">
                          <RotateCcw size={13} />
                        </button>
                      )}
                      {delConfirm === c.id
                        ? <>
                            <button style={S.iconBtnRed} onClick={() => { onDelete(c.id); setDelConfirm(null); }}><Check size={13} /></button>
                            <button style={S.iconBtn} onClick={() => setDelConfirm(null)}><X size={13} /></button>
                          </>
                        : <button style={S.iconBtn} onClick={() => setDelConfirm(c.id)}><Trash2 size={13} color="rgba(238,51,99,.6)" /></button>
                      }
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={Object.keys(SECTORS).length + 4} style={{ padding: '32px', textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>{soTiktok && !search ? 'Nenhum cliente com TikTok Shop aqui.' : aba !== 'base' && !search ? `Nenhum cliente ${CLIENTE_FORA[aba].label.toLowerCase()}.` : 'Nenhum cliente encontrado.'}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Novo cliente pelo admin: o mesmo formulário da CS, mas entra
          direto na base com a equipe definida (pula Kick Off e
          onboarding). O formulário já vai para o body (Overlay). */}
      {showAdd && (
        <ClienteForm
          modo="novo"
          admin
          collaborators={collaborators}
          me={me}
          toast={toast}
          onClose={() => setShowAdd(false)}
          onUpload={acoesEntregas?.upload}
          onCriar={async (dados) => {
            const r = await onAdd(dados);
            if (r?.success) setShowAdd(false);
            return r;
          }}
        />
      )}
      {editar && (
        <ClienteFicha
          client={editar}
          acoes={acoesEntregas}
          collaborators={collaborators}
          toast={toast}
          editar
          etapaInicial="equipe"
          onClose={() => setEditarId(null)}
        />
      )}
      {ficha && (
        <ClienteFicha client={ficha} acoes={acoesEntregas} collaborators={collaborators} toast={toast} onClose={() => setFichaId(null)} />
      )}
      {clienteSaida && (
        <SaidaModal
          client={clienteSaida}
          tasksAbertas={tasks.filter(t => t.clientId === clienteSaida.id && t.status !== 'done').length}
          onClose={() => setSaidaId(null)}
          onConfirm={async (opcoes) => {
            const r = await onInativar(clienteSaida.id, opcoes);
            if (r?.success) setSaidaId(null);
          }}
        />
      )}
      {clienteReativar && (
        <ReativarModal
          client={clienteReativar}
          onClose={() => setReativarId(null)}
          onConfirm={async (opcoes) => {
            const r = await onReativar(clienteReativar.id, opcoes);
            if (r?.success) setReativarId(null);
          }}
        />
      )}
      {showLimpeza && (
        <LimpezaModal
          orfaos={orfaos}
          onClose={() => setShowLimpeza(false)}
          onConfirm={async (nomes) => {
            const r = await onLimparExColaboradores(nomes);
            if (r?.success) setShowLimpeza(false);
          }}
        />
      )}
    </div>
  );
}

// Revisão dos ex-colaboradores antes de limpar. Cada nome vem marcado;
// o admin desmarca o que não deve sair — por exemplo, alguém que só
// mudou de nome no cadastro e ainda está na agência.
function LimpezaModal({ orfaos, onClose, onConfirm }) {
  const [marcados, setMarcados] = useState(() => orfaos.map(o => o.nome));
  const [salvando, setSalvando] = useState(false);
  const alterna = (nome) => setMarcados(m => (m.includes(nome) ? m.filter(n => n !== nome) : [...m, nome]));
  const confirmar = async () => {
    setSalvando(true);
    await onConfirm(marcados);
    setSalvando(false);
  };

  return (
    <Overlay onClose={onClose}>
      <div style={{ ...MODAL, maxWidth: 520 }}>
        <ModalHeader title="Limpar ex-colaboradores" onClose={onClose} />
        <p style={{ ...MS2.texto, marginBottom: 14 }}>
          Estes nomes não existem mais no app, mas continuam como responsáveis nos clientes abaixo.
          Ao limpar, eles saem dos clientes. Onde o setor ficar sem ninguém, o líder é avisado para indicar outra pessoa.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
          {orfaos.map(o => {
            const on = marcados.includes(o.nome);
            return (
              <label key={o.nome} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border)', background: on ? 'var(--surface)' : 'transparent', cursor: 'pointer' }}>
                <input type="checkbox" checked={on} onChange={() => alterna(o.nome)} style={{ marginTop: 3, accentColor: 'var(--c)' }} />
                <div style={{ minWidth: 0 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
                    {o.nome} <span style={{ fontWeight: 400, color: 'var(--muted)', fontFamily: 'var(--fm)', fontSize: 11 }}>· {o.clientes.length} {o.clientes.length === 1 ? 'cliente' : 'clientes'}</span>
                  </p>
                  <p style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.5, marginTop: 2 }}>
                    {o.clientes.map(c => c.name).join(', ')}
                  </p>
                </div>
              </label>
            );
          })}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={{ ...BTN_PRIMARY, flex: 1, opacity: marcados.length && !salvando ? 1 : 0.5 }} disabled={!marcados.length || salvando} onClick={confirmar}>
            {salvando ? 'Limpando…' : `Limpar ${marcados.length} ${marcados.length === 1 ? 'nome' : 'nomes'}`}
          </button>
          <button style={BTN_CANCEL} onClick={onClose}>Cancelar</button>
        </div>
      </div>
    </Overlay>
  );
}

const S = {
  input: { background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 9, padding: '10px 13px', color: 'var(--text)', fontSize: 13, outline: 'none', fontFamily: 'var(--f)' },
  iconBtn: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, padding: '5px 7px', color: 'var(--muted)', display: 'flex', alignItems: 'center', cursor: 'pointer' },
  iconBtnBlue: { background: 'rgba(56,189,248,.08)', border: '1px solid rgba(56,189,248,.25)', borderRadius: 6, padding: '5px 7px', color: 'var(--blue)', display: 'flex', alignItems: 'center', cursor: 'pointer' },
  iconBtnRed: { background: 'var(--neon-dim)', border: '1px solid var(--neon-border)', borderRadius: 6, padding: '5px 7px', color: 'var(--neon)', display: 'flex', alignItems: 'center', cursor: 'pointer' },
};

const MS2 = {
  texto: { fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.55 },
  aviso: { fontSize: 12, color: 'var(--amber)', background: 'var(--amber-dim)', border: '1px solid var(--amber-b)', borderRadius: 10, padding: '9px 12px', marginTop: 12, lineHeight: 1.5 },
  check: { display: 'flex', alignItems: 'flex-start', gap: 9, fontSize: 13, color: 'var(--text)', marginTop: 14, cursor: 'pointer' },
  opcao: { textAlign: 'left', padding: '12px 13px', borderRadius: 'var(--r)', border: '1px solid var(--border)', cursor: 'pointer', fontFamily: 'var(--f)' },
};

