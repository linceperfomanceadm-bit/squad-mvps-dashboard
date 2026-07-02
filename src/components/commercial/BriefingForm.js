import React, { useState, useMemo } from 'react';
import { Check, AlertTriangle } from 'lucide-react';
import { SECTORS, SALE_SERVICES } from '../../lib/firebase';

const COLOR = SECTORS.comercial.color;
const MIN_SERVICE_DESC = 350;

/*
 * Formulário de Venda Fechada (Closer → CS).
 * - Etapa 1: dados do cliente (empresa, CNPJ/CPF, responsável, telefone
 *   obrigatórios; e-mail opcional) + serviços vendidos (descrição
 *   >= 350 chars por serviço marcado).
 * - Etapa 2: valor total, forma de pagamento (à vista / a prazo com
 *   parcelas ou parcelamento personalizado que deve somar o total) e
 *   prazo de contrato.
 *
 * Recebe `callForm` (mini-formulário preenchido durante a call). Se
 * houver dados compatíveis, oferece AUTO-PREENCHIMENTO via popup de
 * confirmação antes de aplicar.
 */

const empty = {
  companyName: '', docId: '', contactName: '', contactPhone: '', contactEmail: '',
  services: [],            // ids marcados
  serviceDescs: {},        // { id: descrição }
  saleTotal: '',
  paymentType: 'avista',   // 'avista' | 'prazo'
  installments: '',        // nº de parcelas (prazo)
  installmentValue: '',    // valor de cada parcela (prazo)
  customInstallment: false,
  customPlan: '',          // descrição do parcelamento personalizado
  contractMonths: '',
};

