import React, { useMemo, useState } from 'react';
import { Paperclip, FileCheck2, X, FolderOpen, ExternalLink, Lock } from 'lucide-react';
import {
  SECTORS, SALE_SERVICES, PAYMENT_METHODS, SERVICE_SECTOR_MAP, WD_SERVICE_CONFIG, WD_WEB_SERVICES,
  CADASTRO_PENDENCIAS, normalizaLink, linkValido,
} from '../../lib/firebase';
import {
  cadastroPendencias, inicioNovaVersao, mesChave, rotuloMes, versoesDoEscopo, aplicarCorrecoesNoMes,
} from '../../lib/entregas';
import {
  UFS, formVazio, formDoCliente, sensiveisDoCliente, contaFinanceiro, itensDoEscopo, errosPorEtapa,
  montarClienteNovo, dadosAlterados,
} from '../../lib/cadastro';
import { Overlay, ModalHeader, MODAL, LBL, INP, fmtDate, money } from '../commercial/ui';
import { Tag } from '../shared/ui';
import { Bloco, Campo, CampoSensivel, Selecao, Chip, ResponsaveisSetor, EscopoEditor } from './kit';

/*
 * CADASTRO DO CLIENTE — formulário único.
 *
 * Substitui quatro telas que pediam pedaços do mesmo cadastro: o
 * "Cadastrar Cliente" da CS, o "Novo Cliente" e o "Editar Cliente" do
 * admin e o "Completar cadastro". Agora é sempre este formulário, em
 * abas (Cliente · Serviços · Contrato · Entregas · Equipe):
 *
 *   modo="novo", admin=false → CS cadastra. Nasce em `kickoff` e segue
 *                              o fluxo (Kick Off → responsáveis →
 *                              onboarding).
 *   modo="novo", admin=true  → admin cadastra. Mesmos dados
 *                              obrigatórios, mas entra direto na base
 *                              com a equipe definida — pula só o Kick
 *                              Off e o onboarding (decisão de out/2026).
 *   modo="editar"            → CS, líder e admin corrigem ou completam
 *                              (cliente antigo nasceu sem metade dos
 *                              campos). Aqui nada é obrigatório além do
 *                              formato: o selo de pendências mostra o
 *                              que falta. A aba Equipe e a troca de
 *                              nome só aparecem para o admin.
 *
 * No cadastro novo as abas funcionam como etapas (Continuar confere a
 * etapa); na edição dá para pular direto para a aba que interessa.
 *
 * Regras e montagem do documento ficam em lib/cadastro.js. CPF, CNPJ,
 * valor e pagamento nunca voltam para a tela na edição (só "já
 * cadastrado"); o arquivo do contrato nunca é exibido.
 */

const ETAPAS = [
  { id: 'cliente', label: 'Cliente' },
  { id: 'servicos', label: 'Serviços' },
  { id: 'contrato', label: 'Contrato' },
  { id: 'entregas', label: 'Entregas' },
  { id: 'equipe', label: 'Equipe' },
];

const SETORES_ENVOLVIDOS = Object.values(SECTORS).filter(s => s.id !== 'cs');
const ORDEM_EQUIPE = ['cs', ...SETORES_ENVOLVIDOS.map(s => s.id)];

