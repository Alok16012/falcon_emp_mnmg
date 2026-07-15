/**
 * Central list of app modules. Single source of truth for:
 *   - the Sidebar (which links to render)
 *   - the User-Management "role → modules" permission matrix
 *   - the auth session (which module keys a user's role may access)
 *
 * Add a new module here and it automatically appears in the permission
 * matrix and (once assigned to a role) in the sidebar.
 */

export type AppModule = {
    key: string
    label: string
    href: string
    /** Sidebar section this module belongs to */
    group: string
    /** true = only ADMIN can ever access it; never shown in the role matrix */
    adminOnly?: boolean
}

export const MODULES: AppModule[] = [
    { key: "dashboard", label: "Dashboard", href: "/admin", group: "MAIN" },

    { key: "employees", label: "Employees", href: "/employees", group: "HR MANAGEMENT" },
    { key: "attendance", label: "Attendance", href: "/attendance", group: "HR MANAGEMENT" },
    { key: "joinings", label: "Worker Joining", href: "/joinings", group: "HR MANAGEMENT" },
    { key: "advances", label: "Advance Salary", href: "/advances", group: "HR MANAGEMENT" },
    { key: "payroll", label: "Payroll", href: "/payroll", group: "HR MANAGEMENT" },

    { key: "inquiries", label: "Product Inquiry", href: "/inquiries", group: "SALES" },
    { key: "stock", label: "Stock Management", href: "/stock", group: "SALES" },

    { key: "hardware", label: "Hardware Devices", href: "/hardware", group: "CONFIGURATION" },
    { key: "users", label: "User Management", href: "/admin/users", group: "CONFIGURATION", adminOnly: true },
    { key: "profile", label: "My Profile", href: "/profile", group: "CONFIGURATION" },
]

/** Module keys that can be assigned to a role (excludes admin-only ones). */
export const ASSIGNABLE_MODULES = MODULES.filter(m => !m.adminOnly)

/** Every module key (used for ADMIN, who always sees everything). */
export const ALL_MODULE_KEYS = MODULES.map(m => m.key)

/** Roles whose module access can be configured (ADMIN is always full-access). */
export const CONFIGURABLE_ROLES = ["MANAGER", "INSPECTION_BOY", "CLIENT"] as const

/**
 * Fallback module access used when a role has no saved RolePermission row yet,
 * so the app behaves sensibly before anything is configured.
 */
export const DEFAULT_ROLE_MODULES: Record<string, string[]> = {
    MANAGER: ["dashboard", "employees", "attendance", "joinings", "advances", "payroll", "inquiries", "stock", "hardware", "profile"],
    INSPECTION_BOY: ["attendance", "profile"],
    CLIENT: ["profile"],
}

/** Resolve the module keys a role may access (ADMIN → all). */
export function modulesForRole(role: string, saved?: string[] | null): string[] {
    if (role === "ADMIN") return ALL_MODULE_KEYS
    if (saved && saved.length) {
        // Admin-only modules can never be granted to a non-admin role.
        const adminOnly = new Set(MODULES.filter(m => m.adminOnly).map(m => m.key))
        return saved.filter(k => !adminOnly.has(k))
    }
    return DEFAULT_ROLE_MODULES[role] ?? ["profile"]
}
