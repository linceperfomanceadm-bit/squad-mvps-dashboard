// ─────────────────────────────────────────────────────────────
// Lince Docs — ARQUIVOS DE MARCA
//
// Os cinco arquivos ficam no Firebase Storage, em `marca/`, com
// leitura pública. Não entram no repositório: binário grande pelo
// editor do GitHub é caminho para arquivo fantasma.
//
// COMO PREENCHER
// 1. Firebase Console → Storage → criar a pasta `marca/`
// 2. Subir os cinco arquivos com os nomes abaixo
// 3. Em cada um: menu → "Copiar URL de download"
// 4. Colar aqui, entre aspas, no lugar do texto de exemplo
//
// A URL de download vem no formato:
// https://firebasestorage.googleapis.com/v0/b/<bucket>/o/marca%2Fcapa.jpg?alt=media&token=...
// O token faz parte da URL — cole ela inteira.
// ─────────────────────────────────────────────────────────────

export const MARCA = {
  // Logomarca branca — rodapé de todos os slides
  logoBranca: 'COLE_AQUI_A_URL_DE_logo-branca.png',
  // Logomarca rosa — só no slide de encerramento
  logoRosa: 'COLE_AQUI_A_URL_DE_logo-rosa.png',
  // Ícone do lince — marca d'água, 7% de opacidade
  iconeRosa: 'COLE_AQUI_A_URL_DE_icone-rosa.png',
  // Capa — lince de terno, fundo do primeiro slide
  capa: 'COLE_AQUI_A_URL_DE_capa.jpg',
  // Fechamento — lince na neve, fundo do último slide
  fechamento: 'COLE_AQUI_A_URL_DE_fechamento.jpg',
};

// Enquanto as URLs não forem preenchidas, o deck renderiza sem as
// imagens (fundo sólido, sem logo). O editor avisa em vez de quebrar.
export const marcaPendente = () =>
  Object.values(MARCA).some((u) => !u || u.startsWith('COLE_AQUI'));

// Variáveis CSS injetadas no contêiner do deck. O CSS dos slides lê
// daqui, então trocar um arquivo de marca é trocar uma URL acima.
export const varsDaMarca = () => ({
  '--logo-branca': `url('${MARCA.logoBranca}')`,
  '--logo-rosa': `url('${MARCA.logoRosa}')`,
  '--icone-rosa': `url('${MARCA.iconeRosa}')`,
  '--capa': `url('${MARCA.capa}')`,
  '--fechamento': `url('${MARCA.fechamento}')`,
});
