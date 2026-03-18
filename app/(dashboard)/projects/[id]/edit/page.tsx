
"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { ChevronLeft, Loader2 } from "lucide-react"

type Project = {
    id: string
    name: string
    description: string | null
    companyId: string
}

export default function EditProjectPage({ params }: { params: { id: string } }) {
    const router = useRouter()
    const [project, setProject] = useState<Project | null>(null)
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState("")
    const [name, setName] = useState("")
    const [description, setDescription] = useState("")

    useEffect(() => {
        const fetchProject = async () => {
            try {
                const res = await fetch(`/api/projects/${params.id}`)
                if (!res.ok) throw new Error("Not found")
                const data = await res.json()
                setProject(data)
                setName(data.name)
                setDescription(data.description || "")
            } catch {
                setError("Project not found")
            } finally {
                setLoading(false)
            }
        }
        fetchProject()
    }, [params.id])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setSaving(true)
        setError("")
        try {
            const res = await fetch(`/api/projects/${params.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name, description }),
            })
            if (!res.ok) throw new Error("Failed to update")
            router.push(project ? `/companies/${project.companyId}` : "/companies")
            router.refresh()
        } catch {
            setError("Something went wrong. Please try again.")
        } finally {
            setSaving(false)
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[50vh]">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        )
    }

    if (!project) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
                <h1 className="text-2xl font-bold">Project not found</h1>
                <Link href="/companies" className="inline-flex items-center justify-center bg-white border border-[var(--border)] text-[var(--text2)] px-4 py-2 rounded-md text-sm hover:bg-[var(--surface2)]">
                    Go Back
                </Link>
            </div>
        )
    }

    const inputClasses = "w-full p-[10px_14px] bg-[var(--surface2)] border border-[var(--border)] rounded-[9px] text-[13px] text-[var(--text)] outline-none transition-all placeholder:text-[var(--text3)] focus:border-[var(--accent)] focus:bg-white focus:shadow-[0_0_0_3px_rgba(26,158,110,0.08)]"

    return (
        <div className="min-h-[calc(100vh-54px)] bg-[var(--bg)] py-[28px] px-[24px]">
            <div className="max-w-[520px] mx-auto w-full">
                {/* Header Row */}
                <div className="flex items-center gap-[14px] mb-[28px]">
                    <Link
                        href={`/companies/${project.companyId}`}
                        className="w-[32px] h-[32px] bg-white border border-[var(--border)] rounded-[8px] flex items-center justify-center shrink-0 hover:bg-[var(--surface2)] transition-colors"
                    >
                        <ChevronLeft className="h-4 w-4 text-[var(--text2)]" />
                    </Link>
                    <h1 className="text-[22px] font-semibold tracking-[-0.4px] text-[var(--text)]">
                        Edit Project
                    </h1>
                </div>

                {/* Form Card */}
                <div className="bg-white border border-[var(--border)] rounded-[14px] p-[28px] shadow-none">
                    <form onSubmit={handleSubmit}>
                        {/* Card Header */}
                        <div className="mb-[24px]">
                            <h2 className="text-[16px] font-semibold text-[var(--text)] mb-1">
                                Project Details
                            </h2>
                            <p className="text-[13px] text-[var(--text2)] leading-[1.5]">
                                Update the information for this project.
                            </p>
                        </div>

                        <div className="flex flex-col gap-[18px]">
                            {error && (
                                <div className="p-3 text-[13px] text-[var(--red)] bg-[var(--red-light)] border border-[#fca5a5] rounded-[9px]">
                                    {error}
                                </div>
                            )}

                            {/* Field: Name */}
                            <div className="flex flex-col gap-[6px]">
                                <label htmlFor="name" className="text-[13px] font-medium text-[var(--text)] block">
                                    Project Name <span className="text-[var(--red)] ml-[2px]">*</span>
                                </label>
                                <input
                                    id="name"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    required
                                    placeholder="Project Alpha"
                                    className={inputClasses}
                                />
                            </div>

                            {/* Field: Description */}
                            <div className="flex flex-col gap-[6px]">
                                <label htmlFor="description" className="text-[13px] font-medium text-[var(--text)] block">
                                    Description
                                </label>
                                <textarea
                                    id="description"
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    placeholder="Brief description of the project..."
                                    className={`${inputClasses} min-h-[90px] resize-y`}
                                />
                            </div>

                            {/* Divider & Actions */}
                            <div className="border-t border-[var(--border)] mt-[8px] pt-[20px] flex justify-end gap-[10px]">
                                <Link
                                    href={`/companies/${project.companyId}`}
                                    className="inline-flex items-center justify-center bg-white border border-[var(--border)] text-[var(--text2)] px-[20px] py-[9px] rounded-[9px] text-[13px] font-medium cursor-pointer hover:bg-[var(--surface2)] hover:text-[var(--text)] transition-colors"
                                >
                                    Cancel
                                </Link>
                                <button
                                    type="submit"
                                    disabled={saving || !name.trim()}
                                    className="inline-flex items-center justify-center bg-[var(--accent)] text-white border-0 px-[20px] py-[9px] rounded-[9px] text-[13px] font-medium cursor-pointer hover:bg-[#158a5e] disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                                >
                                    {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Save Changes
                                </button>
                            </div>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    )
}
