/**
 * Example Prisma adapter implementation.
 *
 * This shows how to implement the PermissionAdapter interface for Prisma ORM.
 * Copy this file into your project and adapt as needed.
 *
 * Prisma schema (prisma/schema.prisma):
 * ```prisma
 * model Permission {
 *   id        String   @id @default(uuid())
 *   name      String
 *   guardName String   @map("guard_name")
 *   createdAt DateTime @default(now()) @map("created_at")
 *   updatedAt DateTime @updatedAt @map("updated_at")
 *   modelHasPermissions ModelHasPermission[]
 *   roleHasPermissions  RoleHasPermission[]
 *   @@unique([name, guardName])
 *   @@map("permissions")
 * }
 *
 * model Role {
 *   id        String   @id @default(uuid())
 *   name      String
 *   guardName String   @map("guard_name")
 *   createdAt DateTime @default(now()) @map("created_at")
 *   updatedAt DateTime @updatedAt @map("updated_at")
 *   modelHasRoles       ModelHasRole[]
 *   roleHasPermissions  RoleHasPermission[]
 *   @@unique([name, guardName])
 *   @@map("roles")
 * }
 *
 * model ModelHasPermission {
 *   permissionId String     @map("permission_id")
 *   modelType    String     @map("model_type")
 *   modelId      String     @map("model_id")
 *   permission   Permission @relation(fields: [permissionId], references: [id], onDelete: Cascade)
 *   @@id([permissionId, modelId, modelType])
 *   @@map("model_has_permissions")
 * }
 *
 * model ModelHasRole {
 *   roleId    String  @map("role_id")
 *   modelType String  @map("model_type")
 *   modelId   String  @map("model_id")
 *   teamId    String? @map("team_id")
 *   role      Role    @relation(fields: [roleId], references: [id], onDelete: Cascade)
 *   @@id([roleId, modelId, modelType])
 *   @@index([teamId])
 *   @@map("model_has_roles")
 * }
 *
 * model RoleHasPermission {
 *   permissionId String     @map("permission_id")
 *   roleId       String     @map("role_id")
 *   permission   Permission @relation(fields: [permissionId], references: [id], onDelete: Cascade)
 *   role         Role       @relation(fields: [roleId], references: [id], onDelete: Cascade)
 *   @@id([permissionId, roleId])
 *   @@map("role_has_permissions")
 * }
 * ```
 */

import type { PermissionAdapter, Permission, Role } from '@yourorg/permissions';
// import { PrismaClient } from '@prisma/client';

// type PrismaClientType = PrismaClient;

