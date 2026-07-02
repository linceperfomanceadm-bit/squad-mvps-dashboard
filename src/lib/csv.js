// Parser de CSV simples e sem dependências, suficiente para importar
// leads. Lida com: separador vírgula OU ponto-e-vírgula (comum no Excel
// pt-BR), aspas duplas com vírgulas dentro, e cabeçalho na 1ª linha.
//
// Retorna { headers: [...], rows: [{...}] } onde cada row é um objeto
// mapeado pelos cabeçalhos (em minúsculas, sem acento).

function stripAccents(s) {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function detectDelimiter(line) {
  const commas = (line.match(/,/g) || []).length;
  const semis = (line.match(/;/g) || []).length;
  return semis > commas ? ';' : ',';
}

// Divide uma linha respeitando aspas.
function splitLine(line, delim) {
  const out = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { cur += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === delim && !inQuotes) {
      out.push(cur); cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out.map(c => c.trim());
}

export function parseCSV(text) {
  // Remove BOM e normaliza quebras de linha.
  const clean = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = clean.split('\n').filter(l => l.trim().length > 0);
  if (lines.length === 0) return { headers: [], rows: [] };

  const delim = detectDelimiter(lines[0]);
  const rawHeaders = splitLine(lines[0], delim);
  const headers = rawHeaders.map(h => stripAccents(h.toLowerCase().trim()));

  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = splitLine(lines[i], delim);
    const obj = {};
    headers.forEach((h, idx) => { obj[h] = (cells[idx] || '').trim(); });
    rows.push(obj);
  }
  return { headers, rows };
}

// Mapeia as linhas do CSV para o formato de lead, aceitando vários
// nomes de coluna comuns (nome/name, telefone/phone/celular, etc.).
export function mapRowsToLeads(rows) {
  const pick = (obj, keys) => {
    for (const k of keys) if (obj[k] != null && obj[k] !== '') return obj[k];
    return '';
  };
  return rows.map(r => ({
    name:    pick(r, ['nome', 'name', 'cliente', 'lead']),
    phone:   pick(r, ['telefone', 'phone', 'celular', 'whatsapp', 'fone', 'contato']),
    company: pick(r, ['empresa', 'company', 'negocio', 'negocio']),
    notes:   pick(r, ['observacao', 'observacoes', 'notes', 'obs', 'anotacao', 'anotacoes']),
  })).filter(l => l.name || l.phone);
}

// Modelo de CSV para o usuário baixar.
export const LEADS_CSV_TEMPLATE = 'nome,telefone,empresa,observacao\nJoão Silva,11999998888,Empresa X,Veio da indicação\nMaria Souza,21988887777,Loja Y,Interessada em tráfego\n';
