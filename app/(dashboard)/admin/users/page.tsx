"use client"

import { useState, useEffect, useCallback } from "react"
import { useSession } from "next-auth/react"
import { toast } from "sonner"
import {
    UsersRound, UserPlus, Shield, KeyRound, Trash2, Pencil, X,
    Check, Loader2, Search, ShieldCheck, Lock,
} from "lucide-react"

type AppUser = {
    id: string
    name: string
    email: string
    role: string
    isActive: boolean
    createdAt: string
}

type RolePerm = { role: string; modules: string[] }
type ModuleMeta = { key: string; label: string; group: string }

const ROLE_LABELS: Record<string, string> = {
    ADMIN: "Admin",
    MANAGER: "Manager",
    INSPECTION_BOY: "Staff",
    CLIENT: "Client",
}
const ROLE_COLORS: Record<string, string> = {
    ADMIN: "#7c3aed",
    MANAGER: "#5b5bd6",
    INSPECTION_BOY: "#1a9e6e",
    CLIENT: "#f59e0b",
}
// Roles that can be picked when creating/editing a user
const CREATE_ROLES = ["MANAGER", "INSPECTION_BOY", "CLIENT", "ADMIN"]

export default function UserManagementPage() {
    const { data: session, status } = useSession()
    const isAdmin = session?.user?.role === "ADMIN"

    const [users, setUsers] = useState<AppUser[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState("")

    // Role → module permission matrix
    const [rolePerms, setRolePerms] = useState<RolePerm[]>([])
    const [modules, setModules] = useState<ModuleMeta[]>([])
    const [activeRole, setActiveRole] = useState("MANAGER")
    const [savingPerms, setSavingPerms] = useState(false)

    // Modals
    const [showCreate, setShowCreate] = useState(false)
    const [editUser, setEditUser] = useState<AppUser | null>(null)
    const [resetUser, setResetUser] = useState<AppUser | null>(null)
    const [deleteUser, setDeleteUser] = useState<AppUser | null>(null)

    const fetchUsers = useCallback(async () => {
        try {
            const res = await fetch("/api/admin/users")
            if (!res.ok) throw new Error()
            setUsers(await res.json())
        } catch {
            toast.error("Users load nahi hue")
        } finally {
            setLoading(false)
        }
    }, [])

    const fetchPerms = useCallback(async () => {
        try {
            const res = await fetch("/api/admin/role-permissions")
            if (!res.ok) throw new Error()
            const data = await res.json()
            setRolePerms(data.roles)
            setModules(data.modules)
        } catch {
            toast.error("Permissions load nahi hue")
        }
    }, [])

    useEffect(() => {
        if (isAdmin) { fetchUsers(); fetchPerms() }
    }, [isAdmin, fetchUsers, fetchPerms])

    async function toggleActive(u: AppUser) {
        try {
            const res = await fetch(`/api/admin/users/${u.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ isActive: !u.isActive }),
            })
            if (!res.ok) throw new Error()
            setUsers(prev => prev.map(x => x.id === u.id ? { ...x, isActive: !x.isActive } : x))
        } catch {
            toast.error("Status update fail")
        }
    }

    if (status === "loading") {
        return <div className="flex items-center justify-center h-[60vh]"><Loader2 className="animate-spin text-[var(--text3)]" /></div>
    }
    if (!isAdmin) {
        return (
            <div className="flex flex-col items-center justify-center h-[60vh] text-center gap-2">
                <Lock className="text-[var(--text3)]" size={32} />
                <p className="text-[15px] font-semibold text-[var(--text)]">Sirf Admin access kar sakta hai</p>
                <p className="text-[13px] text-[var(--text3)]">User Management ke liye admin login chahiye.</p>
            </div>
        )
    }

    const filtered = users.filter(u =>
        !search ||
        u.name.toLowerCase().includes(search.toLowerCase()) ||
        u.email.toLowerCase().includes(search.toLowerCase())
    )

    const activePerm = rolePerms.find(r => r.role === activeRole)
    const moduleGroups = Array.from(new Set(modules.map(m => m.group)))

    function toggleModule(key: string) {
        setRolePerms(prev => prev.map(r => {
            if (r.role !== activeRole) return r
            const has = r.modules.includes(key)
            return { ...r, modules: has ? r.modules.filter(k => k !== key) : [...r.modules, key] }
        }))
    }

    async function savePerms() {
        if (!activePerm) return
        setSavingPerms(true)
        try {
            const res = await fetch("/api/admin/role-permissions", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ role: activeRole, modules: activePerm.modules }),
            })
            if (!res.ok) throw new Error(await res.text())
            toast.success(`${ROLE_LABELS[activeRole]} ke modules save ho gaye`)
        } catch (e) {
            toast.error(e instanceof Error ? e.message : "Save fail")
        } finally {
            setSavingPerms(false)
        }
    }

    return (
        <div className="p-4 lg:p-0 flex flex-col gap-6">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-[10px] bg-[#5b5bd6] text-white flex items-center justify-center">
                        <UsersRound size={20} />
                    </div>
                    <div>
                        <h1 className="text-[20px] font-bold text-[var(--text)] leading-tight">User Management</h1>
                        <p className="text-[13px] text-[var(--text3)]">Users banao, role do aur module access set karo</p>
                    </div>
                </div>
                <button
                    onClick={() => setShowCreate(true)}
                    className="flex items-center gap-2 bg-[#5b5bd6] text-white px-4 py-2.5 rounded-[10px] text-[13px] font-semibold hover:opacity-90 transition"
                >
                    <UserPlus size={16} /> Add User
                </button>
            </div>

            {/* Role → Module access matrix */}
            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[14px] overflow-hidden">
                <div className="px-5 py-4 border-b border-[var(--border)] flex items-center gap-2 flex-wrap">
                    <Shield size={16} className="text-[#5b5bd6]" />
                    <h2 className="text-[15px] font-semibold text-[var(--text)]">Module Access by Role</h2>
                    <span className="text-[11px] text-[var(--text3)] ml-1">Admin ko hamesha sab dikhta hai</span>
                </div>

                {/* Role tabs */}
                <div className="flex gap-1.5 px-5 pt-4 flex-wrap">
                    {rolePerms.map(r => (
                        <button
                            key={r.role}
                            onClick={() => setActiveRole(r.role)}
                            className={`px-3.5 py-1.5 rounded-full text-[12.5px] font-medium border transition ${
                                activeRole === r.role
                                    ? "text-white border-transparent"
                                    : "text-[var(--text2)] border-[var(--border)] hover:bg-[var(--surface2)]"
                            }`}
                            style={activeRole === r.role ? { background: ROLE_COLORS[r.role] || "#5b5bd6" } : undefined}
                        >
                            {ROLE_LABELS[r.role] || r.role}
                            <span className="ml-1.5 opacity-70">({r.modules.length})</span>
                        </button>
                    ))}
                </div>

                {/* Module checkboxes grouped */}
                <div className="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-5">
                    {moduleGroups.map(group => (
                        <div key={group}>
                            <p className="text-[10.5px] font-semibold text-[var(--text3)] tracking-wide uppercase mb-2">{group}</p>
                            <div className="flex flex-col gap-1.5">
                                {modules.filter(m => m.group === group).map(m => {
                                    const checked = activePerm?.modules.includes(m.key) ?? false
                                    return (
                                        <label key={m.key} className="flex items-center gap-2.5 cursor-pointer group">
                                            <span className={`h-[18px] w-[18px] rounded-[5px] border flex items-center justify-center transition ${
                                                checked ? "bg-[#1a9e6e] border-[#1a9e6e]" : "border-[var(--border)] group-hover:border-[var(--text3)]"
                                            }`}>
                                                {checked && <Check size={13} className="text-white" strokeWidth={3} />}
                                            </span>
                                            <input type="checkbox" className="hidden" checked={checked} onChange={() => toggleModule(m.key)} />
                                            <span className="text-[13px] text-[var(--text2)]">{m.label}</span>
                                        </label>
                                    )
                                })}
                            </div>
                        </div>
                    ))}
                </div>

                <div className="px-5 py-3 border-t border-[var(--border)] flex justify-end">
                    <button
                        onClick={savePerms}
                        disabled={savingPerms}
                        className="flex items-center gap-2 bg-[#1a9e6e] text-white px-4 py-2 rounded-[9px] text-[13px] font-semibold hover:opacity-90 transition disabled:opacity-60"
                    >
                        {savingPerms ? <Loader2 size={15} className="animate-spin" /> : <ShieldCheck size={15} />}
                        {ROLE_LABELS[activeRole]} ke changes save karo
                    </button>
                </div>
            </div>

            {/* Users list */}
            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[14px] overflow-hidden">
                <div className="px-5 py-4 border-b border-[var(--border)] flex items-center justify-between gap-3 flex-wrap">
                    <h2 className="text-[15px] font-semibold text-[var(--text)]">All Users <span className="text-[var(--text3)] font-normal">({users.length})</span></h2>
                    <div className="relative flex-1 sm:flex-none">
                        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text3)]" />
                        <input
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Search name / email"
                            className="pl-9 pr-3 py-2 text-[13px] rounded-[10px] border border-[var(--border)] bg-[var(--surface2)] w-full sm:w-[220px] outline-none focus:border-[#5b5bd6]"
                        />
                    </div>
                </div>

                {loading ? (
                    <div className="py-16 flex justify-center"><Loader2 className="animate-spin text-[var(--text3)]" /></div>
                ) : filtered.length === 0 ? (
                    <div className="py-16 text-center text-[13px] text-[var(--text3)]">Koi user nahi mila</div>
                ) : (
                    <>
                    {/* Mobile card list */}
                    <div className="md:hidden divide-y divide-[var(--border)]">
                        {filtered.map(u => (
                            <div key={u.id} className="px-4 py-3.5">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-[13px] font-bold shrink-0" style={{ background: ROLE_COLORS[u.role] || "#6b7280" }}>
                                        {u.name?.[0]?.toUpperCase() || "U"}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="text-[14px] font-semibold text-[var(--text)] truncate">{u.name}</p>
                                        <p className="text-[12px] text-[var(--text3)] truncate">{u.email}</p>
                                    </div>
                                    <div className="flex items-center gap-1 shrink-0">
                                        <IconBtn title="Edit" onClick={() => setEditUser(u)}><Pencil size={14} /></IconBtn>
                                        <IconBtn title="Reset password" onClick={() => setResetUser(u)}><KeyRound size={14} /></IconBtn>
                                        {u.id !== session?.user?.id && (
                                            <IconBtn title="Delete" danger onClick={() => setDeleteUser(u)}><Trash2 size={14} /></IconBtn>
                                        )}
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 mt-2 pl-[52px]">
                                    <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold text-white" style={{ background: ROLE_COLORS[u.role] || "#6b7280" }}>
                                        {ROLE_LABELS[u.role] || u.role}
                                    </span>
                                    <button
                                        onClick={() => toggleActive(u)}
                                        className={`px-2.5 py-1 rounded-full text-[11px] font-semibold ${u.isActive ? "bg-[#e8f7f1] text-[#16a34a]" : "bg-[#fef2f2] text-[#dc2626]"}`}
                                    >
                                        {u.isActive ? "Active" : "Inactive"}
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="hidden md:block overflow-x-auto">
                        <table className="w-full text-[13px]">
                            <thead>
                                <tr className="text-left text-[var(--text3)] border-b border-[var(--border)]">
                                    <th className="px-5 py-2.5 font-medium">Name</th>
                                    <th className="px-5 py-2.5 font-medium">Email</th>
                                    <th className="px-5 py-2.5 font-medium">Role</th>
                                    <th className="px-5 py-2.5 font-medium">Status</th>
                                    <th className="px-5 py-2.5 font-medium text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map(u => (
                                    <tr key={u.id} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface2)]">
                                        <td className="px-5 py-3 font-medium text-[var(--text)]">{u.name}</td>
                                        <td className="px-5 py-3 text-[var(--text2)]">{u.email}</td>
                                        <td className="px-5 py-3">
                                            <span className="px-2.5 py-1 rounded-full text-[11.5px] font-semibold text-white" style={{ background: ROLE_COLORS[u.role] || "#6b7280" }}>
                                                {ROLE_LABELS[u.role] || u.role}
                                            </span>
                                        </td>
                                        <td className="px-5 py-3">
                                            <button
                                                onClick={() => toggleActive(u)}
                                                className={`px-2.5 py-1 rounded-full text-[11.5px] font-semibold ${u.isActive ? "bg-[#e8f7f1] text-[#1a9e6e]" : "bg-[#fef2f2] text-[#dc2626]"}`}
                                            >
                                                {u.isActive ? "Active" : "Inactive"}
                                            </button>
                                        </td>
                                        <td className="px-5 py-3">
                                            <div className="flex items-center justify-end gap-1">
                                                <IconBtn title="Edit" onClick={() => setEditUser(u)}><Pencil size={14} /></IconBtn>
                                                <IconBtn title="Reset password" onClick={() => setResetUser(u)}><KeyRound size={14} /></IconBtn>
                                                {u.id !== session?.user?.id && (
                                                    <IconBtn title="Delete" danger onClick={() => setDeleteUser(u)}><Trash2 size={14} /></IconBtn>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    </>
                )}
            </div>

            {showCreate && <CreateUserModal onClose={() => setShowCreate(false)} onDone={() => { setShowCreate(false); fetchUsers() }} />}
            {editUser && <EditUserModal user={editUser} onClose={() => setEditUser(null)} onDone={() => { setEditUser(null); fetchUsers() }} />}
            {resetUser && <ResetPasswordModal user={resetUser} onClose={() => setResetUser(null)} />}
            {deleteUser && <DeleteModal user={deleteUser} onClose={() => setDeleteUser(null)} onDone={() => { setDeleteUser(null); fetchUsers() }} />}
        </div>
    )
}

function IconBtn({ children, onClick, title, danger }: { children: React.ReactNode; onClick: () => void; title: string; danger?: boolean }) {
    return (
        <button
            title={title}
            onClick={onClick}
            className={`p-1.5 rounded-[7px] transition ${danger ? "text-[#dc2626] hover:bg-[#fef2f2]" : "text-[var(--text3)] hover:bg-[var(--surface2)] hover:text-[var(--text)]"}`}
        >
            {children}
        </button>
    )
}

function ModalShell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
    return (
        <div className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-[var(--surface)] rounded-[14px] w-full max-w-[420px] shadow-2xl" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
                    <h3 className="text-[15px] font-semibold text-[var(--text)]">{title}</h3>
                    <button onClick={onClose} className="p-1 rounded-md hover:bg-[var(--surface2)] text-[var(--text3)]"><X size={18} /></button>
                </div>
                <div className="p-5">{children}</div>
            </div>
        </div>
    )
}

const inputCls = "w-full px-3 py-2.5 text-[13px] rounded-[9px] border border-[var(--border)] bg-[var(--surface2)] outline-none focus:border-[#5b5bd6]"
const labelCls = "block text-[12px] font-medium text-[var(--text2)] mb-1.5"

function CreateUserModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
    const [form, setForm] = useState({ name: "", email: "", password: "", role: "MANAGER" })
    const [busy, setBusy] = useState(false)

    async function submit() {
        if (!form.name || !form.email || !form.password) { toast.error("Naam, email, password bharo"); return }
        setBusy(true)
        try {
            const res = await fetch("/api/admin/users", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(form),
            })
            if (!res.ok) { const t = await res.json().catch(() => ({})); throw new Error(t.error || "Create fail") }
            toast.success("User ban gaya")
            onDone()
        } catch (e) {
            toast.error(e instanceof Error ? e.message : "Create fail")
        } finally {
            setBusy(false)
        }
    }

    return (
        <ModalShell title="Add New User" onClose={onClose}>
            <div className="flex flex-col gap-3.5">
                <div><label className={labelCls}>Full Name</label><input className={inputCls} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
                <div><label className={labelCls}>Email</label><input className={inputCls} type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></div>
                <div><label className={labelCls}>Password</label><input className={inputCls} value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} /></div>
                <div>
                    <label className={labelCls}>Role</label>
                    <select className={inputCls} value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
                        {CREATE_ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r] || r}</option>)}
                    </select>
                    <p className="text-[11px] text-[var(--text3)] mt-1.5">Role ke modules upar &quot;Module Access by Role&quot; me set karo.</p>
                </div>
                <button onClick={submit} disabled={busy} className="mt-1 bg-[#5b5bd6] text-white py-2.5 rounded-[9px] text-[13px] font-semibold hover:opacity-90 disabled:opacity-60 flex items-center justify-center gap-2">
                    {busy && <Loader2 size={15} className="animate-spin" />} Create User
                </button>
            </div>
        </ModalShell>
    )
}

function EditUserModal({ user, onClose, onDone }: { user: AppUser; onClose: () => void; onDone: () => void }) {
    const [form, setForm] = useState({ name: user.name, email: user.email, role: user.role })
    const [busy, setBusy] = useState(false)

    async function submit() {
        setBusy(true)
        try {
            const res = await fetch(`/api/admin/users/${user.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(form),
            })
            if (!res.ok) { const t = await res.json().catch(() => ({})); throw new Error(t.error || "Update fail") }
            toast.success("User update ho gaya")
            onDone()
        } catch (e) {
            toast.error(e instanceof Error ? e.message : "Update fail")
        } finally {
            setBusy(false)
        }
    }

    return (
        <ModalShell title="Edit User" onClose={onClose}>
            <div className="flex flex-col gap-3.5">
                <div><label className={labelCls}>Full Name</label><input className={inputCls} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
                <div><label className={labelCls}>Email</label><input className={inputCls} type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></div>
                <div>
                    <label className={labelCls}>Role</label>
                    <select className={inputCls} value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
                        {CREATE_ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r] || r}</option>)}
                    </select>
                </div>
                <button onClick={submit} disabled={busy} className="mt-1 bg-[#5b5bd6] text-white py-2.5 rounded-[9px] text-[13px] font-semibold hover:opacity-90 disabled:opacity-60 flex items-center justify-center gap-2">
                    {busy && <Loader2 size={15} className="animate-spin" />} Save Changes
                </button>
            </div>
        </ModalShell>
    )
}

