import type {
  Permission,
  PermissionCache,
  PermissionCheckOptions,
  PermissionConfig,
  Role,
} from './types';

/**
 * Main class for managing roles and permissions.
 *
 * Inspired by Spatie Laravel Permission, this class provides a fluent API
 * for CRUD operations, assignment, and checking of roles and permissions.
 *
 * @example
 * ```ts
 * const manager = new PermissionManager({
 *   adapter: new DrizzleAdapter(db),
 *   modelType: 'User',
 *   enableWildcards: true,
 *   superAdminRole: 'super-admin',
 * });
 * ```
 */
export class PermissionManager {
  private readonly adapter: PermissionConfig['adapter'];
  private readonly cache: PermissionCache | undefined;
  private readonly defaultGuard: string;
  private readonly modelType: string;
  private readonly enableTeams: boolean;
  private readonly enableWildcards: boolean;
  private readonly superAdminRole: string;
  private readonly cacheTtl: number;

  constructor(config: PermissionConfig) {
    this.adapter = config.adapter;
    this.cache = config.cache;
    this.defaultGuard = config.defaultGuard ?? 'web';
    this.modelType = config.modelType;
    this.enableTeams = config.enableTeams ?? false;
    this.enableWildcards = config.enableWildcards ?? false;
    this.superAdminRole = config.superAdminRole ?? 'super-admin';
    this.cacheTtl = config.cacheTtl ?? 3600;
  }

  // ─── Permission CRUD ───────────────────────────────────────────────────────

  /**
   * Create a new permission.
   *
   * @param name - Permission name, e.g. 'posts.edit'
   * @param guardName - Guard context (defaults to defaultGuard)
   */
  async createPermission(name: string, guardName?: string): Promise<Permission> {
    return this.adapter.createPermission(name, guardName ?? this.defaultGuard);
  }

  /**
   * Find a permission by name and optional guard.
   */
  async findPermission(name: string, guardName?: string): Promise<Permission | null> {
    return this.adapter.findPermission(name, guardName ?? this.defaultGuard);
  }

  /**
   * Delete a permission by its ID.
   */
  async deletePermission(permissionId: string): Promise<void> {
    await this.adapter.deletePermission(permissionId);
    if (this.cache) {
      await this.cache.clear();
    }
  }

  /**
   * List all permissions in the system.
   */
  async getAllPermissions(): Promise<Permission[]> {
    return this.adapter.getAllPermissions();
  }

  // ─── Role CRUD ─────────────────────────────────────────────────────────────

  /**
   * Create a new role.
   *
   * @param name - Role name, e.g. 'admin'
   * @param guardName - Guard context (defaults to defaultGuard)
   */
  async createRole(name: string, guardName?: string): Promise<Role> {
    return this.adapter.createRole(name, guardName ?? this.defaultGuard);
  }

  /**
   * Find a role by name and optional guard.
   */
  async findRole(name: string, guardName?: string): Promise<Role | null> {
    return this.adapter.findRole(name, guardName ?? this.defaultGuard);
  }

  /**
   * Delete a role by its ID.
   */
  async deleteRole(roleId: string): Promise<void> {
    await this.adapter.deleteRole(roleId);
    if (this.cache) {
      await this.cache.clear();
    }
  }

  /**
   * List all roles in the system.
   */
  async getAllRoles(): Promise<Role[]> {
    return this.adapter.getAllRoles();
  }

  // ─── User Permissions ──────────────────────────────────────────────────────

  /**
   * Grant a direct permission to a user.
   * Auto-creates the permission if it doesn't exist.
   *
   * @param userId - Target user ID
   * @param permission - Permission name or Permission object
   * @param guardName - Guard context (defaults to defaultGuard)
   */
  async givePermissionTo(
    userId: string,
    permission: string | Permission,
    guardName?: string
  ): Promise<void> {
    const resolved = await this.resolvePermission(permission, guardName);
    await this.adapter.givePermissionToUser(userId, resolved.id, this.modelType);
    await this.invalidateUserCache(userId);
  }

