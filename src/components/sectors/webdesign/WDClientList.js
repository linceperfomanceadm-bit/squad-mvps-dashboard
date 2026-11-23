import React, { useState, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom';
import {
  ChevronDown, ChevronUp, CheckSquare, Square, ArrowRight, RotateCcw, Trash2, FileText, Layers, Plus,
  CalendarClock, User, Repeat, Check, Clock, AlertTriangle, PauseCircle, PlayCircle, Pencil, Hourglass, Trophy, ClipboardList,
} from 'lucide-react';
import { WD_SERVICE_CONFIG, RECURRENCE_SERVICES } from '../../../lib/firebase';
import { wdCardsOf, wdOnboardingLate, wdRelogio, wdPausaAtiva, wdPausaPendente, wdConclusao } from '../../../lib/wdJobs';
import { WDEditarProjetoModal, WDPausaModal, WDDecisaoPausaModal } from './WDJobModais';

const fmtDataHora = (iso) => new Date(iso).toLocaleString('pt-BR', {
  day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
});
const DIA_MS = 86400000;

// ─── Progress Ring ─────────────────────────────────────────────
function Ring({ checked, total }) {
  const r = 14, circ = 2 * Math.PI * r;
  const pct = total > 0 ? checked / total : 0;
  const dash = pct * circ;
  const color = pct === 1 ? 'var(--green)' : 'var(--c)';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
      <span style={{ fontSize: 9, color: 'var(--muted)', fontFamily: 'var(--fm)' }}>{checked}/{total}</span>
      <svg width="36" height="36" viewBox="0 0 36 36">
        <circle cx="18" cy="18" r={r} fill="none" stroke="var(--soft)" strokeWidth="3" />
        <circle cx="18" cy="18" r={r} fill="none" stroke={color} strokeWidth="3"
          strokeDasharray={`${dash.toFixed(2)} ${circ.toFixed(2)}`} strokeLinecap="round"
          transform="rotate(-90 18 18)" style={{ transition: 'stroke-dasharray .4s' }} />
      </svg>
    </div>
  );
}

// ─── Relógio do serviço ────────────────────────────────────────
// Substitui o Countdown genérico no Web: o prazo vale ponto, então o
// relógio desconta pausa aprovada, congela enquanto ela dura e não
// conta nada antes do zeramento (lib/wdJobs → wdRelogio).
function RelogioWD({ client, job }) {
  const [, tick] = useState(0);
  useEffect(() => { const t = setInterval(() => tick(n => n + 1), 60000); return () => clearInterval(t); }, []);

  const r = wdRelogio(client, job);
  if (!r) return null;
  if (r.aguardandoCall) {
    return (
      <div style={S.aguardando}>
        <CalendarClock size={13} style={{ flexShrink: 0 }} />
        <span>Call de onboarding em <strong>{fmtDataHora(r.callEm)}</strong> — o prazo de {r.dias}d começa nela.</span>
      </div>
    );
  }
  const totalMs = r.dias * DIA_MS;
  const pct = Math.min((r.decorridoMs / totalMs) * 100, 100);
  const isWarn = !r.atrasado && r.restanteMs < totalMs * 0.25;
  const color = r.pausado ? 'var(--blue)' : r.atrasado ? 'var(--red)' : isWarn ? 'var(--amber)' : 'var(--green)';
  const badge = r.pausado ? 'PAUSADO' : r.atrasado ? 'ATRASADO' : isWarn ? 'URGENTE' : 'NO PRAZO';
  const label = r.atrasado
    ? `${Math.max(1, Math.floor(-r.restanteMs / DIA_MS))}d em atraso`
    : `${Math.ceil(r.restanteMs / DIA_MS)}d restantes`;
  const Icone = r.pausado ? PauseCircle : r.atrasado ? AlertTriangle : Clock;

  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color, fontFamily: 'var(--fm)', fontWeight: 500 }}>
          <Icone size={12} /> {label}
        </span>
        <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: `color-mix(in srgb, ${color} 9%, transparent)`, color, border: `1px solid color-mix(in srgb, ${color} 31%, transparent)`, fontFamily: 'var(--fm)' }}>{badge}</span>
      </div>
      <div style={{ height: 4, background: 'var(--soft)', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 2, transition: 'width .6s ease' }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
        <span style={{ fontSize: 10, color: 'var(--muted)' }}>
          {r.status === 'onboarding' ? 'Onboarding' : 'Produção'}
          {r.pausadoMs > 0 && ` · ${Math.round(r.pausadoMs / DIA_MS * 10) / 10}d pausado`}
        </span>
        <span style={{ fontSize: 10, color: 'var(--muted)' }}>{r.dias}d prazo</span>
      </div>
    </div>
  );
}