export default function ClienteForm({
  modo = 'editar',
  client = null,
  admin = false,
  collaborators = [],
  me,
  toast,
  etapaInicial = 'cliente',
  onClose,
  onCriar,          // novo: (clientData) => { success }
  onUpload,         // (kind, file) => { success, file }
  onSaveCadastro,   // editar: (dados) => { success }
  onSaveEscopo,     // editar: (escopo) => { success, desde, corrigiuAtual }
  onRenomear,       // editar, admin: (nome) => { success }
  onSalvarEquipe,   // editar, admin: (responsibles) => { success }
}) {
  const novo = modo === 'novo';
  // Na edição a aba Equipe depende de ter onde salvar (só o admin recebe).
  const comEquipe = novo ? admin : !!onSalvarEquipe;
  const etapas = ETAPAS.filter(e => e.id !== 'equipe' || comEquipe);

  const inicial = useMemo(() => (novo ? formVazio() : formDoCliente(client)), []); // eslint-disable-line react-hooks/exhaustive-deps
  const sens = useMemo(() => (novo ? {} : sensiveisDoCliente(client)), []); // eslint-disable-line react-hooks/exhaustive-deps

  const [f, setF] = useState(inicial);
  const [etapa, setEtapa] = useState(etapas.some(e => e.id === etapaInicial) ? etapaInicial : 'cliente');
  const [financeiroAberto, setFinanceiroAberto] = useState(novo);
  const [anexoContrato, setAnexoContrato] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [tentou, setTentou] = useState(false);
  const [erro, setErro] = useState('');

  const set = (k, v) => setF(x => ({ ...x, [k]: v }));
  const setEnd = (k, v) => setF(x => ({ ...x, endereco: { ...x.endereco, [k]: v } }));
  const setFin = (k, v) => setF(x => ({ ...x, financeiro: { ...x.financeiro, [k]: v } }));

  const erros = errosPorEtapa(f, { novo, admin: comEquipe, financeiroAberto });
  const idx = etapas.findIndex(e => e.id === etapa);
  const pendencias = novo ? [] : cadastroPendencias(client);
  const podeRenomear = novo || !!onRenomear;
  const pj = f.personType === 'pj';
  const csAtivas = collaborators.filter(c => c.active !== false && c.sector === 'cs');

  // Marcar um serviço sugere o setor dele; desmarcar não tira, porque o
  // setor pode estar ali por outro serviço ou de propósito.
  const toggleServico = (id) => setF(x => {
    const s = { ...x.servicos };
    if (id in s) { delete s[id]; return { ...x, servicos: s }; }
    s[id] = '';
    const setor = SERVICE_SECTOR_MAP[id];
    const sectors = novo && setor && !x.sectors.includes(setor) ? [...x.sectors, setor] : x.sectors;
    return { ...x, servicos: s, sectors };
  });
  const toggleSetor = (id) => setF(x => ({ ...x, sectors: x.sectors.includes(id) ? x.sectors.filter(s => s !== id) : [...x.sectors, id] }));
  // Pipeline próprio puxa o setor dono dele.
  const setWd = (v) => setF(x => ({ ...x, wdService: v, sectors: v && !x.sectors.includes('webdesign') ? [...x.sectors, 'webdesign'] : x.sectors }));
  const toggleIdv = () => setF(x => ({ ...x, hasIdVisual: !x.hasIdVisual, sectors: !x.hasIdVisual && !x.sectors.includes('design') ? [...x.sectors, 'design'] : x.sectors }));

  const enviarContrato = async (file) => {
    if (!file) return;
    setErro('');
    setEnviando(true);
    const r = await onUpload('contrato', file);
    setEnviando(false);
    if (!r?.success) { setErro(r?.error || 'Não foi possível enviar o arquivo.'); return; }
    setAnexoContrato(r.file);
  };

  // ── Navegação ─────────────────────────────────────────────
  const continuar = () => {
    if (erros[etapa]) { setTentou(true); return; }
    setTentou(false);
    setEtapa(etapas[idx + 1].id);
  };
  const primeiraComErro = () => etapas.find(e => erros[e.id]);

  // ── Cadastro novo ─────────────────────────────────────────
  const criar = async () => {
    const comErro = primeiraComErro();
    if (comErro) { setTentou(true); setEtapa(comErro.id); return; }
    setSalvando(true);
    setErro('');
    const r = await onCriar(montarClienteNovo(f, { admin, anexoContrato, me }));
    setSalvando(false);
    if (r && r.success === false) setErro(r.error || 'Não foi possível cadastrar.');
  };

  // ── Edição ────────────────────────────────────────────────
  const salvar = async () => {
    const comErro = primeiraComErro();
    if (comErro) { setTentou(true); setEtapa(comErro.id); return; }
    setErro('');

    const nome = f.name.trim();
    const mudouNome = podeRenomear && nome !== (client.name || '');
    const dados = dadosAlterados(f, inicial, { financeiroAberto });
    if (anexoContrato) dados.anexoContrato = anexoContrato;

    const itens = itensDoEscopo(f.itens);
    const chave = (lista) => JSON.stringify(lista.map(({ id, sector, label, qtd, unica }) => ({ id, sector, label, qtd: Number(qtd), unica: unica === true })));
    const desdeNovo = inicioNovaVersao(client);
    // Também conta como mudança quando o formulário já está certo mas o
    // mês em andamento ainda tem o setor/nome antigo — salvar leva a
    // correção para o mês atual (`aplicarCorrecoesNoMes`).
    const corrigeMesAtual = versoesDoEscopo(client).length > 0 && desdeNovo > mesChave()
      && aplicarCorrecoesNoMes(versoesDoEscopo(client).filter(v => v.desde < desdeNovo), itens, mesChave()).corrigiu;
    const escopoMudou = f.semRecorrencia !== inicial.semRecorrencia || chave(itens) !== chave(itensDoEscopo(inicial.itens)) || corrigeMesAtual;
    const equipeMudou = comEquipe && JSON.stringify(f.responsibles) !== JSON.stringify(inicial.responsibles);

    if (!mudouNome && !Object.keys(dados).length && !escopoMudou && !equipeMudou) { onClose(); return; }

    setSalvando(true);
    const falha = (msg) => { setSalvando(false); setErro(msg); };
    if (mudouNome) {
      const r = await onRenomear(nome);
      if (!r?.success) return falha(r?.error || 'Não foi possível renomear.');
    }
    if (Object.keys(dados).length) {
      const r = await onSaveCadastro(dados);
      if (!r?.success) return falha(r?.error || 'Não foi possível salvar.');
    }
    let desde = null;
    let corrigiuAtual = false;
    if (escopoMudou) {
      const r = await onSaveEscopo({ itens, semRecorrencia: f.semRecorrencia && !itens.length });
      if (!r?.success) return falha(r?.error || 'Não foi possível salvar as entregas.');
      desde = r.desde;
      corrigiuAtual = !!r.corrigiuAtual;
    }
    if (equipeMudou) {
      const r = await onSalvarEquipe(f.responsibles);
      if (!r?.success) return falha(r?.error || 'Não foi possível salvar a equipe.');
    }
    setSalvando(false);
    if (toast) {
      const futuro = desde && desde > mesChave();
      const mes = futuro ? rotuloMes(desde, true).toLowerCase() : '';
      toast(futuro && corrigiuAtual
        ? `Cadastro salvo. Setor e nome já valem neste mês; o resto das entregas vale a partir de ${mes}.`
        : futuro ? `Cadastro salvo. As novas entregas valem a partir de ${mes}.` : 'Cadastro salvo.');
    }
    onClose();
  };

  // ── Render ────────────────────────────────────────────────
  const titulo = novo ? (admin ? 'Novo cliente' : 'Cadastrar cliente') : `Cadastro · ${client.name}`;
  const ultima = idx === etapas.length - 1;
  const erroDaEtapa = tentou ? erros[etapa] : '';

  return (
    <Overlay onClose={onClose}>
      <div style={{ ...MODAL, maxWidth: 720 }}>
        <ModalHeader title={titulo} onClose={onClose} />

        {novo && admin && (
          <p style={{ ...S.hint, marginBottom: 12 }}>
            Pelo admin o cliente entra direto na base, com a equipe já definida. Só o Kick Off e o onboarding ficam de fora — o resto do cadastro é o mesmo da CS.
          </p>
        )}
        {!novo && (pendencias.length > 0 ? (
          <div style={S.aviso}>
            <span style={{ fontSize: 12.5, color: 'var(--text)' }}>Falta completar:</span>
            {pendencias.map(p => <Tag key={p} tone="warn">{CADASTRO_PENDENCIAS[p]?.label || p}</Tag>)}
          </div>
        ) : (
          <p style={{ ...S.hint, marginBottom: 12 }}>Cadastro completo. Você pode revisar qualquer campo.</p>
        ))}

        <div style={S.abas} role="tablist">
          {etapas.map((e, i) => {
            const marca = tentou && erros[e.id];
            return (
              <button
                key={e.id}
                type="button"
                role="tab"
                aria-selected={etapa === e.id}
                className={`ui-btn small ${etapa === e.id ? 'on' : ''}`}
                style={{ flex: 1, justifyContent: 'center', ...(etapa === e.id ? { borderColor: 'var(--c-border)', color: 'var(--c)' } : null) }}
                onClick={() => setEtapa(e.id)}
              >
                {novo ? `${i + 1}. ` : ''}{e.label}
                {marca && <span style={S.ponto} aria-label="tem pendência" />}
              </button>
            );
          })}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* ── Cliente ─────────────────────────────────── */}
          {etapa === 'cliente' && (
            <>
              {podeRenomear ? (
                <div>
                  <Campo label="Nome do cliente na base" obrigatorio value={f.name} onChange={v => set('name', v)} placeholder="Como o time vai chamar esse cliente no app" />
                  {!novo && <p style={{ ...S.hint, marginTop: 6 }}>Renomear também atualiza o nome nos cards, solicitações e documentos já criados.</p>}
                </div>
              ) : (
                <div>
                  <p style={LBL}>NOME DO CLIENTE NA BASE</p>
                  <p style={{ fontSize: 14, color: 'var(--text)', marginTop: 6 }}>{client.name}</p>
                </div>
              )}

              <div>
                <p style={LBL}>TIPO DE CONTRATANTE{novo ? ' *' : ''}</p>
                <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                  <Chip ativo={pj} onClick={() => set('personType', 'pj')}>Pessoa Jurídica</Chip>
                  <Chip ativo={!pj} onClick={() => set('personType', 'pf')}>Pessoa Física</Chip>
                </div>
              </div>

              {pj && (
                <Bloco titulo="EMPRESA">
                  <Campo label="Razão social" obrigatorio={novo} value={f.razaoSocial} onChange={v => set('razaoSocial', v)} placeholder="Como consta no contrato" />
                  <div style={S.grid2}>
                    <Campo label="Nome fantasia" value={f.tradeName} onChange={v => set('tradeName', v)} placeholder="Nome comercial (opcional)" />
                    <CampoSensivel label="CNPJ" obrigatorio={novo} value={f.cnpj} onChange={v => set('cnpj', v)} preenchido={sens.cnpj} placeholder="00.000.000/0001-00" />
                  </div>
                </Bloco>
              )}

              <Bloco titulo={pj ? 'REPRESENTANTE LEGAL' : 'CONTRATANTE'}>
                <div style={S.grid2}>
                  <Campo label="Nome completo" obrigatorio={novo} value={f.contactName} onChange={v => set('contactName', v)} />
                  <CampoSensivel label="CPF" obrigatorio={novo} value={f.contactCpf} onChange={v => set('contactCpf', v)} preenchido={sens.contactCpf} placeholder="000.000.000-00" />
                  <Campo label="Telefone" obrigatorio={novo} value={f.contactPhone} onChange={v => set('contactPhone', v)} placeholder="(00) 00000-0000" />
                  <Campo label="E-mail" value={f.contactEmail} onChange={v => set('contactEmail', v)} />
                </div>
              </Bloco>

              <Bloco
                titulo="ENDEREÇO"
                hint={!novo && sens.endereco && !f.endereco.logradouro ? `Gravado no formato antigo: ${sens.endereco}. Preencha os campos para atualizar.` : null}
              >
                <div style={{ ...S.grid, gridTemplateColumns: '1fr 2fr' }}>
                  <Campo label="CEP" obrigatorio={novo} value={f.endereco.cep} onChange={v => setEnd('cep', v)} placeholder="00000-000" />
                  <Campo label="Logradouro" obrigatorio={novo} value={f.endereco.logradouro} onChange={v => setEnd('logradouro', v)} placeholder="Rua, avenida, praça..." />
                </div>
                <div style={{ ...S.grid, gridTemplateColumns: '1fr 1fr 2fr' }}>
                  <Campo label="Número" obrigatorio={novo} value={f.endereco.numero} onChange={v => setEnd('numero', v)} />
                  <Campo label="Complemento" value={f.endereco.complemento} onChange={v => setEnd('complemento', v)} placeholder="Sala, conj." />
                  <Campo label="Bairro" obrigatorio={novo} value={f.endereco.bairro} onChange={v => setEnd('bairro', v)} />
                </div>
                <div style={{ ...S.grid, gridTemplateColumns: '3fr 1fr' }}>
                  <Campo label="Cidade" obrigatorio={novo} value={f.endereco.cidade} onChange={v => setEnd('cidade', v)} />
                  <Selecao label="UF" obrigatorio={novo} value={f.endereco.uf} onChange={v => setEnd('uf', v)} vazio="—" opcoes={UFS.map(u => ({ value: u, label: u }))} />
                </div>
              </Bloco>
            </>
          )}

          {/* ── Serviços ────────────────────────────────── */}
          {etapa === 'servicos' && (
            <>
              <div>
                <p style={LBL}>SERVIÇOS CONTRATADOS{novo ? ' *' : ''}</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                  {SALE_SERVICES.map(s => (
                    <Chip key={s.id} ativo={s.id in f.servicos} onClick={() => toggleServico(s.id)}>{s.label}</Chip>
                  ))}
                </div>
              </div>

              {Object.keys(f.servicos).map(id => (
                <Campo
                  key={id}
                  area
                  rows={3}
                  obrigatorio={novo}
                  label={`O que foi vendido — ${SALE_SERVICES.find(s => s.id === id)?.label || id}`}
                  value={f.servicos[id]}
                  onChange={v => setF(x => ({ ...x, servicos: { ...x.servicos, [id]: v } }))}
                  placeholder="Entregáveis, quantidades, prazos, o que está e o que NÃO está incluso..."
                />
              ))}

              {novo && !admin && (
                <Bloco titulo="CS RESPONSÁVEL *" hint="Quem vai tocar este cliente no dia a dia. Participa da call de Kick Off e depois agenda a call de onboarding com o time.">
                  <Selecao value={f.csResponsible} onChange={v => set('csResponsible', v)} opcoes={csAtivas.map(c => ({ value: c.name, label: c.name }))} />
                  {csAtivas.length === 0 && <p style={{ ...S.hint, color: 'var(--amber)' }}>Nenhuma CS ativa encontrada. Cadastre uma no painel admin antes de seguir.</p>}
                </Bloco>
              )}

              {novo && (
                <Bloco
                  titulo="SETORES ENVOLVIDOS *"
                  hint={admin
                    ? 'Cada setor marcado precisa de um responsável na aba Equipe. Sugerimos pelos serviços, mas confira: SEO, Consultoria e Outro não têm setor fixo.'
                    : 'O líder de cada setor marcado indica o responsável depois do Kick Off. Sugerimos pelos serviços, mas confira: SEO, Consultoria e Outro não têm setor fixo.'}
                >
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {SETORES_ENVOLVIDOS.map(s => (
                      <Chip key={s.id} ativo={f.sectors.includes(s.id)} onClick={() => toggleSetor(s.id)}>{s.label}</Chip>
                    ))}
                  </div>
                </Bloco>
              )}

              {novo && (
                <Bloco titulo="SITE E ID VISUAL" hint="Abrem acompanhamento próprio no painel do time e contam como entrega quando o serviço é finalizado. Podem ser marcados juntos.">
                  <Selecao label="Serviço de WebDesign" value={f.wdService} onChange={setWd} vazio="Nenhum" opcoes={WD_WEB_SERVICES.map(k => ({ value: k, label: WD_SERVICE_CONFIG[k]?.label || k }))} />
                  <div>
                    <Chip ativo={f.hasIdVisual} onClick={toggleIdv}>ID Visual — criação de marca completa</Chip>
                    <p style={{ ...S.hint, marginTop: 6 }}>
                      {admin ? 'O designer da marca é o responsável de Design escolhido na aba Equipe.' : 'O designer da marca é definido pelo líder de Design, na indicação de responsáveis.'}
                    </p>
                  </div>
                </Bloco>
              )}
              {!novo && (
                <p style={S.hint}>Site de cliente que já está na casa é adicionado no painel de Web; ID Visual, pelo admin.</p>
              )}
            </>
          )}

          {/* ── Contrato ────────────────────────────────── */}
          {etapa === 'contrato' && (
            <>
              <div style={S.grid2}>
                <Campo label="Duração (meses)" obrigatorio={novo} type="number" value={f.contractMonths} onChange={v => set('contractMonths', v)} placeholder="Ex: 6" />
                {(!novo || admin) && (
                  <div>
                    <Campo label="Início do contrato" type="date" value={f.contractStart} onChange={v => set('contractStart', v)} />
                    <p style={{ ...S.hint, marginTop: 6 }}>
                      {novo
                        ? 'Em branco, conta a partir de hoje.'
                        : `Em branco, conta a partir da call de onboarding realizada${client.kickoff?.confirmedAt ? ` (${fmtDate(client.kickoff.confirmedAt)})` : ''}.`}
                    </p>
                  </div>
                )}
              </div>

              <Bloco titulo={`VALOR E PAGAMENTO${novo ? ' *' : ''}`}>
                {!financeiroAberto ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Lock size={14} color="var(--dim)" />
                    <span style={{ flex: 1, fontSize: 12.5, color: sens.financeiro ? 'var(--text)' : 'var(--muted)' }}>
                      {sens.financeiro ? 'Já cadastrados. Por segurança, valores não aparecem no app.' : 'Não informados.'}
                    </span>
                    <button type="button" className="ui-btn small" onClick={() => setFinanceiroAberto(true)}>
                      {sens.financeiro ? 'Substituir' : 'Informar'}
                    </button>
                  </div>
                ) : (
                  <Financeiro fin={f.financeiro} setFin={setFin} onCancelar={novo ? null : () => setFinanceiroAberto(false)} />
                )}
              </Bloco>

              <Campo label="Briefing" obrigatorio={novo} area rows={5} value={f.briefing} onChange={v => set('briefing', v)} placeholder="Contexto do cliente para o time: o que ele faz, público, concorrentes, referências, tom de voz, expectativas..." />

              <div>
                <p style={LBL}>PASTA DO CLIENTE NO DRIVE</p>
                <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                  <div style={{ position: 'relative', flex: 1 }}>
                    <FolderOpen size={14} color="var(--dim)" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
                    <input
                      value={f.driveUrl}
                      onChange={e => set('driveUrl', e.target.value)}
                      placeholder="https://drive.google.com/drive/folders/..."
                      style={{ ...INP, paddingLeft: 34, borderColor: linkValido(f.driveUrl) ? 'var(--border)' : 'var(--red)' }}
                    />
                  </div>
                  {f.driveUrl.trim() && linkValido(f.driveUrl) && (
                    <a className="ui-btn small" href={normalizaLink(f.driveUrl)} target="_blank" rel="noreferrer" style={{ height: 'auto', textDecoration: 'none' }} title="Testar o link">
                      <ExternalLink size={13} /> Abrir
                    </a>
                  )}
                </div>
                <p style={{ ...S.hint, marginTop: 6 }}>Opcional. Onde ficam os arquivos do cliente — o time vê o atalho no card dele.</p>
              </div>

              <Campo label="Observações" area value={f.observations} onChange={v => set('observations', v)} placeholder="Combinados fora do contrato, cuidados, alertas para a CS..." />

              <ArquivoContrato
                atual={anexoContrato || client?.contrato?.anexoContrato}
                novo={!!anexoContrato}
                enviando={enviando}
                onPick={enviarContrato}
              />
            </>
          )}

          {/* ── Entregas ────────────────────────────────── */}
          {etapa === 'entregas' && (
            <>
              <div>
                <p style={S.hint}>
                  {novo || !versoesDoEscopo(client).length
                    ? 'O que o contrato prevê. Vale já para este mês.'
                    : `Quantidades e entregas novas ou removidas valem a partir de ${rotuloMes(inicioNovaVersao(client), true).toLowerCase()}. Correção de setor ou de nome vale já, inclusive neste mês. O histórico não muda.`}
                </p>
                <p style={{ ...S.hint, marginTop: 6 }}>
                  Use <b style={{ color: 'var(--text)', fontWeight: 500 }}>Única</b> para o que se entrega uma vez só (ex.: Google Meu Negócio): fica pendente até alguém marcar e conta no mês em que foi feita.
                  {' '}Site e ID Visual não entram aqui: contam sozinhos quando o serviço é finalizado no painel.
                </p>
              </div>
              <EscopoEditor
                itens={f.itens}
                semRecorrencia={f.semRecorrencia}
                onChange={({ itens, semRecorrencia }) => setF(x => ({ ...x, itens, semRecorrencia }))}
              />
            </>
          )}

          {/* ── Equipe (admin) ──────────────────────────── */}
          {etapa === 'equipe' && comEquipe && (
            <>
              <p style={S.hint}>
                Clique para adicionar ou tirar. Pode haver mais de uma pessoa por setor.
                {novo ? ' Obrigatório: CS e os setores marcados em Serviços.' : ''}
              </p>
              <div>
                {ORDEM_EQUIPE.map(sid => (
                  <ResponsaveisSetor
                    key={sid}
                    sectorId={sid}
                    collaborators={collaborators}
                    selected={f.responsibles[sid]}
                    obrigatorio={novo && (sid === 'cs' || f.sectors.includes(sid))}
                    onChange={(arr) => setF(x => ({ ...x, responsibles: { ...x.responsibles, [sid]: arr } }))}
                  />
                ))}
              </div>
            </>
          )}
        </div>

        {(erroDaEtapa || erro) && (
          <p style={S.erro}><X size={13} /> {erro || erroDaEtapa}</p>
        )}

        <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
          {novo ? (
            <>
              {idx > 0 && <button type="button" className="ui-btn" onClick={() => { setTentou(false); setEtapa(etapas[idx - 1].id); }}>Voltar</button>}
              {ultima ? (
                <button type="button" className="ui-btn primary" style={{ flex: 1, justifyContent: 'center' }} disabled={salvando || enviando} onClick={criar}>
                  {salvando ? 'Cadastrando...' : 'Cadastrar cliente'}
                </button>
              ) : (
                <button type="button" className="ui-btn primary" style={{ flex: 1, justifyContent: 'center' }} onClick={continuar}>Continuar</button>
              )}
              <button type="button" className="ui-btn" onClick={onClose}>Cancelar</button>
            </>
          ) : (
            <>
              <button type="button" className="ui-btn primary" style={{ flex: 1, justifyContent: 'center' }} disabled={salvando || enviando} onClick={salvar}>
                {salvando ? 'Salvando...' : 'Salvar cadastro'}
              </button>
              <button type="button" className="ui-btn" onClick={onClose}>Cancelar</button>
            </>
          )}
        </div>
      </div>
    </Overlay>
  );
}

