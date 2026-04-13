import { can } from '@creditflow-core/auth';
import { isNuib, normalizeNuib } from '@creditflow-core/shared';
import { prisma } from './client.js';
import { buildSimplePdf } from './pdf.js';
import { getLoanBalance } from './loan-orchestrator.js';

type AnyRecord = Record<string, unknown>;

function db() {
  return prisma as any;
}

function asDate(value: unknown) {
  return value instanceof Date ? value : new Date(String(value));
}

function roleCanReadCrc(role: string) {
  return can(role as 'ADMIN' | 'MANAGER' | 'OFFICER', 'clients:read') && (role === 'ADMIN' || role === 'MANAGER');
}

function roleCanExportCrc(role: string) {
  return role === 'ADMIN';
}

export function assertCrcReadAccess(role: string) {
  if (!roleCanReadCrc(role)) {
    throw new Error('CRC access is restricted to authorized internal users.');
  }
}

export function assertCrcExportAccess(role: string) {
  if (!roleCanExportCrc(role)) {
    throw new Error('CRC export is restricted to administrators.');
  }
}

export async function registerImf(input: { code: string; name: string; nuib: string; email?: string }) {
  const nuib = normalizeNuib(input.nuib);
  if (!isNuib(nuib)) {
    throw new Error('IMF NUIB is invalid.');
  }

  return db().imfInstitution.create({
    data: {
      code: input.code.trim().toUpperCase(),
      name: input.name.trim(),
      nuib,
      email: input.email?.trim().toLowerCase() ?? null,
    },
  });
}

export async function listImfs() {
  return db().imfInstitution.findMany({
    orderBy: { createdAt: 'desc' },
  });
}

export async function openCrcRectificationCase(input: {
  clientId: string;
  loanContractId?: string;
  reason: string;
  requestedByClientAt?: string;
  institutionDetectedAt?: string;
}) {
  const requestedByClientAt = input.requestedByClientAt ? asDate(input.requestedByClientAt) : null;
  const institutionDetectedAt = input.institutionDetectedAt ? asDate(input.institutionDetectedAt) : null;
  const clientDueAt = requestedByClientAt
    ? new Date(requestedByClientAt.getTime() + 10 * 24 * 60 * 60 * 1000)
    : null;
  const spontaneousDueAt = institutionDetectedAt
    ? new Date(institutionDetectedAt.getTime() + 7 * 24 * 60 * 60 * 1000)
    : null;

  return db().crcRectificationCase.create({
    data: {
      clientId: input.clientId,
      loanContractId: input.loanContractId ?? null,
      reason: input.reason.trim(),
      requestedByClientAt,
      institutionDetectedAt,
      clientDueAt,
      spontaneousDueAt,
      status: 'OPEN',
    },
  });
}

export async function listCrcRectificationCases(referenceDate?: string | Date) {
  const now = referenceDate ? asDate(referenceDate) : new Date();
  const cases = (await db().crcRectificationCase.findMany({
    include: { client: true },
    orderBy: { createdAt: 'desc' },
  })) as AnyRecord[];

  return cases.map((item) => {
    const clientDueAt = item.clientDueAt ? asDate(item.clientDueAt) : null;
    const spontaneousDueAt = item.spontaneousDueAt ? asDate(item.spontaneousDueAt) : null;
    return {
      id: String(item.id),
      clientId: String(item.clientId),
      clientName: String((item.client as AnyRecord)?.name ?? ''),
      reason: String(item.reason),
      status: String(item.status),
      clientDueAt: clientDueAt?.toISOString() ?? null,
      spontaneousDueAt: spontaneousDueAt?.toISOString() ?? null,
      alert:
        (clientDueAt && clientDueAt <= now) || (spontaneousDueAt && spontaneousDueAt <= now)
          ? 'OVERDUE'
          : (clientDueAt && clientDueAt.getTime() - now.getTime() <= 2 * 24 * 60 * 60 * 1000) ||
              (spontaneousDueAt && spontaneousDueAt.getTime() - now.getTime() <= 2 * 24 * 60 * 60 * 1000)
            ? 'DUE_SOON'
            : 'OK',
    };
  });
}

