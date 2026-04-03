'use client';

/**
 * React components for declarative permission-based rendering.
 *
 * @example
 * ```tsx
 * import { Can, HasRole, Cannot } from '@yourorg/permissions/nextjs';
 *
 * <Can permission="posts.edit">
 *   <EditButton />
 * </Can>
 *
 * <HasRole role="admin" fallback={<p>Admins only</p>}>
 *   <AdminPanel />
 * </HasRole>
 *
 * <Cannot permission="posts.delete">
 *   <p>You cannot delete posts.</p>
 * </Cannot>
 * ```
 */

import React from 'react';
import { useCan, useHasRole } from './hooks';

// ─── <Can> ────────────────────────────────────────────────────────────────────

export interface CanProps {
  /** Permission name or array of names */
  permission: string | string[];
  /** If true, user must have ALL permissions; default is ANY */
  requireAll?: boolean;
  children: React.ReactNode;
  /** Rendered when the user does NOT have the permission */
  fallback?: React.ReactNode;
}

/**
 * Renders `children` if the user has the given permission(s), otherwise `fallback`.
 */
export function Can({
  permission,
  requireAll = false,
  children,
  fallback = null,
}: CanProps): React.ReactElement {
  const allowed = useCan(permission, requireAll);
  return React.createElement(React.Fragment, null, allowed ? children : fallback);
}

// ─── <HasRole> ────────────────────────────────────────────────────────────────

export interface HasRoleProps {
  /** Role name or array of names */
  role: string | string[];
  /** If true, user must have ALL roles; default is ANY */
  requireAll?: boolean;
  children: React.ReactNode;
  /** Rendered when the user does NOT have the role */
  fallback?: React.ReactNode;
}

/**
 * Renders `children` if the user has the given role(s), otherwise `fallback`.
 */
export function HasRole({
  role,
  requireAll = false,
  children,
  fallback = null,
}: HasRoleProps): React.ReactElement {
  const allowed = useHasRole(role, requireAll);
  return React.createElement(React.Fragment, null, allowed ? children : fallback);
}

// ─── <Cannot> ─────────────────────────────────────────────────────────────────

export interface CannotProps {
  /** Permission name or array of names */
  permission: string | string[];
  /** If true, renders children only when ALL permissions are missing */
  requireAll?: boolean;
  children: React.ReactNode;
}

/**
 * Renders `children` only when the user LACKS the given permission(s).
 */
export function Cannot({
  permission,
  requireAll = false,
  children,
}: CannotProps): React.ReactElement {
  const allowed = useCan(permission, requireAll);
  return React.createElement(React.Fragment, null, allowed ? null : children);
}
