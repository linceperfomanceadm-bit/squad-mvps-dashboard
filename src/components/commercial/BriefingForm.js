import React, { useState } from 'react';
import { Check } from 'lucide-react';
import { SECTORS, SALE_SERVICES, PAYMENT_METHODS } from '../../lib/firebase';

const COLOR = SECTORS.cs.color;
const MIN_SERVICE_DESC = 350;
const MIN_BRIEFING = 200;

/*
 * FORMULÁRIO DE CONTRATO — cadastrado pelo CS Comercial.
 * Campos exigidos pelo fluxograma:
 *   Nome do Responsável, CPF, Nome Fantasia/Empresa, CNPJ, Endereço,
 *   Serviços Contratados, Duração do contrato, Valor,
 *   Forma de Pagamento, Briefing, Observações.
 *
 * Etapa 1 — Cliente (dados cadastrais)
 * Etapa 2 — Serviços contratados (descrição >= 350 chars por serviço)
 * Etapa 3 — Valor, pagamento, briefing e observações
 */

const empty = {
  // Cliente
  contactName: '',      // Nome do Responsável
  contactCpf: '',       // CPF do responsável
  companyName: '',      // Nome Fantasia / Empresa
  companyCnpj: '',      // CNPJ
  address: '',          // Endereço
  contactPhone: '',
  contactEmail: '',
  // Serviços
  services: [],
  serviceDescs: {},
  // Financeiro
  contractMonths: '',
  saleTotal: '',
  paymentMethod: '',
  paymentType: 'avista',  // 'avista' | 'prazo'
  installments: '',
  installmentValue: '',
  customInstallment: false,
  customPlan: '',
  // Texto
  briefing: '',
  observations: '',
};

