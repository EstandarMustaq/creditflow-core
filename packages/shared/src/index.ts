export type Money = number;

export type LoanStatus = 'ACTIVE' | 'AT_RISK' | 'PAID' | 'DELINQUENT' | 'RESTRUCTURED';

export interface ApiResult<T> {
  ok: boolean;
  data?: T;
  error?: string;
}
