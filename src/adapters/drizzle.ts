/**
 * Drizzle ORM adapter implementation.
 *
 * Pass an instance of this class to PermissionManager to use Drizzle ORM
 * with any PostgreSQL-compatible database.
 *
 * @example
 * ```ts
 * import { drizzle } from 'drizzle-orm/node-postgres';
 * import { DrizzleAdapter } from '@yourorg/permissions/adapters/drizzle';
 *
 * const db = drizzle(connectionString);
 * const adapter = new DrizzleAdapter(db);
 * ```
 */

import { randomUUID } from 'crypto';
import { and, eq, inArray } from 'drizzle-orm';
import type { PermissionAdapter, Permission, Role } from '../types';
import {
  modelHasPermissions,
  modelHasRoles,
  permissions,
  roleHasPermissions,
  roles,
} from './drizzle-schema';

// Minimal type for a Drizzle database instance (select + insert + delete)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DrizzleDB = any;

/**
 * Drizzle ORM adapter for the permissions package.
 */
export class DrizzleAdapter implements PermissionAdapter {
  constructor(private readonly db: DrizzleDB) {}

  // ─── Permission CRUD ─────────────────────────────────────────────────────

  async createPermission(name: string, guardName: string): Promise<Permission> {
    const id = randomUUID();
    const now = new Date();
    const [row] = await this.db
      .insert(permissions)
      .values({ id, name, guardName, createdAt: now, updatedAt: now })
      .returning();
    return this.mapPermission(row);
  }

  async findPermission(name: string, guardName: string): Promise<Permission | null> {
    const rows = await this.db
      .select()
      .from(permissions)
      .where(and(eq(permissions.name, name), eq(permissions.guardName, guardName)))
      .limit(1);
    return rows[0] ? this.mapPermission(rows[0]) : null;
  }

  async findPermissionById(id: string): Promise<Permission | null> {
    const rows = await this.db
      .select()
      .from(permissions)
      .where(eq(permissions.id, id))
      .limit(1);
    return rows[0] ? this.mapPermission(rows[0]) : null;
  }

  async deletePermission(permissionId: string): Promise<void> {
    await this.db.delete(permissions).where(eq(permissions.id, permissionId));
  }

  async getAllPermissions(): Promise<Permission[]> {
    const rows = await this.db.select().from(permissions);
    return rows.map(this.mapPermission);
  }

  // ─── Role CRUD ───────────────────────────────────────────────────────────

  async createRole(name: string, guardName: string): Promise<Role> {
    const id = randomUUID();
    const now = new Date();
    const [row] = await this.db
      .insert(roles)
      .values({ id, name, guardName, createdAt: now, updatedAt: now })
      .returning();
    return this.mapRole(row);
  }

  async findRole(name: string, guardName: string): Promise<Role | null> {
    const rows = await this.db
      .select()
      .from(roles)
      .where(and(eq(roles.name, name), eq(roles.guardName, guardName)))
      .limit(1);
    return rows[0] ? this.mapRole(rows[0]) : null;
  }

  async findRoleById(id: string): Promise<Role | null> {
    const rows = await this.db
      .select()
      .from(roles)
      .where(eq(roles.id, id))
      .limit(1);
    return rows[0] ? this.mapRole(rows[0]) : null;
  }

  async deleteRole(roleId: string): Promise<void> {
    await this.db.delete(roles).where(eq(roles.id, roleId));
  }

  async getAllRoles(): Promise<Role[]> {
    const rows = await this.db.select().from(roles);
    return rows.map(this.mapRole);
  }

  // ─── User ↔ Permission ───────────────────────────────────────────────────

  async givePermissionToUser(
    userId: string,
    permissionId: string,
    modelType: string
  ): Promise<void> {
    await this.db
      .insert(modelHasPermissions)
      .values({ permissionId, modelId: userId, modelType })
      .onConflictDoNothing();
  }

  async revokePermissionFromUser(
    userId: string,
    permissionId: string,
    modelType: string
  ): Promise<void> {
    await this.db
      .delete(modelHasPermissions)
      .where(
        and(
          eq(modelHasPermissions.permissionId, permissionId),
          eq(modelHasPermissions.modelId, userId),
          eq(modelHasPermissions.modelType, modelType)
        )
      );
  }

  async syncUserPermissions(
    userId: string,
    permissionIds: string[],
    modelType: string
  ): Promise<void> {
    await this.db
      .delete(modelHasPermissions)
      .where(
        and(
          eq(modelHasPermissions.modelId, userId),
          eq(modelHasPermissions.modelType, modelType)
        )
      );

    if (permissionIds.length > 0) {
      await this.db
        .insert(modelHasPermissions)
        .values(
          permissionIds.map((permissionId) => ({ permissionId, modelId: userId, modelType }))
        )
        .onConflictDoNothing();
    }
  }

  async getUserDirectPermissions(userId: string, modelType: string): Promise<Permission[]> {
    const rows = await this.db
      .select({ permission: permissions })
      .from(modelHasPermissions)
      .innerJoin(permissions, eq(modelHasPermissions.permissionId, permissions.id))
      .where(
        and(
          eq(modelHasPermissions.modelId, userId),
          eq(modelHasPermissions.modelType, modelType)
        )
      );
    return rows.map((r: { permission: typeof permissions.$inferSelect }) =>
      this.mapPermission(r.permission)
    );
  }

  // ─── User ↔ Role ─────────────────────────────────────────────────────────

  async assignRoleToUser(
    userId: string,
    roleId: string,
    modelType: string,
    teamId?: string
  ): Promise<void> {
    await this.db
      .insert(modelHasRoles)
      .values({ roleId, modelId: userId, modelType, teamId: teamId ?? null })
      .onConflictDoNothing();
  }

