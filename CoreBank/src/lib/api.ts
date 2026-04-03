import type {
  ApiErrorShape,
  AiAnalysisResponse,
  AuthResponse,
  ClientListResponse,
  ClientStatementResponse,
  HealthResponse,
  LoanBalanceResponse,
  PortfolioOverview,
  ReminderSweepResponse
} from './types';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

async function request<T>(path: string, init?: RequestInit, token?: string): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {})
    }
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as ApiErrorShape;
    throw new Error(payload.message ?? payload.error ?? `Request failed with ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export function getHealth() {
  return request<HealthResponse>('/health');
}

export function login(email: string, password: string) {
  return request<AuthResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password })
  });
}

export function register(input: { name: string; email: string; password: string; role: string }) {
  return request<AuthResponse>('/auth/register', {
    method: 'POST',
    body: JSON.stringify(input)
  });
}

export function getPortfolio(token: string) {
  return request<PortfolioOverview>('/reports/portfolio', undefined, token);
}

export function getClients(token: string) {
  return request<ClientListResponse>('/clients', undefined, token);
}

export function createClient(
  token: string,
  input: { name: string; phone: string; email?: string; nationalId?: string; address?: string }
) {
  return request('/clients', { method: 'POST', body: JSON.stringify(input) }, token);
}

export function createLoan(
  token: string,
  input: {
    clientId: string;
    principal: number;
    annualInterestRate: number;
    installmentCount: number;
    startDate: string;
    graceDays: number;
    lateFeeRateDaily: number;
    currency: string;
  }
) {
  return request('/loans', { method: 'POST', body: JSON.stringify(input) }, token);
}

export function getLoanBalance(token: string, loanId: string) {
  return request<LoanBalanceResponse>(`/loans/${loanId}/balance`, undefined, token);
}

export function getClientStatement(token: string, clientId: string) {
  return request<ClientStatementResponse>(`/clients/${clientId}/statement`, undefined, token);
}

export function createPayment(
  token: string,
  input: { loanId: string; amount: number; paidAt?: string; reference?: string }
) {
  return request('/payments', { method: 'POST', body: JSON.stringify(input) }, token);
}

export function triggerAiAnalysis(token: string, input: { loanId: string; notes?: string }) {
  return request<AiAnalysisResponse>('/ai/analysis', { method: 'POST', body: JSON.stringify(input) }, token);
}

export function sendReminders(
  token: string,
  input: { dryRun?: boolean; overdueThresholdDays?: number; referenceDate?: string } = {}
) {
  return request<ReminderSweepResponse>('/reminders/send', { method: 'POST', body: JSON.stringify(input) }, token);
}
