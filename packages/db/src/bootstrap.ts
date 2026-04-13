import { prisma } from './client.js';

const schemaStatements = [
  `DO $$
  BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'RoleCode') THEN
      CREATE TYPE "RoleCode" AS ENUM ('ADMIN', 'MANAGER', 'OFFICER');
    END IF;
  END $$;`,
  `DO $$
  BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'LoanStatus') THEN
      CREATE TYPE "LoanStatus" AS ENUM ('ACTIVE', 'AT_RISK', 'DELINQUENT', 'PAID', 'RESTRUCTURED');
    END IF;
  END $$;`,
  `DO $$
  BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'InstallmentStatus') THEN
      CREATE TYPE "InstallmentStatus" AS ENUM ('PENDING', 'AT_RISK', 'PARTIAL', 'OVERDUE', 'PAID', 'RESTRUCTURED');
    END IF;
  END $$;`,
  `DO $$
  BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ReminderStatus') THEN
      CREATE TYPE "ReminderStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'CANCELLED');
    END IF;
  END $$;`,
  `DO $$
  BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ReminderChannel') THEN
      CREATE TYPE "ReminderChannel" AS ENUM ('EMAIL', 'SMS', 'WHATSAPP', 'INTERNAL');
    END IF;
  END $$;`,
  `DO $$
  BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'LoanPartyRole') THEN
      CREATE TYPE "LoanPartyRole" AS ENUM ('BORROWER', 'AVALIST', 'GUARANTOR');
    END IF;
  END $$;`,
  `DO $$
  BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CrcCaseStatus') THEN
      CREATE TYPE "CrcCaseStatus" AS ENUM ('OPEN', 'CORRECTED', 'CLOSED', 'EXPIRED');
    END IF;
  END $$;`,
  `DO $$
  BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CrcExportFormat') THEN
      CREATE TYPE "CrcExportFormat" AS ENUM ('CSV', 'XML');
    END IF;
  END $$;`,
  `CREATE TABLE IF NOT EXISTS "imf_institutions" (
    "id" TEXT PRIMARY KEY,
    "code" TEXT NOT NULL UNIQUE,
    "name" TEXT NOT NULL,
    "nuib" TEXT NOT NULL UNIQUE,
    "email" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT TRUE,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );`,
  `CREATE TABLE IF NOT EXISTS "roles" (
    "id" TEXT PRIMARY KEY,
    "code" "RoleCode" NOT NULL UNIQUE,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );`,
  `CREATE TABLE IF NOT EXISTS "users" (
    "id" TEXT PRIMARY KEY,
    "roleId" TEXT,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL UNIQUE,
    "passwordHash" TEXT NOT NULL,
    "role" "RoleCode" NOT NULL DEFAULT 'OFFICER',
    "lastActiveAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT "users_roleId_fkey"
      FOREIGN KEY ("roleId")
      REFERENCES "roles"("id")
      ON DELETE SET NULL
      ON UPDATE CASCADE
  );`,
  `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "lastActiveAt" TIMESTAMPTZ;`,
  `CREATE TABLE IF NOT EXISTS "clients" (
    "id" TEXT PRIMARY KEY,
    "name" TEXT NOT NULL,
    "nuib" TEXT UNIQUE,
    "phone" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "nationalId" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "kycStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "documentType" TEXT NOT NULL DEFAULT 'MOZ_ID',
    "documentAuthentic" BOOLEAN NOT NULL DEFAULT FALSE,
    "documentFormatValid" BOOLEAN NOT NULL DEFAULT FALSE,
    "documentCheckedAt" TIMESTAMPTZ,
    "phoneVerified" BOOLEAN NOT NULL DEFAULT FALSE,
    "emailVerified" BOOLEAN NOT NULL DEFAULT FALSE,
    "addressVerified" BOOLEAN NOT NULL DEFAULT FALSE,
    "crcConsentAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );`,
  `ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "nuib" TEXT;`,
  `ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "email" TEXT;`,
  `ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "nationalId" TEXT;`,
  `ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "address" TEXT;`,
  `ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "kycStatus" TEXT NOT NULL DEFAULT 'PENDING';`,
  `ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "documentType" TEXT NOT NULL DEFAULT 'MOZ_ID';`,
  `ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "documentAuthentic" BOOLEAN NOT NULL DEFAULT FALSE;`,
  `ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "documentFormatValid" BOOLEAN NOT NULL DEFAULT FALSE;`,
  `ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "documentCheckedAt" TIMESTAMPTZ;`,
  `ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "phoneVerified" BOOLEAN NOT NULL DEFAULT FALSE;`,
  `ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "emailVerified" BOOLEAN NOT NULL DEFAULT FALSE;`,
  `ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "addressVerified" BOOLEAN NOT NULL DEFAULT FALSE;`,
  `ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "crcConsentAt" TIMESTAMPTZ;`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "clients_nuib_key" ON "clients" ("nuib");`,
  `CREATE TABLE IF NOT EXISTS "loan_contracts" (
    "id" TEXT PRIMARY KEY,
    "imfId" TEXT,
    "clientId" TEXT NOT NULL,
    "principal" DOUBLE PRECISION NOT NULL,
    "annualInterestRate" DOUBLE PRECISION NOT NULL,
    "installmentCount" INTEGER NOT NULL,
    "startDate" TIMESTAMPTZ NOT NULL,
    "graceDays" INTEGER NOT NULL DEFAULT 0,
    "lateFeeRateDaily" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'MZN',
    "status" "LoanStatus" NOT NULL DEFAULT 'ACTIVE',
    "totalContractValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalPaid" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "outstandingBalance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "longestDelayDays" INTEGER NOT NULL DEFAULT 0,
    "extinguishedAt" TIMESTAMPTZ,
    "crcReportedAt" TIMESTAMPTZ,
    "retentionUntil" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT "loan_contracts_imfId_fkey"
      FOREIGN KEY ("imfId")
      REFERENCES "imf_institutions"("id")
      ON DELETE SET NULL
      ON UPDATE CASCADE,
    CONSTRAINT "loan_contracts_clientId_fkey"
      FOREIGN KEY ("clientId")
      REFERENCES "clients"("id")
      ON DELETE RESTRICT
      ON UPDATE CASCADE
  );`,
  `ALTER TABLE "loan_contracts" ADD COLUMN IF NOT EXISTS "imfId" TEXT;`,
  `ALTER TABLE "loan_contracts" ADD COLUMN IF NOT EXISTS "extinguishedAt" TIMESTAMPTZ;`,
  `ALTER TABLE "loan_contracts" ADD COLUMN IF NOT EXISTS "crcReportedAt" TIMESTAMPTZ;`,
  `ALTER TABLE "loan_contracts" ADD COLUMN IF NOT EXISTS "retentionUntil" TIMESTAMPTZ;`,
  `CREATE TABLE IF NOT EXISTS "installment_plans" (
    "id" TEXT PRIMARY KEY,
    "loanContractId" TEXT NOT NULL UNIQUE,
    "version" INTEGER NOT NULL DEFAULT 1,
    "source" TEXT NOT NULL DEFAULT 'INITIAL',
    "schedulePayload" JSONB NOT NULL,
    "generatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT "installment_plans_loanContractId_fkey"
      FOREIGN KEY ("loanContractId")
      REFERENCES "loan_contracts"("id")
      ON DELETE RESTRICT
      ON UPDATE CASCADE
  );`,
  `CREATE TABLE IF NOT EXISTS "installments" (
    "id" TEXT PRIMARY KEY,
    "loanContractId" TEXT NOT NULL,
    "installmentNo" INTEGER NOT NULL,
    "dueDate" TIMESTAMPTZ NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "principal" DOUBLE PRECISION NOT NULL,
    "interest" DOUBLE PRECISION NOT NULL,
    "paidAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lateFee" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "remainingToPay" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "daysLate" INTEGER NOT NULL DEFAULT 0,
    "status" "InstallmentStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT "installments_loanContractId_fkey"
      FOREIGN KEY ("loanContractId")
      REFERENCES "loan_contracts"("id")
      ON DELETE RESTRICT
      ON UPDATE CASCADE,
    CONSTRAINT "installments_loanContractId_installmentNo_key"
      UNIQUE ("loanContractId", "installmentNo")
  );`,
  `CREATE TABLE IF NOT EXISTS "payments" (
    "id" TEXT PRIMARY KEY,
    "loanContractId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "paidAt" TIMESTAMPTZ NOT NULL,
    "reference" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT "payments_loanContractId_fkey"
      FOREIGN KEY ("loanContractId")
      REFERENCES "loan_contracts"("id")
      ON DELETE RESTRICT
      ON UPDATE CASCADE
  );`,
  `CREATE TABLE IF NOT EXISTS "reminders" (
    "id" TEXT PRIMARY KEY,
    "loanContractId" TEXT NOT NULL,
    "channel" "ReminderChannel" NOT NULL,
    "message" TEXT NOT NULL,
    "scheduledAt" TIMESTAMPTZ NOT NULL,
    "sentAt" TIMESTAMPTZ,
    "status" "ReminderStatus" NOT NULL DEFAULT 'PENDING',
    "metadata" JSONB,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT "reminders_loanContractId_fkey"
      FOREIGN KEY ("loanContractId")
      REFERENCES "loan_contracts"("id")
      ON DELETE RESTRICT
      ON UPDATE CASCADE
  );`,
  `CREATE TABLE IF NOT EXISTS "audit_logs" (
    "id" TEXT PRIMARY KEY,
    "entity" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityId" TEXT,
    "payload" JSONB,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );`,
  `CREATE TABLE IF NOT EXISTS "loan_parties" (
    "id" TEXT PRIMARY KEY,
    "loanContractId" TEXT NOT NULL,
    "clientId" TEXT,
    "role" "LoanPartyRole" NOT NULL,
    "name" TEXT NOT NULL,
    "nuib" TEXT NOT NULL,
    "nationalId" TEXT,
    "phone" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT "loan_parties_loanContractId_fkey"
      FOREIGN KEY ("loanContractId")
      REFERENCES "loan_contracts"("id")
      ON DELETE RESTRICT
      ON UPDATE CASCADE,
    CONSTRAINT "loan_parties_clientId_fkey"
      FOREIGN KEY ("clientId")
      REFERENCES "clients"("id")
      ON DELETE SET NULL
      ON UPDATE CASCADE
  );`,
  `CREATE TABLE IF NOT EXISTS "immutable_retention_logs" (
    "id" TEXT PRIMARY KEY,
    "loanContractId" TEXT,
    "eventType" TEXT NOT NULL,
    "retentionUntil" TIMESTAMPTZ,
    "payload" JSONB,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT "immutable_retention_logs_loanContractId_fkey"
      FOREIGN KEY ("loanContractId")
      REFERENCES "loan_contracts"("id")
      ON DELETE SET NULL
      ON UPDATE CASCADE
  );`,
  `CREATE TABLE IF NOT EXISTS "settlement_letters" (
    "id" TEXT PRIMARY KEY,
    "loanContractId" TEXT NOT NULL,
    "issuedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "issuedBy" TEXT,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "documentBase64" TEXT NOT NULL,
    CONSTRAINT "settlement_letters_loanContractId_fkey"
      FOREIGN KEY ("loanContractId")
      REFERENCES "loan_contracts"("id")
      ON DELETE RESTRICT
      ON UPDATE CASCADE
  );`,
  `CREATE TABLE IF NOT EXISTS "crc_rectification_cases" (
    "id" TEXT PRIMARY KEY,
    "clientId" TEXT NOT NULL,
    "loanContractId" TEXT,
    "reason" TEXT NOT NULL,
    "requestedByClientAt" TIMESTAMPTZ,
    "institutionDetectedAt" TIMESTAMPTZ,
    "clientDueAt" TIMESTAMPTZ,
    "spontaneousDueAt" TIMESTAMPTZ,
    "status" "CrcCaseStatus" NOT NULL DEFAULT 'OPEN',
    "resolvedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT "crc_rectification_cases_clientId_fkey"
      FOREIGN KEY ("clientId")
      REFERENCES "clients"("id")
      ON DELETE RESTRICT
      ON UPDATE CASCADE
  );`,
  `CREATE TABLE IF NOT EXISTS "crc_consultation_logs" (
    "id" TEXT PRIMARY KEY,
    "clientId" TEXT NOT NULL,
    "performedBy" TEXT,
    "charged" BOOLEAN NOT NULL DEFAULT TRUE,
    "queryCount" INTEGER NOT NULL DEFAULT 1,
    "responseRef" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT "crc_consultation_logs_clientId_fkey"
      FOREIGN KEY ("clientId")
      REFERENCES "clients"("id")
      ON DELETE RESTRICT
      ON UPDATE CASCADE
  );`,
  `CREATE TABLE IF NOT EXISTS "crc_export_layouts" (
    "id" TEXT PRIMARY KEY,
    "name" TEXT NOT NULL UNIQUE,
    "format" "CrcExportFormat" NOT NULL,
    "fields" JSONB NOT NULL,
    "rootNode" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT TRUE,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );`,
  `CREATE TABLE IF NOT EXISTS "ai_events" (
    "id" TEXT PRIMARY KEY,
    "loanContractId" TEXT,
    "eventType" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "inputPayload" JSONB,
    "outputPayload" JSONB,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT "ai_events_loanContractId_fkey"
      FOREIGN KEY ("loanContractId")
      REFERENCES "loan_contracts"("id")
      ON DELETE SET NULL
      ON UPDATE CASCADE
  );`,
  `INSERT INTO "roles" ("id", "code", "name", "description")
   VALUES
    ('role_admin', 'ADMIN', 'Administrator', 'System administration'),
    ('role_manager', 'MANAGER', 'Manager', 'Portfolio and collections management'),
    ('role_officer', 'OFFICER', 'Officer', 'Credit and field operations')
   ON CONFLICT ("code") DO NOTHING;`,
  `INSERT INTO "imf_institutions" ("id", "code", "name", "nuib", "email", "active")
   VALUES ('imf_default', 'DEFAULT_IMF', 'Default IMF', '100000000000001', 'ops@admincorebank.co.mz', TRUE)
   ON CONFLICT ("code") DO NOTHING;`,
  `INSERT INTO "crc_export_layouts" ("id", "name", "format", "fields", "rootNode", "active")
   VALUES
   (
     'crc_layout_csv_default',
     'default_csv',
     'CSV',
     '[{"key":"imfCode","label":"IMF_CODE"},{"key":"clientNuib","label":"CLIENT_NUIB"},{"key":"clientName","label":"CLIENT_NAME"},{"key":"loanId","label":"LOAN_ID"},{"key":"status","label":"STATUS"},{"key":"outstandingBalance","label":"OUTSTANDING_BALANCE"}]'::jsonb,
     NULL,
     TRUE
   ),
   (
     'crc_layout_xml_default',
     'default_xml',
     'XML',
     '[{"key":"imfCode","label":"imfCode"},{"key":"clientNuib","label":"clientNuib"},{"key":"clientName","label":"clientName"},{"key":"loanId","label":"loanId"},{"key":"status","label":"status"},{"key":"outstandingBalance","label":"outstandingBalance"}]'::jsonb,
     'crcReport',
     TRUE
   )
   ON CONFLICT ("name") DO NOTHING;`,
];

let bootstrapPromise: Promise<void> | null = null;

export function ensureCoreSchema() {
  if (!bootstrapPromise) {
    bootstrapPromise = (async () => {
      for (const statement of schemaStatements) {
        await prisma.$executeRawUnsafe(statement);
      }
    })();
  }

  return bootstrapPromise;
}