export async function scanCrcRectificationDeadlines(referenceDate?: string | Date) {
  const items = await listCrcRectificationCases(referenceDate);
  const flagged = items.filter((item) => item.alert === 'OVERDUE' || item.alert === 'DUE_SOON');

  if (flagged.length) {
    await db().auditLog.create({
      data: {
        entity: 'CRC_RECTIFICATION_CASE',
        action: 'CRC_DEADLINE_SCAN',
        payload: {
          count: flagged.length,
          items: flagged,
          referenceDate: referenceDate ? asDate(referenceDate) : new Date(),
        },
      },
    });
  }

  return {
    count: flagged.length,
    items: flagged,
  };
}

export async function logCrcConsultation(input: {
  clientId: string;
  performedBy?: string;
  responseRef?: string;
  charged?: boolean;
  queryCount?: number;
}) {
  const client = await db().client.findUnique({
    where: { id: input.clientId },
    select: { crcConsentAt: true },
  });

  if (!client?.crcConsentAt) {
    throw new Error('CRC consultation requires recorded client consent.');
  }

  return db().crcConsultationLog.create({
    data: {
      clientId: input.clientId,
      performedBy: input.performedBy ?? null,
      responseRef: input.responseRef ?? null,
      charged: input.charged ?? true,
      queryCount: input.queryCount ?? 1,
    },
  });
}

export async function listCrcConsultations() {
  return db().crcConsultationLog.findMany({
    include: { client: true },
    orderBy: { createdAt: 'desc' },
  });
}

export async function upsertCrcExportLayout(input: {
  name: string;
  format: 'CSV' | 'XML';
  fields: Array<{ key: string; label: string }>;
  rootNode?: string;
  active?: boolean;
}) {
  const existing = await db().crcExportLayout.findUnique({ where: { name: input.name } });
  if (!existing) {
    return db().crcExportLayout.create({
      data: {
        name: input.name,
        format: input.format,
        fields: input.fields,
        rootNode: input.rootNode ?? null,
        active: input.active ?? true,
      },
    });
  }

  return db().crcExportLayout.update({
    where: { name: input.name },
    data: {
      format: input.format,
      fields: input.fields,
      rootNode: input.rootNode ?? null,
      active: input.active ?? true,
    },
  });
}

export async function listCrcExportLayouts() {
  return db().crcExportLayout.findMany({
    orderBy: { createdAt: 'asc' },
  });
}

function serializeCsv(rows: Array<Record<string, unknown>>, fields: Array<{ key: string; label: string }>) {
  const header = fields.map((field) => field.label).join(',');
  const lines = rows.map((row) =>
    fields
      .map((field) => `"${String(row[field.key] ?? '').replaceAll('"', '""')}"`)
      .join(','),
  );
  return [header, ...lines].join('\n');
}

function serializeXml(
  rows: Array<Record<string, unknown>>,
  fields: Array<{ key: string; label: string }>,
  rootNode: string,
) {
  const escape = (value: string) =>
    value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');

  const items = rows
    .map((row) => {
      const nodes = fields
        .map((field) => `<${field.label}>${escape(String(row[field.key] ?? ''))}</${field.label}>`)
        .join('');
      return `<record>${nodes}</record>`;
    })
    .join('');

  return `<?xml version="1.0" encoding="UTF-8"?><${rootNode}>${items}</${rootNode}>`;
}

