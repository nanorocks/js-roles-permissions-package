/**
 * Complete Next.js 14+ App Router example.
 *
 * Demonstrates:
 *  - Database setup with Drizzle + PostgreSQL
 *  - PermissionManager initialization
 *  - Seeding roles and permissions
 *  - Middleware configuration
 *  - Server actions with permission checks
 *  - Root layout with PermissionProvider
 *  - Client component using hooks and components
 *  - Team-scoped permissions
 *  - API route protection
 */

// ─── database.ts ─────────────────────────────────────────────────────────────
// import { drizzle } from 'drizzle-orm/node-postgres';
// import { Pool } from 'pg';
//
// const pool = new Pool({ connectionString: process.env.DATABASE_URL! });
// export const db = drizzle(pool);

// ─── lib/permissions.ts ───────────────────────────────────────────────────────
// import { PermissionManager, InMemoryCache } from '@yourorg/permissions';
// import { DrizzleAdapter } from '@yourorg/permissions/adapters/drizzle';
// import { db } from './database';
//
// export const permissionManager = new PermissionManager({
//   adapter: new DrizzleAdapter(db),
//   modelType: 'User',
//   defaultGuard: 'web',
//   enableTeams: true,
//   enableWildcards: true,
//   superAdminRole: 'super-admin',
//   cache: new InMemoryCache(),
//   cacheTtl: 3600, // 1 hour
// });

// ─── lib/seed-permissions.ts ──────────────────────────────────────────────────
// async function seedPermissionsAndRoles() {
//   // Create permissions
//   await permissionManager.createPermission('posts.view');
//   await permissionManager.createPermission('posts.create');
//   await permissionManager.createPermission('posts.edit');
//   await permissionManager.createPermission('posts.delete');
//   await permissionManager.createPermission('users.manage');
//   await permissionManager.createPermission('settings.manage');
//
//   // Create roles
//   const editorRole = await permissionManager.createRole('editor');
//   const adminRole  = await permissionManager.createRole('admin');
//   await permissionManager.createRole('super-admin');
//
//   // Assign permissions to roles
//   await permissionManager.syncRolePermissions(editorRole.id, [
//     'posts.view', 'posts.create', 'posts.edit',
//   ]);
//   await permissionManager.syncRolePermissions(adminRole.id, [
//     'posts.view', 'posts.create', 'posts.edit', 'posts.delete', 'users.manage',
//   ]);
//
//   console.log('Permissions and roles seeded.');
// }

// ─── middleware.ts (project root) ─────────────────────────────────────────────
// import { NextRequest } from 'next/server';
// import { createPermissionMiddleware } from '@yourorg/permissions/nextjs';
// import { permissionManager } from './lib/permissions';
// import { getSession } from './lib/auth';
//
// const withPermission = createPermissionMiddleware(permissionManager, async (req) => {
//   const session = await getSession(req);
//   return session ? { id: session.user.id, teamId: session.user.teamId } : null;
// });
//
// // Protect the /admin route
// const adminMiddleware = withPermission({
//   roles: ['admin', 'super-admin'],
//   requireAll: false,
//   loginRedirect: '/login',
//   unauthorizedRedirect: '/403',
// });
//
// // Protect /dashboard/settings
// const settingsMiddleware = withPermission({
//   permissions: ['settings.manage'],
//   loginRedirect: '/login',
//   unauthorizedRedirect: '/403',
// });
//
// export async function middleware(req: NextRequest) {
//   if (req.nextUrl.pathname.startsWith('/admin')) {
//     return adminMiddleware(req);
//   }
//   if (req.nextUrl.pathname.startsWith('/dashboard/settings')) {
//     return settingsMiddleware(req);
//   }
// }
//
// export const config = {
//   matcher: ['/admin/:path*', '/dashboard/settings/:path*'],
// };

// ─── app/actions.ts (Server Actions) ─────────────────────────────────────────
// 'use server';
// import { requirePermission, requireRole } from '@yourorg/permissions/nextjs';
// import { permissionManager } from '@/lib/permissions';
// import { getSession } from '@/lib/auth';
//
// export async function deletePost(postId: string) {
//   const session = await getSession();
//   if (!session) throw new Error('Unauthenticated');
//
//   await requirePermission(permissionManager, session.user.id, 'posts.delete');
//   // ... delete post logic
// }
//
// export async function manageTeamMember(teamId: string, memberId: string) {
//   const session = await getSession();
//   if (!session) throw new Error('Unauthenticated');
//
//   await requireRole(permissionManager, session.user.id, ['admin', 'super-admin']);
//   // ... management logic
// }

// ─── app/layout.tsx (Root Layout with PermissionProvider) ────────────────────
// import { PermissionProvider, getUserPermissionsForClient } from '@yourorg/permissions/nextjs';
// import { permissionManager } from '@/lib/permissions';
// import { getSession } from '@/lib/auth';
//
// export default async function RootLayout({ children }: { children: React.ReactNode }) {
//   const session = await getSession();
//   const { permissions, roles } = session
//     ? await getUserPermissionsForClient(permissionManager, session.user.id, session.user.teamId)
//     : { permissions: [], roles: [] };
//
//   return (
//     <html>
//       <body>
//         <PermissionProvider permissions={permissions} roles={roles}>
//           {children}
//         </PermissionProvider>
//       </body>
//     </html>
//   );
// }

// ─── app/dashboard/page.tsx (Client Component) ───────────────────────────────
// 'use client';
// import { Can, HasRole, Cannot } from '@yourorg/permissions/nextjs';
//
// export default function DashboardPage() {
//   return (
//     <div>
//       <h1>Dashboard</h1>
//
//       <Can permission="posts.create">
//         <button>Create Post</button>
//       </Can>
//
//       <HasRole role="admin">
//         <a href="/admin">Admin Panel</a>
//       </HasRole>
//
//       <Cannot permission="posts.delete">
//         <p>Contact an admin to delete posts.</p>
//       </Cannot>
//     </div>
//   );
// }

// ─── app/api/posts/route.ts ───────────────────────────────────────────────────
// import { NextRequest, NextResponse } from 'next/server';
// import { requirePermission } from '@yourorg/permissions/nextjs';
// import { permissionManager } from '@/lib/permissions';
// import { getSession } from '@/lib/auth';
//
// export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
//   const session = await getSession(req);
//   if (!session) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
//
//   try {
//     await requirePermission(permissionManager, session.user.id, 'posts.delete');
//   } catch {
//     return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
//   }
//
//   // ... delete logic
//   return NextResponse.json({ success: true });
// }

export {};
