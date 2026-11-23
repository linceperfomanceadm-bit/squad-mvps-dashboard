import React, { useState } from 'react';
import { Check, PauseCircle, PlayCircle } from 'lucide-react';
import { WD_SERVICE_CONFIG, WD_WEB_SERVICES } from '../../../lib/firebase';
import { wdJobsOf, WD_ACTIVE_STATUSES } from '../../../lib/wdJobs';
import { Overlay, ModalHeader, MODAL, LBL, INP, BTN_PRIMARY, BTN_GREEN, BTN_CANCEL, fmtDateTime } from '../../commercial/ui';

/*
 * Modais do card de serviço do WebDesign.
 *
 * - WDEditarProjetoModal: só o LÍDER do setor. Troca o tipo do projeto
 *   e/ou os responsáveis daquele serviço (useClients:
 *   wdTrocarServico / wdTrocarResponsaveis).
 * - WDPausaModal: pedido de pausa com justificativa obrigatória. Do
 *   colaborador, fica pendente até o líder aceitar; do líder, já vale.
 * - WDDecisaoPausaModal: o líder lê a justificativa e aprova ou recusa
 *   (motivo da recusa é opcional e fica no histórico do serviço).
 *
 * Todos recebem a ação já embrulhada (devolve { success, error }) e
 * fecham sozinhos quando dá certo.
 */

