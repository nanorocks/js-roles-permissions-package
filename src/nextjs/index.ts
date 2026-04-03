/**
 * Next.js integration exports.
 *
 * @example
 * ```ts
 * import {
 *   PermissionProvider,
 *   useCan,
 *   useHasRole,
 *   Can,
 *   HasRole,
 *   Cannot,
 *   createPermissionMiddleware,
 *   requirePermission,
 *   requireRole,
 *   getUserPermissionsForClient,
 * } from '@yourorg/permissions/nextjs';
 * ```
 */

export * from './middleware';
export * from './hooks';
export * from './components';