export default function BriefingForm({ initial, callForm, onSubmit, onCancel }) {
  const [step, setStep] = useState(1);
  const [data, setData] = useState({ ...empty, ...(initial || {}) });
  const [submitting, setSubmitting] = useState(false);
  const [showAutofill, setShowAutofill] = useState(false);

  const set = (k, v) => setData(d => ({ ...d, [k]: v }));
  const toggleService = (id) => setData(d => ({
    ...d,
    services: d.services.includes(id) ? d.services.filter(s => s !== id) : [...d.services, id],
  }));
  const setDesc = (id, v) => setData(d => ({ ...d, serviceDescs: { ...d.serviceDescs, [id]: v } }));

  // Oferece auto-preenchimento se houver dados na call ainda não aplicados.
  const canAutofill = useMemo(() => {
    if (!callForm) return false;
    return (callForm.clientCompany && callForm.clientCompany !== data.companyName)
        || (callForm.responsibleName && callForm.responsibleName !== data.contactName)
        || (callForm.investAmount && !data.saleTotal);
  }, [callForm, data]);

  const applyAutofill = () => {
    setData(d => ({
      ...d,
      companyName: d.companyName || callForm.clientCompany || '',
      contactName: d.contactName || callForm.responsibleName || '',
      saleTotal: d.saleTotal || (callForm.investAmount ? String(callForm.investAmount).replace(/[^\d,.-]/g, '') : ''),
    }));
    setShowAutofill(false);
  };

  // ── Validação ────────────────────────────────────────────────
  const step1Valid = (
    data.companyName.trim() && data.docId.trim() && data.contactName.trim() && data.contactPhone.trim() &&
    data.services.length > 0 &&
    data.services.every(id => (data.serviceDescs[id] || '').trim().length >= MIN_SERVICE_DESC)
  );

  const totalNum = parseFloat(String(data.saleTotal).replace(',', '.')) || 0;
  const instCount = parseInt(data.installments, 10) || 0;
  const instValue = parseFloat(String(data.installmentValue).replace(',', '.')) || 0;
  const installmentSum = instCount * instValue;
  const sumMatches = data.customInstallment
    ? true // no personalizado a conferência é textual (validada pelo closer)
    : (data.paymentType === 'avista' || Math.abs(installmentSum - totalNum) < 0.01);

  const step2Valid = (
    totalNum > 0 && data.contractMonths &&
    (data.paymentType === 'avista' ||
      (data.customInstallment ? data.customPlan.trim() : (instCount > 0 && instValue > 0 && sumMatches)))
  );

  const submit = async () => {
    if (!step1Valid) { setStep(1); return; }
    if (!step2Valid) { setStep(2); return; }
    setSubmitting(true);
    const briefing = {
      ...data,
      saleTotal: totalNum,
      // resumo dos serviços para o CS
      servicesSummary: data.services.map(id => ({
        id, label: SALE_SERVICES.find(s => s.id === id)?.label || id,
        desc: data.serviceDescs[id] || '',
      })),
      payment: data.paymentType === 'avista'
        ? { type: 'avista' }
        : (data.customInstallment
          ? { type: 'prazo', custom: true, plan: data.customPlan }
          : { type: 'prazo', installments: instCount, installmentValue: instValue }),
    };
    const r = await onSubmit(briefing);
    setSubmitting(false);
    if (r && !r.success) { /* erro é tratado pelo pai via toast */ }
  };

  return (
    <div>
      {/* Botão de auto-preenchimento */}
      {canAutofill && (
        <button onClick={() => setShowAutofill(true)} style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', background: `${COLOR}15`, border: `1px solid ${COLOR}44`, borderRadius: 10, padding: '10px 14px', color: COLOR, fontSize: 13, fontWeight: 600, cursor: 'pointer', marginBottom: 16 }}>
          <Check size={15} /> Preencher automaticamente com os dados da call
        </button>
      )}

      {/* Stepper */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {['Dados & Serviços', 'Valor & Pagamento'].map((t, i) => (
          <div key={i} style={{ flex: 1, padding: '8px 12px', borderRadius: 9, textAlign: 'center', fontSize: 12, fontWeight: 700, background: step === i + 1 ? `${COLOR}22` : 'var(--surface)', color: step === i + 1 ? COLOR : 'var(--muted)', border: `1px solid ${step === i + 1 ? `${COLOR}55` : 'var(--border)'}` }}>
            {i + 1}. {t}
          </div>
        ))}
      </div>

      {step === 1 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Field label="Nome da Empresa *" value={data.companyName} onChange={v => set('companyName', v)} />
            <Field label="CNPJ ou CPF *" value={data.docId} onChange={v => set('docId', v)} />
            <Field label="Nome do Responsável *" value={data.contactName} onChange={v => set('contactName', v)} />
            <Field label="Telefone *" value={data.contactPhone} onChange={v => set('contactPhone', v)} />
          </div>
          <Field label="E-mail (opcional)" value={data.contactEmail} onChange={v => set('contactEmail', v)} />

          <div>
            <label style={LBL}>SERVIÇOS VENDIDOS *</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
              {SALE_SERVICES.map(s => {
                const active = data.services.includes(s.id);
                return (
                  <button key={s.id} type="button" onClick={() => toggleService(s.id)} style={{ fontSize: 12, fontWeight: 600, padding: '7px 13px', borderRadius: 16, cursor: 'pointer', background: active ? `${COLOR}22` : 'var(--surface)', color: active ? COLOR : 'var(--muted)', border: `1px solid ${active ? `${COLOR}66` : 'var(--border)'}` }}>
                    {active && '✓ '}{s.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Descrição por serviço marcado */}
          {data.services.map(id => {
            const label = SALE_SERVICES.find(s => s.id === id)?.label || id;
            const len = (data.serviceDescs[id] || '').trim().length;
            return (
              <div key={id}>
                <label style={LBL}>DESCRIÇÃO — {label.toUpperCase()} * <span style={{ color: len >= MIN_SERVICE_DESC ? 'var(--green)' : 'var(--muted)', fontWeight: 400 }}>({len}/{MIN_SERVICE_DESC})</span></label>
                <textarea value={data.serviceDescs[id] || ''} onChange={e => setDesc(id, e.target.value)} rows={4} placeholder={`Descreva em detalhe o que foi vendido em ${label} (mínimo ${MIN_SERVICE_DESC} caracteres)...`} style={{ ...INP, marginTop: 6, resize: 'vertical', fontFamily: 'var(--f)' }} />
              </div>
            );
          })}

          <button disabled={!step1Valid} onClick={() => setStep(2)} style={{ ...BTN, marginTop: 8, opacity: step1Valid ? 1 : .5, background: `linear-gradient(135deg,${COLOR},${COLOR}cc)` }}>
            Continuar →
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={LBL}>VALOR TOTAL DA VENDA (R$) *</label>
            <input value={data.saleTotal} onChange={e => set('saleTotal', e.target.value)} placeholder="Ex: 5000" style={{ ...INP, marginTop: 6 }} />
            {totalNum > 0 && <p style={{ fontSize: 12, color: 'var(--green)', marginTop: 4 }}>{totalNum.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>}
          </div>

          <div>
            <label style={LBL}>FORMA DE PAGAMENTO *</label>
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <button type="button" onClick={() => set('paymentType', 'avista')} style={{ flex: 1, ...BTN, ...(data.paymentType === 'avista' ? { background: `linear-gradient(135deg,${COLOR},${COLOR}cc)` } : SOFT) }}>À vista</button>
              <button type="button" onClick={() => set('paymentType', 'prazo')} style={{ flex: 1, ...BTN, ...(data.paymentType === 'prazo' ? { background: `linear-gradient(135deg,${COLOR},${COLOR}cc)` } : SOFT) }}>A prazo</button>
            </div>
          </div>

          {data.paymentType === 'prazo' && (
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 14 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text)', marginBottom: 12, cursor: 'pointer' }}>
                <input type="checkbox" checked={data.customInstallment} onChange={e => set('customInstallment', e.target.checked)} />
                Parcelamento personalizado
              </label>
              {data.customInstallment ? (
                <div>
                  <label style={LBL}>CONDIÇÃO PERSONALIZADA *</label>
                  <textarea value={data.customPlan} onChange={e => set('customPlan', e.target.value)} rows={2} placeholder="Ex: entrada de R$2000 + 3x de R$1000" style={{ ...INP, marginTop: 6, resize: 'vertical', fontFamily: 'var(--f)' }} />
                  <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 6 }}>Confira que a soma da condição bate com o valor total ({totalNum.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}).</p>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <label style={LBL}>Nº DE PARCELAS *</label>
                    <input value={data.installments} onChange={e => set('installments', e.target.value)} placeholder="Ex: 3" style={{ ...INP, marginTop: 6 }} />
                  </div>
                  <div>
                    <label style={LBL}>VALOR DA PARCELA *</label>
                    <input value={data.installmentValue} onChange={e => set('installmentValue', e.target.value)} placeholder="Ex: 1666.67" style={{ ...INP, marginTop: 6 }} />
                  </div>
                  {instCount > 0 && instValue > 0 && (
                    <p style={{ gridColumn: '1/3', fontSize: 12, color: sumMatches ? 'var(--green)' : 'var(--neon)', fontWeight: 600 }}>
                      {instCount}x de {instValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} = {installmentSum.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      {sumMatches ? ' ✓ bate com o total' : ' ✕ não bate com o valor total'}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          <div>
            <label style={LBL}>PRAZO DE CONTRATO (MESES) *</label>
            <input value={data.contractMonths} onChange={e => set('contractMonths', e.target.value)} placeholder="Ex: 6" style={{ ...INP, marginTop: 6 }} />
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <button onClick={() => setStep(1)} style={{ ...BTN, ...SOFT }}>← Voltar</button>
            <button disabled={!step2Valid || submitting} onClick={submit} style={{ ...BTN, flex: 1, opacity: (step2Valid && !submitting) ? 1 : .5, background: 'linear-gradient(135deg,#22c55e,#16a34a)' }}>
              <Check size={15} /> {submitting ? 'Enviando...' : 'Registrar venda e enviar ao CS'}
            </button>
          </div>
        </div>
      )}

      {onCancel && (
        <button onClick={onCancel} style={{ ...BTN, ...SOFT, width: '100%', marginTop: 10 }}>Cancelar</button>
      )}

      {/* Popup de confirmação de auto-preenchimento */}
      {showAutofill && (
        <div onClick={() => setShowAutofill(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1400, padding: 20 }}>
          <div onClick={e => e.stopPropagation()} className="fade-up" style={{ background: 'rgba(16,16,30,.99)', border: `1px solid ${COLOR}44`, borderRadius: 16, padding: 24, width: '100%', maxWidth: 400 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <AlertTriangle size={20} color={COLOR} />
              <h3 style={{ fontSize: 16, fontWeight: 800, color: '#fff' }}>Preencher com dados da call?</h3>
            </div>
            <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 18, lineHeight: 1.5 }}>
              Vou usar o que você preencheu durante a call (empresa, responsável e valor) para adiantar este formulário. Os campos que você já editou aqui não serão sobrescritos.
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={applyAutofill} style={{ ...BTN, flex: 1, background: `linear-gradient(135deg,${COLOR},${COLOR}cc)` }}>Sim, preencher</button>
              <button onClick={() => setShowAutofill(false)} style={{ ...BTN, ...SOFT }}>Não</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, value, onChange }) {
  return (
    <div>
      <label style={LBL}>{label}</label>
      <input value={value || ''} onChange={e => onChange(e.target.value)} style={{ ...INP, marginTop: 6 }} />
    </div>
  );
}

const LBL = { fontSize: 10, letterSpacing: '.12em', color: 'var(--muted)', fontWeight: 600, fontFamily: 'var(--fm)', display: 'block' };
const INP = { width: '100%', background: '#12121f', border: '1px solid var(--border)', borderRadius: 9, padding: '10px 13px', color: 'var(--text)', fontSize: 13, outline: 'none', fontFamily: 'var(--f)' };
const BTN = { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, border: 'none', borderRadius: 10, padding: '11px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer', color: '#fff' };
const SOFT = { background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--muted)' };
