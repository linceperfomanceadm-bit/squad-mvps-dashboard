import React, { useState, useEffect } from 'react';
import { Check, Paperclip, X } from 'lucide-react';
import { SECTORS, SALE_SERVICES, PAYMENT_METHODS, SERVICE_SECTOR_MAP, WD_SERVICE_CONFIG, WD_WEB_SERVICES } from '../../lib/firebase';

const COLOR = SECTORS.cs.color;
const MIN_SERVICE_DESC = 350;
const MIN_BRIEFING = 200;

/*
 * CADASTRO DE CLIENTE — CS Comercial (e admin, na ausência dela).
 *
 * É o ponto de entrada do cliente no app. Ao salvar, o cliente nasce
 * em `stage: 'staffing'` e fica invisível para os setores até que os
 * líderes dos setores contratados indiquem os responsáveis.
 *
 * Etapa 1 — Cliente (nome na base + qualificação do contrato:
 *           empresa, representante legal e endereço destrinchado)
 * Etapa 2 — Serviços contratados e setores envolvidos
 * Etapa 3 — Financeiro, briefing, observações e anexos
 *
 * SOBRE OS SETORES: são sugeridos automaticamente pelos serviços
 * marcados (SERVICE_SECTOR_MAP), mas a CS confirma na mão. SEO,
 * Consultoria e Outro não mapeiam para setor nenhum, e um cliente
 * pode precisar de um setor que não aparece nos serviços vendidos.
 *
 * SOBRE OS ANEXOS: o briefing é visível para todos os responsáveis.
 * O contrato NÃO é renderizado em tela nenhuma do app — fica só
 * guardado no Storage, para consulta pelo console do Firebase.
 */

const UFS = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'];

