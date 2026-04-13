function escapeCsvValue(value: string) {
  if (/[",\n]/.test(value)) {
    return `"${value.replaceAll('"', '""')}"`;
  }

  return value;
}

export function exportClientsTemplateCsv() {
  const headers = ['name', 'nuib', 'phone', 'email', 'nationalId', 'address', 'crcConsentAt'];
  const rows = [
    [
      'Nome do Cliente',
      '123456789012345',
      '842345678',
      'cliente@gmail.com',
      '100123456789A',
      'Av. 24 de Julho, Maputo',
      '2026-01-10T10:00:00.000Z',
    ],
  ];

  const csv = [headers.join(','), ...rows.map((row) => row.map(escapeCsvValue).join(','))].join('\n');
  return Buffer.from(csv, 'utf8').toString('base64');
}
