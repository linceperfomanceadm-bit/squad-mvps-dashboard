import React, { useState, useMemo } from 'react';
import { Check, ChevronLeft, ChevronRight } from 'lucide-react';
import { SECTORS } from '../../lib/firebase';

const COLOR = SECTORS.comercial.color;
const MIN_SCOPE = 300;

/*
 * Formulário de Briefing (Closer → CS).
 * 4 abas: Cadastral, Escopo, Inteligência, Técnico.
 * Validação rígida: campos obrigatórios + escopo >= 300 chars.
 * Só habilita "Enviar para o CS" quando tudo é válido.
 *
 * Este é um conjunto PADRÃO de campos — ajuste livremente depois.
 */
const TABS = ['Cadastral', 'Escopo', 'Inteligência', 'Técnico'];

const emptyBriefing = {
  // Cadastral
  companyName: '', cnpj: '', contactName: '', contactPhone: '', contactEmail: '',
  // Escopo
  services: [], scope: '', budget: '',
  // Inteligência
  pains: '', goals: '', competitors: '', decisionMaker: '',
  // Técnico
  hasWebsite: '', currentTools: '', assetsLink: '', observations: '',
};

export default function BriefingForm({ initial, onSubmit, onCancel }) {
  const [tab, setTab] = useState(0);
  const [data, setData] = useState({ ...emptyBriefing, ...(initial || {}) });
  const [submitting, setSubmitting] = useState(false);

  const set = (k, v) => setData(d => ({ ...d, [k]: v }));
  const toggleService = (id) => setData(d => ({
    ...d,
    services: d.services.includes(id) ? d.services.filter(s => s !== id) : [...d.services, id],
  }));

  // ── Validação por aba ───────────────────────────────────────
  const errors = useMemo(() => validate(data), [data]);
  const tabHasError = (i) => errors.byTab[i].length > 0;
  const isValid = errors.all.length === 0;

  const submit = async () => {
    if (!isValid) {
      // leva para a primeira aba com erro
      const firstBad = errors.byTab.findIndex(e => e.length > 0);
      if (firstBad >= 0) setTab(firstBad);
      return;
    }
    setSubmitting(true);
    await onSubmit(data);
    setSubmitting(false);
  };

  return (
    <div>
      {/* Stepper */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
        {TABS.map((t, i) => (
          <button key={t} onClick={() => setTab(i)} style={{
            flex: 1, padding: '9px 6px', borderRadius: 9, cursor: 'pointer', fontSize: 12, fontWeight: 700,
            background: tab === i ? `${COLOR}1f` : 'var(--surface)',
            color: tab === i ? COLOR : 'var(--muted)',
            border: `1px solid ${tab === i ? `${COLOR}50` : 'var(--border)'}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}>
            <span style={{ width: 18, height: 18, borderRadius: '50%', fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: tabHasError(i) ? 'rgba(238,51,99,.2)' : 'rgba(34,197,94,.18)', color: tabHasError(i) ? 'var(--neon)' : 'var(--green)' }}>
              {tabHasError(i) ? i + 1 : <Check size={11} />}
            </span>
            {t}
          </button>
        ))}
      </div>

      {/* Conteúdo da aba */}
      <div style={{ minHeight: 280 }}>
        {tab === 0 && (
          <Grid>
            <F label="RAZÃO SOCIAL / EMPRESA *" err={errors.field.companyName}><input style={INP} value={data.companyName} onChange={e => set('companyName', e.target.value)} /></F>
            <F label="CNPJ *" err={errors.field.cnpj}><input style={INP} value={data.cnpj} onChange={e => set('cnpj', e.target.value)} placeholder="00.000.000/0000-00" /></F>
            <F label="NOME DO CONTATO *" err={errors.field.contactName}><input style={INP} value={data.contactName} onChange={e => set('contactName', e.target.value)} /></F>
            <F label="TELEFONE DO CONTATO"><input style={INP} value={data.contactPhone} onChange={e => set('contactPhone', e.target.value)} /></F>
            <F label="E-MAIL DO CONTATO"><input style={INP} value={data.contactEmail} onChange={e => set('contactEmail', e.target.value)} /></F>
          </Grid>
        )}

        {tab === 1 && (
          <div>
            <F label="SERVIÇOS CONTRATADOS *" err={errors.field.services}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
                {Object.values(SECTORS).map(s => {
                  const on = data.services.includes(s.id);
                  return (
                    <button key={s.id} onClick={() => toggleService(s.id)} style={{
                      fontSize: 12, fontWeight: 600, padding: '7px 12px', borderRadius: 20, cursor: 'pointer',
                      background: on ? `${s.color}1f` : 'var(--surface)', color: on ? s.color : 'var(--muted)',
                      border: `1px solid ${on ? `${s.color}50` : 'var(--border)'}`,
                    }}>{s.emoji} {s.label}</button>
                  );
                })}
              </div>
            </F>
            <F label={`ESCOPO DETALHADO * (mín. ${MIN_SCOPE} caracteres)`} err={errors.field.scope}>
              <textarea style={{ ...INP, minHeight: 140, resize: 'vertical', fontFamily: 'var(--f)' }} value={data.scope} onChange={e => set('scope', e.target.value)} placeholder="Descreva em detalhe o que foi vendido, entregáveis, prazos combinados, expectativas do cliente..." />
              <div style={{ fontSize: 11, color: data.scope.trim().length >= MIN_SCOPE ? 'var(--green)' : 'var(--muted)', fontFamily: 'var(--fm)', marginTop: 4, textAlign: 'right' }}>
                {data.scope.trim().length} / {MIN_SCOPE}
              </div>
            </F>
            <F label="VERBA / INVESTIMENTO *" err={errors.field.budget}><input style={INP} value={data.budget} onChange={e => set('budget', e.target.value)} placeholder="Ex: 2500 (valor mensal acordado)" /></F>
          </div>
        )}

        {tab === 2 && (
          <Grid>
            <F label="PRINCIPAIS DORES *" err={errors.field.pains} full><textarea style={{ ...INP, minHeight: 90, resize: 'vertical', fontFamily: 'var(--f)' }} value={data.pains} onChange={e => set('pains', e.target.value)} /></F>
            <F label="OBJETIVOS DO CLIENTE" full><textarea style={{ ...INP, minHeight: 70, resize: 'vertical', fontFamily: 'var(--f)' }} value={data.goals} onChange={e => set('goals', e.target.value)} /></F>
            <F label="CONCORRENTES"><input style={INP} value={data.competitors} onChange={e => set('competitors', e.target.value)} /></F>
            <F label="DECISOR"><input style={INP} value={data.decisionMaker} onChange={e => set('decisionMaker', e.target.value)} /></F>
          </Grid>
        )}

        {tab === 3 && (
          <Grid>
            <F label="JÁ POSSUI SITE?"><input style={INP} value={data.hasWebsite} onChange={e => set('hasWebsite', e.target.value)} placeholder="URL ou 'não'" /></F>
            <F label="FERRAMENTAS ATUAIS"><input style={INP} value={data.currentTools} onChange={e => set('currentTools', e.target.value)} placeholder="CRM, gestor de anúncios, etc" /></F>
            <F label="LINK DE ASSETS / DRIVE" full><input style={INP} value={data.assetsLink} onChange={e => set('assetsLink', e.target.value)} placeholder="Materiais, logos, acessos..." /></F>
            <F label="OBSERVAÇÕES GERAIS" full><textarea style={{ ...INP, minHeight: 80, resize: 'vertical', fontFamily: 'var(--f)' }} value={data.observations} onChange={e => set('observations', e.target.value)} /></F>
          </Grid>
        )}
      </div>

      {/* Navegação + submit */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
        <button onClick={onCancel} style={{ ...BTN_SOFT, marginRight: 'auto' }}>Cancelar</button>
        {tab > 0 && <button onClick={() => setTab(tab - 1)} style={BTN_SOFT}><ChevronLeft size={15} /> Anterior</button>}
        {tab < TABS.length - 1
          ? <button onClick={() => setTab(tab + 1)} style={{ ...BTN, background: `linear-gradient(135deg,${COLOR},${COLOR}cc)` }}>Próximo <ChevronRight size={15} /></button>
          : <button onClick={submit} disabled={!isValid || submitting} style={{ ...BTN, background: isValid ? 'linear-gradient(135deg,#22c55e,#16a34a)' : 'var(--surface)', color: isValid ? '#fff' : 'var(--muted)', cursor: isValid ? 'pointer' : 'not-allowed', boxShadow: isValid ? '0 4px 16px rgba(34,197,94,.3)' : 'none' }}>
              <Check size={15} /> {submitting ? 'Enviando...' : 'Enviar para o CS'}
            </button>}
      </div>
      {!isValid && tab === TABS.length - 1 && (
        <p style={{ fontSize: 11, color: 'var(--neon)', marginTop: 10, textAlign: 'right' }}>
          Há campos obrigatórios pendentes. Abas com número (não ✓) ainda têm erros.
        </p>
      )}
    </div>
  );
}

// ── Validação ──────────────────────────────────────────────────
function validate(d) {
  const field = {};
  const req = (k, cond) => { if (!cond) field[k] = true; };

  req('companyName', d.companyName.trim());
  req('cnpj', d.cnpj.trim());
  req('contactName', d.contactName.trim());
  req('services', d.services.length > 0);
  req('scope', d.scope.trim().length >= MIN_SCOPE);
  req('budget', d.budget.trim());
  req('pains', d.pains.trim());

  const byTab = [
    ['companyName', 'cnpj', 'contactName'].filter(k => field[k]),
    ['services', 'scope', 'budget'].filter(k => field[k]),
    ['pains'].filter(k => field[k]),
    [],
  ];
  const all = Object.keys(field);
  return { field, byTab, all };
}

// ── UI helpers ─────────────────────────────────────────────────
function Grid({ children }) {
  return <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>{children}</div>;
}
function F({ label, children, err, full }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, gridColumn: full ? '1 / -1' : 'auto', marginBottom: 12 }}>
      <label style={{ ...LBL, color: err ? 'var(--neon)' : 'var(--muted)' }}>{label}{err ? ' ⚠' : ''}</label>
      {children}
    </div>
  );
}

const LBL = { fontSize: 10, letterSpacing: '.14em', fontWeight: 600, fontFamily: 'var(--fm)' };
const INP = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 9, padding: '10px 13px', color: 'var(--text)', fontSize: 13, outline: 'none', width: '100%', fontFamily: 'var(--f)' };
const BTN = { display: 'flex', alignItems: 'center', gap: 8, border: 'none', borderRadius: 9, padding: '10px 18px', fontSize: 13, fontWeight: 700, cursor: 'pointer', color: '#fff' };
const BTN_SOFT = { display: 'flex', alignItems: 'center', gap: 6, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 9, padding: '10px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer', color: 'var(--text)' };