  async removeRoleFromUser(
    userId: string,
    roleId: string,
    modelType: string,
    teamId?: string
  ): Promise<void> {
    const conditions = [
      eq(modelHasRoles.roleId, roleId),
      eq(modelHasRoles.modelId, userId),
      eq(modelHasRoles.modelType, modelType),
    ];
    if (teamId !== undefined) {
      conditions.push(eq(modelHasRoles.teamId, teamId));
    }
    await this.db.delete(modelHasRoles).where(and(...conditions));
  }

  async syncUserRoles(
    userId: string,
    roleIds: string[],
    modelType: string,
    teamId?: string
  ): Promise<void> {
    const conditions = [
      eq(modelHasRoles.modelId, userId),
      eq(modelHasRoles.modelType, modelType),
    ];
    if (teamId !== undefined) {
      conditions.push(eq(modelHasRoles.teamId, teamId));
    }
    await this.db.delete(modelHasRoles).where(and(...conditions));

    if (roleIds.length > 0) {
      await this.db
        .insert(modelHasRoles)
        .values(
          roleIds.map((roleId) => ({
            roleId,
            modelId: userId,
            modelType,
            teamId: teamId ?? null,
          }))
        )
        .onConflictDoNothing();
    }
  }

  async getUserRoles(
    userId: string,
    modelType: string,
    teamId?: string
  ): Promise<Role[]> {
    const conditions = [
      eq(modelHasRoles.modelId, userId),
      eq(modelHasRoles.modelType, modelType),
    ];
    if (teamId !== undefined) {
      conditions.push(eq(modelHasRoles.teamId, teamId));
    }

    const rows = await this.db
      .select({ role: roles })
      .from(modelHasRoles)
      .innerJoin(roles, eq(modelHasRoles.roleId, roles.id))
      .where(and(...conditions));

    return rows.map((r: { role: typeof roles.$inferSelect }) => this.mapRole(r.role));
  }

  // ─── Role ↔ Permission ───────────────────────────────────────────────────

  async givePermissionToRole(roleId: string, permissionId: string): Promise<void> {
    await this.db
      .insert(roleHasPermissions)
      .values({ roleId, permissionId })
      .onConflictDoNothing();
  }

  async revokePermissionFromRole(roleId: string, permissionId: string): Promise<void> {
    await this.db
      .delete(roleHasPermissions)
      .where(
        and(
          eq(roleHasPermissions.roleId, roleId),
          eq(roleHasPermissions.permissionId, permissionId)
        )
      );
  }

  async syncRolePermissions(roleId: string, permissionIds: string[]): Promise<void> {
    await this.db
      .delete(roleHasPermissions)
      .where(eq(roleHasPermissions.roleId, roleId));

    if (permissionIds.length > 0) {
      await this.db
        .insert(roleHasPermissions)
        .values(permissionIds.map((permissionId) => ({ roleId, permissionId })))
        .onConflictDoNothing();
    }
  }

  async getRolePermissions(roleId: string): Promise<Permission[]> {
    const rows = await this.db
      .select({ permission: permissions })
      .from(roleHasPermissions)
      .innerJoin(permissions, eq(roleHasPermissions.permissionId, permissions.id))
      .where(eq(roleHasPermissions.roleId, roleId));
    return rows.map((r: { permission: typeof permissions.$inferSelect }) =>
      this.mapPermission(r.permission)
    );
  }

  // ─── Combined queries ────────────────────────────────────────────────────

  async getAllUserPermissions(
    userId: string,
    modelType: string,
    teamId?: string
  ): Promise<Permission[]> {
    const [direct, viaRoles] = await Promise.all([
      this.getUserDirectPermissions(userId, modelType),
      this.getUserPermissionsViaRoles(userId, modelType, teamId),
    ]);

    // Merge and deduplicate by ID
    const seen = new Set<string>();
    const merged: Permission[] = [];
    for (const p of [...direct, ...viaRoles]) {
      if (!seen.has(p.id)) {
        seen.add(p.id);
        merged.push(p);
      }
    }
    return merged;
  }

  async getUserPermissionsViaRoles(
    userId: string,
    modelType: string,
    teamId?: string
  ): Promise<Permission[]> {
    // Get roles for the user
    const userRoles = await this.getUserRoles(userId, modelType, teamId);
    if (userRoles.length === 0) return [];

    const roleIds = userRoles.map((r) => r.id);

    // Get distinct permissions for those roles
    const rows = await this.db
      .selectDistinct({ permission: permissions })
      .from(roleHasPermissions)
      .innerJoin(permissions, eq(roleHasPermissions.permissionId, permissions.id))
      .where(inArray(roleHasPermissions.roleId, roleIds));

    return rows.map((r: { permission: typeof permissions.$inferSelect }) =>
      this.mapPermission(r.permission)
    );
  }

  // ─── Mappers ─────────────────────────────────────────────────────────────

  private mapPermission(row: typeof permissions.$inferSelect): Permission {
    return {
      id: row.id,
      name: row.name,
      guardName: row.guardName,
      createdAt: row.createdAt ?? undefined,
      updatedAt: row.updatedAt ?? undefined,
    };
  }

  private mapRole(row: typeof roles.$inferSelect): Role {
    return {
      id: row.id,
      name: row.name,
      guardName: row.guardName,
      createdAt: row.createdAt ?? undefined,
      updatedAt: row.updatedAt ?? undefined,
    };
  }
}

// Re-export schema so consumers can use it directly
export * from './drizzle-schema';
