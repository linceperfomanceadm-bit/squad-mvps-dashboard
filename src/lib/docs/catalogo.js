// ─────────────────────────────────────────────────────────────
// Lince Docs — CATÁLOGO DE DOCUMENTOS
//
// Cada documento declara seus campos (`secoes`) e como eles viram
// slide (`render`). Para criar um documento novo, acrescente um
// objeto aqui — nada fora desta pasta precisa ser tocado.
//
// Campos suportados: 'texto', 'area', 'lista' (linhas fixas com
// colunas), 'nota' (texto de orientação, sem valor) e coluna do tipo
// 'opcao' (select).
//
// REGRA 3.10 — dois níveis de profundidade:
//   `extra: true`  no campo ou na coluna → complementar
//   `linhasEss: n` na lista → quantas linhas bastam no modo essencial
// O modo essencial esconde, nunca apaga.
//
// REGRA 3.11 — `padrao: [...]` na coluna pré-preenche as linhas
// quando o documento abre. Seção com `iniciaDesligada` nasce fora.
// ─────────────────────────────────────────────────────────────

import { esc, v, lista, num, delta } from './motor';

export const DOCS = [
  // ═══════════════════════════════════════════════════════════
  // 1 · PRÉ-ESTRATÉGIA
  // ═══════════════════════════════════════════════════════════
  {
    id: 'pre-estrategia',
    nome: 'Pré-Estratégia — Social Media',
    desc: 'Diagnóstico, benchmark, tom de voz, pilares, cadência, métricas e fluxo de produção. 12 slides.',
    meta: '12 slides · ~35 campos',
    ativo: true,
    balancoFunil: true, // acompanha o equilíbrio topo/meio/fundo na tela
    // Campo que alimenta a base de cálculo travada do cliente (regra 3.2)
    campoBase: 'base',

    secoes: [
      {
        t: 'Capa',
        campos: [
          {
            id: 'cliente', rot: 'Nome do cliente', tipo: 'texto',
            dica: 'Escreva como a marca se chama no mercado, do jeito que ela mesma assina.',
            ph: 'ACRIVIA',
          },
          {
            id: 'recorte', rot: 'O que este plano cobre, em uma frase', tipo: 'area',
            dica: 'Responda duas coisas: o que vamos fazer e em quanto tempo. Uma frase, sem adjetivo.',
            ph: 'Estratégia de conteúdo para os primeiros 90 dias, com foco em posicionamento, percepção de valor e geração de demanda.',
          },
          {
            id: 'autor', rot: 'Quem vai apresentar', tipo: 'texto',
            dica: 'Seu nome. É quem o cliente vai procurar depois da reunião.',
            ph: 'Eloisa Lira',
          },
        ],
      },
      {
        t: 'Sobre este documento',
        campos: [
          {
            id: 'sobre1', rot: 'O que o cliente vai encontrar aqui', tipo: 'area',
            dica: 'Liste em texto corrido o que o documento cobre (diagnóstico, concorrência, pilares, cadência, métricas) e termine dizendo o que a marca deve virar aos olhos do público.',
            ph: 'Este plano cobre o diagnóstico do perfil hoje, o mapa da concorrência, os pilares de conteúdo, a cadência de publicação, as métricas que vamos acompanhar e o fluxo de produção. O objetivo é transformar o perfil na referência técnica do setor na região.',
          },
          {
            id: 'sobre2', rot: 'De onde saiu esta análise', tipo: 'area', extra: true,
            dica: 'Diga o que você olhou para chegar nas conclusões: perfis analisados, conversa de briefing, dados do próprio perfil.',
            ph: 'A leitura vem da análise de quatro perfis concorrentes, dos dados dos últimos 90 dias do perfil e da conversa de briefing com a sócia responsável.',
          },
          {
            id: 'prioridades', rot: 'As prioridades do trabalho, da mais importante para a menos', tipo: 'lista', linhas: 4, linhasEss: 3,
            dica: 'A ordem importa: quando duas boas ideias disputarem espaço, é esta lista que decide. Escreva cada prioridade em até seis palavras.',
            cols: [{ id: 't', rot: 'Prioridade', ph: 'Construir autoridade e marca' }],
          },
        ],
      },
      {
        t: '01 · Diagnóstico',
        campos: [
          {
            id: 'ativos', rot: 'O que o cliente já tem de bom', tipo: 'area',
            dica: 'Comece pelo que já existe e funciona: identidade visual, alguém disposto a aparecer, autoridade real no assunto, base de clientes. Cliente que se sente diagnosticado como incompetente entra na defensiva.',
            ph: 'A marca tem identidade visual pronta, uma sócia confortável em vídeo, quinze anos de mercado e uma base de clientes que indica. A matéria-prima está toda aqui.',
          },
          {
            id: 'gargalo', rot: 'O problema que trava o crescimento (apenas um)', tipo: 'area',
            dica: 'Um gargalo só. Nomeie sem rodeio, explique por que ele é fatal neste mercado e deixe claro que tem solução por método. Se listar quatro, a seção 07 não tem o que resolver.',
            ph: 'O perfil só publica quando sobra tempo. Sem constância, o algoritmo não entrega e o esforço de cada post se perde — e é justamente a constância que separa os dois concorrentes que crescem dos outros.',
          },
          {
            id: 'diagFrase', rot: 'O diagnóstico resumido em uma frase', tipo: 'area',
            dica: 'Modelo pronto: "O cliente tem [ativos] para [objetivo]. O que falta é [o sistema que resolve o gargalo]."',
            ph: 'A marca tem autoridade e material de sobra para virar referência. O que falta é um sistema que garanta publicação constante sem depender de alguém lembrar.',
          },
        ],
      },
      {
        t: '02 · Concorrência',
        campos: [
          {
            id: 'metodo', rot: 'Como você levantou os dados dos concorrentes', tipo: 'area',
            dica: 'Diga o que é número público e o que é leitura sua. Assumir a limitação compra credibilidade para o resto do documento.',
            ph: 'Seguidores e formatos são públicos. Frequência e horário não são auditáveis de fora: foram estimados pela leitura dos últimos 30 dias de cada perfil.',
          },
          {
            id: 'concorrentes', rot: 'Perfis que você analisou', tipo: 'lista', linhas: 4, linhasEss: 3,
            dica: 'Use três níveis: a referência do setor, um concorrente do mesmo porte e uma marca pessoal que disputa a mesma atenção. Deixe a última linha para o próprio cliente, para a comparação ficar de pé.',
            cols: [
              { id: 'perfil', rot: 'Arroba do perfil', ph: '@lucasacrilicos' },
              { id: 'nivel', rot: 'É referência, par ou marca pessoal?', ph: 'Par direto', extra: true },
              { id: 'seg', rot: 'Seguidores', ph: '312 mil' },
              { id: 'fmt', rot: 'Formato que mais usa', ph: 'Vídeo', extra: true },
              { id: 'tema', rot: 'Assunto dos posts', ph: 'Produto e bastidor' },
            ],
          },
        ],
      },
      {
        t: '02 · Brechas',
        campos: [
          {
            id: 'brechas', rot: 'O que ninguém está fazendo (e o cliente pode fazer)', tipo: 'lista', linhas: 3,
            dica: 'Brecha é o que falta no mercado, não o que o cliente quer fazer. Dê um nome curto e explique por que está sobrando espaço ali.',
            cols: [
              { id: 't', rot: 'Nome da brecha', ph: 'Humanização com estrutura' },
              { id: 'd', rot: 'Por que ninguém ocupou esse espaço', ph: 'Os grandes são impessoais e os influenciadores não têm respaldo técnico. Ninguém junta as duas coisas.' },
            ],
          },
          {
            id: 'terreno', rot: 'O que essa leitura significa para o cliente', tipo: 'area',
            dica: 'Feche a seção dizendo qual combinação só o cliente consegue entregar e onde o concorrente mais próximo é vulnerável.',
            ph: 'Nenhum concorrente junta técnica e rosto. É essa combinação que o perfil pode ocupar, e o concorrente mais próximo não consegue copiar sem trocar o time.',
          },
        ],
      },
      {
        t: '03 · Tom de voz',
        campos: [
          {
            id: 'vozResumo', rot: 'Como a marca soa quando fala', tipo: 'area',
            dica: 'Descreva o jeito de falar em uma ou duas frases, como se explicasse para alguém que vai escrever a legenda amanhã. Fale de postura, não de assunto.',
            ph: 'A marca fala como especialista que explica sem palestrar: direta, sem jargão e sem prometer milagre. Explica o porquê antes de dar a solução.',
          },
          {
            id: 'voz', rot: 'Características do tom de voz', tipo: 'lista', linhas: 3,
            dica: 'Escolha três características e diga o que cada uma muda na hora de escrever. Sem isso, "profissional" e "próximo" viram opinião de quem está com o teclado na mão.',
            cols: [
              { id: 't', rot: 'Característica', ph: 'Direto' },
              { id: 'd', rot: 'O que isso muda na escrita', ph: 'Frase curta, resposta na primeira linha, nada de introdução antes do assunto.' },
            ],
          },
          {
            id: 'vozEvitar', rot: 'O que a marca nunca faz', tipo: 'lista', linhas: 3,
            dica: 'Liste o que está proibido: gíria, emoji, promessa de resultado, polêmica, meme do momento. Serve tanto para a equipe quanto para alinhar expectativa com o cliente.',
            cols: [
              { id: 't', rot: 'Evitar', ph: 'Promessa de resultado' },
              { id: 'd', rot: 'Por quê', ph: 'O setor é regulado e promessa numérica queima a confiança construída pelo restante do conteúdo.', extra: true },
            ],
          },
          {
            id: 'vozExemplo', rot: 'Um exemplo de frase no tom certo', tipo: 'area', extra: true,
            dica: 'Escreva uma frase que poderia abrir um post. É a forma mais rápida de o cliente entender o tom sem discutir adjetivo.',
            ph: '"Antes de trocar a embalagem, olhe o custo por peça. Na maioria dos casos, o problema não é o material."',
          },
        ],
      },
      {
        t: '04 · Pilares',
        campos: [
          {
            id: 'pilaresIntro', rot: 'Por que um pilar pesa mais que o outro', tipo: 'area',
            dica: 'Explique qual pilar leva a maior fatia e por quê. O mais pesado tem que ser o que ocupa a brecha da seção 02.',
            ph: 'O maior peso fica em autoridade técnica: é a brecha aberta no mercado e o que sustenta o preço praticado. Bastidor entra como apoio, não como base.',
          },
          {
            id: 'pilares', rot: 'Os pilares de conteúdo e o peso de cada um', tipo: 'lista', linhas: 4, linhasEss: 3,
            dica: 'Os pesos somam 100%. A etapa do funil não é enfeite: é o que impede um mês inteiro de conteúdo de descoberta sem nenhuma peça que ajude alguém a decidir.',
            cols: [
              { id: 'n', rot: 'Nome do pilar', ph: 'Autoridade técnica' },
              { id: 'p', rot: 'Peso (%)', ph: '40' },
              { id: 'f', rot: 'Etapa do funil', tipo: 'opcao', opcoes: ['Topo', 'Meio', 'Fundo'] },
              { id: 'd', rot: 'Que tipo de post entra aqui', ph: 'Análise de mudanças do setor traduzidas para o impacto no bolso do cliente.' },
            ],
          },
        ],
      },
      {
        t: '05 · Cadência',
        campos: [
          {
            id: 'criterio', rot: 'Por que esses dias e horários', tipo: 'area',
            dica: 'Justifique a frequência e os horários escolhidos. Se o motivo for referência de mercado, diga isso — não invente dado do perfil que você ainda não tem.',
            ph: 'Três posts por semana mais stories quase diários é o piso para o algoritmo entregar com regularidade. Quarta ao meio-dia e quinta às 9h concentram o público do cliente.',
          },
          {
            id: 'grade', rot: 'Grade da semana', tipo: 'lista', linhas: 5, linhasEss: 3,
            dica: 'Uma linha por publicação da semana. Inclua Stories como linha própria mesmo que esteja fora do contrato: o que some da grade some da conversa.',
            cols: [
              { id: 'dia', rot: 'Dia', ph: 'Terça' },
              { id: 'pilar', rot: 'Pilar', ph: 'Autoridade', extra: true },
              { id: 'fmt', rot: 'Formato', ph: 'Carrossel' },
              { id: 'hora', rot: 'Horário', ph: '11h às 13h' },
            ],
          },
          {
            id: 'obs', rot: 'Avisos sobre a grade', tipo: 'area', extra: true,
            dica: 'Use para combinar o que muda depois. Exemplo: em quatro a seis semanas os dados do próprio perfil passam a mandar nos horários.',
            ph: 'Estes horários são ponto de partida. Depois de quatro a seis semanas, os dados do próprio perfil substituem a referência de mercado.',
          },
        ],
      },
      {
        t: '05 · Mockup do mês',
        opcional: true,
        iniciaDesligada: true,
        campos: [
          {
            id: 'mockup', rot: 'Temas dos posts do primeiro mês', tipo: 'lista', linhas: 8, linhasEss: 6,
            dica: 'Formato: E = estático (fazer desejar), C = carrossel (fazer entender), V = vídeo (fazer acreditar). Funil: T = topo, M = meio, F = fundo. O balanço no topo da pré-visualização mostra se o mês ficou torto.',
            cols: [
              { id: 't', rot: 'Tema do post', ph: 'Bastidores da produção' },
              { id: 'f', rot: 'Formato', tipo: 'opcao', opcoes: ['E', 'C', 'V'], ph: 'V' },
              { id: 'fn', rot: 'Etapa do funil', tipo: 'opcao', opcoes: ['T', 'M', 'F'] },
            ],
          },
        ],
      },
      {
        t: '06 · Métricas',
        campos: [
          {
            id: 'metricasIntro', rot: 'Por que vamos olhar estas métricas', tipo: 'area',
            dica: 'Ligue as métricas ao objetivo do cliente e diga o que deixou de fora. É aqui que você combina, antes de começar, o que vai contar como resultado.',
            ph: 'Como o objetivo dos primeiros meses é autoridade e não venda imediata, curtida importa menos do que salvamento e compartilhamento.',
          },
          {
            id: 'objetivo', rot: 'Nome do objetivo (aparece no título do slide)', tipo: 'texto', ph: 'autoridade', extra: true,
            dica: 'Uma palavra, em minúscula. O slide vai escrever "O que prova [sua palavra]".',
          },
          {
            id: 'metricas', rot: 'Métricas que provam o objetivo', tipo: 'lista', linhas: 4, linhasEss: 3,
            dica: 'Para cada métrica, explique o que ela diz sobre o comportamento de quem viu o post. Evite métrica que ninguém sabe ler.',
            cols: [
              { id: 'n', rot: 'Métrica', ph: 'Taxa de salvamento' },
              { id: 'd', rot: 'O que ela prova', ph: 'Quem salva está dizendo que o conteúdo é útil e que pretende voltar nele.' },
            ],
          },
          {
            id: 'base', rot: 'Base de cálculo dos percentuais', tipo: 'texto',
            dica: 'Escolha agora e não mude mais: dividir por seguidores, por alcance ou por visualizações dá números muito diferentes, e trocar no meio invalida a comparação com todos os relatórios anteriores.',
            ph: 'interações ÷ alcance',
          },
          {
            id: 'regua', rot: 'O que o relatório mensal vai responder', tipo: 'area',
            dica: 'Escreva as três perguntas que todo relatório vai responder e diga o que é consequência, não meta (seguidor costuma ser consequência).',
            ph: 'Todo mês o relatório responde: alcançamos gente nova? Quem chegou ficou? Alguém saiu do perfil e falou com a empresa? Seguidor é consequência disso, não meta.',
          },
        ],
      },
      {
        t: '07 · Fluxo de produção',
        campos: [
          {
            id: 'logica', rot: 'A lógica do fluxo em uma linha', tipo: 'area',
            dica: 'Diga o princípio que faz o conteúdo sair mesmo em semana ruim. Normalmente é trabalhar por estoque, e não por urgência.',
            ph: 'Trabalhamos com estoque: o que é publicado esta semana foi gravado no mês passado. Assim o conteúdo não depende de alguém lembrar de postar.',
          },
          {
            id: 'etapas', rot: 'Etapas do ciclo, na ordem', tipo: 'lista', linhas: 4,
            dica: 'Uma etapa por linha, do planejamento à publicação. Diga em cada uma quem faz e quando — inclusive o que é do cliente.',
            cols: [
              { id: 'n', rot: 'Etapa', ph: 'Gravação' },
              { id: 'd', rot: 'Quem faz e quando', ph: 'Os dois sócios gravam em lote, num único dia por mês, com roteiro enviado antes.' },
            ],
          },
          {
            id: 'resultado', rot: 'O que muda quando o fluxo roda', tipo: 'area',
            dica: 'Este texto precisa eliminar o gargalo que você nomeou na seção 01. Se ele não resolve aquele problema, o documento não fecha.',
            ph: 'Com o ciclo rodando, a publicação deixa de depender de tempo livre. A constância, que é o gargalo de hoje, passa a ser resultado do processo.',
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

      B('papel', '03 · Tom de voz', `<section class="slide"><span class="pg"></span>
        <div class="eyebrow">Seção 03</div><h2>Tom de voz</h2><div class="bar"></div>
        <p style="margin-bottom:1.8cqw">${v(d.vozResumo, 'como a marca soa quando fala')}</p>
        <div class="grid g3">${lista(d.voz).map((r, i) => `<div class="card solid">
          <span class="num">${i + 1}</span><h3>${v(r.t, 'característica')}</h3><p>${v(r.d, 'o que muda na escrita')}</p></div>`).join('')}</div>
        <div class="grid g2" style="align-items:start;margin-top:1.6cqw">
          <div class="card claro"><h3>O que a marca nunca faz</h3>
            <ul class="ast" style="margin-top:1cqw">${lista(d.vozEvitar).map((r) =>
    `<li><strong>${v(r.t, 'evitar')}${r.t ? '.' : ''}</strong> ${r.d ? esc(r.d) : ''}</li>`).join('')}</ul></div>
          <div class="fecho" style="margin:0"><span class="rot">No tom certo, soa assim</span>
            <p>${v(d.vozExemplo, 'exemplo de frase')}</p></div>
        </div>
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
    `<li><strong>${v(r.n, 'métrica')}${r.n ? '.' : ''}</strong> ${v(r.d, 'por quê')}</li>`).join('')}</ul></div>
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
          // O slide monta sozinho a partir das camadas — não há campo
          // para os quatro números. Quando existia, o resumo divergia do
          // corpo do relatório.
          {
            id: 'kpiNota', rot: 'Os quatro números do slide', tipo: 'nota',
            texto: 'Este slide monta sozinho: ele pega a primeira métrica preenchida de cada camada. Se quiser destacar outra, mova ela para a primeira linha da camada.',
          },
        ],
      },
      {
        t: 'Camada 1 · Distribuição',
        campos: [
          {
            id: 'm1', rot: 'Métricas', tipo: 'lista', linhas: 4, linhasEss: 3,
            dica: 'Só os dois números. O nome e a direção já vêm postos — troque se este cliente medir outra coisa.',
            cols: [
              { id: 'n', rot: 'Métrica', padrao: ['Alcance', '% de não seguidores', 'Views', 'Novos seguidores'] },
              { id: 'a', rot: 'Mês anterior' },
              { id: 'b', rot: 'Mês atual' },
              {
                id: 'dir', rot: 'Direção', tipo: 'opcao', opcoes: ['↑ melhor', '↓ melhor'], extra: true,
                padrao: ['↑ melhor', '↑ melhor', '↑ melhor', '↑ melhor'],
              },
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
            id: 'm2', rot: 'Métricas', tipo: 'lista', linhas: 4, linhasEss: 3,
            dica: 'Skip rate já vem marcado como "cair é bom".',
            cols: [
              { id: 'n', rot: 'Métrica', padrao: ['Tempo médio de visualização', 'Retenção nos 3s', 'Skip rate', 'Conclusão de Stories'] },
              { id: 'a', rot: 'Mês anterior' },
              { id: 'b', rot: 'Mês atual' },
              {
                id: 'dir', rot: 'Direção', tipo: 'opcao', opcoes: ['↑ melhor', '↓ melhor'], extra: true,
                padrao: ['↑ melhor', '↑ melhor', '↓ melhor', '↑ melhor'],
              },
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
            id: 'm3', rot: 'Métricas', tipo: 'lista', linhas: 4, linhasEss: 3,
            dica: 'Compartilhamento por DM é o sinal mais forte do algoritmo hoje.',
            cols: [
              { id: 'n', rot: 'Métrica', padrao: ['Compartilhamentos (envios)', 'Salvamentos', 'Comentários', 'Contas engajadas'] },
              { id: 'a', rot: 'Mês anterior' },
              { id: 'b', rot: 'Mês atual' },
              {
                id: 'dir', rot: 'Direção', tipo: 'opcao', opcoes: ['↑ melhor', '↓ melhor'], extra: true,
                padrao: ['↑ melhor', '↑ melhor', '↑ melhor', '↑ melhor'],
              },
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
            id: 'm4', rot: 'Métricas', tipo: 'lista', linhas: 4, linhasEss: 3,
            dica: 'Conversas no direct exige contagem manual. Combine isso com o cliente no início do contrato.',
            cols: [
              { id: 'n', rot: 'Métrica', padrao: ['Visitas ao perfil', 'Cliques no link', 'Conversas no direct', 'Leads'] },
              { id: 'a', rot: 'Mês anterior' },
              { id: 'b', rot: 'Mês atual' },
              {
                id: 'dir', rot: 'Direção', tipo: 'opcao', opcoes: ['↑ melhor', '↓ melhor'], extra: true,
                padrao: ['↑ melhor', '↑ melhor', '↑ melhor', '↑ melhor'],
              },
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
          { id: 'flopNota', rot: 'O que isso muda na produção', tipo: 'area', extra: true },
        ],
      },
      {
        t: 'Entrega x planejado',
        campos: [
          {
            id: 'entrega', rot: 'Volume por formato', tipo: 'lista', linhas: 5, linhasEss: 3,
            cols: [
              { id: 'f', rot: 'Formato', padrao: ['Reels', 'Carrossel', 'Estático', 'Stories', ''] },
              { id: 'p', rot: 'Planejado', ph: '8' },
              { id: 'e', rot: 'Entregue', ph: '6' },
              { id: 'o', rot: 'Observação', ph: 'Duas gravações remarcadas.', extra: true },
            ],
          },
          {
            id: 'funil', rot: 'Distribuição por etapa do funil', tipo: 'lista', linhas: 3,
            dica: 'Puxe do mockup da pré-estratégia. Mês inteiro de topo explica alcance alto com conversa parada.',
            cols: [
              { id: 'e', rot: 'Etapa', tipo: 'opcao', opcoes: ['Topo', 'Meio', 'Fundo'], padrao: ['Topo', 'Meio', 'Fundo'] },
              { id: 'q', rot: 'Peças' },
              { id: 'o', rot: 'Leitura', extra: true },
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
            id: 'plano', rot: 'Ações', tipo: 'lista', linhas: 4, linhasEss: 3,
            cols: [{ id: 't', rot: 'Ação' }, { id: 'r', rot: 'Responsável', extra: true }, { id: 'q', rot: 'Quando', extra: true }],
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
      // Leitura rápida é derivada: a 1ª métrica preenchida de cada camada.
      const destaque = [d.m1, d.m2, d.m3, d.m4]
        .map((m) => lista(m).find((r) => r && r.n && (r.a || r.b)))
        .filter(Boolean);

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
  (destaque.length ? destaque : [{}, {}, {}, {}]).map((r) => `<div class="card kpi">
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