const empty = {
  // Identificação
  clientName: '',       // nome do cliente na base do app
  personType: 'pj',     // 'pj' | 'pf' — PF não tem razão social nem CNPJ
  // Empresa
  razaoSocial: '',      // como consta no contrato
  tradeName: '',        // nome fantasia, o nome comercial do dia a dia
  companyCnpj: '',
  // Representante legal (quem assina o contrato)
  contactName: '',
  contactCpf: '',
  contactPhone: '',
  contactEmail: '',
  // Endereço destrinchado, para bater com a qualificação do contrato
  cep: '',
  logradouro: '',
  numero: '',
  complemento: '',
  bairro: '',
  cidade: '',
  uf: '',
  // Serviços
  services: [],
  serviceDescs: {},
  sectors: [],
  // CS Operacional que vai tocar o cliente. Diferente dos demais
  // setores, este não passa por indicação de líder: quem escolhe é a
  // própria CS Comercial, aqui no cadastro.
  csResponsible: '',
  // Entregas com pipeline próprio. As duas convivem: dá para vender
  // ID Visual junto de um serviço web no mesmo contrato.
  wdService: '',        // '' | 'ecommerce' | 'landing_page' | 'lp_catalogo'
  hasIdVisual: false,
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

export default function ClientRegisterForm({ onSubmit, onUpload, onCancel, collaborators = [] }) {
  const [step, setStep] = useState(1);
  const [data, setData] = useState(empty);
  const [submitting, setSubmitting] = useState(false);
  const [anexoBriefing, setAnexoBriefing] = useState(null);
  const [anexoContrato, setAnexoContrato] = useState(null);
  const [uploading, setUploading] = useState('');
  const [uploadError, setUploadError] = useState('');

  const set = (k, v) => setData(d => ({ ...d, [k]: v }));

  // Só CS Operacional ativo entra na lista — a CS Comercial não vira
  // responsável operacional pelo cliente.
  const csOperacionais = collaborators.filter(
    c => c.active !== false && c.sector === 'cs' && (c.csRole || 'operacional') === 'operacional'
  );

  const toggleService = (id) => setData(d => ({
    ...d,
    services: d.services.includes(id) ? d.services.filter(s => s !== id) : [...d.services, id],
  }));
  const setDesc = (id, v) => setData(d => ({ ...d, serviceDescs: { ...d.serviceDescs, [id]: v } }));
  const toggleSector = (id) => setData(d => ({
    ...d,
    sectors: d.sectors.includes(id) ? d.sectors.filter(s => s !== id) : [...d.sectors, id],
  }));

  // Marcar um pipeline puxa o setor dono automaticamente. Desmarcar
  // não tira o setor: ele pode estar ali por outro serviço.
  const setWdService = (v) => setData(d => ({
    ...d,
    wdService: v,
    sectors: v && !d.sectors.includes('webdesign') ? [...d.sectors, 'webdesign'] : d.sectors,
  }));
  const toggleIdVisual = () => setData(d => {
    const novo = !d.hasIdVisual;
    return {
      ...d,
      hasIdVisual: novo,
      sectors: novo && !d.sectors.includes('design') ? [...d.sectors, 'design'] : d.sectors,
    };
  });

  // Sugere os setores conforme os serviços marcados. Só ACRESCENTA:
  // se a CS desmarcou um setor de propósito, ele não volta sozinho ao
  // mexer em outro serviço.
  useEffect(() => {
    const sugeridos = data.services.map(id => SERVICE_SECTOR_MAP[id]).filter(Boolean);
    if (!sugeridos.length) return;
    setData(d => {
      const novos = sugeridos.filter(s => !d.sectors.includes(s));
      return novos.length ? { ...d, sectors: [...d.sectors, ...novos] } : d;
    });
  }, [data.services]); // eslint-disable-line react-hooks/exhaustive-deps

  const pickFile = async (kind, file) => {
    if (!file) return;
    setUploadError('');
    setUploading(kind);
    const r = await onUpload(kind, file);
    setUploading('');
    if (!r.success) { setUploadError(r.error); return; }
    if (kind === 'contrato') setAnexoContrato(r.file);
    else setAnexoBriefing(r.file);
  };

  // ── Validação por etapa ──────────────────────────────────────
  const isPJ = data.personType === 'pj';

  const step1Valid = (
    data.clientName.trim() &&
    data.contactName.trim() && data.contactCpf.trim() && data.contactPhone.trim() &&
    (!isPJ || (data.razaoSocial.trim() && data.companyCnpj.trim())) &&
    data.logradouro.trim() && data.numero.trim() && data.bairro.trim() &&
    data.cidade.trim() && data.uf.trim() && data.cep.trim()
  );

  // Cada pipeline próprio precisa do setor dono dele no quadro de
  // responsáveis, senão nasce sem ninguém para tocar.
  const step2Valid = (
    data.services.length > 0 &&
    data.services.every(id => (data.serviceDescs[id] || '').trim().length >= MIN_SERVICE_DESC) &&
    data.sectors.length > 0 &&
    data.csResponsible &&
    (!data.wdService || data.sectors.includes('webdesign')) &&
    (!data.hasIdVisual || data.sectors.includes('design'))
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

    // Sem nome fantasia informado, o comercial vira o próprio nome do
    // cliente na base — é assim que o time chama ele no dia a dia.
    const tradeName = data.tradeName.trim() || data.clientName.trim();
    const enderecoLinha = [
      [data.logradouro.trim(), data.numero.trim()].filter(Boolean).join(', '),
      data.complemento.trim(),
      data.bairro.trim(),
      [data.cidade.trim(), data.uf.trim()].filter(Boolean).join('/'),
      data.cep.trim() ? `CEP ${data.cep.trim()}` : '',
    ].filter(Boolean).join(' - ');

    const servicos = data.services.map(id => ({
      id,
      label: SALE_SERVICES.find(s => s.id === id)?.label || id,
      desc: data.serviceDescs[id] || '',
    }));

    const pagamento = data.paymentType === 'avista'
      ? { type: 'avista', method: data.paymentMethod }
      : (data.customInstallment
        ? { type: 'prazo', method: data.paymentMethod, custom: true, plan: data.customPlan }
        : { type: 'prazo', method: data.paymentMethod, installments: instCount, installmentValue: instValue });

    const clientData = {
      name: data.clientName.trim(),
      stage: 'staffing',
      // A CS Operacional já entra definida. Os demais setores ficam
      // em branco até o líder de cada um indicar quem assume.
      responsibles: { cs: [data.csResponsible] },
      staffing: { sectors: data.sectors, startedAt: new Date().toISOString() },
      // Pipeline do WebDesign: nasce junto com o cliente, como antes.
      wdService: data.wdService || null,
      contrato: {
        personType: data.personType,
        // O bloco `idv` só nasce quando o líder de Design indicar o
        // responsável — é ele quem escolhe o designer da marca.
        hasIdVisual: data.hasIdVisual,
        wdService: data.wdService || null,
        razaoSocial: isPJ ? data.razaoSocial.trim() : '',
        tradeName: tradeName,
        // `companyName` continua sendo o nome comercial — telas antigas
        // leem esse campo e não devem quebrar.
        companyName: tradeName,
        cnpj: isPJ ? data.companyCnpj.trim() : '',
        contactName: data.contactName.trim(),
        contactCpf: data.contactCpf.trim(),
        contactPhone: data.contactPhone.trim(),
        contactEmail: data.contactEmail.trim(),
        endereco: {
          cep: data.cep.trim(),
          logradouro: data.logradouro.trim(),
          numero: data.numero.trim(),
          complemento: data.complemento.trim(),
          bairro: data.bairro.trim(),
          cidade: data.cidade.trim(),
          uf: data.uf.trim(),
        },
        // Linha única montada a partir dos campos acima, para exibição
        // e para as telas que já esperavam um `address` de texto.
        address: enderecoLinha,
        servicos,
        saleTotal: totalNum,
        contractMonths: data.contractMonths,
        pagamento,
        briefing: data.briefing.trim(),
        observations: data.observations.trim(),
        anexoBriefing: anexoBriefing || null,
        anexoContrato: anexoContrato || null,
      },
      // Espelhos no topo do doc: as telas antigas (drawer do CS
      // Operacional, Brand Hub) leem daqui. Manter evita reescrever
      // meia dúzia de componentes que já funcionam.
      contactName: data.contactName.trim(),
      contactPhone: data.contactPhone.trim(),
      contactEmail: data.contactEmail.trim(),
      cnpj: isPJ ? data.companyCnpj.trim() : '',
      address: enderecoLinha,
      saleTotal: totalNum,
      contractMonths: data.contractMonths,
      services: servicos,
      briefing: data.briefing.trim(),
      observations: data.observations.trim(),
      // Call 1 (Kick Off, CS Comercial) e call 2 (Onboarding, CS
      // Operacional). Ambas só viram `pending: true` no seu momento:
      // a primeira quando o quadro de responsáveis fecha, a segunda
      // quando o Kick Off é dado como realizado.
      kickoffCall: { pending: false, at: null, meetLink: '', scheduledBy: null, scheduledAt: null, confirmedAt: null, confirmedBy: null },
      kickoff: { pending: false, at: null, meetLink: '', scheduledBy: null, scheduledAt: null, confirmedAt: null, confirmedBy: null },
      clientHealth: null,
    };

    const r = await onSubmit(clientData);
    setSubmitting(false);
    if (r && !r.success) { /* erro tratado pelo pai via toast */ }
  };

  const STEPS = ['Cliente', 'Serviços', 'Contrato'];

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
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Field label="Nome do cliente na base *" value={data.clientName} onChange={v => set('clientName', v)} placeholder="Como o time vai chamar esse cliente no app" />

          <div>
            <p style={LBL}>TIPO DE CONTRATANTE *</p>
            <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
              {[{ id: 'pj', label: 'Pessoa Jurídica' }, { id: 'pf', label: 'Pessoa Física' }].map(o => (
                <button key={o.id} type="button" onClick={() => set('personType', o.id)} style={{ flex: 1, padding: '9px', borderRadius: 9, fontSize: 12, fontWeight: 700, cursor: 'pointer', background: data.personType === o.id ? `${COLOR}22` : 'var(--surface)', color: data.personType === o.id ? '#fff' : 'var(--muted)', border: `1px solid ${data.personType === o.id ? `${COLOR}66` : 'var(--border)'}` }}>
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          {isPJ && (
            <Bloco titulo="EMPRESA">
              <Field label="Razão social *" value={data.razaoSocial} onChange={v => set('razaoSocial', v)} placeholder="Como consta no contrato. Ex: Exemplo Comércio LTDA" />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <Field label="Nome fantasia" value={data.tradeName} onChange={v => set('tradeName', v)} placeholder="Nome comercial (opcional)" />
                <Field label="CNPJ *" value={data.companyCnpj} onChange={v => set('companyCnpj', v)} placeholder="00.000.000/0001-00" />
              </div>
            </Bloco>
          )}

          <Bloco titulo={isPJ ? 'REPRESENTANTE LEGAL' : 'CONTRATANTE'}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <Field label="Nome completo *" value={data.contactName} onChange={v => set('contactName', v)} />
              <Field label="CPF *" value={data.contactCpf} onChange={v => set('contactCpf', v)} placeholder="000.000.000-00" />
              <Field label="Telefone *" value={data.contactPhone} onChange={v => set('contactPhone', v)} placeholder="(00) 00000-0000" />
              <Field label="E-mail" value={data.contactEmail} onChange={v => set('contactEmail', v)} />
            </div>
          </Bloco>

          <Bloco titulo="ENDEREÇO">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 10 }}>
              <Field label="CEP *" value={data.cep} onChange={v => set('cep', v)} placeholder="00000-000" />
              <Field label="Logradouro *" value={data.logradouro} onChange={v => set('logradouro', v)} placeholder="Rua, avenida, praça..." />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 2fr', gap: 10 }}>
              <Field label="Número *" value={data.numero} onChange={v => set('numero', v)} />
              <Field label="Complemento" value={data.complemento} onChange={v => set('complemento', v)} placeholder="Sala, conj." />
              <Field label="Bairro *" value={data.bairro} onChange={v => set('bairro', v)} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '3fr 1fr', gap: 10 }}>
              <Field label="Cidade *" value={data.cidade} onChange={v => set('cidade', v)} />
              <div>
                <p style={LBL}>UF *</p>
                <select style={{ ...SEL, marginTop: 6 }} value={data.uf} onChange={e => set('uf', e.target.value)}>
                  <option value="">—</option>
                  {UFS.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
            </div>
          </Bloco>

          <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
            <button style={{ ...BTN, flex: 1, opacity: step1Valid ? 1 : .5 }} disabled={!step1Valid} onClick={() => setStep(2)}>Continuar</button>
            {onCancel && <button style={CANCEL} onClick={onCancel}>Cancelar</button>}
          </div>
          {!step1Valid && (
            <Hint text={isPJ
              ? 'Preencha o nome na base, razão social, CNPJ, dados do representante e o endereço completo.'
              : 'Preencha o nome na base, os dados do contratante e o endereço completo.'} />
          )}
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

          <div style={{ background: 'rgba(255,255,255,.03)', border: '1px solid var(--border)', borderRadius: 10, padding: 14 }}>
            <p style={LBL}>CS OPERACIONAL RESPONSÁVEL *</p>
            <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 5, marginBottom: 10, lineHeight: 1.5 }}>
              Quem vai tocar este cliente no dia a dia. Participa da call de Kick Off com você
              e depois agenda a call de onboarding com o time.
            </p>
            <select style={SEL} value={data.csResponsible} onChange={e => set('csResponsible', e.target.value)}>
              <option value="">Selecionar...</option>
              {csOperacionais.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
            </select>
            {csOperacionais.length === 0 && (
              <p style={{ fontSize: 11, color: 'var(--amber)', marginTop: 8, lineHeight: 1.5 }}>
                Nenhum colaborador de CS Operacional ativo encontrado. Cadastre um no painel Admin antes de seguir.
              </p>
            )}
          </div>

          <div style={{ background: 'rgba(255,255,255,.03)', border: '1px solid var(--border)', borderRadius: 10, padding: 14 }}>
            <p style={LBL}>SETORES ENVOLVIDOS NO PROJETO *</p>
            <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 5, marginBottom: 10, lineHeight: 1.5 }}>
              Cada setor marcado precisa que o líder dele indique um responsável antes da call de Kick Off ser liberada.
              Sugerimos pelos serviços, mas confira: SEO, Consultoria e Outro não têm setor fixo.
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {Object.values(SECTORS).filter(s => s.id !== 'cs').map(s => {
                const active = data.sectors.includes(s.id);
                return (
                  <button key={s.id} type="button" onClick={() => toggleSector(s.id)} style={{ fontSize: 12, fontWeight: 600, padding: '6px 12px', borderRadius: 14, cursor: 'pointer', background: active ? `${s.color}22` : 'var(--surface)', color: active ? s.color : 'var(--muted)', border: `1px solid ${active ? `${s.color}66` : 'var(--border)'}`, display: 'flex', alignItems: 'center', gap: 5 }}>
                    {active && <Check size={11} />} {s.emoji} {s.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div style={{ background: 'rgba(255,255,255,.03)', border: '1px solid var(--border)', borderRadius: 10, padding: 14 }}>
            <p style={LBL}>ENTREGAS COM PIPELINE PRÓPRIO</p>
            <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 5, marginBottom: 12, lineHeight: 1.5 }}>
              Estas duas abrem checklist e acompanhamento próprios no painel do time. Podem ser
              marcadas juntas — é o caso de quem contrata criação de marca e loja virtual no mesmo contrato.
            </p>

            <p style={LBL}>SERVIÇO DE WEBDESIGN</p>
            <select style={{ ...SEL, marginTop: 6, marginBottom: 14 }} value={data.wdService} onChange={e => setWdService(e.target.value)}>
              <option value="">Nenhum</option>
              {WD_WEB_SERVICES.map(k => (
                <option key={k} value={k}>{WD_SERVICE_CONFIG[k]?.label || k}</option>
              ))}
            </select>

            <button
              type="button"
              onClick={toggleIdVisual}
              style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '10px 13px', borderRadius: 9, cursor: 'pointer', textAlign: 'left', background: data.hasIdVisual ? `${SECTORS.design.color}18` : 'var(--surface)', color: data.hasIdVisual ? SECTORS.design.color : 'var(--muted)', border: `1px solid ${data.hasIdVisual ? `${SECTORS.design.color}55` : 'var(--border)'}`, fontSize: 13, fontWeight: 600 }}
            >
              {data.hasIdVisual ? <Check size={14} /> : <span style={{ width: 14 }} />}
              ID Visual — criação de marca completa
            </button>
            <p style={{ fontSize: 11, color: '#666', marginTop: 7, lineHeight: 1.5 }}>
              O designer dono da marca é definido pelo líder de Design, na indicação de responsáveis.
            </p>
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
          {!step2Valid && (
            <Hint text={
              !data.csResponsible
                ? 'Escolha o CS Operacional responsável pelo cliente.'
                : data.wdService && !data.sectors.includes('webdesign')
                  ? 'O serviço de WebDesign exige o setor WebDesign marcado.'
                  : data.hasIdVisual && !data.sectors.includes('design')
                    ? 'O ID Visual exige o setor Design marcado.'
                    : `Marque ao menos um serviço, descreva cada um com no mínimo ${MIN_SERVICE_DESC} caracteres e escolha ao menos um setor.`
            } />
          )}
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

          {/* Anexos */}
          <div style={{ background: 'rgba(255,255,255,.03)', border: '1px solid var(--border)', borderRadius: 10, padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <FileSlot
              label="ANEXO DO BRIEFING"
              hint="Visível para todos os responsáveis pelo projeto."
              file={anexoBriefing}
              busy={uploading === 'briefing'}
              onPick={f => pickFile('briefing', f)}
              onClear={() => setAnexoBriefing(null)}
            />
            <FileSlot
              label="ANEXO DO CONTRATO"
              hint="Guardado apenas no Storage. Nenhuma tela do app exibe este arquivo."
              file={anexoContrato}
              busy={uploading === 'contrato'}
              onPick={f => pickFile('contrato', f)}
              onClear={() => setAnexoContrato(null)}
            />
            {uploadError && <p style={{ fontSize: 11, color: 'var(--neon)' }}>⚠ {uploadError}</p>}
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
            <button style={CANCEL} onClick={() => setStep(2)}>Voltar</button>
            <button
              style={{ ...BTN, flex: 1, background: 'linear-gradient(135deg,#22c55e,#16a34a)', opacity: (step3Valid && !submitting) ? 1 : .5 }}
              disabled={!step3Valid || submitting || !!uploading}
              onClick={submit}
            >
              {submitting ? 'Cadastrando...' : '✓ Cadastrar Cliente'}
            </button>
          </div>
          {!step3Valid && <Hint text={`Valor, duração, forma de pagamento e briefing (mín. ${MIN_BRIEFING} caracteres) são obrigatórios.`} />}
        </div>
      )}

    </div>
  );
}

