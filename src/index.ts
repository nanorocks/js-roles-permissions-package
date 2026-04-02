/**
 * Main package exports.
 *
 * @example
 * ```ts
 * import { PermissionManager, InMemoryCache } from '@yourorg/permissions';
 * ```
 */

export * from './types';
export * from './cache';
export * from './permission-manager';
export { PermissionManager as default } from './permission-manager';