// Valor e forma de pagamento. Na edição só abre quando alguém vai
// substituir — o que está gravado nunca é mostrado.
function Financeiro({ fin, setFin, onCancelar }) {
  const conta = contaFinanceiro(fin);
  return (
    <>
      <div style={S.grid2}>
        <Campo label="Valor total (R$)" obrigatorio value={fin.saleTotal} onChange={v => setFin('saleTotal', v)} placeholder="Ex: 4500" />
        <Selecao label="Forma de pagamento" obrigatorio value={fin.paymentMethod} onChange={v => setFin('paymentMethod', v)} opcoes={PAYMENT_METHODS.map(m => ({ value: m, label: m }))} />
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <Chip ativo={fin.paymentType === 'avista'} onClick={() => setFin('paymentType', 'avista')}>À vista</Chip>
        <Chip ativo={fin.paymentType === 'prazo'} onClick={() => setFin('paymentType', 'prazo')}>Parcelado</Chip>
      </div>
      {fin.paymentType === 'prazo' && (
        <>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: 'var(--text)', cursor: 'pointer' }}>
            <input type="checkbox" checked={fin.customInstallment} onChange={e => setFin('customInstallment', e.target.checked)} />
            Parcelamento personalizado (entrada diferente, valores variados)
          </label>
          {fin.customInstallment ? (
            <Campo label="Plano de pagamento" area value={fin.customPlan} onChange={v => setFin('customPlan', v)} placeholder="Ex: entrada de R$ 1.500 + 3x de R$ 1.000" />
          ) : (
            <div style={S.grid2}>
              <Campo label="Nº de parcelas" value={fin.installments} onChange={v => setFin('installments', v)} />
              <Campo label="Valor da parcela" value={fin.installmentValue} onChange={v => setFin('installmentValue', v)} />
              {conta.parcelas > 0 && conta.parcela > 0 && (
                <p style={{ gridColumn: '1/-1', fontSize: 11.5, fontFamily: 'var(--fm)', color: conta.confere ? 'var(--green)' : 'var(--red)' }}>
                  {conta.parcelas}x {money(conta.parcela)} = {money(conta.soma)} · {conta.confere ? 'confere com o total' : `diferente do total (${money(conta.total)})`}
                </p>
              )}
            </div>
          )}
        </>
      )}
      {onCancelar && (
        <button type="button" className="ui-btn small" style={{ alignSelf: 'flex-start' }} onClick={onCancelar}>Manter o que já está cadastrado</button>
      )}
    </>
  );
}