// ─── Single Card ───────────────────────────────────────────────
// Um card por SERVIÇO: o mesmo cliente pode ter E-commerce e LP.
function WDCard({ client, job, me, souLider, collaborators, acoes, onMoveToProduction, onMoveBackToOnboarding, onUpdateChecklist, onUpdateNotes, onMoveStatus, onDelete }) {
  const [expanded, setExpanded] = useState(false);
  const [delConfirm, setDelConfirm] = useState(false);
  const [showRecModal, setShowRecModal] = useState(false);
  const [recChoice, setRecChoice] = useState('');
  const [recCustom, setRecCustom] = useState('');
  const [modal, setModal] = useState(null); // 'editar' | 'pausa' | 'decisao'
  const notesTimer = useRef(null);

  const wd = job || {};
  const cfg = WD_SERVICE_CONFIG[wd.service] || {};
  const checklist = wd.checklist || [];
  const checked = checklist.filter(i => i.checked).length;
  const total = checklist.length;
  const allChecked = total > 0 && checked === total;
  const isOnboarding = wd.status === 'onboarding';
  const isProduction = wd.status === 'production';
  const emAndamento = isOnboarding || isProduction;
  const souResponsavel = (wd.responsibles || []).includes(me);
  const pausaAtiva = wdPausaAtiva(wd);
  const pausaPendente = wdPausaPendente(wd);
  // Prévia do que a conclusão vale agora (mesmo cálculo do carimbo).
  const previa = allChecked && isProduction ? wdConclusao(wd) : null;

  const handleCheck = (itemId, val) => {
    const agora = new Date().toISOString();
    const updated = checklist.map(i => (i.id === itemId
      ? { ...i, checked: !val, checkedAt: !val ? agora : null, checkedBy: !val ? (me || null) : null }
      : i));
    onUpdateChecklist(client.id, updated, job.id);
  };

  const handleNotes = (value) => {
    clearTimeout(notesTimer.current);
    notesTimer.current = setTimeout(() => onUpdateNotes(client.id, value, job.id), 700);
  };

  const handleMoveRec = () => {
    const svc = recChoice === 'Outro' ? recCustom : recChoice;
    if (!svc.trim()) return;
    onMoveStatus(client.id, 'recurrence', { recurrenceService: svc }, job.id, me);
    setShowRecModal(false); setRecChoice(''); setRecCustom('');
  };

  return (
    <>
      <div style={S.card}>
        <div style={S.hd}>
          <div style={S.hdLeft}>
            <span style={S.tag}>{cfg.label || wd.service}</span>
            <div style={S.name}>{client.name}</div>
            <div style={S.resp}>
              <User size={12} style={{ flexShrink: 0 }} /> {(wd.responsibles || []).join(', ') || '—'}
              {wd.recurrenceService && <span style={S.recBadge}><Repeat size={10} /> {wd.recurrenceService}</span>}
            </div>
          </div>
          <div style={S.hdRight}>
            {isProduction && <Ring checked={checked} total={total} />}
            {souLider && (
              <button style={S.xbtn} title="Trocar tipo ou responsável" onClick={() => setModal('editar')}><Pencil size={14} /></button>
            )}
            <button style={S.xbtn} onClick={() => setExpanded(!expanded)}>{expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}</button>
          </div>
        </div>

        {emAndamento && <RelogioWD client={client} job={wd} />}

        {pausaPendente && (
          <div style={S.pendente}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600 }}>
              <Hourglass size={13} /> Pausa aguardando o líder
            </div>
            <p style={S.pausaTxt}>{pausaPendente.pedidoPor}: {pausaPendente.motivo}</p>
            <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
              {souLider && <button style={S.pausaBtn} onClick={() => setModal('decisao')}>Responder pedido</button>}
              {(pausaPendente.pedidoPor === me || souLider) && (
                <button style={S.pausaBtnSec} onClick={() => acoes.retomar(client.id, job.id)}>Cancelar pedido</button>
              )}
            </div>
          </div>
        )}

        {pausaAtiva && (
          <div style={S.pausado}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600 }}>
              <PauseCircle size={13} /> Pausado desde {fmtDataHora(pausaAtiva.desde)}
            </div>
            <p style={S.pausaTxt}>{pausaAtiva.motivo}</p>
            <p style={{ fontSize: 11, opacity: .8, marginTop: 4 }}>Pedido por {pausaAtiva.pedidoPor} · aprovado por {pausaAtiva.aprovadoPor}</p>
            {(souResponsavel || souLider) && (
              <button style={{ ...S.pausaBtn, marginTop: 8, display: 'flex', alignItems: 'center', gap: 5 }} onClick={() => acoes.retomar(client.id, job.id)}>
                <PlayCircle size={13} /> Retomar projeto
              </button>
            )}
          </div>
        )}

        {expanded && (
          <div style={S.body} className="fade-in">
            {isOnboarding && (
              <button style={S.moveProdBtn} onClick={() => onMoveToProduction(client.id, job.id, me)}>
                <ArrowRight size={14} /> Call realizada — Mover para Produção
              </button>
            )}
            {isProduction && (
              <button style={S.backBtn} onClick={() => onMoveBackToOnboarding(client.id, job.id)}>
                <RotateCcw size={13} /> Voltou para Onboarding por engano?
              </button>
            )}
            {isProduction && checklist.length > 0 && (
              <div style={{ marginBottom: 14 }}>
                <p style={S.secLbl}>CHECKLIST</p>
                {checklist.map(item => (
                  <div key={item.id} style={{ ...S.ci, opacity: item.checked ? .55 : 1 }} onClick={() => handleCheck(item.id, item.checked)}>
                    {item.checked ? <CheckSquare size={15} color="var(--green)" style={{ flexShrink: 0 }} /> : <Square size={15} color="var(--muted)" style={{ flexShrink: 0 }} />}
                    <span style={{ fontSize: 13, textDecoration: item.checked ? 'line-through' : 'none', color: item.checked ? 'var(--muted)' : 'var(--text)', flex: 1 }}>{item.label}</span>
                    {item.checked && item.checkedBy && <span style={S.quem}>{item.checkedBy}</span>}
                  </div>
                ))}
              </div>
            )}
            {isProduction && cfg.hasNotes && (
              <div style={{ marginBottom: 14 }}>
                <p style={{ ...S.secLbl, display: 'flex', alignItems: 'center', gap: 5 }}><FileText size={10} /> ANOTAÇÕES</p>
                <textarea style={S.ta} defaultValue={wd.notes || ''} onChange={e => handleNotes(e.target.value)} placeholder="Anotações..." />
              </div>
            )}
            {allChecked && isProduction && (
              <div style={S.doneBox}>
                <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--green)', display: 'flex', alignItems: 'center', gap: 6 }}><Check size={14} /> Todos os itens concluídos!</p>
                {previa && (
                  <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 5 }}>
                    <Trophy size={12} color={previa.noPrazo ? 'var(--green)' : 'var(--amber)'} />
                    Concluindo agora: {previa.noPrazo ? 'no prazo' : 'fora do prazo'}, +{previa.pts} pontos para cada responsável.
                  </p>
                )}
                <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 6 }}>Para onde mover este serviço?</p>
                <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                  <button style={S.btnFin} onClick={() => onMoveStatus(client.id, 'finished', {}, job.id, me)}>Finalizado</button>
                  <button style={S.btnRec} onClick={() => setShowRecModal(true)}>Recorrência</button>
                </div>
              </div>
            )}
            <div style={S.arow}>
              {emAndamento && !wd.pausa && (souResponsavel || souLider) && (
                <button style={S.asec} onClick={() => setModal('pausa')}><PauseCircle size={13} /> Pausar projeto</button>
              )}
              {isProduction && <button style={S.asec} onClick={() => onMoveStatus(client.id, 'inactive', {}, job.id, me)}>Mover p/ Inativos</button>}
              {['inactive', 'recurrence', 'finished'].includes(wd.status) && (
                <button style={S.asec} onClick={() => onMoveStatus(client.id, 'onboarding', { onboardingStartedAt: new Date().toISOString(), productionStartedAt: null, checklist: [] }, job.id, me)}>
                  <RotateCcw size={12} /> Reativar
                </button>
              )}
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'center' }}>
                {!delConfirm
                  ? <button style={S.delBtn} title="Remover serviço (o cliente continua na base)" onClick={() => setDelConfirm(true)}><Trash2 size={13} /></button>
                  : <><span style={{ fontSize: 11, color: 'var(--muted)' }}>Remover este serviço?</span>
                      <button style={S.confDel} onClick={() => onDelete(client.id, job.id)}>Sim</button>
                      <button style={S.cancDel} onClick={() => setDelConfirm(false)}>Não</button></>
                }
              </div>
            </div>
          </div>
        )}
      </div>

      {modal === 'editar' && (
        <WDEditarProjetoModal client={client} job={wd} collaborators={collaborators} onClose={() => setModal(null)}
          onTrocarServico={acoes.trocarServico} onTrocarResponsaveis={acoes.trocarResponsaveis} />
      )}
      {modal === 'pausa' && (
        <WDPausaModal client={client} job={wd} souLider={souLider} onClose={() => setModal(null)} onPedir={acoes.pedirPausa} />
      )}
      {modal === 'decisao' && (
        <WDDecisaoPausaModal client={client} job={wd} onClose={() => setModal(null)} onDecidir={acoes.decidirPausa} />
      )}

      {showRecModal && ReactDOM.createPortal(
        <div style={S.overlay} onClick={() => setShowRecModal(false)}>
          <div style={S.recModal} onClick={e => e.stopPropagation()} className="fade-up">
            <h3 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>Qual serviço na Recorrência?</h3>
            <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 16 }}>Para <strong style={{ color: 'var(--text)' }}>{client.name}</strong> · {cfg.label || wd.service}</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {RECURRENCE_SERVICES.map(s => (
                <button key={s} style={{ ...S.recOpt, ...(recChoice === s ? S.recOptSel : {}) }} onClick={() => setRecChoice(s)}>{s}</button>
              ))}
            </div>
            {recChoice === 'Outro' && <input style={{ ...S.ta, marginTop: 10, minHeight: 0, padding: '10px 12px' }} placeholder="Descreva o serviço..." value={recCustom} onChange={e => setRecCustom(e.target.value)} />}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
              <button style={S.cancDel} onClick={() => setShowRecModal(false)}>Cancelar</button>
              <button style={S.btnFin} onClick={handleMoveRec} disabled={!recChoice || (recChoice === 'Outro' && !recCustom.trim())}>Confirmar</button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}