/**
 * Prisma adapter for @yourorg/permissions.
 *
 * @example
 * ```ts
 * import { PrismaClient } from '@prisma/client';
 * import { PermissionManager } from '@yourorg/permissions';
 * import { PrismaAdapter } from './prisma-adapter';
 *
 * const prisma = new PrismaClient();
 * const manager = new PermissionManager({
 *   adapter: new PrismaAdapter(prisma),
 *   modelType: 'User',
 * });
 * ```
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export class PrismaAdapter implements PermissionAdapter {
  // constructor(private readonly prisma: PrismaClientType) {}
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(private readonly prisma: any) {}

  // ─── Permission CRUD ────────────────────────────────────────────────────

  async createPermission(name: string, guardName: string): Promise<Permission> {
    return this.prisma.permission.create({ data: { name, guardName } });
  }

  async findPermission(name: string, guardName: string): Promise<Permission | null> {
    return this.prisma.permission.findUnique({ where: { name_guardName: { name, guardName } } });
  }

  async findPermissionById(id: string): Promise<Permission | null> {
    return this.prisma.permission.findUnique({ where: { id } });
  }

  async deletePermission(permissionId: string): Promise<void> {
    await this.prisma.permission.delete({ where: { id: permissionId } });
  }

  async getAllPermissions(): Promise<Permission[]> {
    return this.prisma.permission.findMany();
  }

  // ─── Role CRUD ──────────────────────────────────────────────────────────

  async createRole(name: string, guardName: string): Promise<Role> {
    return this.prisma.role.create({ data: { name, guardName } });
  }

  async findRole(name: string, guardName: string): Promise<Role | null> {
    return this.prisma.role.findUnique({ where: { name_guardName: { name, guardName } } });
  }

  async findRoleById(id: string): Promise<Role | null> {
    return this.prisma.role.findUnique({ where: { id } });
  }

  async deleteRole(roleId: string): Promise<void> {
    await this.prisma.role.delete({ where: { id: roleId } });
  }

  async getAllRoles(): Promise<Role[]> {
    return this.prisma.role.findMany();
  }

  // ─── User ↔ Permission ──────────────────────────────────────────────────

  async givePermissionToUser(
    userId: string,
    permissionId: string,
    modelType: string
  ): Promise<void> {
    await this.prisma.modelHasPermission.upsert({
      where: { permissionId_modelId_modelType: { permissionId, modelId: userId, modelType } },
      create: { permissionId, modelId: userId, modelType },
      update: {},
    });
  }

  async revokePermissionFromUser(
    userId: string,
    permissionId: string,
    modelType: string
  ): Promise<void> {
    await this.prisma.modelHasPermission.deleteMany({
      where: { permissionId, modelId: userId, modelType },
    });
  }

  async syncUserPermissions(
    userId: string,
    permissionIds: string[],
    modelType: string
  ): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.modelHasPermission.deleteMany({ where: { modelId: userId, modelType } }),
      this.prisma.modelHasPermission.createMany({
        data: permissionIds.map((permissionId) => ({ permissionId, modelId: userId, modelType })),
        skipDuplicates: true,
      }),
    ]);
  }

  async getUserDirectPermissions(userId: string, modelType: string): Promise<Permission[]> {
    const rows = await this.prisma.modelHasPermission.findMany({
      where: { modelId: userId, modelType },
      include: { permission: true },
    });
    return rows.map((r: { permission: Permission }) => r.permission);
  }

  // ─── User ↔ Role ────────────────────────────────────────────────────────

  async assignRoleToUser(
    userId: string,
    roleId: string,
    modelType: string,
    teamId?: string
  ): Promise<void> {
    await this.prisma.modelHasRole.upsert({
      where: { roleId_modelId_modelType: { roleId, modelId: userId, modelType } },
      create: { roleId, modelId: userId, modelType, teamId: teamId ?? null },
      update: {},
    });
  }

  async removeRoleFromUser(
    userId: string,
    roleId: string,
    modelType: string,
    teamId?: string
  ): Promise<void> {
    await this.prisma.modelHasRole.deleteMany({
      where: { roleId, modelId: userId, modelType, ...(teamId ? { teamId } : {}) },
    });
  }

  async syncUserRoles(
    userId: string,
    roleIds: string[],
    modelType: string,
    teamId?: string
  ): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.modelHasRole.deleteMany({
        where: { modelId: userId, modelType, ...(teamId ? { teamId } : {}) },
      }),
      this.prisma.modelHasRole.createMany({
        data: roleIds.map((roleId) => ({
          roleId,
          modelId: userId,
          modelType,
          teamId: teamId ?? null,
        })),
        skipDuplicates: true,
      }),
    ]);
  }

  async getUserRoles(userId: string, modelType: string, teamId?: string): Promise<Role[]> {
    const rows = await this.prisma.modelHasRole.findMany({
      where: { modelId: userId, modelType, ...(teamId ? { teamId } : {}) },
      include: { role: true },
    });
    return rows.map((r: { role: Role }) => r.role);
  }

  // ─── Role ↔ Permission ──────────────────────────────────────────────────

  async givePermissionToRole(roleId: string, permissionId: string): Promise<void> {
    await this.prisma.roleHasPermission.upsert({
      where: { permissionId_roleId: { permissionId, roleId } },
      create: { permissionId, roleId },
      update: {},
    });
  }

  async revokePermissionFromRole(roleId: string, permissionId: string): Promise<void> {
    await this.prisma.roleHasPermission.deleteMany({ where: { permissionId, roleId } });
  }

  async syncRolePermissions(roleId: string, permissionIds: string[]): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.roleHasPermission.deleteMany({ where: { roleId } }),
      this.prisma.roleHasPermission.createMany({
        data: permissionIds.map((permissionId) => ({ permissionId, roleId })),
        skipDuplicates: true,
      }),
    ]);
  }

  async getRolePermissions(roleId: string): Promise<Permission[]> {
    const rows = await this.prisma.roleHasPermission.findMany({
      where: { roleId },
      include: { permission: true },
    });
    return rows.map((r: { permission: Permission }) => r.permission);
  }

  // ─── Combined queries ───────────────────────────────────────────────────

  async getAllUserPermissions(
    userId: string,
    modelType: string,
    teamId?: string
  ): Promise<Permission[]> {
    const [direct, viaRoles] = await Promise.all([
      this.getUserDirectPermissions(userId, modelType),
      this.getUserPermissionsViaRoles(userId, modelType, teamId),
    ]);
    const seen = new Set<string>();
    const result: Permission[] = [];
    for (const p of [...direct, ...viaRoles]) {
      if (!seen.has(p.id)) {
        seen.add(p.id);
        result.push(p);
      }
    }
    return result;
  }

  async getUserPermissionsViaRoles(
    userId: string,
    modelType: string,
    teamId?: string
  ): Promise<Permission[]> {
    const userRoles = await this.getUserRoles(userId, modelType, teamId);
    if (userRoles.length === 0) return [];
    const roleIds = userRoles.map((r) => r.id);
    const rows = await this.prisma.roleHasPermission.findMany({
      where: { roleId: { in: roleIds } },
      include: { permission: true },
      distinct: ['permissionId'],
    });
    return rows.map((r: { permission: Permission }) => r.permission);
  }
}
