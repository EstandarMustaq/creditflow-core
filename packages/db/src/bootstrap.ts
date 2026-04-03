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
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT "users_roleId_fkey"
      FOREIGN KEY ("roleId")
      REFERENCES "roles"("id")
      ON DELETE SET NULL
      ON UPDATE CASCADE
  );`,
  `CREATE TABLE IF NOT EXISTS "clients" (
    "id" TEXT PRIMARY KEY,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "nationalId" TEXT,
    "address" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );`,
  `CREATE TABLE IF NOT EXISTS "loan_contracts" (
    "id" TEXT PRIMARY KEY,
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
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT "loan_contracts_clientId_fkey"
      FOREIGN KEY ("clientId")
      REFERENCES "clients"("id")
      ON DELETE RESTRICT
      ON UPDATE CASCADE
  );`,
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
