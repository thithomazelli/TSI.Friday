/**
 * Formata um CPF sem pontuação para o formato XXX.XXX.XXX-XX
 * @param cpf - CPF com ou sem formatação
 * @returns CPF formatado ou string vazia se inválido
 */
export function formatCPF(cpf: string | undefined | null): string {
  if (!cpf) return '';

  // Remove caracteres não numéricos
  const cleanCPF = cpf.replace(/\D/g, '');

  // Verifica se tem 11 dígitos
  if (cleanCPF.length !== 11) return cleanCPF;

  // Formata: XXX.XXX.XXX-XX
  return cleanCPF.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
}

/**
 * Formata um CNPJ sem pontuação para o formato XX.XXX.XXX/XXXX-XX
 * @param cnpj - CNPJ com ou sem formatação
 * @returns CNPJ formatado ou string vazia se inválido
 */
export function formatCNPJ(cnpj: string | undefined | null): string {
  if (!cnpj) return '';

  // Remove caracteres não numéricos
  const cleanCNPJ = cnpj.replace(/\D/g, '');

  // Verifica se tem 14 dígitos
  if (cleanCNPJ.length !== 14) return cleanCNPJ;

  // Formata: XX.XXX.XXX/XXXX-XX
  return cleanCNPJ.replace(
    /(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/,
    '$1.$2.$3/$4-$5',
  );
}

/**
 * Formata um documento (CPF ou CNPJ) baseado no comprimento
 * @param document - Documento com ou sem formatação
 * @returns Documento formatado
 */
export function formatDocument(document: string | undefined | null): string {
  if (!document) return '';

  const cleanDoc = document.replace(/\D/g, '');

  if (cleanDoc.length === 11) {
    return formatCPF(cleanDoc);
  } else if (cleanDoc.length === 14) {
    return formatCNPJ(cleanDoc);
  }

  return document;
}

/**
 * Formata um valor monetário no padrão pt-BR/BRL, usado nos valueFormatters de colunas
 * de valor em ag-Grid por toda a aplicação.
 * @param value - Valor a ser formatado (numérico ou string numérica)
 * @returns Valor formatado como moeda, string original se não numérico, ou vazio se nulo
 */
export function formatCurrencyBRL(value: unknown): string {
  if (value == null || value === '') {
    return '';
  }

  const number = Number(value);
  if (Number.isNaN(number)) {
    return String(value);
  }

  return number.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/**
 * Formata uma data no padrão dd/MM/yyyy, usado nos valueFormatters de colunas de data
 * em ag-Grid por toda a aplicação.
 * @param date - Data a ser formatada
 * @returns Data formatada ou vazio se nula/inválida
 */
export function formatDateBR(date: string | Date | null | undefined): string {
  if (!date) {
    return '';
  }

  const parsedDate = new Date(date);
  if (isNaN(parsedDate.getTime())) {
    return '';
  }

  const day = String(parsedDate.getDate()).padStart(2, '0');
  const month = String(parsedDate.getMonth() + 1).padStart(2, '0');
  const year = parsedDate.getFullYear();

  return `${day}/${month}/${year}`;
}

/**
 * Formata uma data e hora no padrão dd/MM/yyyy HH:mm, usado nos valueFormatters de
 * colunas de data/hora em ag-Grid por toda a aplicação.
 * @param date - Data a ser formatada
 * @returns Data e hora formatadas ou vazio se nula/inválida
 */
export function formatDateTimeBR(date: string | Date | null | undefined): string {
  if (!date) {
    return '';
  }

  const parsedDate = new Date(date);
  if (isNaN(parsedDate.getTime())) {
    return '';
  }

  const day = String(parsedDate.getDate()).padStart(2, '0');
  const month = String(parsedDate.getMonth() + 1).padStart(2, '0');
  const year = parsedDate.getFullYear();
  const hours = String(parsedDate.getHours()).padStart(2, '0');
  const minutes = String(parsedDate.getMinutes()).padStart(2, '0');

  return `${day}/${month}/${year} ${hours}:${minutes}`;
}