  /**
   * Revoke a direct permission from a user.
   *
   * @param userId - Target user ID
   * @param permission - Permission name or Permission object
   * @param guardName - Guard context (defaults to defaultGuard)
   */
  async revokePermissionFrom(
    userId: string,
    permission: string | Permission,
    guardName?: string
  ): Promise<void> {
    const resolved = await this.resolvePermission(permission, guardName);
    await this.adapter.revokePermissionFromUser(userId, resolved.id, this.modelType);
    await this.invalidateUserCache(userId);
  }

  /**
   * Sync a user's direct permissions — replaces them with the given list.
   *
   * @param userId - Target user ID
   * @param permissions - Array of permission names or Permission objects
   * @param guardName - Guard context (defaults to defaultGuard)
   */
  async syncPermissions(
    userId: string,
    permissions: (string | Permission)[],
    guardName?: string
  ): Promise<void> {
    const resolved = await Promise.all(
      permissions.map((p) => this.resolvePermission(p, guardName))
    );
    await this.adapter.syncUserPermissions(
      userId,
      resolved.map((p) => p.id),
      this.modelType
    );
    await this.invalidateUserCache(userId);
  }

  /**
   * Get all direct permissions for a user.
   */
  async getUserDirectPermissions(userId: string): Promise<Permission[]> {
    return this.adapter.getUserDirectPermissions(userId, this.modelType);
  }

  // ─── User Roles ────────────────────────────────────────────────────────────

  /**
   * Assign a role to a user.
   * Auto-creates the role if it doesn't exist.
   *
   * @param userId - Target user ID
   * @param role - Role name or Role object
   * @param teamId - Optional team scope
   * @param guardName - Guard context (defaults to defaultGuard)
   */
  async assignRole(
    userId: string,
    role: string | Role,
    teamId?: string,
    guardName?: string
  ): Promise<void> {
    const resolved = await this.resolveRole(role, guardName);
    await this.adapter.assignRoleToUser(
      userId,
      resolved.id,
      this.modelType,
      this.enableTeams ? teamId : undefined
    );
    await this.invalidateUserCache(userId, teamId);
  }

  /**
   * Remove a role from a user.
   *
   * @param userId - Target user ID
   * @param role - Role name or Role object
   * @param teamId - Optional team scope
   * @param guardName - Guard context (defaults to defaultGuard)
   */
  async removeRole(
    userId: string,
    role: string | Role,
    teamId?: string,
    guardName?: string
  ): Promise<void> {
    const resolved = await this.resolveRole(role, guardName);
    await this.adapter.removeRoleFromUser(
      userId,
      resolved.id,
      this.modelType,
      this.enableTeams ? teamId : undefined
    );
    await this.invalidateUserCache(userId, teamId);
  }

  /**
   * Sync a user's roles — replaces them with the given list.
   *
   * @param userId - Target user ID
   * @param roles - Array of role names or Role objects
   * @param teamId - Optional team scope
   * @param guardName - Guard context (defaults to defaultGuard)
   */
  async syncRoles(
    userId: string,
    roles: (string | Role)[],
    teamId?: string,
    guardName?: string
  ): Promise<void> {
    const resolved = await Promise.all(roles.map((r) => this.resolveRole(r, guardName)));
    await this.adapter.syncUserRoles(
      userId,
      resolved.map((r) => r.id),
      this.modelType,
      this.enableTeams ? teamId : undefined
    );
    await this.invalidateUserCache(userId, teamId);
  }

  /**
   * Get all roles assigned to a user.
   *
   * @param userId - Target user ID
   * @param teamId - Optional team scope
   */
  async getUserRoles(userId: string, teamId?: string): Promise<Role[]> {
    return this.adapter.getUserRoles(
      userId,
      this.modelType,
      this.enableTeams ? teamId : undefined
    );
  }

  // ─── Role Permissions ──────────────────────────────────────────────────────