export default function BriefingForm({ initial, onSubmit, onCancel }) {
  const [step, setStep] = useState(1);
  const [data, setData] = useState({ ...empty, ...(initial || {}) });
  const [submitting, setSubmitting] = useState(false);

  const set = (k, v) => setData(d => ({ ...d, [k]: v }));
  const toggleService = (id) => setData(d => ({
    ...d,
    services: d.services.includes(id) ? d.services.filter(s => s !== id) : [...d.services, id],
  }));
  const setDesc = (id, v) => setData(d => ({ ...d, serviceDescs: { ...d.serviceDescs, [id]: v } }));

  // ── Validação por etapa ──────────────────────────────────────
  const step1Valid = (
    data.contactName.trim() && data.contactCpf.trim() &&
    data.companyName.trim() && data.companyCnpj.trim() &&
    data.address.trim() && data.contactPhone.trim()
  );

  const step2Valid = (
    data.services.length > 0 &&
    data.services.every(id => (data.serviceDescs[id] || '').trim().length >= MIN_SERVICE_DESC)
  );

  const totalNum   = parseFloat(String(data.saleTotal).replace(/\./g, '').replace(',', '.')) || 0;
  const instCount  = parseInt(data.installments, 10) || 0;
  const instValue  = parseFloat(String(data.installmentValue).replace(/\./g, '').replace(',', '.')) || 0;
  const installmentSum = instCount * instValue;
  const sumMatches = data.customInstallment
    ? true
    : (data.paymentType === 'avista' || Math.abs(installmentSum - totalNum) < 0.01);

  const step3Valid = (
    totalNum > 0 &&
    data.contractMonths &&
    data.paymentMethod &&
    (data.briefing || '').trim().length >= MIN_BRIEFING &&
    (data.paymentType === 'avista' ||
      (data.customInstallment ? data.customPlan.trim() : (instCount > 0 && instValue > 0 && sumMatches)))
  );

  const submit = async () => {
    if (!step1Valid) { setStep(1); return; }
    if (!step2Valid) { setStep(2); return; }
    if (!step3Valid) { setStep(3); return; }
    setSubmitting(true);
    const briefing = {
      ...data,
      saleTotal: totalNum,
      // docId mantido por compatibilidade com telas antigas.
      docId: data.companyCnpj || data.contactCpf,
      servicesSummary: data.services.map(id => ({
        id,
        label: SALE_SERVICES.find(s => s.id === id)?.label || id,
        desc: data.serviceDescs[id] || '',
      })),
      payment: data.paymentType === 'avista'
        ? { type: 'avista', method: data.paymentMethod }
        : (data.customInstallment
          ? { type: 'prazo', method: data.paymentMethod, custom: true, plan: data.customPlan }
          : { type: 'prazo', method: data.paymentMethod, installments: instCount, installmentValue: instValue }),
    };
    const r = await onSubmit(briefing);
    setSubmitting(false);
    if (r && !r.success) { /* erro tratado pelo pai via toast */ }
  };

  const STEPS = ['Cliente', 'Serviços', 'Valor & Briefing'];

  return (
    <div>
      {/* Stepper */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {STEPS.map((t, i) => (
          <button
            key={t}
            onClick={() => setStep(i + 1)}
            style={{ flex: 1, padding: '8px 12px', borderRadius: 9, textAlign: 'center', fontSize: 12, fontWeight: 700, cursor: 'pointer', background: step === i + 1 ? `${COLOR}22` : 'var(--surface)', color: step === i + 1 ? COLOR : 'var(--muted)', border: `1px solid ${step === i + 1 ? `${COLOR}55` : 'var(--border)'}` }}
          >
            {i + 1}. {t}
          </button>
        ))}
      </div>

      {step === 1 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Field label="Nome do Responsável *" value={data.contactName} onChange={v => set('contactName', v)} />
            <Field label="CPF *" value={data.contactCpf} onChange={v => set('contactCpf', v)} placeholder="000.000.000-00" />
            <Field label="Nome Fantasia / Empresa *" value={data.companyName} onChange={v => set('companyName', v)} />
            <Field label="CNPJ *" value={data.companyCnpj} onChange={v => set('companyCnpj', v)} placeholder="00.000.000/0001-00" />
            <Field label="Telefone *" value={data.contactPhone} onChange={v => set('contactPhone', v)} />
            <Field label="E-mail" value={data.contactEmail} onChange={v => set('contactEmail', v)} />
          </div>
          <Field label="Endereço *" value={data.address} onChange={v => set('address', v)} area placeholder="Rua, número, bairro, cidade/UF, CEP" />

          <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
            <button style={{ ...BTN, flex: 1, opacity: step1Valid ? 1 : .5 }} disabled={!step1Valid} onClick={() => setStep(2)}>Continuar</button>
            {onCancel && <button style={CANCEL} onClick={onCancel}>Cancelar</button>}
          </div>
          {!step1Valid && <Hint text="Preencha responsável, CPF, empresa, CNPJ, endereço e telefone." />}
        </div>
      )}

      {step === 2 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <p style={LBL}>SERVIÇOS CONTRATADOS *</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
              {SALE_SERVICES.map(s => {
                const active = data.services.includes(s.id);
                return (
                  <button key={s.id} type="button" onClick={() => toggleService(s.id)} style={{ fontSize: 12, fontWeight: 600, padding: '6px 12px', borderRadius: 14, cursor: 'pointer', background: active ? `${COLOR}22` : 'var(--surface)', color: active ? '#fff' : 'var(--muted)', border: `1px solid ${active ? `${COLOR}66` : 'var(--border)'}`, display: 'flex', alignItems: 'center', gap: 5 }}>
                    {active && <Check size={11} />} {s.label}
                  </button>
                );
              })}
            </div>
          </div>

          {data.services.map(id => {
            const label = SALE_SERVICES.find(s => s.id === id)?.label || id;
            const len = (data.serviceDescs[id] || '').trim().length;
            const ok = len >= MIN_SERVICE_DESC;
            return (
              <div key={id}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <p style={LBL}>O QUE FOI VENDIDO — {label.toUpperCase()} *</p>
                  <span style={{ fontSize: 10, fontFamily: 'var(--fm)', color: ok ? 'var(--green)' : 'var(--amber)' }}>{len}/{MIN_SERVICE_DESC}</span>
                </div>
                <textarea
                  value={data.serviceDescs[id] || ''}
                  onChange={e => setDesc(id, e.target.value)}
                  rows={4}
                  placeholder="Descreva com detalhe o escopo combinado: entregáveis, quantidades, prazos, o que está e o que NÃO está incluso..."
                  style={{ ...INP, marginTop: 6, resize: 'vertical', borderColor: ok ? 'var(--green-b)' : 'var(--border)' }}
                />
              </div>
            );
          })}

          <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
            <button style={CANCEL} onClick={() => setStep(1)}>Voltar</button>
            <button style={{ ...BTN, flex: 1, opacity: step2Valid ? 1 : .5 }} disabled={!step2Valid} onClick={() => setStep(3)}>Continuar</button>
          </div>
          {!step2Valid && <Hint text={`Marque ao menos um serviço e descreva cada um com no mínimo ${MIN_SERVICE_DESC} caracteres.`} />}
        </div>
      )}

      {step === 3 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Field label="Valor total (R$) *" value={data.saleTotal} onChange={v => set('saleTotal', v)} placeholder="Ex: 4500" />
            <Field label="Duração do contrato (meses) *" value={data.contractMonths} onChange={v => set('contractMonths', v)} placeholder="Ex: 6" />
          </div>

          <div>
            <p style={LBL}>FORMA DE PAGAMENTO *</p>
            <select style={{ ...SEL, marginTop: 6 }} value={data.paymentMethod} onChange={e => set('paymentMethod', e.target.value)}>
              <option value="">Selecionar...</option>
              {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            {[{ id: 'avista', label: 'À vista' }, { id: 'prazo', label: 'Parcelado' }].map(o => (
              <button key={o.id} type="button" onClick={() => set('paymentType', o.id)} style={{ flex: 1, padding: '9px', borderRadius: 9, fontSize: 12, fontWeight: 700, cursor: 'pointer', background: data.paymentType === o.id ? `${COLOR}22` : 'var(--surface)', color: data.paymentType === o.id ? '#fff' : 'var(--muted)', border: `1px solid ${data.paymentType === o.id ? `${COLOR}66` : 'var(--border)'}` }}>
                {o.label}
              </button>
            ))}
          </div>

          {data.paymentType === 'prazo' && (
            <div style={{ background: 'rgba(255,255,255,.03)', border: '1px solid var(--border)', borderRadius: 10, padding: 14 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text)', cursor: 'pointer', marginBottom: 10 }}>
                <input type="checkbox" checked={data.customInstallment} onChange={e => set('customInstallment', e.target.checked)} style={{ accentColor: COLOR }} />
                Parcelamento personalizado (entrada diferente, valores variados)
              </label>
              {data.customInstallment ? (
                <textarea value={data.customPlan} onChange={e => set('customPlan', e.target.value)} rows={3} placeholder="Ex: entrada de R$ 1.500 + 3x de R$ 1.000" style={{ ...INP, resize: 'vertical' }} />
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <Field label="Nº de parcelas" value={data.installments} onChange={v => set('installments', v)} />
                  <Field label="Valor da parcela" value={data.installmentValue} onChange={v => set('installmentValue', v)} />
                  {instCount > 0 && instValue > 0 && (
                    <p style={{ gridColumn: '1/-1', fontSize: 11, fontFamily: 'var(--fm)', color: sumMatches ? 'var(--green)' : 'var(--neon)' }}>
                      {instCount}x {money(instValue)} = {money(installmentSum)}{sumMatches ? ' ✓ confere com o total' : ` ✕ diferente do total (${money(totalNum)})`}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <p style={LBL}>BRIEFING *</p>
              <span style={{ fontSize: 10, fontFamily: 'var(--fm)', color: (data.briefing || '').trim().length >= MIN_BRIEFING ? 'var(--green)' : 'var(--amber)' }}>
                {(data.briefing || '').trim().length}/{MIN_BRIEFING}
              </span>
            </div>
            <textarea value={data.briefing} onChange={e => set('briefing', e.target.value)} rows={5} placeholder="Contexto do cliente para o time: o que ele faz, público, concorrentes, referências, tom de voz, expectativas, prazos combinados..." style={{ ...INP, marginTop: 6, resize: 'vertical' }} />
          </div>

          <div>
            <p style={LBL}>OBSERVAÇÕES</p>
            <textarea value={data.observations} onChange={e => set('observations', e.target.value)} rows={3} placeholder="Combinados fora do contrato, cuidados, alertas para o CS..." style={{ ...INP, marginTop: 6, resize: 'vertical' }} />
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
            <button style={CANCEL} onClick={() => setStep(2)}>Voltar</button>
            <button
              style={{ ...BTN, flex: 1, background: 'linear-gradient(135deg,#22c55e,#16a34a)', opacity: (step3Valid && !submitting) ? 1 : .5 }}
              disabled={!step3Valid || submitting}
              onClick={submit}
            >
              {submitting ? 'Salvando...' : '✓ Cadastrar Contrato'}
            </button>
          </div>
          {!step3Valid && <Hint text={`Valor, duração, forma de pagamento e briefing (mín. ${MIN_BRIEFING} caracteres) são obrigatórios.`} />}
        </div>
      )}

    </div>
  );
}

function Field({ label, value, onChange, placeholder, area }) {
  return (
    <div>
      <p style={LBL}>{label}</p>
      {area
        ? <textarea value={value} onChange={e => onChange(e.target.value)} rows={2} placeholder={placeholder} style={{ ...INP, marginTop: 6, resize: 'vertical' }} />
        : <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={{ ...INP, marginTop: 6 }} />}
    </div>
  );
}

function Hint({ text }) {
  return <p style={{ fontSize: 11, color: 'var(--muted)', textAlign: 'center' }}>{text}</p>;
}

const money = (n) => (Number(n) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const LBL = { fontSize: 10, letterSpacing: '.12em', color: 'var(--muted)', fontWeight: 600, fontFamily: 'var(--fm)' };
const INP = { width: '100%', background: '#12121f', border: '1px solid var(--border)', borderRadius: 9, padding: '10px 13px', color: 'var(--text)', fontSize: 13, outline: 'none', fontFamily: 'var(--f)' };
const SEL = { ...INP, cursor: 'pointer' };
const BTN = { padding: '12px', borderRadius: 10, border: 'none', fontSize: 14, fontWeight: 700, cursor: 'pointer', background: 'linear-gradient(135deg,var(--neon),#c41f4a)', color: '#fff' };
const CANCEL = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 18px', color: 'var(--muted)', fontSize: 13, fontWeight: 600, cursor: 'pointer' };
