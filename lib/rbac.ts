// Role-Based Access Control (RBAC) Configuration

export type UserRole = 'super_admin' | 'verifier_admin';

export interface Permission {
    resource: string;
    actions: string[];
}

export interface RoleConfig {
    name: string;
    displayName: string;
    permissions: Permission[];
    dashboardAccess: string[];
}

// Define permissions for each role
export const ROLES: Record<UserRole, RoleConfig> = {
    super_admin: {
        name: 'super_admin',
        displayName: 'Super Administrator',
        permissions: [
            { resource: 'users', actions: ['create', 'read', 'update', 'delete'] },
            { resource: 'skilled_workers', actions: ['create', 'read', 'update', 'delete', 'verify', 'reject'] },
            { resource: 'analytics', actions: ['read'] },
            { resource: 'settings', actions: ['read', 'update'] },
            { resource: 'admins', actions: ['create', 'read', 'update', 'delete'] },
            { resource: 'banners', actions: ['create', 'read', 'update', 'delete'] },
            { resource: 'services', actions: ['create', 'read', 'update', 'delete'] },
            { resource: 'sms', actions: ['read', 'send'] },
            { resource: 'logs', actions: ['read'] },
            { resource: 'support', actions: ['read', 'update'] },
        ],
        dashboardAccess: [
            '/dashboard',
            '/users',
            '/skilled-workers',
            '/view-workers',
            '/analytics',
            '/settings',
            '/sms',
            '/logs',
            '/support'
        ]
    },
    verifier_admin: {
        name: 'verifier_admin',
        displayName: 'PESO Verifier Administrator',
        permissions: [
            { resource: 'skilled_workers', actions: ['read', 'verify', 'reject'] },
            { resource: 'analytics', actions: ['read'] },
        ],
        dashboardAccess: [
            '/dashboard',
            '/skilled-workers',
            '/view-workers',
            '/analytics'
        ]
    }
};

// Helper functions
export function hasPermission(role: UserRole, resource: string, action: string): boolean {
    const roleConfig = ROLES[role];
    if (!roleConfig) return false;

    const permission = roleConfig.permissions.find(p => p.resource === resource);
    return permission ? permission.actions.includes(action) : false;
}

export function canAccessRoute(role: UserRole, route: string): boolean {
    const roleConfig = ROLES[role];
    if (!roleConfig) return false;

    return roleConfig.dashboardAccess.some(path => route.startsWith(path));
}

export function getRoleDisplayName(role: UserRole): string {
    return ROLES[role]?.displayName || 'Unknown Role';
}

export function getAllowedRoutes(role: UserRole): string[] {
    return ROLES[role]?.dashboardAccess || [];
}