export async function exportCrcPortfolio(input: {
  format: 'CSV' | 'XML';
  layoutName: string;
  imfId?: string;
  performedBy?: string;
}) {
  const layout = (await db().crcExportLayout.findUnique({
    where: { name: input.layoutName },
  })) as AnyRecord | null;

  if (!layout) {
    throw new Error('CRC export layout not found.');
  }

  const loans = (await db().loanContract.findMany({
    where: input.imfId ? { imfId: input.imfId } : undefined,
    include: {
      imf: true,
      client: true,
      parties: true,
    },
    orderBy: { createdAt: 'desc' },
  })) as AnyRecord[];

  const rows = loans.map((loan) => ({
    imfCode: loan.imf ? String((loan.imf as AnyRecord).code) : '',
    imfName: loan.imf ? String((loan.imf as AnyRecord).name) : '',
    clientNuib: String((loan.client as AnyRecord).nuib ?? ''),
    clientName: String((loan.client as AnyRecord).name ?? ''),
    loanId: String(loan.id),
    status: String(loan.status),
    outstandingBalance: Number(loan.outstandingBalance ?? 0),
    totalPaid: Number(loan.totalPaid ?? 0),
    retentionUntil: loan.retentionUntil ? asDate(loan.retentionUntil).toISOString() : '',
    partiesCount: Array.isArray(loan.parties) ? loan.parties.length : 0,
  }));

  const fields = Array.isArray(layout.fields) ? (layout.fields as Array<{ key: string; label: string }>) : [];
  const fileText =
    input.format === 'CSV'
      ? serializeCsv(rows, fields)
      : serializeXml(rows, fields, String(layout.rootNode ?? 'crcReport'));

  await db().immutableRetentionLog.create({
    data: {
      eventType: 'CRC_EXPORT_GENERATED',
      payload: {
        format: input.format,
        layoutName: input.layoutName,
        performedBy: input.performedBy ?? null,
        rows: rows.length,
      },
    },
  });

  return {
    fileName: `crc-export-${input.layoutName.toLowerCase()}.${input.format.toLowerCase()}`,
    mimeType: input.format === 'CSV' ? 'text/csv' : 'application/xml',
    contentBase64: Buffer.from(fileText, 'utf8').toString('base64'),
    rows: rows.length,
  };
}

export async function generateSettlementLetter(input: { loanId: string; issuedBy?: string }) {
  const balance = await getLoanBalance(input.loanId);
  if (balance.summary.status !== 'PAID') {
    throw new Error('Settlement letter can only be issued after the loan is fully extinguished.');
  }

  const issuedAt = new Date();
  const retentionUntil = new Date(issuedAt);
  retentionUntil.setFullYear(retentionUntil.getFullYear() + 10);
  const lines = [
    'CoreBank - Carta de Quitacao',
    `Data de emissao: ${issuedAt.toISOString().slice(0, 10)}`,
    `Cliente: ${balance.client.name}`,
    `NUIB: ${balance.client.nuib ?? ''}`,
    `Contrato: ${balance.loan.id}`,
    `Estado: ${balance.summary.status}`,
    `Total pago: ${balance.summary.totalPaid}`,
    'Declaramos que o credito se encontra extinto e sem saldo em aberto.',
  ];

  const documentBase64 = buildSimplePdf(lines);
  const fileName = `quitacao-${balance.loan.id}.pdf`;
  const letter = await db().settlementLetter.create({
    data: {
      loanContractId: input.loanId,
      issuedBy: input.issuedBy ?? null,
      fileName,
      mimeType: 'application/pdf',
      documentBase64,
    },
  });

  await db().loanContract.update({
    where: { id: input.loanId },
    data: {
      crcReportedAt: issuedAt,
      retentionUntil,
    },
  });

  await db().immutableRetentionLog.create({
    data: {
      loanContractId: input.loanId,
      eventType: 'SETTLEMENT_LETTER_ISSUED',
      retentionUntil,
      payload: {
        issuedBy: input.issuedBy ?? null,
        letterId: letter.id,
      },
    },
  });

  return {
    id: String(letter.id),
    fileName,
    mimeType: 'application/pdf',
    documentBase64,
    issuedAt: issuedAt.toISOString(),
  };
}
