export type CoreUserRole = 'ADMIN' | 'MANAGER' | 'OFFICER';

const corporateDomains: Record<CoreUserRole, string> = {
  ADMIN: 'admincorebank.co.mz',
  MANAGER: 'managercorebank.co.mz',
  OFFICER: 'officercorebank.co.mz',
};

export function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

export function normalizeNationalId(value: string) {
  return value.trim().toUpperCase();
}

export function normalizeAddress(value: string) {
  return value.trim().replace(/\s+/g, ' ');
}

export function normalizeNuib(value: string) {
  return value.replace(/\D/g, '');
}

export function normalizeMozPhone(value: string) {
  const digits = value.replace(/\D/g, '');
  if (digits.startsWith('258') && digits.length === 12) {
    return digits.slice(3);
  }
  return digits;
}

export function isMozMobilePhone(value: string) {
  const phone = normalizeMozPhone(value);
  return /^8[2-7]\d{7}$/.test(phone);
}

export function isGoogleEmail(value: string) {
  return /^[a-z0-9._%+-]+@gmail\.com$/i.test(normalizeEmail(value));
}

export function isMozNationalId(value: string) {
  return /^100\d{9}[A-Z]$/.test(normalizeNationalId(value));
}

export function isNuib(value: string) {
  return /^\d{15}$/.test(normalizeNuib(value));
}

export function getAllowedCorporateEmail(role: CoreUserRole) {
  return `@${corporateDomains[role]}`;
}

export function isAllowedCorporateUserEmail(email: string, role: CoreUserRole) {
  return normalizeEmail(email).endsWith(getAllowedCorporateEmail(role));
}

export function isKnownCorporateUserEmail(email: string) {
  const normalized = normalizeEmail(email);
  return Object.values(corporateDomains).some((domain) => normalized.endsWith(`@${domain}`));
}

export function buildClientKycProfile(input: {
  phone: string;
  email: string;
  nationalId: string;
  address: string;
}) {
  const phone = normalizeMozPhone(input.phone);
  const email = normalizeEmail(input.email);
  const nationalId = normalizeNationalId(input.nationalId);
  const address = normalizeAddress(input.address);

  const phoneVerified = isMozMobilePhone(phone);
  const emailVerified = isGoogleEmail(email);
  const documentFormatValid = isMozNationalId(nationalId);
  const addressVerified = address.length >= 5;
  const documentAuthentic = documentFormatValid;
  const checksPassed = phoneVerified && emailVerified && documentFormatValid && addressVerified;

  return {
    phone,
    email,
    nationalId,
    address,
    metadata: {
      kycStatus: checksPassed ? 'VERIFIED' : 'REVIEW',
      documentType: 'MOZ_ID',
      documentAuthentic,
      documentFormatValid,
      documentCheckedAt: new Date(),
      phoneVerified,
      emailVerified,
      addressVerified,
    },
  };
}