// ─── Client List (page wrapper) ────────────────────────────────
const PROD_SUBTABS = Object.entries(WD_SERVICE_CONFIG).map(([key, v]) => ({ key, label: v.label }));

export default function WDClientList({ clients, collaborators, page, prodSubTab, setProdSubTab, me, souLider, acoes, onMoveToProduction, onMoveBackToOnboarding, onUpdateChecklist, onUpdateNotes, onMoveStatus, onDelete, onAddClient }) {
  const cards = wdCardsOf(clients);
  const getDisplay = () => {
    if (page === 'production') return cards.filter(k => k.job.status === 'production' && k.job.service === prodSubTab);
    return cards.filter(k => k.job.status === page);
  };
  const display = getDisplay();
  const prodCounts = {};
  Object.keys(WD_SERVICE_CONFIG).forEach(k => { prodCounts[k] = cards.filter(c => c.job.status === 'production' && c.job.service === k).length; });
  const PAGE_LABELS = { onboarding: 'Onboarding', production: 'Produção', inactive: 'Inativos', recurrence: 'Recorrência', finished: 'Finalizados' };
  const overdueOnb = cards.filter(({ client, job }) => wdOnboardingLate(client, job)).length;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 22 }}>
        <div>
          <h1 style={{ fontSize: 21, fontWeight: 500, color: 'var(--text)', letterSpacing: '-.01em', marginBottom: 3 }}>{PAGE_LABELS[page]}</h1>
          <p style={{ fontSize: 13, color: 'var(--muted)' }}>
            {display.length} serviço{display.length !== 1 ? 's' : ''}
            {page === 'onboarding' && overdueOnb > 0 && <span style={{ color: 'var(--red)' }}> · {overdueOnb} em atraso</span>}
          </p>
        </div>
        <button onClick={onAddClient} style={S.addBtn}>
          <Plus size={15} /> Adicionar Serviço
        </button>
      </div>

      {page === 'production' && (
        <div style={{ display: 'flex', gap: 6, marginBottom: 18, flexWrap: 'wrap' }}>
          {PROD_SUBTABS.map(({ key, label }) => {
            const on = prodSubTab === key;
            return (
              <button key={key} onClick={() => setProdSubTab(key)}
                style={{ display: 'flex', alignItems: 'center', gap: 5, background: on ? 'var(--c-dim)' : 'var(--surface)', border: `1px solid ${on ? 'var(--c-border)' : 'var(--border)'}`, borderRadius: 8, padding: '6px 13px', color: on ? 'var(--c)' : 'var(--muted)', fontSize: 12, fontWeight: 500, cursor: 'pointer', transition: 'all .15s' }}>
                <Layers size={11} />
                {label}
                {prodCounts[key] > 0 && <span style={{ background: on ? 'var(--c-dim)' : 'var(--soft)', borderRadius: 8, padding: '1px 6px', fontSize: 10, fontFamily: 'var(--fm)' }}>{prodCounts[key]}</span>}
              </button>
            );
          })}
        </div>
      )}

      {display.length === 0
        ? <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, paddingTop: 80, textAlign: 'center' }}>
            <ClipboardList size={40} color="var(--dim)" />
            <p style={{ fontSize: 16, color: 'var(--muted)', fontWeight: 600 }}>Nenhum serviço aqui</p>
            <p style={{ fontSize: 12, color: 'var(--muted)', opacity: .6, maxWidth: 280 }}>
              {page === 'onboarding' ? 'Adicione um serviço a um cliente da base para iniciar o onboarding.' : 'Mova serviços para esta aba quando necessário.'}
            </p>
          </div>
        : <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(330px,1fr))', gap: 12 }}>
            {display.map(({ key, client, job }) => (
              <WDCard key={key} client={client} job={job}
                me={me}
                souLider={souLider}
                collaborators={collaborators}
                acoes={acoes}
                onMoveToProduction={onMoveToProduction}
                onMoveBackToOnboarding={onMoveBackToOnboarding}
                onUpdateChecklist={onUpdateChecklist}
                onUpdateNotes={onUpdateNotes}
                onMoveStatus={onMoveStatus}
                onDelete={onDelete}
              />
            ))}
          </div>
      }
    </div>
  );
}