export function WDEditarProjetoModal({ client, job, collaborators, onClose, onTrocarServico, onTrocarResponsaveis }) {
  const [service, setService] = useState(job.service);
  const [nomes, setNomes] = useState(job.responsibles || []);
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState('');

  const time = (collaborators || []).filter(c => c.active !== false);
  // Quem já é responsável e saiu do time continua aparecendo, para o
  // líder conseguir tirar.
  const foraDoTime = (job.responsibles || []).filter(n => !time.some(c => c.name === n));
  const outrosAtivos = new Set(
    wdJobsOf(client).filter(j => j.id !== job.id && WD_ACTIVE_STATUSES.includes(j.status)).map(j => j.service),
  );
  const ativo = WD_ACTIVE_STATUSES.includes(job.status);

  const mudouServico = service !== job.service;
  const mudouNomes = nomes.length !== (job.responsibles || []).length || nomes.some(n => !(job.responsibles || []).includes(n));
  const toggle = (n) => setNomes(sel => (sel.includes(n) ? sel.filter(x => x !== n) : [...sel, n]));

  const salvar = async () => {
    if (!nomes.length) { setErro('Selecione ao menos um responsável.'); return; }
    setBusy(true); setErro('');
    if (mudouServico) {
      const r = await onTrocarServico(client.id, job.id, service);
      if (!r?.success) { setBusy(false); setErro(r?.error || 'Não foi possível trocar o tipo.'); return; }
    }
    if (mudouNomes) {
      const r = await onTrocarResponsaveis(client.id, job.id, nomes);
      if (!r?.success) { setBusy(false); setErro(r?.error || 'Não foi possível trocar o responsável.'); return; }
    }
    setBusy(false);
    onClose();
  };

  return (
    <Overlay onClose={onClose}>
      <div style={{ ...MODAL, maxWidth: 460 }}>
        <ModalHeader title="Editar projeto" onClose={onClose} />
        <p style={S.sub}>{client.name}</p>

        <p style={LBL}>TIPO DO PROJETO</p>
        <div style={S.opts}>
          {WD_WEB_SERVICES.map(k => {
            const bloqueado = ativo && k !== job.service && outrosAtivos.has(k);
            const sel = service === k;
            return (
              <button key={k} type="button" disabled={bloqueado} title={bloqueado ? 'Já em andamento para este cliente' : ''}
                style={{ ...S.opt, ...(sel ? S.optSel : {}), ...(bloqueado ? S.optOff : {}) }}
                onClick={() => setService(k)}>
                {sel && <Check size={11} />} {WD_SERVICE_CONFIG[k]?.label || k}
              </button>
            );
          })}
        </div>
        {mudouServico && job.status === 'production' && (
          <p style={S.aviso}>
            O checklist passa a ser o de {WD_SERVICE_CONFIG[service]?.label}: itens com o mesmo nome continuam marcados,
            os outros saem. O prazo de produção vira {WD_SERVICE_CONFIG[service]?.days} dias, contados do mesmo início.
          </p>
        )}

        <p style={{ ...LBL, marginTop: 18 }}>RESPONSÁVEIS</p>
        <div style={S.opts}>
          {[...time.map(c => c.name), ...foraDoTime].map(n => {
            const sel = nomes.includes(n);
            return (
              <button key={n} type="button" style={{ ...S.chip, ...(sel ? S.optSel : {}) }} onClick={() => toggle(n)}>
                {sel && <Check size={11} />} {n}
              </button>
            );
          })}
        </div>

        {erro && <p style={S.erro}>{erro}</p>}

        <div style={S.acoes}>
          <button style={BTN_CANCEL} onClick={onClose}>Cancelar</button>
          <button style={{ ...BTN_PRIMARY, opacity: (busy || (!mudouServico && !mudouNomes)) ? .5 : 1 }}
            disabled={busy || (!mudouServico && !mudouNomes)} onClick={salvar}>
            {busy ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>
    </Overlay>
  );
}

export function WDPausaModal({ client, job, souLider, onClose, onPedir }) {
  const [motivo, setMotivo] = useState('');
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState('');

  const enviar = async () => {
    if (!motivo.trim()) { setErro('Escreva a justificativa.'); return; }
    setBusy(true); setErro('');
    const r = await onPedir(client.id, job.id, motivo.trim());
    setBusy(false);
    if (r?.success) onClose();
    else setErro(r?.error || 'Não foi possível pedir a pausa.');
  };

  return (
    <Overlay onClose={onClose}>
      <div style={{ ...MODAL, maxWidth: 440 }}>
        <ModalHeader title="Pausar projeto" onClose={onClose} />
        <p style={S.sub}>{client.name} · {WD_SERVICE_CONFIG[job.service]?.label || job.service}</p>
        <p style={S.texto}>
          {souLider
            ? 'Como líder, a pausa vale na hora. O prazo congela até o projeto ser retomado.'
            : 'Use quando o projeto está parado por causa do cliente. A pausa só vale depois que o líder aceitar a justificativa — a partir daí, o tempo desde o pedido não conta no prazo.'}
        </p>
        <p style={LBL}>JUSTIFICATIVA *</p>
        <textarea value={motivo} onChange={e => setMotivo(e.target.value)} rows={4} autoFocus
          placeholder="Ex.: cliente ainda não enviou as fotos dos produtos; cobrado em 20/11 pelo grupo."
          style={{ ...INP, marginTop: 6, resize: 'vertical' }} />
        {erro && <p style={S.erro}>{erro}</p>}
        <div style={S.acoes}>
          <button style={BTN_CANCEL} onClick={onClose}>Cancelar</button>
          <button style={{ ...BTN_PRIMARY, display: 'flex', alignItems: 'center', gap: 6, opacity: busy || !motivo.trim() ? .5 : 1 }}
            disabled={busy || !motivo.trim()} onClick={enviar}>
            <PauseCircle size={14} /> {busy ? 'Enviando...' : souLider ? 'Pausar agora' : 'Enviar para o líder'}
          </button>
        </div>
      </div>
    </Overlay>
  );
}

export function WDDecisaoPausaModal({ client, job, onClose, onDecidir }) {
  const [recusando, setRecusando] = useState(false);
  const [motivoRecusa, setMotivoRecusa] = useState('');
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState('');
  const p = job.pausa || {};

  const decidir = async (aprovar) => {
    setBusy(true); setErro('');
    const r = await onDecidir(client.id, job.id, aprovar, motivoRecusa.trim());
    setBusy(false);
    if (r?.success) onClose();
    else setErro(r?.error || 'Não foi possível responder o pedido.');
  };

  return (
    <Overlay onClose={onClose}>
      <div style={{ ...MODAL, maxWidth: 440 }}>
        <ModalHeader title="Pedido de pausa" onClose={onClose} />
        <p style={S.sub}>{client.name} · {WD_SERVICE_CONFIG[job.service]?.label || job.service}</p>
        <div style={S.pedido}>
          <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}>
            <strong style={{ color: 'var(--text)' }}>{p.pedidoPor || 'Alguém'}</strong>
            {p.pedidoEm ? ` · ${fmtDateTime(p.pedidoEm)}` : ''}
          </p>
          <p style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>{p.motivo}</p>
        </div>
        <p style={S.texto}>Aprovada, a pausa vale desde o pedido e o prazo congela até alguém retomar o projeto.</p>
        {recusando && (
          <>
            <p style={LBL}>MOTIVO DA RECUSA (OPCIONAL)</p>
            <textarea value={motivoRecusa} onChange={e => setMotivoRecusa(e.target.value)} rows={3} autoFocus
              style={{ ...INP, marginTop: 6, resize: 'vertical' }} />
          </>
        )}
        {erro && <p style={S.erro}>{erro}</p>}
        <div style={S.acoes}>
          {recusando ? (
            <>
              <button style={BTN_CANCEL} onClick={() => setRecusando(false)} disabled={busy}>Voltar</button>
              <button style={{ ...BTN_PRIMARY, opacity: busy ? .5 : 1 }} disabled={busy} onClick={() => decidir(false)}>Confirmar recusa</button>
            </>
          ) : (
            <>
              <button style={BTN_CANCEL} onClick={() => setRecusando(true)} disabled={busy}>Recusar</button>
              <button style={{ ...BTN_GREEN, display: 'flex', alignItems: 'center', gap: 6, opacity: busy ? .5 : 1 }} disabled={busy} onClick={() => decidir(true)}>
                <PlayCircle size={14} /> Aprovar pausa
              </button>
            </>
          )}
        </div>
      </div>
    </Overlay>
  );
}

const S = {
  sub: { fontSize: 12.5, color: 'var(--muted)', marginTop: -8, marginBottom: 16 },
  texto: { fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.55, marginBottom: 14 },
  opts: { display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 },
  opt: { display: 'flex', alignItems: 'center', gap: 5, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '7px 13px', color: 'var(--muted)', fontSize: 12, fontWeight: 500, cursor: 'pointer' },
  chip: { display: 'flex', alignItems: 'center', gap: 4, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '5px 11px', color: 'var(--muted)', fontSize: 12, fontWeight: 600, cursor: 'pointer' },
  optSel: { background: 'var(--c-dim)', border: '1px solid var(--c-border)', color: 'var(--c)' },
  optOff: { opacity: .45, cursor: 'not-allowed' },
  aviso: { fontSize: 11.5, color: 'var(--amber)', background: 'var(--amber-dim)', border: '1px solid var(--amber-b)', borderRadius: 8, padding: '8px 10px', marginTop: 10, lineHeight: 1.5 },
  pedido: { background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px', marginBottom: 12 },
  erro: { fontSize: 12, color: 'var(--red)', marginTop: 12 },
  acoes: { display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 18 },
};
