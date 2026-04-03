export interface AuthResponse {
  authenticated: boolean;
  token: string;
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
}

export interface ClientRecord {
  id: string;
  name: string;
  phone: string;
  email?: string | null;
  nationalId?: string | null;
  address?: string | null;
}

export interface ClientListResponse {
  items: Array<
    ClientRecord & {
      loans?: Array<{
        id: string;
        status: string;
        outstandingBalance?: number;
      }>;
    }
  >;
}

export interface PortfolioOverview {
  totalPrincipal: number;
  totalOutstanding: number;
  totalLateFees: number;
  totalContracts: number;
  totalInstallments: number;
}

export interface AiAnalysisResponse {
  provider: string;
  model: string;
  usedFallback?: boolean;
  analysis: string;
  prompt?: string;
}

export interface ReminderSweepResponse {
  count: number;
  items: Array<{
    loanContractId: string;
    channel: string;
    message: string;
    status: string;
  }>;
}

export interface LoanBalanceResponse {
  loan: {
    id: string;
    clientId: string;
    status: string;
    currency: string;
  };
  summary: {
    status: string;
    totalContractValue: number;
    totalPaid: number;
    outstandingBalance: number;
    remainingContractValue: number;
    installmentsOverdue: number;
    installmentsOpen: number;
    longestDelayDays: number;
  };
  schedule: Array<{
    installmentNumber: number;
    dueDate: string;
    remainingToPay: number;
    paidAmount: number;
    status: string;
    daysLate: number;
  }>;
}

export interface ClientStatementResponse {
  client: ClientRecord;
  loans: LoanBalanceResponse[];
  summary: {
    totalContracts: number;
    totalOutstanding: number;
    totalPaid: number;
    overdueContracts: number;
  };
}

export interface ApiErrorShape {
  message?: string;
  error?: string;
}

export interface HealthResponse {
  ok: boolean;
  uptime: number;
  timestamp: string;
  api: {
    active: boolean;
    state: 'online' | 'offline';
  };
  worker: {
    active: boolean;
    state: 'online' | 'offline';
    lastHeartbeatAt: string | null;
    staleMs: number | null;
    pid?: number;
    source?: string;
  };
}