// Arquivo do contrato: só mostra que existe, quando e por quem. Nunca
// abre (tem CPF, CNPJ e valores).
function ArquivoContrato({ atual, novo, enviando, onPick }) {
  return (
    <div>
      <p style={LBL}>ARQUIVO DO CONTRATO (OPCIONAL)</p>
      <div style={S.arquivo}>
        {atual ? (
          <>
            <FileCheck2 size={16} color="var(--green)" />
            <span style={{ flex: 1, fontSize: 12.5, color: 'var(--text)' }}>
              Contrato anexado{atual.at ? ` em ${fmtDate(atual.at)}` : novo ? ' agora' : ''}{atual.by ? ` por ${atual.by}` : ''}
            </span>
          </>
        ) : (
          <span style={{ flex: 1, fontSize: 12.5, color: 'var(--muted)' }}>Nenhum contrato anexado.</span>
        )}
        <label className="ui-btn small" style={{ cursor: enviando ? 'wait' : 'pointer' }}>
          <Paperclip size={13} /> {enviando ? 'Enviando...' : atual ? 'Substituir' : 'Anexar'}
          <input type="file" disabled={enviando} accept=".pdf,.doc,.docx,image/*" style={{ display: 'none' }} onChange={e => { onPick(e.target.files?.[0]); e.target.value = ''; }} />
        </label>
      </div>
      <p style={{ ...S.hint, marginTop: 6 }}>Por ter CPF, CNPJ e valores, o contrato fica só guardado — não abre em nenhuma tela do app.</p>
    </div>
  );
}

const S = {
  hint: { fontSize: 11.5, color: 'var(--muted)', lineHeight: 1.5 },
  aviso: { display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', background: 'var(--amber-dim)', border: '1px solid var(--amber-b)', borderRadius: 12, padding: '10px 12px', marginBottom: 12 },
  abas: { display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' },
  ponto: { width: 6, height: 6, borderRadius: 99, background: 'var(--red)', marginLeft: 4 },
  grid: { display: 'grid', gap: 10 },
  grid2: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 10 },
  arquivo: { display: 'flex', alignItems: 'center', gap: 10, background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 10, padding: '8px 8px 8px 12px', marginTop: 6 },
  erro: { fontSize: 12.5, color: 'var(--red)', marginTop: 14, display: 'flex', alignItems: 'center', gap: 6 },
};
