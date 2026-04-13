function parseCsvLine(line: string) {
  const cells: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        index += 1;
        continue;
      }

      inQuotes = !inQuotes;
      continue;
    }

    if (char === ',' && !inQuotes) {
      cells.push(current.trim());
      current = '';
      continue;
    }

    current += char;
  }

  cells.push(current.trim());
  return cells;
}

export function parseDelimitedFile(buffer: Buffer) {
  if (!buffer.length) {
    return { rows: [], note: 'empty buffer received; provide a CSV file' };
  }

  const text = buffer.toString('utf8').replace(/^\uFEFF/, '').trim();
  if (!text) {
    return { rows: [], note: 'empty csv content received' };
  }

  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (!lines.length) {
    return { rows: [], note: 'empty csv content received' };
  }

  const headerLine = lines[0];
  if (!headerLine) {
    return { rows: [], note: 'empty csv header received' };
  }

  const headers = parseCsvLine(headerLine);
  const rows = lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    return headers.reduce<Record<string, string>>((acc, header, index) => {
      acc[header] = values[index] ?? '';
      return acc;
    }, {});
  });

  return { format: 'csv', headers, rows };
}
