export type Role = 'ADMIN' | 'MANAGER' | 'OFFICER';

const permissions: Record<Role, string[]> = {
  ADMIN: ['*'],
  MANAGER: ['clients:read', 'clients:write', 'loans:read', 'loans:write', 'payments:read', 'payments:write'],
  OFFICER: ['clients:read', 'clients:write', 'loans:read', 'payments:read', 'payments:write']
};

export function can(role: Role, permission: string) {
  return permissions[role].includes('*') || permissions[role].includes(permission);
}
