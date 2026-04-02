/**
 * Next.js middleware utilities for permission-based route protection.
 *
 * @example
 * ```ts
 * // middleware.ts (project root)
 * import { NextRequest } from 'next/server';
 * import { createPermissionMiddleware } from '@yourorg/permissions/nextjs';
 *
 * const withPermission = createPermissionMiddleware(permissionManager, async (req) => {
 *   const session = await getSession(req);
 *   return session?.user ?? null;
 * });
 *
 * export const middleware = withPermission({ permissions: ['dashboard.view'] });
 * ```
 */

import type { PermissionManager } from '../permission-manager';

/**
 * A minimal representation of the authenticated user returned from `getUserFromRequest`.
 */
export interface AuthUser {
  id: string;
  teamId?: string;
}

/**
 * Configuration for an individual middleware protection rule.
 */
export interface MiddlewareConfig {
  /** Required permissions (OR logic by default) */
  permissions?: string[];
  /** Required roles (OR logic by default) */
  roles?: string[];
  /** If true, the user must satisfy ALL permissions and ALL roles */
  requireAll?: boolean;
  /** Redirect URL when unauthenticated (defaults to '/login') */
  loginRedirect?: string;
  /** Redirect URL when unauthorized (defaults to '/unauthorized') */
  unauthorizedRedirect?: string;
  /** Team ID for team-scoped checks */
  teamId?: string;
}

// Import Next.js types lazily so this file compiles without 'next' installed
type NextRequest = import('next/server').NextRequest;
type NextResponse = import('next/server').NextResponse;

type GetUserFn = (req: NextRequest) => Promise<AuthUser | null>;
type MiddlewareFn = (req: NextRequest) => Promise<NextResponse>;

/**
 * Creates a permission middleware factory.
 *
 * @param manager - PermissionManager instance
 * @param getUserFromRequest - Function that resolves the current user from the request
 * @returns A factory function that creates route protection middleware
 */
export function createPermissionMiddleware(
  manager: PermissionManager,
  getUserFromRequest: GetUserFn
): (config: MiddlewareConfig) => MiddlewareFn {
  return (config: MiddlewareConfig): MiddlewareFn => {
    return async (req: NextRequest): Promise<NextResponse> => {
      // Dynamic import to avoid hard dependency on 'next'
      const { NextResponse } = await import('next/server');

      const user = await getUserFromRequest(req);

      if (!user) {
        const loginUrl = config.loginRedirect ?? '/login';
        return NextResponse.redirect(new URL(loginUrl, req.url));
      }

      const teamId = config.teamId ?? user.teamId;
      const options = { requireAll: config.requireAll ?? false, teamId };

      // Check permissions
      if (config.permissions && config.permissions.length > 0) {
        const allowed = await manager.can(user.id, config.permissions, options);
        if (!allowed) {
          const unauthorizedUrl = config.unauthorizedRedirect ?? '/unauthorized';
          return NextResponse.redirect(new URL(unauthorizedUrl, req.url));
        }
      }

      // Check roles
      if (config.roles && config.roles.length > 0) {
        const hasRole = await manager.hasRole(user.id, config.roles, options);
        if (!hasRole) {
          const unauthorizedUrl = config.unauthorizedRedirect ?? '/unauthorized';
          return NextResponse.redirect(new URL(unauthorizedUrl, req.url));
        }
      }

      return NextResponse.next();
    };
  };
}

/**
 * Server-action helper — throws if the user does not have the required permission.
 *
 * @param manager - PermissionManager instance
 * @param userId - Current user ID
 * @param permission - Permission name(s) to check
 * @param options - Optional check options
 *
 * @throws {Error} when the user lacks the required permission
 */
export async function requirePermission(
  manager: PermissionManager,
  userId: string,
  permission: string | string[],
  options?: { requireAll?: boolean; teamId?: string }
): Promise<void> {
  const allowed = await manager.can(userId, permission, options);
  if (!allowed) {
    throw new Error(
      `Unauthorized: missing permission "${Array.isArray(permission) ? permission.join(', ') : permission}"`
    );
  }
}

/**
 * Server-action helper — throws if the user does not have the required role.
 *
 * @param manager - PermissionManager instance
 * @param userId - Current user ID
 * @param role - Role name(s) to check
 * @param options - Optional check options
 *
 * @throws {Error} when the user lacks the required role
 */
export async function requireRole(
  manager: PermissionManager,
  userId: string,
  role: string | string[],
  options?: { requireAll?: boolean; teamId?: string }
): Promise<void> {
  const allowed = await manager.hasRole(userId, role, options);
  if (!allowed) {
    throw new Error(
      `Unauthorized: missing role "${Array.isArray(role) ? role.join(', ') : role}"`
    );
  }
}

/**
 * Returns a serializable object with the user's permissions and roles.
 * Useful for passing data from Server Components to the PermissionProvider.
 *
 * @param manager - PermissionManager instance
 * @param userId - Current user ID
 * @param teamId - Optional team scope
 */
export async function getUserPermissionsForClient(
  manager: PermissionManager,
  userId: string,
  teamId?: string
): Promise<{ permissions: string[]; roles: string[] }> {
  const [userPerms, userRoles] = await Promise.all([
    manager.getUserPermissions(userId, { teamId }),
    manager.getUserRoles(userId, teamId),
  ]);
  return {
    permissions: userPerms.map((p) => p.name),
    roles: userRoles.map((r) => r.name),
  };
}
