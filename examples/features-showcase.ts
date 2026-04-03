/**
 * Features showcase — demonstrates every feature of the permissions package.
 *
 * This file uses pseudo-imports. Replace them with real imports once you have
 * a database connection configured.
 */

import { PermissionManager, InMemoryCache } from '@yourorg/permissions';
import { DrizzleAdapter } from '@yourorg/permissions/adapters/drizzle';

// Assume `db` is a configured Drizzle instance
// import { db } from './database';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const db: any;

async function showcase() {
  // ─── Setup ──────────────────────────────────────────────────────────────

  const manager = new PermissionManager({
    adapter: new DrizzleAdapter(db),
    modelType: 'User',
    defaultGuard: 'web',
    enableTeams: true,
    enableWildcards: true,
    superAdminRole: 'super-admin',
    cache: new InMemoryCache(),
    cacheTtl: 3600,
  });

  // ─── 1. Permission CRUD ──────────────────────────────────────────────────

  const editPerm   = await manager.createPermission('posts.edit');
  const createPerm = await manager.createPermission('posts.create');
  const deletePerm = await manager.createPermission('posts.delete');
  await manager.createPermission('posts.view');
  await manager.createPermission('users.manage');

  console.log('Created permissions:', editPerm, createPerm, deletePerm);

  const found = await manager.findPermission('posts.edit');
  console.log('Found permission:', found);

  const allPerms = await manager.getAllPermissions();
  console.log('All permissions:', allPerms.map((p) => p.name));

  // ─── 2. Role CRUD ────────────────────────────────────────────────────────

  const editorRole     = await manager.createRole('editor');
  const adminRole      = await manager.createRole('admin');
  const superAdminRole = await manager.createRole('super-admin');

  console.log('Created roles:', editorRole.name, adminRole.name, superAdminRole.name);

  const allRoles = await manager.getAllRoles();
  console.log('All roles:', allRoles.map((r) => r.name));

  // ─── 3. Role Permissions ─────────────────────────────────────────────────

  // Give individual permission to a role
  await manager.givePermissionToRole(editorRole.id, 'posts.edit');
  await manager.givePermissionToRole(editorRole.id, 'posts.create');

  // Sync role permissions (replaces existing)
  await manager.syncRolePermissions(adminRole.id, [
    'posts.edit', 'posts.create', 'posts.delete', 'users.manage',
  ]);

  // Revoke one permission from a role
  await manager.revokePermissionFromRole(editorRole.id, 'posts.create');

  const editorPerms = await manager.getRolePermissions(editorRole.id);
  console.log('Editor permissions:', editorPerms.map((p) => p.name));

  // ─── 4. User Role Assignment ─────────────────────────────────────────────

  const userId  = 'user-1';
  const adminId = 'user-2';
  const saId    = 'user-3';

  await manager.assignRole(userId, 'editor');
  await manager.assignRole(adminId, adminRole);
  await manager.assignRole(saId, 'super-admin');

  const userRoles = await manager.getUserRoles(userId);
  console.log('User roles:', userRoles.map((r) => r.name));

  // Sync roles
  await manager.syncRoles(userId, ['editor', 'admin']);

  // Remove a role
  await manager.removeRole(userId, 'admin');

  // ─── 5. Direct User Permissions ──────────────────────────────────────────

  // Give a direct permission (not via role)
  await manager.givePermissionTo(userId, 'posts.delete');

  // Sync direct permissions
  await manager.syncPermissions(userId, ['posts.view', 'posts.delete']);

  // Revoke
  await manager.revokePermissionFrom(userId, 'posts.delete');

  const directPerms = await manager.getUserDirectPermissions(userId);
  console.log('Direct permissions:', directPerms.map((p) => p.name));

  // ─── 6. Permission Checking ──────────────────────────────────────────────

  // Basic check
  const canEdit = await manager.can(userId, 'posts.edit');
  console.log('Can edit posts:', canEdit); // true (via editor role)

  // Array of permissions – OR logic (default)
  const canEditOrDelete = await manager.can(userId, ['posts.edit', 'posts.delete']);
  console.log('Can edit OR delete:', canEditOrDelete);

  // AND logic
  const canBoth = await manager.can(userId, ['posts.edit', 'posts.delete'], { requireAll: true });
  console.log('Can edit AND delete:', canBoth);

  // Check via role only
  const viaRole = await manager.hasPermissionViaRole(userId, 'posts.edit');
  console.log('Has posts.edit via role:', viaRole);

  // Direct check
  const direct = await manager.hasDirectPermission(userId, 'posts.view');
  console.log('Has posts.view directly:', direct);

  // ─── 7. Role Checking ────────────────────────────────────────────────────

  const isEditor = await manager.hasRole(userId, 'editor');
  console.log('Is editor:', isEditor);

  const isEditorOrAdmin = await manager.hasRole(userId, ['editor', 'admin']);
  console.log('Is editor or admin:', isEditorOrAdmin);

  const isBoth = await manager.hasRole(userId, ['editor', 'admin'], { requireAll: true });
  console.log('Is editor AND admin:', isBoth);

  // ─── 8. Super Admin ──────────────────────────────────────────────────────

  // Super admin bypasses ALL permission checks
  const superCanAnything = await manager.can(saId, 'some.nonexistent.permission');
  console.log('Super admin can do anything:', superCanAnything); // true

  // ─── 9. Wildcard Permissions ─────────────────────────────────────────────

  const wildcardManager = new PermissionManager({
    adapter: new DrizzleAdapter(db),
    modelType: 'User',
    enableWildcards: true,
  });

  const wildcardUserId = 'user-wildcard';
  await wildcardManager.givePermissionTo(wildcardUserId, 'posts.*');

  // 'posts.*' matches 'posts.edit', 'posts.delete', 'posts.create', etc.
  console.log('Wildcard posts.edit:',   await wildcardManager.can(wildcardUserId, 'posts.edit'));
  console.log('Wildcard posts.delete:', await wildcardManager.can(wildcardUserId, 'posts.delete'));
  console.log('Wildcard users.manage:', await wildcardManager.can(wildcardUserId, 'users.manage')); // false

  // Admin wildcard
  await wildcardManager.givePermissionTo(wildcardUserId, 'admin.*');
  console.log('Admin wildcard admin.users.manage:',
    await wildcardManager.can(wildcardUserId, 'admin.users.manage'));

  // ─── 10. Team Permissions ────────────────────────────────────────────────

  const teamManager = new PermissionManager({
    adapter: new DrizzleAdapter(db),
    modelType: 'User',
    enableTeams: true,
  });

  const teamUserId = 'user-team';
  const teamId     = 'team-abc';

  await teamManager.assignRole(teamUserId, 'admin', teamId);
  const teamRoles = await teamManager.getUserRoles(teamUserId, teamId);
  console.log('Team roles:', teamRoles.map((r) => r.name));

  const canInTeam = await teamManager.hasRole(teamUserId, 'admin', { teamId });
  console.log('Has admin role in team:', canInTeam);

  // ─── 11. Get All User Permissions ────────────────────────────────────────

  const allUserPerms = await manager.getUserPermissions(userId);
  console.log('All user permissions (direct + via roles):',
    allUserPerms.map((p) => p.name));

  // ─── 12. Batch Operations ────────────────────────────────────────────────

  // Create multiple permissions at once
  const batchNames = ['comments.create', 'comments.edit', 'comments.delete'];
  const batchPerms = await Promise.all(batchNames.map((n) => manager.createPermission(n)));
  console.log('Batch created:', batchPerms.map((p) => p.name));

  // Assign multiple roles at once
  await manager.syncRoles(userId, ['editor']);
  console.log('Synced roles for user.');

  // ─── 13. Caching Demo ────────────────────────────────────────────────────

  const cache = new InMemoryCache();
  const cachedManager = new PermissionManager({
    adapter: new DrizzleAdapter(db),
    modelType: 'User',
    cache,
    cacheTtl: 300,
  });

  // First call hits the database and populates cache
  await cachedManager.can(userId, 'posts.edit');
  // Second call uses cache
  await cachedManager.can(userId, 'posts.edit');

  // Cache is auto-invalidated when permissions change
  await cachedManager.givePermissionTo(userId, 'posts.delete');
  // Next check hits the database again

  await cache.clear(); // Manual cache clear
  console.log('Cache demo complete.');

  // ─── 14. Complex Authorization Logic ────────────────────────────────────

  // A user can publish a post if they can create AND edit posts
  const canPublish = await manager.can(userId, ['posts.create', 'posts.edit'], { requireAll: true });
  console.log('Can publish post:', canPublish);

  // A user is a content manager if they are an editor OR an admin
  const isContentManager = await manager.hasRole(userId, ['editor', 'admin']);
  console.log('Is content manager:', isContentManager);

  console.log('\nAll features demonstrated successfully!');
}

showcase().catch(console.error);
