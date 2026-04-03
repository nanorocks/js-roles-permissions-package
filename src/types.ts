/**
 * Core TypeScript interfaces and types for the permissions package.
 */

/**
 * Represents a permission that can be assigned to a role or user directly.
 */
export interface Permission {
  /** UUID identifier */
  id: string;
  /** Permission name, e.g. 'posts.edit' */
  name: string;
  /** Guard name, e.g. 'web' or 'api' */
  guardName: string;
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * Represents a role that groups permissions together.
 */
export interface Role {
  /** UUID identifier */
  id: string;
  /** Role name, e.g. 'admin' */
  name: string;
  /** Guard name, e.g. 'web' or 'api' */
  guardName: string;
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * Options for permission/role checks.
 */
export interface PermissionCheckOptions {
  /** Guard context for permission checks */
  guardName?: string;
  /** Team ID for team-scoped checks */
  teamId?: string;
  /** If true, user must have ALL listed permissions/roles; otherwise ANY is sufficient */
  requireAll?: boolean;
}

/**
 * Abstract adapter interface that must be implemented for each ORM.
 * All methods are async and return Promises.
 */
export interface PermissionAdapter {
  // ─── Permission CRUD ───────────────────────────────────────────────

  /** Create a new permission record */
  createPermission(name: string, guardName: string): Promise<Permission>;

  /** Find a permission by name and guard */
  findPermission(name: string, guardName: string): Promise<Permission | null>;

  /** Find a permission by its ID */
  findPermissionById(id: string): Promise<Permission | null>;

  /** Delete a permission by ID */
  deletePermission(permissionId: string): Promise<void>;

  /** List all permissions */
  getAllPermissions(): Promise<Permission[]>;

  // ─── Role CRUD ─────────────────────────────────────────────────────

  /** Create a new role record */
  createRole(name: string, guardName: string): Promise<Role>;

  /** Find a role by name and guard */
  findRole(name: string, guardName: string): Promise<Role | null>;

  /** Find a role by its ID */
  findRoleById(id: string): Promise<Role | null>;

  /** Delete a role by ID */
  deleteRole(roleId: string): Promise<void>;

  /** List all roles */
  getAllRoles(): Promise<Role[]>;

  // ─── User ↔ Permission ─────────────────────────────────────────────

  /** Grant a direct permission to a user (model) */
  givePermissionToUser(
    userId: string,
    permissionId: string,
    modelType: string
  ): Promise<void>;

  /** Revoke a direct permission from a user */
  revokePermissionFromUser(
    userId: string,
    permissionId: string,
    modelType: string
  ): Promise<void>;

  /** Replace all direct permissions for a user */
  syncUserPermissions(
    userId: string,
    permissionIds: string[],
    modelType: string
  ): Promise<void>;

  /** Get all direct permissions for a user */
  getUserDirectPermissions(
    userId: string,
    modelType: string
  ): Promise<Permission[]>;

  // ─── User ↔ Role ───────────────────────────────────────────────────

  /** Assign a role to a user, optionally scoped to a team */
  assignRoleToUser(
    userId: string,
    roleId: string,
    modelType: string,
    teamId?: string
  ): Promise<void>;

  /** Remove a role from a user */
  removeRoleFromUser(
    userId: string,
    roleId: string,
    modelType: string,
    teamId?: string
  ): Promise<void>;

  /** Replace all roles for a user */
  syncUserRoles(
    userId: string,
    roleIds: string[],
    modelType: string,
    teamId?: string
  ): Promise<void>;

  /** Get all roles for a user */
  getUserRoles(userId: string, modelType: string, teamId?: string): Promise<Role[]>;

  // ─── Role ↔ Permission ─────────────────────────────────────────────

  /** Grant a permission to a role */
  givePermissionToRole(roleId: string, permissionId: string): Promise<void>;

  /** Revoke a permission from a role */
  revokePermissionFromRole(roleId: string, permissionId: string): Promise<void>;

  /** Replace all permissions for a role */
  syncRolePermissions(roleId: string, permissionIds: string[]): Promise<void>;

  /** Get all permissions assigned directly to a role */
  getRolePermissions(roleId: string): Promise<Permission[]>;

  // ─── Combined queries ──────────────────────────────────────────────

  /**
   * Get all permissions a user has, both direct and inherited through roles.
   * Should avoid duplicates.
   */
  getAllUserPermissions(
    userId: string,
    modelType: string,
    teamId?: string
  ): Promise<Permission[]>;

  /** Get only the permissions a user has through their roles */
  getUserPermissionsViaRoles(
    userId: string,
    modelType: string,
    teamId?: string
  ): Promise<Permission[]>;
}

/**
 * Cache interface for storing permission results.
 * Implement this interface to add custom cache backends (e.g. Redis).
 */
export interface PermissionCache {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  get(key: string): Promise<any | null>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  set(key: string, value: any, ttl?: number): Promise<void>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;
}

/**
 * Configuration object passed to PermissionManager.
 */
export interface PermissionConfig {
  /** ORM adapter to use for database operations */
  adapter: PermissionAdapter;
  /** Optional cache implementation */
  cache?: PermissionCache;
  /** Default guard name (defaults to 'web') */
  defaultGuard?: string;
  /** Model type string stored in the database (e.g. 'User') */
  modelType: string;
  /** Enable team/multi-tenancy support */
  enableTeams?: boolean;
  /** Enable wildcard permission matching (e.g. 'posts.*') */
  enableWildcards?: boolean;
  /** Role name that bypasses all permission checks */
  superAdminRole?: string;
  /** Default cache TTL in seconds */
  cacheTtl?: number;
}
