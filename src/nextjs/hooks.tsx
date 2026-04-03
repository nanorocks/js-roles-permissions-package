'use client';

/**
 * React hooks for client-side permission checks.
 *
 * Wrap your application (or layout) with <PermissionProvider> and then use
 * the hooks in any client component.
 *
 * @example
 * ```tsx
 * // layout.tsx (Server Component)
 * import { PermissionProvider } from '@yourorg/permissions/nextjs';
 *
 * export default async function Layout({ children }) {
 *   const { permissions, roles } = await getUserPermissionsForClient(manager, userId);
 *   return (
 *     <PermissionProvider permissions={permissions} roles={roles}>
 *       {children}
 *     </PermissionProvider>
 *   );
 * }
 * ```
 */

import React, { createContext, useContext, useMemo } from 'react';

// ─── Context ──────────────────────────────────────────────────────────────────

export interface PermissionContextValue {
  /** All permission names available to the current user */
  permissions: string[];
  /** All role names assigned to the current user */
  roles: string[];
  /**
   * Check if the user has the given permission(s).
   * @param permission - Single permission or an array
   * @param requireAll - If true, user must have ALL permissions; default is ANY
   */
  can: (permission: string | string[], requireAll?: boolean) => boolean;
  /**
   * Check if the user has the given role(s).
   * @param role - Single role or an array
   * @param requireAll - If true, user must have ALL roles; default is ANY
   */
  hasRole: (role: string | string[], requireAll?: boolean) => boolean;
}

const PermissionContext = createContext<PermissionContextValue | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

export interface PermissionProviderProps {
  permissions: string[];
  roles: string[];
  children: React.ReactNode;
}

/**
 * Provides permission context to the React component tree.
 */
export function PermissionProvider({
  permissions,
  roles,
  children,
}: PermissionProviderProps): React.ReactElement {
  const value = useMemo<PermissionContextValue>(() => {
    const can = (permission: string | string[], requireAll = false): boolean => {
      const perms = Array.isArray(permission) ? permission : [permission];
      if (requireAll) return perms.every((p) => permissions.includes(p));
      return perms.some((p) => permissions.includes(p));
    };

    const hasRole = (role: string | string[], requireAll = false): boolean => {
      const roleList = Array.isArray(role) ? role : [role];
      if (requireAll) return roleList.every((r) => roles.includes(r));
      return roleList.some((r) => roles.includes(r));
    };

    return { permissions, roles, can, hasRole };
  }, [permissions, roles]);

  return React.createElement(PermissionContext.Provider, { value }, children);
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

/**
 * Returns the full permission context.
 * Must be used inside a <PermissionProvider>.
 */
export function usePermissions(): PermissionContextValue {
  const ctx = useContext(PermissionContext);
  if (!ctx) {
    throw new Error('usePermissions must be used inside a <PermissionProvider>');
  }
  return ctx;
}

/**
 * Returns true if the current user has the given permission(s).
 *
 * @param permission - Permission name or array of names
 * @param requireAll - If true, user must have ALL permissions (default: ANY)
 */
export function useCan(permission: string | string[], requireAll = false): boolean {
  const { can } = usePermissions();
  return can(permission, requireAll);
}

/**
 * Returns true if the current user has the given role(s).
 *
 * @param role - Role name or array of names
 * @param requireAll - If true, user must have ALL roles (default: ANY)
 */
export function useHasRole(role: string | string[], requireAll = false): boolean {
  const { hasRole } = usePermissions();
  return hasRole(role, requireAll);
}
