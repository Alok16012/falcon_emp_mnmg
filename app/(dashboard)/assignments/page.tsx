
"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { Loader2, Trash2, Zap } from "lucide-react"

export default function AssignmentsPage() {
    const { data: session, status } = useSession()
    const router = useRouter()

    useEffect(() => {
        if (status === "unauthenticated") {
            router.push("/login")
        } else if (status === "authenticated" && session?.user?.role !== "ADMIN" && session?.user?.role !== "MANAGER") {
            router.push("/client")
        }
    }, [status, session, router])

    const [companies, setCompanies] = useState<any[]>([])
    const [projects, setProjects] = useState<any[]>([])
    const [inspectors, setInspectors] = useState<any[]>([])
    const [managers, setManagers] = useState<any[]>([])
    const [assignments, setAssignments] = useState<any[]>([])
    const [groups, setGroups] = useState<any[]>([])

    const [selectedCompanyId, setSelectedCompanyId] = useState("")
    const [selectedProjectId, setSelectedProjectId] = useState("")
    const [selectedInspectorIds, setSelectedInspectorIds] = useState<string[]>([])
    const [selectedManagerIds, setSelectedManagerIds] = useState<string[]>([])

    const [loading, setLoading] = useState(false)
    const [fetching, setFetching] = useState(true)
    const [searchTerm, setSearchTerm] = useState("")
    const [filterStatus, setFilterStatus] = useState("all")

    useEffect(() => {
        fetchInitialData()
        fetchGroups()
    }, [])

    useEffect(() => {
        if (selectedCompanyId) {
            fetchProjects(selectedCompanyId)
        } else {
            setProjects([])
            setSelectedProjectId("")
        }
    }, [selectedCompanyId])

    const fetchGroups = async () => {
        try {
            const res = await fetch("/api/groups")
            if (res.ok) setGroups(await res.json())
        } catch (error) {
            console.error("Failed to fetch groups", error)
        }
    }

    const handleGroupSelect = async (groupProjectId: string) => {
        if (!groupProjectId) return
        // Find company by searching groups
        for (const company of groups) {
            const project = company.projects?.find((p: any) => p.id === groupProjectId)
            if (project) {
                setSelectedCompanyId(company.id)
                // fetch projects for that company first
                try {
                    const res = await fetch(`/api/projects?companyId=${company.id}`)
                    if (res.ok) {
                        const data = await res.json()
                        if (Array.isArray(data)) setProjects(data)
                    }
                } catch { }
                setSelectedProjectId(groupProjectId)

                // Pre-select group's managers and inspectors
                if (project.managers) {
                    setSelectedManagerIds(project.managers.map((m: any) => m.id))
                }
                if (project.inspectors) {
                    setSelectedInspectorIds(project.inspectors.map((i: any) => i.id))
                }

                break
            }
        }
    }

    const fetchInitialData = async () => {
        setFetching(true)
        try {
            const [compRes, insRes, mgrRes, assRes] = await Promise.all([
                fetch("/api/companies"),
                fetch("/api/users?role=INSPECTION_BOY"),
                fetch("/api/users?role=MANAGER"),
                fetch(`/api/assignments?t=${Date.now()}`)
            ])

            if (compRes.ok) setCompanies(await compRes.json())
            if (insRes.ok) setInspectors(await insRes.json())
            if (mgrRes.ok) setManagers(await mgrRes.json())
            if (assRes.ok) {
                const data = await assRes.json()
                setAssignments(Array.isArray(data) ? data : [])
            }
        } catch (error) {
            console.error("Failed to fetch data", error)
            setAssignments([])
        } finally {
            setFetching(false)
        }
    }

    const fetchProjects = async (companyId: string) => {
        try {
            const res = await fetch(`/api/projects?companyId=${companyId}`)
            if (res.ok) {
                const data = await res.json()
                if (Array.isArray(data)) {
                    setProjects(data)
                } else {
                    setProjects([])
                }
            } else {
                setProjects([])
            }
        } catch (error) {
            console.error("Failed to fetch projects", error)
            setProjects([])
        }
    }

    const handleAssign = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!selectedProjectId || (selectedInspectorIds.length === 0 && selectedManagerIds.length === 0)) return

        setLoading(true)
        try {
            const res = await fetch("/api/assignments", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    projectId: selectedProjectId,
                    inspectorIds: selectedInspectorIds.length > 0 ? selectedInspectorIds : undefined,
                    managerIds: selectedManagerIds.length > 0 ? selectedManagerIds : undefined
                })
            })

            if (res.ok) {
                const result = await res.json()

                // Refresh list and groups
                const assRes = await fetch(`/api/assignments?t=${Date.now()}`)
                const assData = await assRes.json()
                setAssignments(Array.isArray(assData) ? assData : [])
                fetchGroups() // Also update the group dropdown data

                // Reset form
                setSelectedInspectorIds([])
                setSelectedManagerIds([])
                setSelectedProjectId("")
                setSelectedCompanyId("")

                // Show results
                const createdCount = result.created?.length || 0
                const failedCount = result.failed?.length || 0
                const managerAssigned = selectedManagerIds.length > 0

                if (failedCount > 0) {
                    alert(`${createdCount} inspector(s) assigned. ${failedCount} failed (duplicates). ${managerAssigned ? 'Managers also assigned.' : ''}`)
                } else if (createdCount > 0 || managerAssigned) {
                    alert(`${createdCount > 0 ? createdCount + ' inspector(s)' : ''} ${managerAssigned ? (createdCount > 0 ? 'and ' : '') + selectedManagerIds.length + ' manager(s)' : ''} assigned successfully!`)
                }
            } else {
                const error = await res.json()
                alert(error.error + (error.details ? ": " + error.details : "") || "Failed to assign")
            }
        } catch (error) {
            alert("An error occurred")
        } finally {
            setLoading(false)
        }
    }

    const handleCancel = async (id: string) => {
        if (!confirm("Are you sure you want to cancel this assignment?")) return

        try {
            const res = await fetch(`/api/assignments/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: "cancelled" })
            })

            if (res.ok) {
                setAssignments(assignments.map(a => a.id === id ? { ...a, status: "cancelled" } : a))
            }
        } catch (error) {
            alert("Failed to cancel assignment")
        }
    }

    const handleDelete = async (id: string) => {
        if (!confirm("Are you sure you want to permanently delete this assignment and all its inspections? This cannot be undone.")) return

        try {
            const res = await fetch(`/api/assignments/${id}`, {
                method: "DELETE",
            })

            if (res.ok) {
                setAssignments(assignments.filter(a => a.id !== id))
            } else {
                alert("Failed to delete assignment")
            }
        } catch (error) {
            alert("An error occurred while deleting")
        }
    }

    const filteredAssignments = Array.isArray(assignments) ? assignments.filter(a => {
        const matchesSearch =
            a.project?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            a.inspectionBoy?.name?.toLowerCase().includes(searchTerm.toLowerCase())

        const matchesStatus = filterStatus === "all" || a.status === filterStatus

        return matchesSearch && matchesStatus
    }) : []

    const getStatusColor = (status: string) => {
        switch (status) {
            case "active": return "bg-green-100 text-green-800 border-green-200"
            case "completed": return "bg-gray-100 text-gray-800 border-gray-200"
            case "cancelled": return "bg-red-100 text-red-800 border-red-200"
            default: return "bg-blue-100 text-blue-800 border-blue-200"
        }
    }

    if (status === "loading" || fetching) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        )
    }

    if (session?.user?.role !== "ADMIN" && session?.user?.role !== "MANAGER") {
        return null // Will redirect in useEffect
    }

    const inputClasses = "w-full p-[10px_14px] bg-[var(--surface2)] border border-[var(--border)] rounded-[9px] text-[13px] text-[var(--text)] outline-none transition-all placeholder:text-[var(--text3)] focus:border-[var(--accent)] focus:bg-white focus:shadow-[0_0_0_3px_rgba(26,158,110,0.08)] font-[Inter] appearance-none"
    const dropdownBg = { backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%239e9b95' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E\")", backgroundRepeat: "no-repeat", backgroundPosition: "right 14px center", paddingRight: "36px" }

    return (
        <div className="min-h-[calc(100vh-54px)] bg-[var(--bg)] p-[24px_28px] w-full">
            
            {/* PAGE TITLE ROW */}
            <div className="flex justify-between items-center mb-[20px]">
                <h1 className="text-[22px] font-semibold tracking-[-0.4px] text-[var(--text)]">
                    Assignments
                </h1>
                <button
                    onClick={() => {
                        const el = document.getElementById("new-assignment-form")
                        el?.scrollIntoView({ behavior: 'smooth' })
                        el?.querySelector("select")?.focus()
                    }}
                    className="inline-flex items-center justify-center bg-[var(--accent)] text-white px-[20px] py-[9px] rounded-[9px] text-[13px] font-medium hover:bg-[#158a5e] transition-colors"
                >
                    Create Assignment
                </button>
            </div>

            {/* MAIN GRID */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-[20px] items-start">
                
                {/* LEFT COLUMN: ASSIGNMENT FORM */}
                <div>
                    {/* CARD 1: QUICK SELECT */}
                    {groups.length > 0 && (
                        <div className="bg-white border border-[var(--border)] rounded-[14px] p-[18px_20px] mb-[14px]">
                            <div className="flex items-center gap-[8px] mb-[6px]">
                                <Zap className="h-[16px] w-[16px] text-[var(--amber)]" />
                                <h2 className="text-[13.5px] font-semibold text-[var(--text)]">Quick Select Existing Group</h2>
                            </div>
                            <p className="text-[12.5px] text-[var(--text2)] mb-[12px]">
                                Select an existing group to auto-fill Company and Project below
                            </p>
                            <select
                                className={`${inputClasses} cursor-pointer`}
                                style={dropdownBg}
                                defaultValue=""
                                onChange={(e) => handleGroupSelect(e.target.value)}
                            >
                                <option value="">— Select a group to auto-fill —</option>
                                {groups.map((company: any) =>
                                    company.projects?.map((project: any) => (
                                        <option key={project.id} value={project.id}>
                                            {company.name} → {project.name} ({project.inspectors?.length ?? 0} inspectors)
                                        </option>
                                    ))
                                )}
                            </select>
                        </div>
                    )}

                    {/* CARD 2: NEW ASSIGNMENT FORM */}
                    <div id="new-assignment-form" className="bg-white border border-[var(--border)] rounded-[14px] p-[22px]">
                        <div className="mb-[18px]">
                            <h2 className="text-[15px] font-semibold text-[var(--text)] mb-[4px]">New Assignment</h2>
                            <p className="text-[13px] text-[var(--text2)]">Assign members to a specific project.</p>
                        </div>
                        
                        <form onSubmit={handleAssign}>
                            {/* Company + Project */}
                            <div className="grid grid-cols-2 gap-[12px] mb-[18px]">
                                <div>
                                    <label htmlFor="company" className="block text-[12.5px] font-medium text-[var(--text)] mb-[6px]">
                                        Select Company <span className="text-[var(--red)] ml-[2px]">*</span>
                                    </label>
                                    <select
                                        id="company"
                                        className={`${inputClasses} cursor-pointer`}
                                        style={dropdownBg}
                                        value={selectedCompanyId}
                                        onChange={(e) => setSelectedCompanyId(e.target.value)}
                                        required
                                    >
                                        <option value="">Select Company</option>
                                        {companies.map((c: any) => (
                                            <option key={c.id} value={c.id}>{c.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label htmlFor="project" className="block text-[12.5px] font-medium text-[var(--text)] mb-[6px]">
                                        Select Project <span className="text-[var(--red)] ml-[2px]">*</span>
                                    </label>
                                    <select
                                        id="project"
                                        className={`${inputClasses} cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-[var(--bg)]`}
                                        style={dropdownBg}
                                        value={selectedProjectId}
                                        onChange={(e) => setSelectedProjectId(e.target.value)}
                                        disabled={!selectedCompanyId}
                                        required
                                    >
                                        <option value="">Select Project</option>
                                        {projects.map((p: any) => (
                                            <option key={p.id} value={p.id}>{p.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {/* SELECT INSPECTORS */}
                            <div className="mb-[16px]">
                                <label className="block text-[12.5px] font-medium text-[var(--text)] mb-[8px]">
                                    Select Inspectors
                                </label>
                                <div className="bg-[var(--surface2)] border border-[var(--border)] rounded-[10px] py-[4px] max-h-[200px] overflow-y-auto">
                                    {inspectors.length === 0 ? (
                                        <p className="text-[13px] text-[var(--text3)] p-[9px_14px]">No inspectors available</p>
                                    ) : (
                                        inspectors.map((i: any) => {
                                            const isChecked = selectedInspectorIds.includes(i.id)
                                            return (
                                                <label key={i.id} className="flex items-center gap-[10px] p-[9px_14px] border-b border-[var(--border)] last:border-b-0 cursor-pointer transition-colors hover:bg-[var(--accent-light)]">
                                                    <input
                                                        type="checkbox"
                                                        checked={isChecked}
                                                        onChange={(e) => {
                                                            if (e.target.checked) setSelectedInspectorIds([...selectedInspectorIds, i.id])
                                                            else setSelectedInspectorIds(selectedInspectorIds.filter(id => id !== i.id))
                                                        }}
                                                        className="sr-only"
                                                    />
                                                    <div className={`w-[16px] h-[16px] border-[1.5px] rounded-[4px] flex items-center justify-center transition-colors shrink-0 ${isChecked ? "bg-[var(--accent)] border-[var(--accent)]" : "bg-white border-[#d4d1ca]"}`}>
                                                        {isChecked && <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-white"><polyline points="20 6 9 17 4 12"></polyline></svg>}
                                                    </div>
                                                    <span className="text-[13px] font-medium text-[var(--text)]">{i.name}</span>
                                                    <span className="text-[12px] text-[var(--text3)] ml-[4px]">({i.email})</span>
                                                </label>
                                            )
                                        })
                                    )}
                                </div>
                            </div>

                            {/* ASSIGN MANAGERS */}
                            <div className="mt-[16px]">
                                <label className="block text-[12.5px] font-medium text-[var(--text)] mb-[8px]">
                                    Assign Managers <span className="text-[var(--text3)] font-normal ml-1">(Optional)</span>
                                </label>
                                <div className="bg-[var(--surface2)] border border-[var(--border)] rounded-[10px] py-[4px] max-h-[150px] overflow-y-auto">
                                    {managers.length === 0 ? (
                                        <p className="text-[13px] text-[var(--text3)] p-[9px_14px]">No managers available</p>
                                    ) : (
                                        managers.map((m: any) => {
                                            const isChecked = selectedManagerIds.includes(m.id)
                                            return (
                                                <label key={m.id} className="flex items-center gap-[10px] p-[9px_14px] border-b border-[var(--border)] last:border-b-0 cursor-pointer transition-colors hover:bg-[var(--accent-light)]">
                                                    <input
                                                        type="checkbox"
                                                        checked={isChecked}
                                                        onChange={(e) => {
                                                            if (e.target.checked) setSelectedManagerIds([...selectedManagerIds, m.id])
                                                            else setSelectedManagerIds(selectedManagerIds.filter(id => id !== m.id))
                                                        }}
                                                        className="sr-only"
                                                    />
                                                    <div className={`w-[16px] h-[16px] border-[1.5px] rounded-[4px] flex items-center justify-center transition-colors shrink-0 ${isChecked ? "bg-[var(--accent)] border-[var(--accent)]" : "bg-white border-[#d4d1ca]"}`}>
                                                        {isChecked && <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-white"><polyline points="20 6 9 17 4 12"></polyline></svg>}
                                                    </div>
                                                    <span className="text-[13px] font-medium text-[var(--text)]">{m.name}</span>
                                                    <span className="text-[12px] text-[var(--text3)] ml-[4px]">({m.email})</span>
                                                </label>
                                            )
                                        })
                                    )}
                                </div>
                            </div>

                            {/* FORM ACTIONS */}
                            <div className="mt-[18px] flex justify-end gap-[10px]">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setSelectedInspectorIds([])
                                        setSelectedManagerIds([])
                                        setSelectedProjectId("")
                                        setSelectedCompanyId("")
                                    }}
                                    className="inline-flex items-center justify-center bg-white border border-[var(--border)] text-[var(--text2)] px-[20px] py-[9px] rounded-[9px] text-[13px] font-medium cursor-pointer hover:bg-[var(--surface2)] hover:text-[var(--text)] transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={loading || !selectedProjectId || (selectedInspectorIds.length === 0 && selectedManagerIds.length === 0)}
                                    className="inline-flex items-center justify-center bg-[var(--accent)] text-white border-0 px-[20px] py-[9px] rounded-[9px] text-[13px] font-medium cursor-pointer hover:bg-[#158a5e] disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                                >
                                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Create Assignment
                                </button>
                            </div>
                        </form>
                    </div>
                </div>

                {/* RIGHT COLUMN: ASSIGNMENTS TABLE */}
                <div className="bg-white border border-[var(--border)] rounded-[14px] overflow-hidden sticky top-[24px]">
                    <div className="p-[14px_18px] border-b border-[var(--border)] flex justify-between items-center bg-white z-20">
                        <h2 className="text-[13.5px] font-semibold text-[var(--text)]">Assignments</h2>
                        <select 
                            className={`${inputClasses} py-[6px] text-[12px] min-w-[120px] w-auto cursor-pointer`}
                            style={{ ...dropdownBg, paddingRight: "30px", backgroundPosition: "right 10px center" }}
                            value={filterStatus}
                            onChange={(e) => setFilterStatus(e.target.value)}
                        >
                            <option value="all">All Status</option>
                            <option value="active">Active</option>
                            <option value="manager_only">Manager</option>
                            <option value="completed">Completed</option>
                            <option value="cancelled">Cancelled</option>
                        </select>
                    </div>
                    
                    <div className="overflow-x-auto max-h-[calc(100vh-140px)] overflow-y-auto">
                        {filteredAssignments.length === 0 ? (
                            <div className="p-[24px] text-center text-[13px] text-[var(--text3)]">
                                No assignments found.
                            </div>
                        ) : (
                            <table className="w-full text-left border-collapse">
                                <thead className="sticky top-0 z-10 bg-[var(--surface2)]">
                                    <tr className="border-b border-[var(--border)]">
                                        <th className="p-[10px_16px] text-[11px] font-medium text-[var(--text3)] uppercase tracking-[0.5px]">Inspector</th>
                                        <th className="p-[10px_16px] text-[11px] font-medium text-[var(--text3)] uppercase tracking-[0.5px]">Project</th>
                                        <th className="p-[10px_16px] text-[11px] font-medium text-[var(--text3)] uppercase tracking-[0.5px]">Company</th>
                                        <th className="p-[10px_16px] text-[11px] font-medium text-[var(--text3)] uppercase tracking-[0.5px]">Status</th>
                                        <th className="p-[10px_16px] text-right text-[11px] font-medium text-[var(--text3)] uppercase tracking-[0.5px]">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredAssignments.map((a: any) => (
                                        <tr key={a.id} className="border-b border-[var(--border)] last:border-b-0 hover:bg-[var(--surface2)] transition-colors">
                                            <td className="p-[12px_16px]">
                                                <div className="text-[13px] font-medium text-[var(--text)] mb-[1px]">
                                                    {a.inspectionBoy?.name || "Pending Inspector"}
                                                </div>
                                                <div className="text-[11.5px] text-[var(--text3)] mt-[1px]">
                                                    {a.inspectionBoy?.email || a.assigner?.name || "No email"}
                                                </div>
                                            </td>
                                            <td className="p-[12px_16px]">
                                                <div className="text-[13px] text-[var(--text2)]">{a.project.name}</div>
                                            </td>
                                            <td className="p-[12px_16px]">
                                                <div className="text-[13px] text-[var(--text2)]">{a.project.company.name}</div>
                                            </td>
                                            <td className="p-[12px_16px]">
                                                {a.status === "active" && <span className="inline-flex items-center px-[10px] py-[3px] rounded-[20px] text-[11.5px] font-medium bg-[var(--accent-light)] text-[var(--accent-text)]">Active</span>}
                                                {a.status === "manager_only" && <span className="inline-flex items-center px-[10px] py-[3px] rounded-[20px] text-[11.5px] font-medium bg-[var(--surface2)] border border-[var(--border)] text-[var(--text3)]">Manager Only</span>}
                                                {a.status === "completed" && <span className="inline-flex items-center px-[10px] py-[3px] rounded-[20px] text-[11.5px] font-medium bg-[#f3f4f6] text-[#374151]">Completed</span>}
                                                {a.status === "cancelled" && <span className="inline-flex items-center px-[10px] py-[3px] rounded-[20px] text-[11.5px] font-medium bg-[var(--red-light)] text-[var(--red)]">Cancelled</span>}
                                                {/* If nothing matches, basic inactive badge */}
                                                {!["active", "manager_only", "completed", "cancelled"].includes(a.status) && (
                                                    <span className="inline-flex items-center px-[10px] py-[3px] rounded-[20px] text-[11.5px] font-medium bg-[var(--surface2)] border border-[var(--border)] text-[var(--text3)]">Inactive</span>
                                                )}
                                            </td>
                                            <td className="p-[12px_16px] text-right space-x-[8px]">
                                                <button
                                                    onClick={() => handleDelete(a.id)}
                                                    className="w-[28px] h-[28px] inline-flex items-center justify-center rounded-[7px] text-[var(--text3)] hover:bg-[var(--red-light)] hover:text-[var(--red)] transition-colors"
                                                    title="Delete Assignment"
                                                >
                                                    <Trash2 className="h-[14px] w-[14px]" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>

            </div>
        </div>
    )
}
