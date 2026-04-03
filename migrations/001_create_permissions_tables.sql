-- ============================================================================
-- 001_create_permissions_tables.sql
-- PostgreSQL migration for the @yourorg/permissions package.
--
-- Creates five tables that implement Role-Based Access Control (RBAC):
--   permissions           — available permissions in the system
--   roles                 — available roles in the system
--   model_has_permissions — direct user ↔ permission assignments
--   model_has_roles       — user ↔ role assignments (team-aware)
--   role_has_permissions  — role ↔ permission assignments
-- ============================================================================

-- ─── permissions ─────────────────────────────────────────────────────────────
-- Stores individual permission records.
-- Permissions are identified by (name, guard_name) and must be unique.
CREATE TABLE IF NOT EXISTS permissions (
    id         VARCHAR(36)  NOT NULL PRIMARY KEY,
    name       VARCHAR(255) NOT NULL,
    guard_name VARCHAR(255) NOT NULL DEFAULT 'web',
    created_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT permissions_name_guard_unique UNIQUE (name, guard_name)
);

COMMENT ON TABLE  permissions            IS 'Stores all available permissions';
COMMENT ON COLUMN permissions.id         IS 'UUID primary key';
COMMENT ON COLUMN permissions.name       IS 'Human-readable permission name, e.g. posts.edit';
COMMENT ON COLUMN permissions.guard_name IS 'Authentication guard, e.g. web or api';

-- ─── roles ───────────────────────────────────────────────────────────────────
-- Stores role records. Roles group permissions together.
CREATE TABLE IF NOT EXISTS roles (
    id         VARCHAR(36)  NOT NULL PRIMARY KEY,
    name       VARCHAR(255) NOT NULL,
    guard_name VARCHAR(255) NOT NULL DEFAULT 'web',
    created_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT roles_name_guard_unique UNIQUE (name, guard_name)
);

COMMENT ON TABLE  roles            IS 'Stores all available roles';
COMMENT ON COLUMN roles.id         IS 'UUID primary key';
COMMENT ON COLUMN roles.name       IS 'Human-readable role name, e.g. admin';
COMMENT ON COLUMN roles.guard_name IS 'Authentication guard, e.g. web or api';

-- ─── model_has_permissions ───────────────────────────────────────────────────
-- Direct permission assignments to any model (typically User).
-- model_type distinguishes between different model types (e.g. 'User', 'Team').
CREATE TABLE IF NOT EXISTS model_has_permissions (
    permission_id VARCHAR(36)  NOT NULL,
    model_type    VARCHAR(255) NOT NULL,
    model_id      VARCHAR(255) NOT NULL,

    PRIMARY KEY (permission_id, model_id, model_type),

    CONSTRAINT fk_mhp_permission
        FOREIGN KEY (permission_id)
        REFERENCES permissions (id)
        ON DELETE CASCADE
);

COMMENT ON TABLE  model_has_permissions              IS 'Direct permission assignments to models';
COMMENT ON COLUMN model_has_permissions.permission_id IS 'References permissions.id';
COMMENT ON COLUMN model_has_permissions.model_type    IS 'Model class, e.g. User';
COMMENT ON COLUMN model_has_permissions.model_id      IS 'Model primary key value';

-- ─── model_has_roles ─────────────────────────────────────────────────────────
-- Role assignments to models, optionally scoped to a team.
CREATE TABLE IF NOT EXISTS model_has_roles (
    role_id    VARCHAR(36)  NOT NULL,
    model_type VARCHAR(255) NOT NULL,
    model_id   VARCHAR(255) NOT NULL,
    team_id    VARCHAR(255),

    PRIMARY KEY (role_id, model_id, model_type),

    CONSTRAINT fk_mhr_role
        FOREIGN KEY (role_id)
        REFERENCES roles (id)
        ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS model_has_roles_team_id_idx ON model_has_roles (team_id);

COMMENT ON TABLE  model_has_roles            IS 'Role assignments to models, team-aware';
COMMENT ON COLUMN model_has_roles.role_id    IS 'References roles.id';
COMMENT ON COLUMN model_has_roles.model_type IS 'Model class, e.g. User';
COMMENT ON COLUMN model_has_roles.model_id   IS 'Model primary key value';
COMMENT ON COLUMN model_has_roles.team_id    IS 'Optional team scope for multi-tenancy';

-- ─── role_has_permissions ────────────────────────────────────────────────────
-- Permission assignments to roles.
CREATE TABLE IF NOT EXISTS role_has_permissions (
    permission_id VARCHAR(36) NOT NULL,
    role_id       VARCHAR(36) NOT NULL,

    PRIMARY KEY (permission_id, role_id),

    CONSTRAINT fk_rhp_permission
        FOREIGN KEY (permission_id)
        REFERENCES permissions (id)
        ON DELETE CASCADE,

    CONSTRAINT fk_rhp_role
        FOREIGN KEY (role_id)
        REFERENCES roles (id)
        ON DELETE CASCADE
);

COMMENT ON TABLE  role_has_permissions               IS 'Permissions assigned to roles';
COMMENT ON COLUMN role_has_permissions.permission_id IS 'References permissions.id';
COMMENT ON COLUMN role_has_permissions.role_id       IS 'References roles.id';

-- ─── updated_at trigger ──────────────────────────────────────────────────────
-- Automatically updates the updated_at column on row modification.

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'permissions_updated_at'
    ) THEN
        CREATE TRIGGER permissions_updated_at
            BEFORE UPDATE ON permissions
            FOR EACH ROW EXECUTE FUNCTION set_updated_at();
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'roles_updated_at'
    ) THEN
        CREATE TRIGGER roles_updated_at
            BEFORE UPDATE ON roles
            FOR EACH ROW EXECUTE FUNCTION set_updated_at();
    END IF;
END;
$$;