  /**
   * Grant a permission to a role.
   * Auto-creates the permission if it doesn't exist.
   *
   * @param roleId - Target role ID
   * @param permission - Permission name or Permission object
   * @param guardName - Guard context (defaults to defaultGuard)
   */
  async givePermissionToRole(
    roleId: string,
    permission: string | Permission,
    guardName?: string
  ): Promise<void> {
    const resolved = await this.resolvePermission(permission, guardName);
    await this.adapter.givePermissionToRole(roleId, resolved.id);
    if (this.cache) {
      await this.cache.clear();
    }
  }

  /**
   * Revoke a permission from a role.
   *
   * @param roleId - Target role ID
   * @param permission - Permission name or Permission object
   * @param guardName - Guard context (defaults to defaultGuard)
   */
  async revokePermissionFromRole(
    roleId: string,
    permission: string | Permission,
    guardName?: string
  ): Promise<void> {
    const resolved = await this.resolvePermission(permission, guardName);
    await this.adapter.revokePermissionFromRole(roleId, resolved.id);
    if (this.cache) {
      await this.cache.clear();
    }
  }

  /**
   * Sync a role's permissions — replaces them with the given list.
   *
   * @param roleId - Target role ID
   * @param permissions - Array of permission names or Permission objects
   * @param guardName - Guard context (defaults to defaultGuard)
   */
  async syncRolePermissions(
    roleId: string,
    permissions: (string | Permission)[],
    guardName?: string
  ): Promise<void> {
    const resolved = await Promise.all(
      permissions.map((p) => this.resolvePermission(p, guardName))
    );
    await this.adapter.syncRolePermissions(
      roleId,
      resolved.map((p) => p.id)
    );
    if (this.cache) {
      await this.cache.clear();
    }
  }

  /**
   * Get all permissions assigned to a role.
   */
  async getRolePermissions(roleId: string): Promise<Permission[]> {
    return this.adapter.getRolePermissions(roleId);
  }

  // ─── Permission Checking ───────────────────────────────────────────────────

  /**
   * Check if a user has the given permission(s).
   *
   * - Super admin role bypasses all checks.
   * - Supports OR logic (default) or AND logic (`requireAll: true`).
   * - Checks direct permissions and permissions inherited through roles.
   * - Supports wildcard patterns when `enableWildcards` is true.
   *
   * @param userId - User to check
   * @param permission - Permission name, or array of names
   * @param options - Optional check configuration
   */
  async can(
    userId: string,
    permission: string | string[],
    options?: PermissionCheckOptions
  ): Promise<boolean> {
    const perms = Array.isArray(permission) ? permission : [permission];
    const guardName = options?.guardName ?? this.defaultGuard;
    const teamId = options?.teamId;
    const requireAll = options?.requireAll ?? false;

    // Super admin bypass
    if (await this.isSuperAdmin(userId, guardName, teamId)) {
      return true;
    }

    const cacheKey = this.buildCacheKey(userId, teamId);
    let userPermissions: Permission[];

    const cached = this.cache ? await this.cache.get(cacheKey) : null;
    if (cached) {
      userPermissions = cached as Permission[];
    } else {
      userPermissions = await this.adapter.getAllUserPermissions(
        userId,
        this.modelType,
        this.enableTeams ? teamId : undefined
      );
      if (this.cache) {
        await this.cache.set(cacheKey, userPermissions, this.cacheTtl);
      }
    }

    const userPermissionNames = userPermissions.map((p) => p.name);

    const check = (required: string): boolean => {
      // Exact match
      if (userPermissionNames.includes(required)) return true;
      // Wildcard match
      if (this.enableWildcards) {
        return userPermissionNames.some((up) => this.matchesWildcard(up, required));
      }
      return false;
    };

    if (requireAll) {
      return perms.every(check);
    }
    return perms.some(check);
  }

  /**
   * Check if a user has the given role(s).
   *
   * @param userId - User to check
   * @param role - Role name, or array of role names
   * @param options - Optional check configuration
   */
  async hasRole(
    userId: string,
    role: string | string[],
    options?: PermissionCheckOptions
  ): Promise<boolean> {
    const roles = Array.isArray(role) ? role : [role];
    const teamId = options?.teamId;
    const requireAll = options?.requireAll ?? false;

    const userRoles = await this.adapter.getUserRoles(
      userId,
      this.modelType,
      this.enableTeams ? teamId : undefined
    );
    const userRoleNames = userRoles.map((r) => r.name);

    if (requireAll) {
      return roles.every((r) => userRoleNames.includes(r));
    }
    return roles.some((r) => userRoleNames.includes(r));
  }

