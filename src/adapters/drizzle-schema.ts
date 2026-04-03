/**
 * Drizzle ORM schema definitions for the permissions package.
 *
 * This file defines the five tables required by the RBAC system:
 *   - permissions
 *   - roles
 *   - model_has_permissions  (user ↔ permission, direct)
 *   - model_has_roles         (user ↔ role, team-aware)
 *   - role_has_permissions    (role ↔ permission)
 */

import {
  index,
  pgTable,
  primaryKey,
  timestamp,
  uniqueIndex,
  varchar,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// ─── permissions ──────────────────────────────────────────────────────────────

export const permissions = pgTable(
  'permissions',
  {
    id: varchar('id', { length: 36 }).primaryKey(),
    name: varchar('name', { length: 255 }).notNull(),
    guardName: varchar('guard_name', { length: 255 }).notNull(),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    nameGuardIdx: uniqueIndex('permissions_name_guard_unique').on(
      table.name,
      table.guardName
    ),
  })
);

// ─── roles ────────────────────────────────────────────────────────────────────

export const roles = pgTable(
  'roles',
  {
    id: varchar('id', { length: 36 }).primaryKey(),
    name: varchar('name', { length: 255 }).notNull(),
    guardName: varchar('guard_name', { length: 255 }).notNull(),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    nameGuardIdx: uniqueIndex('roles_name_guard_unique').on(table.name, table.guardName),
  })
);

// ─── model_has_permissions ────────────────────────────────────────────────────

export const modelHasPermissions = pgTable(
  'model_has_permissions',
  {
    permissionId: varchar('permission_id', { length: 36 })
      .notNull()
      .references(() => permissions.id, { onDelete: 'cascade' }),
    modelType: varchar('model_type', { length: 255 }).notNull(),
    modelId: varchar('model_id', { length: 255 }).notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.permissionId, table.modelId, table.modelType] }),
  })
);

// ─── model_has_roles ──────────────────────────────────────────────────────────

export const modelHasRoles = pgTable(
  'model_has_roles',
  {
    roleId: varchar('role_id', { length: 36 })
      .notNull()
      .references(() => roles.id, { onDelete: 'cascade' }),
    modelType: varchar('model_type', { length: 255 }).notNull(),
    modelId: varchar('model_id', { length: 255 }).notNull(),
    teamId: varchar('team_id', { length: 255 }),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.roleId, table.modelId, table.modelType] }),
    teamIdx: index('model_has_roles_team_id_idx').on(table.teamId),
  })
);

// ─── role_has_permissions ─────────────────────────────────────────────────────

export const roleHasPermissions = pgTable(
  'role_has_permissions',
  {
    permissionId: varchar('permission_id', { length: 36 })
      .notNull()
      .references(() => permissions.id, { onDelete: 'cascade' }),
    roleId: varchar('role_id', { length: 36 })
      .notNull()
      .references(() => roles.id, { onDelete: 'cascade' }),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.permissionId, table.roleId] }),
  })
);

// ─── Relations ─────────────────────────────────────────────────────────────────

export const permissionsRelations = relations(permissions, ({ many }) => ({
  modelHasPermissions: many(modelHasPermissions),
  roleHasPermissions: many(roleHasPermissions),
}));

export const rolesRelations = relations(roles, ({ many }) => ({
  modelHasRoles: many(modelHasRoles),
  roleHasPermissions: many(roleHasPermissions),
}));

export const modelHasPermissionsRelations = relations(modelHasPermissions, ({ one }) => ({
  permission: one(permissions, {
    fields: [modelHasPermissions.permissionId],
    references: [permissions.id],
  }),
}));

export const modelHasRolesRelations = relations(modelHasRoles, ({ one }) => ({
  role: one(roles, {
    fields: [modelHasRoles.roleId],
    references: [roles.id],
  }),
}));

export const roleHasPermissionsRelations = relations(roleHasPermissions, ({ one }) => ({
  permission: one(permissions, {
    fields: [roleHasPermissions.permissionId],
    references: [permissions.id],
  }),
  role: one(roles, {
    fields: [roleHasPermissions.roleId],
    references: [roles.id],
  }),
}));