const S = {
  card: { background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 14, padding: 16, marginBottom: 0, transition: 'border-color .2s' },
  hd: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  hdLeft: { flex: 1, minWidth: 0 },
  hdRight: { display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 },
  tag: { display: 'inline-flex', alignItems: 'center', gap: 4, background: 'var(--c-dim)', border: '1px solid var(--c-border)', borderRadius: 5, padding: '2px 8px', fontSize: 10, color: 'var(--c)', fontWeight: 600, marginBottom: 5 },
  name: { fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  resp: { display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--muted)', flexWrap: 'wrap' },
  recBadge: { display: 'inline-flex', alignItems: 'center', gap: 3, background: 'var(--purple-dim)', border: '1px solid var(--purple-b)', borderRadius: 4, padding: '1px 6px', fontSize: 10, color: 'var(--purple)', marginLeft: 4 },
  xbtn: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 7, padding: '4px 7px', color: 'var(--muted)', display: 'flex', alignItems: 'center', cursor: 'pointer' },
  body: { borderTop: '1px solid var(--border)', paddingTop: 12, marginTop: 12 },
  aguardando: { display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, color: 'var(--blue)', background: 'var(--blue-dim)', border: '1px solid var(--blue-b)', borderRadius: 8, padding: '8px 10px', marginBottom: 10, lineHeight: 1.45 },
  pendente: { fontSize: 12, color: 'var(--amber)', background: 'var(--amber-dim)', border: '1px solid var(--amber-b)', borderRadius: 8, padding: '9px 11px', marginBottom: 10, lineHeight: 1.45 },
  pausado: { fontSize: 12, color: 'var(--blue)', background: 'var(--blue-dim)', border: '1px solid var(--blue-b)', borderRadius: 8, padding: '9px 11px', marginBottom: 10, lineHeight: 1.45 },
  pausaTxt: { fontSize: 12, color: 'var(--text)', marginTop: 4, whiteSpace: 'pre-wrap', wordBreak: 'break-word' },
  pausaBtn: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 7, padding: '5px 11px', color: 'var(--text)', fontSize: 12, fontWeight: 600, cursor: 'pointer' },
  pausaBtnSec: { background: 'transparent', border: '1px solid var(--border)', borderRadius: 7, padding: '5px 11px', color: 'var(--muted)', fontSize: 12, cursor: 'pointer' },
  secLbl: { fontSize: 10, letterSpacing: '.12em', color: 'var(--muted)', marginBottom: 8, fontWeight: 600, textTransform: 'uppercase', fontFamily: 'var(--fm)' },
  moveProdBtn: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: 'var(--c-dim)', border: '1px solid var(--c-border)', borderRadius: 9, padding: 10, color: 'var(--c)', fontSize: 13, fontWeight: 600, width: '100%', marginBottom: 10, cursor: 'pointer', transition: 'all .2s' },
  backBtn: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '7px 12px', color: 'var(--muted)', fontSize: 12, width: '100%', marginBottom: 12, cursor: 'pointer' },
  ci: { display: 'flex', alignItems: 'center', gap: 9, padding: '7px 9px', borderRadius: 7, cursor: 'pointer', marginBottom: 3, background: 'var(--surface)', transition: 'background .15s' },
  quem: { fontSize: 10, color: 'var(--muted)', fontFamily: 'var(--fm)', whiteSpace: 'nowrap' },
  ta: { width: '100%', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 10px', color: 'var(--text)', fontSize: 13, fontFamily: 'var(--f)', resize: 'vertical', minHeight: 72, outline: 'none' },
  doneBox: { background: 'var(--green-dim)', border: '1px solid var(--green-b)', borderRadius: 10, padding: 14, marginBottom: 14 },
  btnFin: { flex: 1, background: 'var(--green-dim)', border: '1px solid var(--green-b)', borderRadius: 8, padding: 8, color: 'var(--green)', fontSize: 12, fontWeight: 600, cursor: 'pointer' },
  btnRec: { flex: 1, background: 'var(--purple-dim)', border: '1px solid var(--purple-b)', borderRadius: 8, padding: 8, color: 'var(--purple)', fontSize: 12, fontWeight: 600, cursor: 'pointer' },
  arow: { display: 'flex', gap: 8, alignItems: 'center', marginTop: 4, flexWrap: 'wrap' },
  asec: { display: 'flex', alignItems: 'center', gap: 5, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 7, padding: '6px 12px', color: 'var(--muted)', fontSize: 12, cursor: 'pointer' },
  delBtn: { background: 'var(--red-dim)', border: '1px solid color-mix(in srgb, var(--red) 30%, transparent)', borderRadius: 7, padding: '6px 8px', color: 'var(--red)', display: 'flex', alignItems: 'center', cursor: 'pointer' },
  confDel: { background: 'var(--red)', border: 'none', borderRadius: 6, padding: '5px 12px', color: 'var(--bg)', fontSize: 12, fontWeight: 600, cursor: 'pointer' },
  cancDel: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, padding: '5px 12px', color: 'var(--muted)', fontSize: 12, cursor: 'pointer' },
  addBtn: { display: 'flex', alignItems: 'center', gap: 8, background: 'var(--grad)', border: 'none', borderRadius: 10, padding: '10px 18px', color: 'var(--on)', fontSize: 13, fontWeight: 700, cursor: 'pointer' },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, padding: 20 },
  recModal: { background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 16, padding: 24, width: '100%', maxWidth: 420, boxShadow: 'var(--shadow)' },
  recOpt: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '7px 13px', color: 'var(--muted)', fontSize: 12, fontWeight: 500, cursor: 'pointer', transition: 'all .15s' },
  recOptSel: { background: 'var(--purple-dim)', border: '1px solid var(--purple-b)', color: 'var(--purple)' },
};