  /**
   * Check if a user has a permission directly (not via role).
   */
  async hasDirectPermission(userId: string, permission: string): Promise<boolean> {
    const direct = await this.adapter.getUserDirectPermissions(userId, this.modelType);
    return direct.some((p) => p.name === permission);
  }

  /**
   * Check if a user has a permission via one of their roles.
   */
  async hasPermissionViaRole(
    userId: string,
    permission: string,
    options?: PermissionCheckOptions
  ): Promise<boolean> {
    const teamId = options?.teamId;
    const viaRoles = await this.adapter.getUserPermissionsViaRoles(
      userId,
      this.modelType,
      this.enableTeams ? teamId : undefined
    );
    const names = viaRoles.map((p) => p.name);

    if (names.includes(permission)) return true;
    if (this.enableWildcards) {
      return names.some((n) => this.matchesWildcard(n, permission));
    }
    return false;
  }

  // ─── Queries ───────────────────────────────────────────────────────────────

  /**
   * Get all permissions a user has (direct + via roles).
   */
  async getUserPermissions(
    userId: string,
    options?: PermissionCheckOptions
  ): Promise<Permission[]> {
    const teamId = options?.teamId;
    return this.adapter.getAllUserPermissions(
      userId,
      this.modelType,
      this.enableTeams ? teamId : undefined
    );
  }

  // ─── Private helpers ───────────────────────────────────────────────────────

  /**
   * Resolve a permission by name or object.
   * Auto-creates if the permission doesn't exist.
   */
  private async resolvePermission(
    permission: string | Permission,
    guardName?: string
  ): Promise<Permission> {
    if (typeof permission === 'object') {
      return permission;
    }
    const guard = guardName ?? this.defaultGuard;
    const found = await this.adapter.findPermission(permission, guard);
    if (found) return found;
    return this.adapter.createPermission(permission, guard);
  }

  /**
   * Resolve a role by name or object.
   * Auto-creates if the role doesn't exist.
   */
  private async resolveRole(role: string | Role, guardName?: string): Promise<Role> {
    if (typeof role === 'object') {
      return role;
    }
    const guard = guardName ?? this.defaultGuard;
    const found = await this.adapter.findRole(role, guard);
    if (found) return found;
    return this.adapter.createRole(role, guard);
  }

  /**
   * Returns true if the user has the super admin role.
   */
  private async isSuperAdmin(
    userId: string,
    _guardName: string,
    teamId?: string
  ): Promise<boolean> {
    const roles = await this.adapter.getUserRoles(
      userId,
      this.modelType,
      this.enableTeams ? teamId : undefined
    );
    return roles.some((r) => r.name === this.superAdminRole);
  }

  /**
   * Build a cache key for a user's permissions.
   */
  private buildCacheKey(userId: string, teamId?: string): string {
    if (teamId) {
      return `user:${userId}:team:${teamId}:permissions`;
    }
    return `user:${userId}:permissions`;
  }

  /**
   * Invalidate cached permissions for a user.
   */
  private async invalidateUserCache(userId: string, teamId?: string): Promise<void> {
    if (!this.cache) return;
    const key = this.buildCacheKey(userId, teamId);
    await this.cache.delete(key);
  }

  /**
   * Wildcard matching.
   *
   * Converts a pattern like 'posts.*' into the regex /^posts\..*$/
   * and tests whether `required` matches that pattern.
   *
   * @param pattern - Wildcard pattern (the user's stored permission)
   * @param required - The permission name being checked
   */
  private matchesWildcard(pattern: string, required: string): boolean {
    // Escape special regex chars, then replace escaped \* with .*
    const regexStr =
      '^' + pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\\\*/g, '.*') + '$';
    return new RegExp(regexStr).test(required);
  }
}
