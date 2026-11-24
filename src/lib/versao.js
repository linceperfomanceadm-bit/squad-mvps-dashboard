// ─── Versão do app ────────────────────────────────────────────
// Nasceu em nov/2026: uma aba esquecida aberta desde antes de um deploy
// continuou rodando o código velho por dias e desfazendo o trabalho dos
// outros (devolvia para produção as tasks enviadas para a própria
// aprovação). Sem a versão à mostra não havia como saber quem estava
// com o app desatualizado. Agora o rodapé da sidebar mostra a data do
// deploy e o commit; quem estiver com data mais antiga que o último
// deploy precisa dar F5.
//
// De onde vêm os valores: o `buildCommand` do vercel.json grava
// REACT_APP_VERSAO (commit curto) e REACT_APP_BUILD_EM (hora do build,
// ISO em UTC) antes do `npm run build`. Se o comando ficar sem eles, o
// commit cai na variável que a própria Vercel expõe para o CRA
// (REACT_APP_VERCEL_GIT_COMMIT_SHA). No `npm start` local não há
// nenhum dos dois e a versão aparece como "dev".

const commitCompleto = process.env.REACT_APP_VERSAO
  || process.env.REACT_APP_VERCEL_GIT_COMMIT_SHA
  || '';

export const VERSAO_COMMIT = commitCompleto ? commitCompleto.slice(0, 7) : 'dev';

const buildEm = process.env.REACT_APP_BUILD_EM ? new Date(process.env.REACT_APP_BUILD_EM) : null;
const buildValido = buildEm && !Number.isNaN(buildEm.getTime());

// Sempre no horário de Brasília, para todo mundo comparar a mesma coisa
// independente do fuso configurado no computador.
const formatar = (opcoes) => (buildValido
  ? buildEm.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', ...opcoes })
  : '');

// "24/11 10:45"
export const VERSAO_DATA = buildValido
  ? `${formatar({ day: '2-digit', month: '2-digit' })} ${formatar({ hour: '2-digit', minute: '2-digit' })}`
  : '';

// Texto curto do rodapé: "v 24/11 10:45 · d83e99c" (ou só o commit).
export const VERSAO_ROTULO = VERSAO_DATA ? `v ${VERSAO_DATA} · ${VERSAO_COMMIT}` : `v ${VERSAO_COMMIT}`;

// Texto do title (passar o mouse): só a data completa e o commit, sem
// orientação — o rodapé é para conferência, não um aviso ao usuário.
export const VERSAO_DETALHE = buildValido
  ? `Versão do app publicada em ${formatar({ day: '2-digit', month: '2-digit', year: 'numeric' })} às ${formatar({ hour: '2-digit', minute: '2-digit' })} (commit ${VERSAO_COMMIT})`
  : `Versão do app: ${VERSAO_COMMIT}`;
