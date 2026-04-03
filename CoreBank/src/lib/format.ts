export function formatMoney(value: number, currency = 'MZN') {
  return new Intl.NumberFormat('pt-MZ', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2
  }).format(value);
}

export function formatDate(value: string) {
  return new Intl.DateTimeFormat('pt-MZ', {
    year: 'numeric',
    month: 'short',
    day: '2-digit'
  }).format(new Date(value));
}
