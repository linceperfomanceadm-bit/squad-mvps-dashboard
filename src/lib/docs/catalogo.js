// ─────────────────────────────────────────────────────────────
// Lince Docs — CATÁLOGO DE DOCUMENTOS
//
// Cada documento declara seus campos (`secoes`) e como eles viram
// slide (`render`). Para criar um documento novo, acrescente um
// objeto aqui — nada fora desta pasta precisa ser tocado.
//
// Campos suportados: 'texto', 'area', 'lista' (linhas fixas com
// colunas) e coluna do tipo 'opcao' (select).
// ─────────────────────────────────────────────────────────────

import { esc, v, lista, num, delta } from './motor';

export const DOCS = [
  // ═══════════════════════════════════════════════════════════
  // 1 · PRÉ-ESTRATÉGIA
  // ═══════════════════════════════════════════════════════════
  {
    id: 'pre-estrategia',
    nome: 'Pré-Estratégia — Social Media',
    desc: 'Diagnóstico, benchmark, pilares, cadência, métricas e fluxo de produção. 12 slides.',
    meta: '12 slides · ~35 campos',
    ativo: true,
    balancoFunil: true, // acompanha o equilíbrio topo/meio/fundo na tela
    // Campo que alimenta a base de cálculo travada do cliente (regra 3.2)
    campoBase: 'base',

    secoes: [
      {
        t: 'Capa',
        campos: [
          { id: 'cliente', rot: 'Cliente', tipo: 'texto', ph: 'ACRIVIA' },
          {
            id: 'recorte', rot: 'Frase de recorte', tipo: 'area',
            dica: 'O escopo e o horizonte em uma frase.',
            ph: 'Estratégia de conteúdo para os primeiros 90 dias, com foco em posicionamento, percepção de valor e geração de demanda.',
          },
          { id: 'autor', rot: 'Apresentado por', tipo: 'texto', ph: 'Eloisa Lira' },
        ],
      },
      {
        t: 'Sobre este documento',
        campos: [
          {
            id: 'sobre1', rot: 'O que este documento apresenta', tipo: 'area',
            ph: 'O que o documento cobre e no que o cliente deve se transformar aos olhos do mercado.',
          },
          {
            id: 'sobre2', rot: 'Em que a análise se baseia', tipo: 'area',
            ph: 'Por que está neste nível de detalhe: benchmark, comportamento das plataformas, objetivos declarados.',
          },
          {
            id: 'prioridades', rot: 'Prioridades, em ordem', tipo: 'lista', linhas: 4,
            dica: 'Ordem importa: é o critério de desempate quando duas boas ideias competem.',
            cols: [{ id: 't', rot: 'Prioridade', ph: 'Construir autoridade e marca' }],
          },
        ],
      },
      {
        t: '01 · Diagnóstico',
        campos: [
          {
            id: 'ativos', rot: 'Os ativos', tipo: 'area',
            dica: 'Comece pelo que já existe de bom. Cliente que se sente diagnosticado como incompetente entra na defensiva.',
            ph: 'Identidade visual, porta-voz disponível, estrutura de produção, autoridade real no assunto...',
          },
          {
            id: 'gargalo', rot: 'O gargalo', tipo: 'area',
            dica: 'UM gargalo. Um só. Se listar quatro, a seção 07 não tem o que resolver.',
            ph: 'Nomeie sem rodeio, explique por que é fatal neste mercado e mostre que é resolvível por método.',
          },
          {
            id: 'diagFrase', rot: 'Em uma frase', tipo: 'area',
            ph: 'O cliente tem todos os ingredientes para X. O que falta é o sistema que garante Y sem depender de Z.',
          },
        ],
      },
      {
        t: '02 · Concorrência',
        campos: [
          {
            id: 'metodo', rot: 'Método do mapeamento', tipo: 'area',
            dica: 'Declare a limitação dos dados. Essa honestidade compra credibilidade para o resto.',
            ph: 'Seguidores são públicos; frequência e horário não são auditáveis de fora e foram tratados como leitura de padrão.',
          },
          {
            id: 'concorrentes', rot: 'Perfis mapeados', tipo: 'lista', linhas: 4,
            dica: 'Três níveis: referência do setor, par direto e marca pessoal. A quarta linha é o próprio cliente.',
            cols: [
              { id: 'perfil', rot: 'Perfil', ph: '@lucasacrilicos' },
              { id: 'nivel', rot: 'Nível', ph: 'Par direto' },
              { id: 'seg', rot: 'Seguidores', ph: '312 mil' },
              { id: 'fmt', rot: 'Formato dominante', ph: 'Vídeo' },
              { id: 'tema', rot: 'Sobre o que fala', ph: 'Produto e bastidor' },
            ],
          },
        ],
      },
      {
        t: '02 · Brechas',
        campos: [
          {
            id: 'brechas', rot: 'Brechas identificadas', tipo: 'lista', linhas: 3,
            cols: [
              { id: 't', rot: 'Nome', ph: 'Humanização com estrutura' },
              { id: 'd', rot: 'Por que está aberta', ph: 'Os gigantes são impessoais; os influenciadores não têm respaldo.' },
            ],
          },
          {
            id: 'terreno', rot: 'Leitura do terreno', tipo: 'area',
            ph: 'A combinação que nenhum concorrente reúne — e a vulnerabilidade do mais próximo.',
          },
        ],
      },
      {
        t: '03 · Papel do perfil',
        campos: [
          {
            id: 'metafora', rot: 'A metáfora e a delimitação', tipo: 'area',
            ph: 'Pensem no perfil como o centro de uma roda. Cada X é um raio; o perfil é o eixo que recebe e amplifica.',
          },
          {
            id: 'funcoes', rot: 'Funções que só este perfil cumpre', tipo: 'lista', linhas: 3,
            cols: [
              { id: 't', rot: 'Função', ph: 'Carregar a marca' },
              { id: 'd', rot: 'Descrição', ph: 'O que quem chega por indicação precisa entender em segundos.' },
            ],
          },
          {
            id: 'principio', rot: 'Princípio que costura tudo', tipo: 'area',
            ph: 'O perfil nunca disputa com X. Ele fortalece. O conteúdo trabalha duas vezes.',
          },
        ],
      },
      {
        t: '04 · Pilares',
        campos: [
          {
            id: 'pilaresIntro', rot: 'Por que os pesos são desiguais', tipo: 'area',
            dica: 'O pilar mais pesado tem que ser o que ocupa a brecha da seção 02.',
            ph: 'Os pesos não são iguais, e isso é proposital. O maior peso fica em...',
          },
          {
            id: 'pilares', rot: 'Pilares', tipo: 'lista', linhas: 4,
            dica: 'A etapa do funil não é enfeite: é o que impede um mês inteiro de descoberta sem nenhuma peça que ajude alguém a decidir.',
            cols: [
              { id: 'n', rot: 'Nome', ph: 'Autoridade institucional' },
              { id: 'p', rot: 'Peso %', ph: '40' },
              { id: 'f', rot: 'Funil', tipo: 'opcao', opcoes: ['Topo', 'Meio', 'Fundo'] },
              { id: 'd', rot: 'O que entra aqui', ph: 'Análises de mudanças na legislação, traduzidas para o impacto no negócio.' },
            ],
          },
        ],
      },
      {
        t: '05 · Cadência',
        campos: [
          {
            id: 'criterio', rot: 'Critério dos dias e horários', tipo: 'area',
            ph: 'Referência 2026: 3 a 5 posts/semana + stories quase diários. Quarta ao meio-dia e quinta às 9h concentram engajamento.',
          },
          {
            id: 'grade', rot: 'Grade de publicação', tipo: 'lista', linhas: 5,
            dica: 'Inclua Stories como linha própria, mesmo que fora do contrato — o que some da grade some da conversa.',
            cols: [
              { id: 'dia', rot: 'Dia', ph: 'Terça' },
              { id: 'pilar', rot: 'Pilar', ph: 'Autoridade' },
              { id: 'fmt', rot: 'Formato', ph: 'Carrossel' },
              { id: 'hora', rot: 'Horário', ph: '11h às 13h' },
            ],
          },
          {
            id: 'obs', rot: 'Observações', tipo: 'area',
            ph: 'Estes horários são ponto de partida. Depois de 4 a 6 semanas, os dados do próprio perfil passam a mandar.',
          },
        ],
      },
      {
        t: '05 · Mockup do mês',
        opcional: true,
        campos: [
          {
            id: 'mockup', rot: 'Peças do mês', tipo: 'lista', linhas: 8,
            dica: 'E = estático (fazer desejar) · C = carrossel (fazer entender) · V = vídeo (fazer acreditar). T, M e F marcam a etapa do funil — acompanhe o balanço no topo da pré-visualização.',
            cols: [
              { id: 't', rot: 'Tema', ph: 'Bastidores da produção' },
              { id: 'f', rot: 'Formato', tipo: 'opcao', opcoes: ['E', 'C', 'V'], ph: 'V' },
              { id: 'fn', rot: 'Funil', tipo: 'opcao', opcoes: ['T', 'M', 'F'] },
            ],
          },
        ],
      },
      {
        t: '06 · Métricas',
        campos: [
          {
            id: 'metricasIntro', rot: 'Por que este conjunto', tipo: 'area',
            ph: 'Como o objetivo é autoridade e não venda imediata, as métricas de vaidade importam menos.',
          },
          { id: 'objetivo', rot: 'Nome do objetivo (aparece no título do card)', tipo: 'texto', ph: 'autoridade' },
          {
            id: 'metricas', rot: 'Métricas que provam o objetivo', tipo: 'lista', linhas: 4,
            cols: [
              { id: 'n', rot: 'Métrica', ph: 'Taxa de salvamento' },
              { id: 'd', rot: 'Por quê', ph: 'Quem salva está dizendo que o conteúdo é útil e que vai voltar.' },
            ],
          },
          {
            id: 'base', rot: 'Base de cálculo adotada', tipo: 'texto',
            dica: 'Trave agora e nunca mude. ÷ seguidores, ÷ alcance e ÷ views dão números muito diferentes.',
            ph: 'interações ÷ alcance',
          },
          {
            id: 'regua', rot: 'Régua mensal', tipo: 'area',
            ph: 'As três perguntas que o relatório responde todo mês. E o que é consequência, não meta.',
          },
        ],
      },
      {
        t: '07 · Fluxo de produção',
        campos: [
          {
            id: 'logica', rot: 'A lógica em uma linha', tipo: 'area',
            ph: 'Trabalhar por estoque, e não por urgência. O conteúdo nunca depende de alguém lembrar de postar.',
          },
          {
            id: 'etapas', rot: 'Etapas do ciclo', tipo: 'lista', linhas: 4,
            cols: [
              { id: 'n', rot: 'Etapa', ph: 'Gravação' },
              { id: 'd', rot: 'Quem e quando', ph: 'Os quatro sócios gravam em lote, num único dia.' },
            ],
          },
          {
            id: 'resultado', rot: 'Resultado prático', tipo: 'area',
            dica: 'Verificação obrigatória: este texto precisa eliminar o gargalo que você nomeou na seção 01.',
            ph: 'Com esse ciclo, o perfil deixa de depender de X. A constância, que é o gargalo de hoje, passa a ser automática.',
          },
        ],
      },
    ],

    render(d, opc) {
      const S = [];
      const B = (id, nome, html) => S.push({ id, nome, html });

      B('capa', 'Capa', `<section class="slide capa"><span class="pg"></span>
        <div style="margin:auto 0;max-width:50%">
          <h1>Planejamento<br>Estratégico</h1><div class="bar"></div>
          <h3 style="font-size:2.6cqw;margin-bottom:.8cqw">${v(d.cliente, 'CLIENTE')}</h3>
          <p class="lede">${v(d.recorte, 'frase de recorte')}</p>
        </div>
        <p style="font-size:1.5cqw">${v(d.autor, 'apresentado por')}<br>
          <span style="color:var(--rosaclaro)">Social Media</span></p>
        <div class="logo"></div></section>`);

      B('sobre', 'Sobre este documento', `<section class="slide mascote-canto"><span class="pg"></span>
        <div class="eyebrow">Sobre este documento</div><h2>O que você<br>vai ler aqui</h2><div class="bar"></div>
        <div class="grid g2" style="align-items:start">
          <div><p>${v(d.sobre1, 'o que o documento apresenta')}</p>
               <p style="margin-top:1.2cqw">${v(d.sobre2, 'em que a análise se baseia')}</p></div>
          <div class="card claro"><h3>Prioridades, em ordem</h3>
            <ol style="margin-left:1.6cqw;display:flex;flex-direction:column;gap:.7cqw">
            ${lista(d.prioridades).map((r) => `<li>${v(r.t, 'prioridade')}</li>`).join('')}</ol></div>
        </div><div class="logo"></div></section>`);

      B('diagnostico', '01 · Diagnóstico', `<section class="slide mascote-canto"><span class="pg"></span>
        <div class="eyebrow">Seção 01</div><h2>Diagnóstico</h2><div class="bar"></div>
        <p style="max-width:88%">${v(d.ativos, 'os ativos do cliente')}</p>
        <p style="margin-top:1.2cqw;max-width:88%">${v(d.gargalo, 'o gargalo')}</p>
        <div class="fecho"><span class="rot">Em uma frase</span><p>${v(d.diagFrase, 'síntese do diagnóstico')}</p></div>
        <div class="logo"></div></section>`);

      B('concorrencia', '02 · Concorrência', `<section class="slide"><span class="pg"></span>
        <div class="eyebrow">Seção 02</div><h2>Concorrência</h2><div class="bar"></div>
        <p style="margin-bottom:1.6cqw">${v(d.metodo, 'método do mapeamento')}</p>
        <table><thead><tr><th>Perfil</th><th>Nível</th><th>Seguidores</th><th>Formato</th><th>Sobre o que fala</th></tr></thead>
        <tbody>${lista(d.concorrentes).map((r) => `<tr><td>${v(r.perfil, '@')}</td><td>${v(r.nivel, '—')}</td>
          <td>${v(r.seg, '—')}</td><td>${v(r.fmt, '—')}</td><td>${v(r.tema, '—')}</td></tr>`).join('')}</tbody></table>
        <div class="logo"></div></section>`);

      B('brechas', '02 · Brechas', `<section class="slide mascote-canto"><span class="pg"></span>
        <div class="eyebrow">Seção 02 · continuação</div><h2>As brechas</h2><div class="bar"></div>
        <div class="grid g3">${lista(d.brechas).map((r, i) => `<div class="card">
          <span class="num">0${i + 1}</span><h3>${v(r.t, 'brecha')}</h3><p>${v(r.d, 'por que está aberta')}</p></div>`).join('')}</div>
        <div class="fecho"><span class="rot">Leitura do terreno</span><p>${v(d.terreno, 'leitura do terreno')}</p></div>
        <div class="logo"></div></section>`);

      B('papel', '03 · Papel do perfil', `<section class="slide"><span class="pg"></span>
        <div class="eyebrow">Seção 03</div><h2>O papel do perfil</h2><div class="bar"></div>
        <p style="margin-bottom:1.8cqw">${v(d.metafora, 'a metáfora e a delimitação')}</p>
        <div class="grid g3">${lista(d.funcoes).map((r, i) => `<div class="card solid">
          <span class="num">${i + 1}</span><h3>${v(r.t, 'função')}</h3><p>${v(r.d, 'descrição')}</p></div>`).join('')}</div>
        <div class="fecho"><span class="rot">Princípio que costura tudo</span><p>${v(d.principio, 'princípio')}</p></div>
        <div class="logo"></div></section>`);

      const pil = lista(d.pilares);
      const cls = ['p1', 'p2', 'p3', 'p4'];
      B('pilares', '04 · Pilares', `<section class="slide"><span class="pg"></span>
        <div class="eyebrow">Seção 04</div><h2>Pilares de conteúdo</h2><div class="bar"></div>
        <p style="margin-bottom:1.6cqw">${v(d.pilaresIntro, 'por que os pesos são desiguais')}</p>
        <div class="pesos">${pil.map((r, i) => `<div class="${cls[i]}" style="flex:${num(r.p, 25)}">${num(r.p, 25)}%</div>`).join('')}</div>
        <div class="grid g4">${pil.map((r) => `<div class="card">
          ${r.f ? `<span class="tag">${esc(r.f)} de funil</span>`
    : '<span class="tag vazio">[etapa do funil]</span>'}
          <h3>${v(r.n, 'pilar')}</h3><p>${v(r.d, 'o que entra aqui')}</p></div>`).join('')}</div>
        <div class="logo"></div></section>`);

      B('cadencia', '05 · Cadência', `<section class="slide"><span class="pg"></span>
        <div class="eyebrow">Seção 05</div><h2>Cadência</h2><div class="bar"></div>
        <div class="grid g2" style="align-items:start">
          <div><p style="margin-bottom:1.4cqw">${v(d.criterio, 'critério dos dias e horários')}</p>
          <table><thead><tr><th>Dia</th><th>Pilar</th><th>Formato</th><th>Horário</th></tr></thead>
          <tbody>${lista(d.grade).map((r) => `<tr><td>${v(r.dia, '—')}</td><td>${v(r.pilar, '—')}</td>
            <td>${v(r.fmt, '—')}</td><td>${v(r.hora, '—')}</td></tr>`).join('')}</tbody></table></div>
          <div class="card claro"><h3>Cada formato tem função</h3>
            <ul class="ast" style="margin-top:1cqw">
              <li><strong>Reels</strong> — encontrar gente nova. Otimiza tempo de visualização e envios por DM.</li>
              <li><strong>Carrossel</strong> — construir confiança. Otimiza salvamentos.</li>
              <li><strong>Stories</strong> — aquecer a base e converter. Otimiza respostas e cliques.</li>
              <li><strong>Estático</strong> — anúncio, identidade, prova.</li></ul></div>
        </div>
        <div class="fecho"><span class="rot">Observações</span><p>${v(d.obs, 'observações')}</p></div>
        <div class="logo"></div></section>`);

      if (opc['05 · Mockup do mês'] !== false) {
        const est = { E: 'claro', C: 'solid', V: '' };
        B('mockup', '05 · Mockup do mês', `<section class="slide"><span class="pg"></span>
          <div class="eyebrow">Seção 05 · continuação</div><h2>Mockup do mês</h2><div class="bar"></div>
          <div class="grid g4" style="gap:1.2cqw">${lista(d.mockup).map((r) => `
            <div class="card ${est[r.f] || ''}"><p>${v(r.t, 'tema')}</p>
            <span class="num" style="font-size:1.5cqw;margin-top:.6cqw">${esc(r.f || '—')} · ${esc(r.fn || '—')}</span></div>`).join('')}</div>
          <div class="fecho" style="margin-top:1.6cqw"><span class="rot">Legenda</span>
            <p><strong>E</strong> = Estático · fazer desejar &nbsp;|&nbsp; <strong>C</strong> = Carrossel · fazer entender
            &nbsp;|&nbsp; <strong>V</strong> = Vídeo · fazer acreditar<br>
            <strong>T</strong> = Topo · descobrir &nbsp;|&nbsp; <strong>M</strong> = Meio · considerar
            &nbsp;|&nbsp; <strong>F</strong> = Fundo · decidir</p></div>
          <div class="logo"></div></section>`);
      }

      B('metricas', '06 · Métricas', `<section class="slide"><span class="pg"></span>
        <div class="eyebrow">Seção 06</div><h2>Métricas</h2><div class="bar"></div>
        <p style="margin-bottom:1.6cqw">${v(d.metricasIntro, 'por que este conjunto')}</p>
        <div class="grid g2" style="align-items:start">
          <div class="card"><h3>O que prova ${v(d.objetivo, 'o objetivo')}</h3>
            <ul class="ast" style="margin-top:1cqw">${lista(d.metricas).map((r) =>
    `<li><strong>${v(r.n, 'métrica')}.</strong> ${v(r.d, 'por quê')}</li>`).join('')}</ul></div>
          <div class="card claro"><h3>O que prova lead</h3>
            <ul class="ast" style="margin-top:1cqw">
              <li>Cliques no link e DMs que partem de um post específico.</li>
              <li>Perguntar a cada novo cliente como chegou e registrar o canal. Em três meses, vira dado real de retorno.</li></ul>
            <p style="margin-top:1.2cqw;font-size:1.2cqw"><strong>Base de cálculo adotada:</strong> ${v(d.base, 'defina a base')}</p></div>
        </div>
        <div class="fecho"><span class="rot">Régua mensal</span><p>${v(d.regua, 'as três perguntas do relatório')}</p></div>
        <div class="logo"></div></section>`);

      const et = lista(d.etapas);
      B('fluxo', '07 · Fluxo de produção', `<section class="slide"><span class="pg"></span>
        <div class="eyebrow">Seção 07</div><h2>Fluxo de produção</h2><div class="bar"></div>
        <p style="margin-bottom:1.6cqw">${v(d.logica, 'a lógica em uma linha')}</p>
        <div class="fluxo">${et.map((r, i) => `<div class="card"><span class="num">${i + 1}</span>
          <h3>${v(r.n, 'etapa')}</h3><p>${v(r.d, 'quem e quando')}</p></div>`)
    .join('<div class="seta">→</div>')}</div>
        <div class="fecho"><span class="rot">Resultado prático</span><p>${v(d.resultado, 'resultado prático')}</p></div>
        <div class="logo"></div></section>`);

      B('fim', 'Encerramento', `<section class="slide fechamento"><span class="pg"></span>
        <div style="margin:auto;text-align:center">
          <div style="width:26cqw;aspect-ratio:700/201;margin:0 auto 3.4cqw;
            background:var(--logo-rosa) center/contain no-repeat"></div>
          <h1 style="font-size:7cqw">Obrigado!</h1>
          <div class="bar" style="width:22%;margin:2.4cqw auto 0"></div></div></section>`);

      return S;
    },
  },

  // ═══════════════════════════════════════════════════════════
  // 2 · RELATÓRIO DE MÉTRICAS
  // ═══════════════════════════════════════════════════════════
  {
    id: 'metricas',
    nome: 'Relatório de Métricas — Social Media',
    desc: 'Resultados do mês em quatro camadas, com evolução calculada, destaques, o que não funcionou e plano do mês seguinte.',
    meta: '12 slides · variação automática',
    ativo: true,
    balancoFunil: false,
    campoBase: 'base',
    // Relatório compara dois períodos: o editor pede as datas para
    // aplicar a regra 3.7 (janelas de duração equivalente).
    exigePeriodos: true,

    secoes: [
      {
        t: 'Capa',
        campos: [
          { id: 'cliente', rot: 'Cliente', tipo: 'texto', ph: 'ACRIVIA' },
          { id: 'periodo', rot: 'Período', tipo: 'texto', ph: 'Julho de 2026' },
          { id: 'comparado', rot: 'Comparado com', tipo: 'texto', ph: 'Junho de 2026' },
          { id: 'autor', rot: 'Apresentado por', tipo: 'texto', ph: 'Eloisa Lira' },
        ],
      },
      {
        t: 'Leitura rápida',
        campos: [
          {
            id: 'frase', rot: 'O mês em uma frase', tipo: 'area',
            dica: 'É a única linha que o decisor lê inteira. Diga se a agulha se moveu, sim ou não.',
            ph: 'O alcance cresceu 38% puxado por dois Reels, mas a conversa no direct ficou estável — o gargalo agora é o convite, não a descoberta.',
          },
          {
            id: 'kpis', rot: 'Os quatro números do mês', tipo: 'lista', linhas: 4,
            dica: 'A variação é calculada sozinha. Marque "↓ melhor" em métricas onde cair é bom, como skip rate e CPL.',
            cols: [
              { id: 'n', rot: 'Métrica', ph: 'Alcance' },
              { id: 'a', rot: 'Anterior', ph: '12400' },
              { id: 'b', rot: 'Atual', ph: '17100' },
              { id: 'dir', rot: 'Direção', tipo: 'opcao', opcoes: ['↑ melhor', '↓ melhor'] },
            ],
          },
        ],
      },
      {
        t: 'Camada 1 · Distribuição',
        campos: [
          {
            id: 'm1', rot: 'Métricas', tipo: 'lista', linhas: 4,
            dica: 'O algoritmo deu chance? Alcance, % de não seguidores, views, novos seguidores.',
            cols: [
              { id: 'n', rot: 'Métrica' }, { id: 'a', rot: 'Anterior' }, { id: 'b', rot: 'Atual' },
              { id: 'dir', rot: 'Direção', tipo: 'opcao', opcoes: ['↑ melhor', '↓ melhor'] },
            ],
          },
          { id: 'l1', rot: 'O que aconteceu e por quê', tipo: 'area', ph: 'Não repita o número da tabela. Explique a causa.' },
          { id: 'a1', rot: 'O que faremos', tipo: 'area', ph: 'A decisão que este dado gera para o mês seguinte.' },
        ],
      },
      {
        t: 'Camada 2 · Atenção',
        campos: [
          {
            id: 'm2', rot: 'Métricas', tipo: 'lista', linhas: 4,
            dica: 'O criativo prendeu? Retenção nos 3s, tempo médio, skip rate, conclusão de Stories.',
            cols: [
              { id: 'n', rot: 'Métrica' }, { id: 'a', rot: 'Anterior' }, { id: 'b', rot: 'Atual' },
              { id: 'dir', rot: 'Direção', tipo: 'opcao', opcoes: ['↑ melhor', '↓ melhor'] },
            ],
          },
          { id: 'l2', rot: 'O que aconteceu e por quê', tipo: 'area' },
          { id: 'a2', rot: 'O que faremos', tipo: 'area' },
        ],
      },
      {
        t: 'Camada 3 · Ação',
        campos: [
          {
            id: 'm3', rot: 'Métricas', tipo: 'lista', linhas: 4,
            dica: 'Motivou reação? Envios por DM, salvamentos, comentários, contas engajadas.',
            cols: [
              { id: 'n', rot: 'Métrica' }, { id: 'a', rot: 'Anterior' }, { id: 'b', rot: 'Atual' },
              { id: 'dir', rot: 'Direção', tipo: 'opcao', opcoes: ['↑ melhor', '↓ melhor'] },
            ],
          },
          {
            id: 'base', rot: 'Base de cálculo do engajamento', tipo: 'texto',
            dica: 'A mesma declarada na pré-estratégia. Trocar a base entre relatórios invalida a comparação.',
            ph: 'interações ÷ alcance',
          },
          { id: 'l3', rot: 'O que aconteceu e por quê', tipo: 'area' },
          { id: 'a3', rot: 'O que faremos', tipo: 'area' },
        ],
      },
      {
        t: 'Camada 4 · Negócio',
        campos: [
          {
            id: 'm4', rot: 'Métricas', tipo: 'lista', linhas: 4,
            dica: 'Virou resultado? Visitas ao perfil, cliques, conversas no direct, leads, CPL.',
            cols: [
              { id: 'n', rot: 'Métrica' }, { id: 'a', rot: 'Anterior' }, { id: 'b', rot: 'Atual' },
              { id: 'dir', rot: 'Direção', tipo: 'opcao', opcoes: ['↑ melhor', '↓ melhor'] },
            ],
          },
          { id: 'l4', rot: 'O que aconteceu e por quê', tipo: 'area' },
          { id: 'a4', rot: 'O que faremos', tipo: 'area' },
        ],
      },
      {
        t: 'Destaques do mês',
        campos: [
          {
            id: 'tops', rot: 'As três peças que mais performaram', tipo: 'lista', linhas: 3,
            dica: 'Sempre com o porquê. Sem hipótese de causa, o destaque é sorte e não se repete.',
            cols: [
              { id: 't', rot: 'Peça', ph: 'Reels · bastidor do corte a laser' },
              { id: 'v', rot: 'Número', ph: '14,2 mil alcance' },
              { id: 'd', rot: 'Por que funcionou', ph: 'Gancho nos 2 primeiros segundos e som em alta.' },
            ],
          },
        ],
      },
      {
        t: 'O que não funcionou',
        campos: [
          {
            id: 'flops', rot: 'Peças abaixo da média', tipo: 'lista', linhas: 2,
            dica: 'Slide obrigatório. Relatório que só mostra acerto perde credibilidade no primeiro mês ruim.',
            cols: [{ id: 't', rot: 'Peça' }, { id: 'v', rot: 'Número' }, { id: 'd', rot: 'Hipótese do que falhou' }],
          },
          { id: 'flopNota', rot: 'O que isso muda na produção', tipo: 'area' },
        ],
      },
      {
        t: 'Entrega x planejado',
        campos: [
          {
            id: 'entrega', rot: 'Volume por formato', tipo: 'lista', linhas: 5,
            cols: [
              { id: 'f', rot: 'Formato', ph: 'Reels' },
              { id: 'p', rot: 'Planejado', ph: '8' },
              { id: 'e', rot: 'Entregue', ph: '6' },
              { id: 'o', rot: 'Observação', ph: 'Duas gravações remarcadas.' },
            ],
          },
          {
            id: 'funil', rot: 'Distribuição por etapa do funil', tipo: 'lista', linhas: 3,
            dica: 'Puxe do mockup da pré-estratégia. Mês inteiro de topo explica alcance alto com conversa parada.',
            cols: [
              { id: 'e', rot: 'Etapa', tipo: 'opcao', opcoes: ['Topo', 'Meio', 'Fundo'] },
              { id: 'q', rot: 'Peças' },
              { id: 'o', rot: 'Leitura' },
            ],
          },
        ],
      },
      {
        t: 'Aprendizados',
        campos: [
          {
            id: 'insights', rot: 'O que aprendemos', tipo: 'lista', linhas: 3,
            dica: 'Aprendizado é padrão que se repete e vira regra de produção. Não é resumo de número.',
            cols: [
              { id: 't', rot: 'Aprendizado', ph: 'Bastidor supera produto acabado' },
              { id: 'd', rot: 'Em que se baseia e o que muda', ph: 'As 3 peças de maior salvamento do mês foram processo, não resultado.' },
            ],
          },
          {
            id: 'hipotese', rot: 'Hipótese a testar no mês seguinte', tipo: 'area',
            dica: 'Uma hipótese testável, com o que seria considerado confirmação.',
            ph: 'Se abrirmos os Reels com o erro antes do acerto, a retenção nos 3s passa de 55%.',
          },
        ],
      },
      {
        t: 'Plano do próximo mês',
        campos: [
          {
            id: 'plano', rot: 'Ações', tipo: 'lista', linhas: 4,
            cols: [{ id: 't', rot: 'Ação' }, { id: 'r', rot: 'Responsável' }, { id: 'q', rot: 'Quando' }],
          },
          {
            id: 'pedido', rot: 'O que precisamos do cliente', tipo: 'area',
            dica: 'Sem esta linha, a ação que travou por falta de material vira culpa da agência no mês seguinte.',
            ph: 'Uma data de gravação até o dia 10 e o retorno das aprovações em até 2 dias úteis.',
          },
        ],
      },
    ],

    render(d) {
      const S = [];
      const B = (id, nome, html) => S.push({ id, nome, html });
      const linhas = (arr) => lista(arr).filter((r) => r && (r.n || r.t || r.f || r.e));

      const tabela = (arr) => `<table><thead><tr><th>Métrica</th><th>Anterior</th><th>Atual</th><th>Variação</th></tr></thead>
        <tbody>${(linhas(arr).length ? linhas(arr) : [{}]).map((r) => `<tr>
          <td>${v(r.n, 'métrica')}</td><td>${v(r.a, '—')}</td>
          <td><strong>${v(r.b, '—')}</strong></td><td>${delta(r.a, r.b, r.dir)}</td></tr>`).join('')}</tbody></table>`;

      const camada = (n, nome, pergunta, arr, leitura, acao, extra) => `
        <section class="slide"><span class="pg"></span>
          <div class="eyebrow">Camada ${n} · ${nome}</div>
          <h2>${pergunta}</h2><div class="bar"></div>
          ${tabela(arr)}
          ${extra || ''}
          <div class="grid g2" style="margin-top:1.6cqw">
            <div class="card"><h3>O que aconteceu</h3><p>${v(leitura, 'causa por trás do número')}</p></div>
            <div class="card claro"><h3>O que faremos</h3><p>${v(acao, 'decisão para o mês seguinte')}</p></div>
          </div>
          <div class="logo"></div></section>`;

      B('capa', 'Capa', `<section class="slide capa"><span class="pg"></span>
        <div style="margin:auto 0;max-width:50%">
          <h1>Relatório<br>de Resultados</h1><div class="bar"></div>
          <h3 style="font-size:2.6cqw;margin-bottom:.8cqw">${v(d.cliente, 'CLIENTE')}</h3>
          <p class="lede">${v(d.periodo, 'período')}<span style="color:var(--rosaclaro)">
            ${d.comparado ? ` · comparado com ${esc(d.comparado)}` : ''}</span></p>
        </div>
        <p style="font-size:1.5cqw">${v(d.autor, 'apresentado por')}<br>
          <span style="color:var(--rosaclaro)">Social Media</span></p>
        <div class="logo"></div></section>`);

      B('resumo', 'Leitura rápida', `<section class="slide mascote-canto"><span class="pg"></span>
        <div class="eyebrow">Leitura rápida</div><h2>O mês<br>em números</h2><div class="bar"></div>
        <div class="grid g4" style="margin-bottom:2cqw">${
  (linhas(d.kpis).length ? linhas(d.kpis) : [{}, {}, {}, {}]).map((r) => `<div class="card kpi">
            <span class="rotulo">${v(r.n, 'métrica')}</span>
            <span class="valor">${v(r.b, '—')}</span>
            <span class="antes">antes ${v(r.a, '—')}</span>
            ${delta(r.a, r.b, r.dir)}</div>`).join('')}</div>
        <div class="fecho"><span class="rot">O mês em uma frase</span>
          <p>${v(d.frase, 'diga se a agulha se moveu')}</p></div>
        <div class="logo"></div></section>`);

      B('c1', 'Camada 1 · Distribuição', camada(1, 'Distribuição', 'O algoritmo<br>deu chance?', d.m1, d.l1, d.a1));
      B('c2', 'Camada 2 · Atenção', camada(2, 'Atenção', 'O criativo<br>prendeu?', d.m2, d.l2, d.a2));
      B('c3', 'Camada 3 · Ação', camada(3, 'Ação', 'Motivou<br>reação?', d.m3, d.l3, d.a3,
        `<p style="margin-top:1.2cqw;font-size:1.25cqw;color:var(--rosaclaro)">
          Base de cálculo do engajamento: <strong>${v(d.base, 'declare a base')}</strong> — a mesma de todos os relatórios anteriores.</p>`));
      B('c4', 'Camada 4 · Negócio', camada(4, 'Negócio', 'Virou<br>resultado?', d.m4, d.l4, d.a4));

      B('tops', 'Destaques do mês', `<section class="slide"><span class="pg"></span>
        <div class="eyebrow">Destaques</div><h2>O que mais<br>performou</h2><div class="bar"></div>
        <div class="grid g3">${(linhas(d.tops).length ? linhas(d.tops) : [{}, {}, {}]).map((r, i) => `
          <div class="card"><span class="num">0${i + 1}</span>
            <h3>${v(r.t, 'peça')}</h3>
            <p style="color:var(--rosa);font-weight:600;margin:.5cqw 0">${v(r.v, 'número')}</p>
            <p>${v(r.d, 'por que funcionou')}</p></div>`).join('')}</div>
        <div class="logo"></div></section>`);

      B('flops', 'O que não funcionou', `<section class="slide mascote-canto"><span class="pg"></span>
        <div class="eyebrow">Contraponto</div><h2>O que ficou<br>abaixo</h2><div class="bar"></div>
        <div class="grid g2">${(linhas(d.flops).length ? linhas(d.flops) : [{}, {}]).map((r) => `
          <div class="card"><h3>${v(r.t, 'peça')}</h3>
            <p style="color:var(--rosaclaro);font-weight:600;margin:.5cqw 0">${v(r.v, 'número')}</p>
            <p>${v(r.d, 'hipótese do que falhou')}</p></div>`).join('')}</div>
        <div class="fecho"><span class="rot">O que isso muda na produção</span>
          <p>${v(d.flopNota, 'a mudança concreta que este achado gera')}</p></div>
        <div class="logo"></div></section>`);

      B('entrega', 'Entrega x planejado', `<section class="slide"><span class="pg"></span>
        <div class="eyebrow">Execução</div><h2>Entrega<br>x planejado</h2><div class="bar"></div>
        <div class="grid g2" style="align-items:start">
          <div><table><thead><tr><th>Formato</th><th>Plan.</th><th>Entr.</th><th>Observação</th></tr></thead>
            <tbody>${(linhas(d.entrega).length ? linhas(d.entrega) : [{}]).map((r) => `<tr>
              <td>${v(r.f, 'formato')}</td><td>${v(r.p, '—')}</td>
              <td><strong>${v(r.e, '—')}</strong></td><td>${v(r.o, '—')}</td></tr>`).join('')}</tbody></table></div>
          <div class="card claro"><h3>Por etapa do funil</h3>
            <ul class="ast" style="margin-top:1cqw">${(linhas(d.funil).length ? linhas(d.funil) : [{}, {}, {}]).map((r) =>
    `<li><strong>${v(r.e, 'etapa')}</strong> · ${v(r.q, '—')} ${String(r.q) === '1' ? 'peça' : 'peças'}<br>${v(r.o, 'leitura')}</li>`).join('')}</ul></div>
        </div>
        <div class="logo"></div></section>`);

      B('insights', 'Aprendizados', `<section class="slide"><span class="pg"></span>
        <div class="eyebrow">Aprendizados</div><h2>O que o mês<br>nos ensinou</h2><div class="bar"></div>
        <div class="grid g3">${(linhas(d.insights).length ? linhas(d.insights) : [{}, {}, {}]).map((r, i) => `
          <div class="card solid"><span class="num">${i + 1}</span>
            <h3>${v(r.t, 'aprendizado')}</h3><p>${v(r.d, 'em que se baseia e o que muda')}</p></div>`).join('')}</div>
        <div class="fecho"><span class="rot">Hipótese a testar</span>
          <p>${v(d.hipotese, 'uma hipótese testável, com critério de confirmação')}</p></div>
        <div class="logo"></div></section>`);

      B('plano', 'Plano do próximo mês', `<section class="slide"><span class="pg"></span>
        <div class="eyebrow">Próximo ciclo</div><h2>Plano do<br>próximo mês</h2><div class="bar"></div>
        <table><thead><tr><th>Ação</th><th>Responsável</th><th>Quando</th></tr></thead>
          <tbody>${(linhas(d.plano).length ? linhas(d.plano) : [{}]).map((r) => `<tr>
            <td>${v(r.t, 'ação')}</td><td>${v(r.r, '—')}</td><td>${v(r.q, '—')}</td></tr>`).join('')}</tbody></table>
        <div class="fecho"><span class="rot">O que precisamos do cliente</span>
          <p>${v(d.pedido, 'a dependência que trava a execução')}</p></div>
        <div class="logo"></div></section>`);

      B('fim', 'Encerramento', `<section class="slide fechamento"><span class="pg"></span>
        <div style="margin:auto;text-align:center">
          <div style="width:26cqw;aspect-ratio:700/201;margin:0 auto 3.4cqw;
            background:var(--logo-rosa) center/contain no-repeat"></div>
          <h1 style="font-size:7cqw">Obrigado!</h1>
          <div class="bar" style="width:22%;margin:2.4cqw auto 0"></div></div></section>`);

      return S;
    },
  },
  // ═══════════════════════════════════════════════════════════
  // 3 · ROTEIRO DE CARROSSEL — em construção
  // Card desativado, igual ao protótipo: aparece apagado na tela de
  // escolha e não abre. Serve para o time saber o que vem depois.
  // ═══════════════════════════════════════════════════════════
  {
    id: 'carrossel',
    nome: 'Roteiro de Carrossel',
    desc: 'Gancho, desenvolvimento e CTA, lâmina a lâmina.',
    meta: 'Em construção',
    ativo: false,
  },
];

export const docPorId = (id) => DOCS.find((d) => d.id === id) || null;

// Só os documentos que abrem. A tela de escolha continua mostrando os
// inativos, apagados — por isso a lista completa segue exportada.
export const docsAtivos = () => DOCS.filter((d) => d.ativo !== false);