function ResetPasswordModal({ user, onClose }: { user: AppUser; onClose: () => void }) {
    const [password, setPassword] = useState("")
    const [busy, setBusy] = useState(false)

    async function submit() {
        if (password.length < 4) { toast.error("Password chhota hai"); return }
        setBusy(true)
        try {
            const res = await fetch(`/api/admin/users/${user.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ password }),
            })
            if (!res.ok) throw new Error()
            toast.success("Password reset ho gaya")
            onClose()
        } catch {
            toast.error("Reset fail")
        } finally {
            setBusy(false)
        }
    }

    return (
        <ModalShell title={`Reset Password — ${user.name}`} onClose={onClose}>
            <div className="flex flex-col gap-3.5">
                <div><label className={labelCls}>New Password</label><input className={inputCls} value={password} onChange={e => setPassword(e.target.value)} /></div>
                <button onClick={submit} disabled={busy} className="mt-1 bg-[#5b5bd6] text-white py-2.5 rounded-[9px] text-[13px] font-semibold hover:opacity-90 disabled:opacity-60 flex items-center justify-center gap-2">
                    {busy && <Loader2 size={15} className="animate-spin" />} Reset Password
                </button>
            </div>
        </ModalShell>
    )
}

function DeleteModal({ user, onClose, onDone }: { user: AppUser; onClose: () => void; onDone: () => void }) {
    const [busy, setBusy] = useState(false)

    async function submit() {
        setBusy(true)
        try {
            const res = await fetch(`/api/admin/users/${user.id}`, { method: "DELETE" })
            if (!res.ok) { const t = await res.json().catch(() => ({})); throw new Error(t.error || "Delete fail") }
            toast.success("User delete ho gaya")
            onDone()
        } catch (e) {
            toast.error(e instanceof Error ? e.message : "Delete fail")
        } finally {
            setBusy(false)
        }
    }

    return (
        <ModalShell title="Delete User" onClose={onClose}>
            <div className="flex flex-col gap-4">
                <p className="text-[13px] text-[var(--text2)]"><b>{user.name}</b> ({user.email}) ko delete karna hai? Ye undo nahi hoga.</p>
                <div className="flex gap-2 justify-end">
                    <button onClick={onClose} className="px-4 py-2 rounded-[9px] text-[13px] font-medium border border-[var(--border)] text-[var(--text2)] hover:bg-[var(--surface2)]">Cancel</button>
                    <button onClick={submit} disabled={busy} className="px-4 py-2 rounded-[9px] text-[13px] font-semibold bg-[#dc2626] text-white hover:opacity-90 disabled:opacity-60 flex items-center gap-2">
                        {busy && <Loader2 size={15} className="animate-spin" />} Delete
                    </button>
                </div>
            </div>
        </ModalShell>
    )
}
