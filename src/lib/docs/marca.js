// ─────────────────────────────────────────────────────────────
// Lince Docs — ARQUIVOS DE MARCA
//
// Os cinco arquivos vivem no Firebase Storage, em `marca/`, e não no
// repositório: binário grande pelo editor web do GitHub é caminho
// para arquivo fantasma.
//
// As URLs abaixo carregam o token de acesso do Storage. O token faz
// parte do endereço — sem ele a imagem não abre.
//
// PARA TROCAR UM ARQUIVO DE MARCA
// Suba o novo em `marca/` com OUTRO nome, copie a URL e substitua a
// linha correspondente. Não renomeie nem sobrescreva pelo console: o
// nome está embutido na URL, e "Revogar token" mata o link.
//
// Bucket: gs://lince-dashboard.firebasestorage.app
// ─────────────────────────────────────────────────────────────

const BASE = 'https://firebasestorage.googleapis.com/v0/b/lince-dashboard.firebasestorage.app/o/marca%2F';

export const MARCA = {
  // Logomarca branca — rodapé de todos os slides
  logoBranca: `${BASE}logo-branca.png?alt=media&token=d84682d3-7143-4194-a425-f2add0b0d48a`,
  // Logomarca rosa — só no slide de encerramento
  logoRosa: `${BASE}logo-rosa.png?alt=media&token=e663360e-7b34-4114-ad5c-50a385ea5014`,
  // Ícone do lince — marca d'água, 7% de opacidade
  iconeRosa: `${BASE}icone-rosa.png?alt=media&token=60afa9b0-1bcf-43b2-8e4a-04ea5aef0329`,
  // Capa — lince de terno, fundo do primeiro slide
  capa: `${BASE}capa.jpg?alt=media&token=9fc1381e-5aa7-490c-a762-7eac91451c6c`,
  // Fechamento — lince na neve, fundo do último slide
  fechamento: `${BASE}fechamento.jpg?alt=media&token=e5b0dc74-5e3f-4d55-9ed1-bbfcf63aa3e2`,
};

// Guarda contra URL não preenchida. Se um dia alguém trocar um
// arquivo e esquecer de colar o endereço, o editor avisa em vez de
// renderizar um slide sem capa e sem logo — que parece bug de CSS.
export const marcaPendente = () =>
  Object.values(MARCA).some((u) => !u || !u.startsWith('https://'));

// Variáveis CSS injetadas no contêiner do deck. O CSS dos slides lê
// daqui, então trocar um arquivo de marca é trocar uma URL acima.
export const varsDaMarca = () => ({
  '--logo-branca': `url('${MARCA.logoBranca}')`,
  '--logo-rosa': `url('${MARCA.logoRosa}')`,
  '--icone-rosa': `url('${MARCA.iconeRosa}')`,
  '--capa': `url('${MARCA.capa}')`,
  '--fechamento': `url('${MARCA.fechamento}')`,
});
