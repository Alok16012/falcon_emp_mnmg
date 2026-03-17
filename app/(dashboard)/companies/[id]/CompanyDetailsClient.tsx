
"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { Plus, ChevronLeft, MapPin, User, Phone, Calendar, Pencil, Trash2, Loader2, LayoutTemplate } from "lucide-react"

type Project = {
    id: string
    name: string
    description: string | null
    createdAt: string
}

type Company = {
    id: string
    name: string
    address: string | null
    contactPerson: string | null
    contactPhone: string | null
    logoUrl: string | null
    projects: Project[]
}

type Session = {
    user: {
        id: string
        name: string
        role: string
    }
}

export default function CompanyDetailsClient({
    companyId,
    session,
}: {
    companyId: string
    session: Session
}) {
    const router = useRouter()
    const [company, setCompany] = useState<Company | null>(null)
    const [loading, setLoading] = useState(true)
    const [deletingProjectId, setDeletingProjectId] = useState<string | null>(null)
    const [deletingCompany, setDeletingCompany] = useState(false)

    const isAdminOrManager = session.user.role === "ADMIN" || session.user.role === "MANAGER"

    const fetchCompany = async () => {
        try {
            const res = await fetch(`/api/companies/${companyId}`)
            if (!res.ok) throw new Error("Not found")
            const data = await res.json()
            setCompany(data)
        } catch {
            setCompany(null)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchCompany()
    }, [companyId])

    const handleDeleteProject = async (projectId: string, projectName: string) => {
        if (!confirm(`WARNING: Are you sure you want to delete project "${projectName}"? This will permanently delete ALL related assignments and inspections. This action CANNOT be undone.`)) return
        setDeletingProjectId(projectId)
        try {
            const res = await fetch(`/api/projects/${projectId}`, { method: "DELETE" })
            if (!res.ok) throw new Error("Failed")
            await fetchCompany()
        } catch {
            alert("Failed to delete project. Please try again.")
        } finally {
            setDeletingProjectId(null)
        }
    }

    const handleDeleteCompany = async () => {
        if (!company) return
        if (!confirm(`WARNING: Are you sure you want to delete "${company.name}"? This will permanently delete ALL related projects, assignments, and inspections. This action CANNOT be undone.`)) return
        setDeletingCompany(true)
        try {
            const res = await fetch(`/api/companies/${companyId}`, { method: "DELETE" })
            if (!res.ok) throw new Error("Failed")
            router.push("/companies")
            router.refresh()
        } catch {
            alert("Failed to delete company. Please try again.")
            setDeletingCompany(false)
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[50vh]">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        )
    }

    if (!company) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
                <h1 className="text-2xl font-bold">Company not found</h1>
                <Button asChild><Link href="/companies">Go Back</Link></Button>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Button variant="outline" size="icon" asChild>
                        <Link href="/companies"><ChevronLeft className="h-4 w-4" /></Link>
                    </Button>
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">{company.name}</h1>
                        <div className="flex flex-wrap items-center gap-2 text-muted-foreground text-sm mt-1">
                            {company.address && (
                                <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {company.address}</span>
                            )}
                            {company.contactPerson && (
                                <>
                                    <span>•</span>
                                    <span className="flex items-center gap-1"><User className="h-3 w-3" /> {company.contactPerson}</span>
                                </>
                            )}
                            {company.contactPhone && (
                                <>
                                    <span>•</span>
                                    <span className="flex items-center gap-1"><Phone className="h-3 w-3" /> {company.contactPhone}</span>
                                </>
                            )}
                        </div>
                    </div>
                </div>
                {isAdminOrManager && (
                    <div className="flex gap-2">
                        <Button variant="outline" asChild>
                            <Link href={`/companies/${companyId}/edit`}>
                                <Pencil className="mr-2 h-4 w-4" /> Edit
                            </Link>
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={handleDeleteCompany}
                            disabled={deletingCompany}
                        >
                            {deletingCompany ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                            Delete Company
                        </Button>
                    </div>
                )}
            </div>

            {/* Projects Section */}
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-xl font-semibold">Projects ({company.projects.length})</h2>
                    <Button asChild size="sm">
                        <Link href={`/projects/create?companyId=${company.id}`}>
                            <Plus className="mr-2 h-4 w-4" /> Add Project
                        </Link>
                    </Button>
                </div>

                {company.projects.length === 0 ? (
                    <Card>
                        <CardContent className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
                            <p>No projects found for this company.</p>
                            <Button variant="link" asChild>
                                <Link href={`/projects/create?companyId=${company.id}`}>Create the first project</Link>
                            </Button>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {company.projects.map((project) => (
                            <Card key={project.id}>
                                <CardHeader>
                                    <CardTitle className="text-base">{project.name}</CardTitle>
                                    <CardDescription className="line-clamp-2">{project.description || "No description"}</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="text-xs text-muted-foreground flex items-center gap-1">
                                        <Calendar className="h-3 w-3" />
                                        Created {new Date(project.createdAt).toLocaleDateString()}
                                    </div>
                                </CardContent>
                                {isAdminOrManager && (
                                    <CardFooter className="flex flex-wrap justify-end gap-2 pt-0">
                                        <Button variant="outline" size="sm" asChild>
                                            <Link href={`/projects/${project.id}/form-builder`}>
                                                <LayoutTemplate className="h-3 w-3 mr-1" /> Form Builder
                                            </Link>
                                        </Button>
                                        <Button variant="outline" size="sm" asChild>
                                            <Link href={`/projects/${project.id}/edit`}>
                                                <Pencil className="h-3 w-3 mr-1" /> Edit
                                            </Link>
                                        </Button>
                                        <Button
                                            variant="destructive"
                                            size="sm"
                                            onClick={() => handleDeleteProject(project.id, project.name)}
                                            disabled={deletingProjectId === project.id}
                                        >
                                            {deletingProjectId === project.id
                                                ? <Loader2 className="h-3 w-3 animate-spin" />
                                                : <Trash2 className="h-3 w-3 mr-1" />}
                                            Delete
                                        </Button>
                                    </CardFooter>
                                )}
                            </Card>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
