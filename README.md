# @yourorg/permissions

A production-ready TypeScript **Role-Based Access Control (RBAC)** package for Node.js and Next.js, inspired by [Spatie Laravel Permission](https://github.com/spatie/laravel-permission).

## Features

- 🔐 **Role-Based Access Control** — users can have multiple roles; roles can have multiple permissions
- 👤 **Direct Permissions** — assign permissions to users independently of roles
- 🔌 **Adapter Pattern** — works with any ORM (Drizzle, Prisma, TypeORM, …)
- 🏢 **Multi-Tenancy / Teams** — scope roles and permissions to teams
- 🃏 **Wildcard Permissions** — `posts.*` matches `posts.edit`, `posts.delete`, etc.
- 🛡️ **Multiple Guards** — separate permission sets per authentication context
- ⚡ **Caching** — built-in in-memory cache with a pluggable interface (Redis, etc.)
- 👑 **Super Admin** — configurable role that bypasses all permission checks
- ⚛️ **Next.js Integration** — middleware, React hooks, and components

---

## Installation

```bash
npm install @yourorg/permissions
# or
yarn add @yourorg/permissions
# or
pnpm add @yourorg/permissions
```

### Peer dependencies

```bash
# For Drizzle adapter
npm install drizzle-orm

# For Next.js integration
npm install next react
```

---

## Quick Start

### 1. Run the migration

```sql
-- Run migrations/001_create_permissions_tables.sql against your PostgreSQL database
psql -U postgres -d mydb -f migrations/001_create_permissions_tables.sql
```

### 2. Create the manager

```ts
import { PermissionManager, InMemoryCache } from '@yourorg/permissions';
import { DrizzleAdapter } from '@yourorg/permissions/adapters/drizzle';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

const db = drizzle(new Pool({ connectionString: process.env.DATABASE_URL! }));

export const permissions = new PermissionManager({
  adapter: new DrizzleAdapter(db),
  modelType: 'User',
  defaultGuard: 'web',
  enableTeams: true,
  enableWildcards: true,
  superAdminRole: 'super-admin',
  cache: new InMemoryCache(),
  cacheTtl: 3600,
});
```

### 3. Seed roles and permissions

```ts
// Create permissions
await permissions.createPermission('posts.view');
await permissions.createPermission('posts.create');
await permissions.createPermission('posts.edit');
await permissions.createPermission('posts.delete');

// Create roles
const editorRole = await permissions.createRole('editor');
const adminRole  = await permissions.createRole('admin');
await permissions.createRole('super-admin');

// Assign permissions to roles
await permissions.syncRolePermissions(editorRole.id, ['posts.view', 'posts.create', 'posts.edit']);
await permissions.syncRolePermissions(adminRole.id,  ['posts.view', 'posts.create', 'posts.edit', 'posts.delete']);
```

### 4. Assign roles to users

```ts
await permissions.assignRole(userId, 'editor');
await permissions.assignRole(userId, 'admin');
```

### 5. Check permissions

```ts
const canEdit   = await permissions.can(userId, 'posts.edit');    // true
const canDelete = await permissions.can(userId, 'posts.delete');  // true

// OR logic (default): user needs ANY of these
const canAny = await permissions.can(userId, ['posts.edit', 'posts.delete']);

// AND logic: user needs ALL of these
const canAll = await permissions.can(userId, ['posts.edit', 'posts.delete'], { requireAll: true });
```

---

## Next.js Integration

### Middleware (route protection)

```ts
// middleware.ts
import { NextRequest } from 'next/server';
import { createPermissionMiddleware } from '@yourorg/permissions/nextjs';
import { permissions } from '@/lib/permissions';
import { getSession } from '@/lib/auth';

const withPermission = createPermissionMiddleware(permissions, async (req) => {
  const session = await getSession(req);
  return session ? { id: session.user.id } : null;
});

const adminMiddleware = withPermission({
  roles: ['admin', 'super-admin'],
  loginRedirect: '/login',
  unauthorizedRedirect: '/403',
});

export async function middleware(req: NextRequest) {
  if (req.nextUrl.pathname.startsWith('/admin')) {
    return adminMiddleware(req);
  }
}

export const config = { matcher: ['/admin/:path*'] };
```

### Root layout with PermissionProvider

```tsx
// app/layout.tsx
import { PermissionProvider, getUserPermissionsForClient } from '@yourorg/permissions/nextjs';
import { permissions } from '@/lib/permissions';
import { getSession } from '@/lib/auth';

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  const data = session
    ? await getUserPermissionsForClient(permissions, session.user.id)
    : { permissions: [], roles: [] };

  return (
    <html>
      <body>
        <PermissionProvider permissions={data.permissions} roles={data.roles}>
          {children}
        </PermissionProvider>
      </body>
    </html>
  );
}
```

### React hooks

```tsx
'use client';
import { useCan, useHasRole } from '@yourorg/permissions/nextjs';

export function PostActions() {
  const canEdit   = useCan('posts.edit');
  const isAdmin   = useHasRole('admin');

  return (
    <div>
      {canEdit && <button>Edit</button>}
      {isAdmin && <a href="/admin">Admin Panel</a>}
    </div>
  );
}
```

### React components

```tsx
'use client';
import { Can, HasRole, Cannot } from '@yourorg/permissions/nextjs';

export function Dashboard() {
  return (
    <>
      <Can permission="posts.create">
        <button>Create Post</button>
      </Can>

      <HasRole role={['admin', 'editor']} fallback={<p>Restricted area</p>}>
        <AdminPanel />
      </HasRole>

      <Cannot permission="posts.delete">
        <p>Contact an admin to delete posts.</p>
      </Cannot>
    </>
  );
}
```

### Server actions

```ts
'use server';
import { requirePermission, requireRole } from '@yourorg/permissions/nextjs';
import { permissions } from '@/lib/permissions';
import { getSession } from '@/lib/auth';

export async function deletePost(postId: string) {
  const session = await getSession();
  if (!session) throw new Error('Unauthenticated');
  await requirePermission(permissions, session.user.id, 'posts.delete');
  // ... delete logic
}
```

---

## Team / Multi-Tenancy Usage

```ts
// Assign a role scoped to a team
await permissions.assignRole(userId, 'admin', teamId);

// Check role within a team
const isTeamAdmin = await permissions.hasRole(userId, 'admin', { teamId });

// Permission check scoped to a team
const canManage = await permissions.can(userId, 'users.manage', { teamId });
```

---

## API Reference

### `PermissionManager`

#### Permission CRUD
| Method | Description |
|--------|-------------|
| `createPermission(name, guardName?)` | Create a new permission |
| `findPermission(name, guardName?)` | Find a permission by name |
| `deletePermission(id)` | Delete a permission |
| `getAllPermissions()` | List all permissions |

#### Role CRUD
| Method | Description |
|--------|-------------|
| `createRole(name, guardName?)` | Create a new role |
| `findRole(name, guardName?)` | Find a role by name |
| `deleteRole(id)` | Delete a role |
| `getAllRoles()` | List all roles |

#### User Permissions
| Method | Description |
|--------|-------------|
| `givePermissionTo(userId, permission)` | Grant a direct permission to a user |
| `revokePermissionFrom(userId, permission)` | Revoke a direct permission from a user |
| `syncPermissions(userId, permissions[])` | Replace all direct permissions for a user |
| `getUserDirectPermissions(userId)` | Get user's direct permissions |

#### User Roles
| Method | Description |
|--------|-------------|
| `assignRole(userId, role, teamId?)` | Assign a role to a user |
| `removeRole(userId, role, teamId?)` | Remove a role from a user |
| `syncRoles(userId, roles[], teamId?)` | Replace all roles for a user |
| `getUserRoles(userId, teamId?)` | Get user's roles |

#### Role Permissions
| Method | Description |
|--------|-------------|
| `givePermissionToRole(roleId, permission)` | Grant a permission to a role |
| `revokePermissionFromRole(roleId, permission)` | Revoke a permission from a role |
| `syncRolePermissions(roleId, permissions[])` | Replace all permissions for a role |
| `getRolePermissions(roleId)` | Get role's permissions |

#### Permission Checking
| Method | Description |
|--------|-------------|
| `can(userId, permission\|permission[], options?)` | Check if user has permission(s) |
| `hasRole(userId, role\|role[], options?)` | Check if user has role(s) |
| `hasDirectPermission(userId, permission)` | Check direct permission only |
| `hasPermissionViaRole(userId, permission, options?)` | Check permission via roles only |
| `getUserPermissions(userId, options?)` | Get all user permissions (direct + roles) |

#### `PermissionCheckOptions`
```ts
interface PermissionCheckOptions {
  guardName?: string;  // Guard context
  teamId?: string;     // Team scope
  requireAll?: boolean; // true = AND logic, false = OR logic (default)
}
```

---

## Creating a Custom Adapter

Implement the `PermissionAdapter` interface:

```ts
import type { PermissionAdapter, Permission, Role } from '@yourorg/permissions';

export class MyCustomAdapter implements PermissionAdapter {
  async createPermission(name: string, guardName: string): Promise<Permission> { /* ... */ }
  async findPermission(name: string, guardName: string): Promise<Permission | null> { /* ... */ }
  // ... implement all interface methods
}
```

See `examples/prisma-adapter.ts` for a complete Prisma example.

---

## Advanced Examples

### Wildcard permissions

```ts
// Grant 'posts.*' — matches posts.view, posts.edit, posts.delete, etc.
await permissions.givePermissionTo(userId, 'posts.*');

await permissions.can(userId, 'posts.edit');   // true
await permissions.can(userId, 'posts.delete'); // true
await permissions.can(userId, 'users.manage'); // false
```

### Multiple guards

```ts
const webManager = new PermissionManager({ ..., defaultGuard: 'web' });
const apiManager = new PermissionManager({ ..., defaultGuard: 'api' });

await webManager.createPermission('dashboard.view', 'web');
await apiManager.createPermission('tokens.manage', 'api');
```

### Custom Redis cache

```ts
import type { PermissionCache } from '@yourorg/permissions';
import { createClient } from 'redis';

class RedisCache implements PermissionCache {
  constructor(private redis: ReturnType<typeof createClient>) {}

  async get(key: string) {
    const val = await this.redis.get(key);
    return val ? JSON.parse(val) : null;
  }

  async set(key: string, value: unknown, ttl?: number) {
    const serialized = JSON.stringify(value);
    if (ttl) {
      await this.redis.setEx(key, ttl, serialized);
    } else {
      await this.redis.set(key, serialized);
    }
  }

  async delete(key: string) { await this.redis.del(key); }
  async clear()             { await this.redis.flushDb(); }
}
```

---

## Credits

Inspired by [Spatie Laravel Permission](https://github.com/spatie/laravel-permission) — the gold standard for RBAC in Laravel.

## License

MIT — see [LICENSE](./LICENSE)