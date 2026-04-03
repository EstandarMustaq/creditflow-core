import * as XLSX from 'xlsx';

export function exportClientsTemplate() {
  const rows = [
    { name: 'Nome do Cliente', phone: '84xxxxxxx', email: 'cliente@exemplo.com', nationalId: 'ID123', address: 'Maputo' }
  ];
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Clients');
  return XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
}

export function exportPortfolioWorkbook(portfolio: {
  totalPrincipal: number;
  totalOutstanding: number;
  totalLateFees: number;
  totalContracts: number;
  totalInstallments: number;
}) {
  const ws = XLSX.utils.json_to_sheet([
    { metric: 'Total principal', value: portfolio.totalPrincipal },
    { metric: 'Total outstanding', value: portfolio.totalOutstanding },
    { metric: 'Total late fees', value: portfolio.totalLateFees },
    { metric: 'Total contracts', value: portfolio.totalContracts },
    { metric: 'Total installments', value: portfolio.totalInstallments }
  ]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Portfolio');
  return XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
}