function Bloco({ titulo, children }) {
  return (
    <div style={{ background: 'rgba(255,255,255,.03)', border: '1px solid var(--border)', borderRadius: 10, padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <p style={{ ...LBL, color: 'var(--text)' }}>{titulo}</p>
      {children}
    </div>
  );
}

function FileSlot({ label, hint, file, busy, onPick, onClear }) {
  return (
    <div>
      <p style={LBL}>{label}</p>
      <p style={{ fontSize: 10, color: '#666', marginTop: 3, marginBottom: 7, lineHeight: 1.5 }}>{hint}</p>
      {file ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--green-dim)', border: '1px solid var(--green-b)', borderRadius: 9, padding: '9px 12px' }}>
          <Check size={13} color="var(--green)" />
          <span style={{ fontSize: 12, color: 'var(--text)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</span>
          <button type="button" onClick={onClear} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex' }}>
            <X size={13} color="var(--muted)" />
          </button>
        </div>
      ) : (
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--surface)', border: '1px dashed var(--border)', borderRadius: 9, padding: '9px 12px', cursor: busy ? 'wait' : 'pointer' }}>
          <Paperclip size={13} color="var(--muted)" />
          <span style={{ fontSize: 12, color: 'var(--muted)' }}>{busy ? 'Enviando...' : 'Selecionar arquivo (até 25MB)'}</span>
          <input type="file" disabled={busy} onChange={e => onPick(e.target.files?.[0])} style={{ display: 'none' }} />
        </label>
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
