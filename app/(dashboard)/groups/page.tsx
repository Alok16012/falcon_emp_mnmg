"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useSession } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Search, Loader2, Users, Briefcase, User, Building2, ChevronDown, ChevronRight, Download, Trash2, X, ArrowLeft } from "lucide-react"
import Link from "next/link"
import * as XLSX from "xlsx"

interface Manager {
    id: string
    name: string
    email: string
}

interface Inspector {
    id: string
    name: string
    email: string
    assignmentId?: string
}

interface Project {
    id: string
    name: string
    managers: Manager[]
    inspectors: Inspector[]
}

interface CompanyGroup {
    id: string
    name: string
    projects: Project[]
}

export default function GroupsPage() {
    const { data: session, status } = useSession()
    const router = useRouter()
    const searchParams = useSearchParams()
    const projectIdParam = searchParams.get("projectId")

    const [groups, setGroups] = useState<CompanyGroup[]>([])
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState("")
    const [expandedCompanies, setExpandedCompanies] = useState<Set<string>>(new Set())
    const [deletingId, setDeletingId] = useState<string | null>(null)

    // If viewing specific project
    const [specificProject, setSpecificProject] = useState<Project | null>(null)
    const [specificCompany, setSpecificCompany] = useState<string | null>(null)

    useEffect(() => {
        if (status === "unauthenticated") {
            router.push("/login")
        } else if (status === "authenticated" && session?.user?.role !== "ADMIN" && session?.user?.role !== "MANAGER") {
            router.push("/")
        }
    }, [status, session, router])

    useEffect(() => {
        fetchGroups()
    }, [])

    const fetchGroups = async () => {
        setLoading(true)
        try {
            const res = await fetch("/api/groups")
            if (res.ok) {
                const data = await res.json()
                setGroups(data)

                // If projectId in URL, find that specific project
                if (projectIdParam) {
                    for (const company of data) {
                        const project = company.projects.find((p: Project) => p.id === projectIdParam)
                        if (project) {
                            setSpecificProject(project)
                            setSpecificCompany(company.name)
                            break
                        }
                    }
                }
            }
        } catch (error) {
            console.error("Failed to fetch groups", error)
        } finally {
            setLoading(false)
        }
    }

    const toggleCompany = (companyId: string) => {
        setExpandedCompanies(prev => {
            const newSet = new Set(prev)
            if (newSet.has(companyId)) {
                newSet.delete(companyId)
            } else {
                newSet.add(companyId)
            }
            return newSet
        })
    }

    const removeInspector = async (assignmentId: string) => {
        if (!confirm("Remove this inspector from the project?")) return
        
        setDeletingId(assignmentId)
        try {
            const res = await fetch(`/api/groups?assignmentId=${assignmentId}`, {
                method: "DELETE"
            })
            if (res.ok) {
                fetchGroups()
            }
        } catch (error) {
            console.error("Failed to remove inspector", error)
        } finally {
            setDeletingId(null)
        }
    }

    const exportToExcel = (project?: Project) => {
        const exportData: any[] = []
        
        // If specific project, export only that
        if (project) {
            project.inspectors.forEach(inspector => {
                exportData.push({
                    Role: "Inspector",
                    Name: inspector.name,
                    Email: inspector.email
                })
            })
            project.managers.forEach(manager => {
                exportData.push({
                    Role: "Manager",
                    Name: manager.name,
                    Email: manager.email
                })
            })
        } else {
            // Export all
            groups.forEach(company => {
                company.projects.forEach(project => {
                    project.inspectors.forEach(inspector => {
                        exportData.push({
                            Company: company.name,
                            Project: project.name,
                            Role: "Inspector",
                            Name: inspector.name,
                            Email: inspector.email
                        })
                    })
                    project.managers.forEach(manager => {
                        exportData.push({
                            Company: company.name,
                            Project: project.name,
                            Role: "Manager",
                            Name: manager.name,
                            Email: manager.email
                        })
                    })
                })
            })
        }

        const ws = XLSX.utils.json_to_sheet(exportData)
        const wb = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(wb, ws, project ? "Project Members" : "Groups")
        XLSX.writeFile(wb, project ? `${project.name}_members.xlsx` : "project_groups.xlsx")
    }

    const filteredGroups = groups.filter(group => {
        const matchesSearch = group.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            group.projects.some(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()))
        return matchesSearch
    })

    const canEdit = session?.user?.role === "ADMIN" || session?.user?.role === "MANAGER"

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        )
    }

    // If viewing specific project
    if (specificProject) {
        return (
            <div className="space-y-8">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Button variant="ghost" size="icon" onClick={() => router.push("/groups")}>
                            <ArrowLeft className="h-5 w-5" />
                        </Button>
                        <div>
                            <p className="text-sm text-muted-foreground">{specificCompany}</p>
                            <h1 className="text-3xl font-bold tracking-tight">{specificProject.name}</h1>
                            <p className="text-muted-foreground">Project Members</p>
                        </div>
                    </div>
                    <Button variant="outline" onClick={() => exportToExcel(specificProject)}>
                        <Download className="h-4 w-4 mr-2" />
                        Export Excel
                    </Button>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Briefcase className="h-5 w-5" />
                            Team Members
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        {/* Manager */}
                        <div>
                            <p className="text-sm font-medium mb-2">Manager</p>
                            {specificProject.managers.length > 0 ? (
                                <div className="flex flex-wrap gap-2">
                                    {specificProject.managers.map((manager) => (
                                        <Badge 
                                            key={manager.id} 
                                            variant="outline" 
                                            className="bg-purple-50 text-purple-700 border-purple-200"
                                        >
                                            {manager.name}
                                        </Badge>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-sm text-muted-foreground italic">No manager assigned</p>
                            )}
                        </div>

                        {/* Inspectors */}
                        <div>
                            <p className="text-sm font-medium mb-2">Inspectors ({specificProject.inspectors.length})</p>
                            {specificProject.inspectors.length > 0 ? (
                                <div className="space-y-2">
                                    {specificProject.inspectors.map((inspector) => (
                                        <div 
                                            key={inspector.id} 
                                            className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded p-3"
                                        >
                                            <div>
                                                <p className="font-medium">{inspector.name}</p>
                                                <p className="text-sm text-muted-foreground">{inspector.email}</p>
                                            </div>
                                            {canEdit && (
                                                <button
                                                    onClick={() => inspector.assignmentId && removeInspector(inspector.assignmentId)}
                                                    disabled={deletingId === inspector.assignmentId}
                                                    className="text-red-500 hover:text-red-700 p-2"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-sm text-muted-foreground italic">No inspectors assigned</p>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>
        )
    }

    // Normal groups view
    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Groups</h1>
                    <p className="text-muted-foreground">View company projects and team members</p>
                </div>
                {groups.length > 0 && (
                    <Button variant="outline" onClick={() => exportToExcel()}>
                        <Download className="h-4 w-4 mr-2" />
                        Export Excel
                    </Button>
                )}
            </div>

            {/* Search Bar */}
            <div className="relative w-full max-w-sm">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                    placeholder="Search by company or project name..."
                    className="pl-8"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>

            {/* Groups List */}
            {filteredGroups.length === 0 ? (
                <Card>
                    <CardContent className="flex flex-col items-center justify-center py-12">
                        <Users className="h-12 w-12 text-muted-foreground opacity-20 mb-4" />
                        <p className="text-muted-foreground mb-4">No groups found</p>
                        <Button asChild>
                            <Link href="/assignments">Go to Assignments</Link>
                        </Button>
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-4">
                    {filteredGroups.map((group) => (
                        <Card key={group.id} className="overflow-hidden">
                            <CardHeader 
                                className="cursor-pointer hover:bg-muted/50 transition-colors py-4"
                                onClick={() => toggleCompany(group.id)}
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        {expandedCompanies.has(group.id) ? (
                                            <ChevronDown className="h-5 w-5 text-muted-foreground" />
                                        ) : (
                                            <ChevronRight className="h-5 w-5 text-muted-foreground" />
                                        )}
                                        <Building2 className="h-5 w-5 text-primary" />
                                        <CardTitle className="text-lg">{group.name}</CardTitle>
                                        <Badge variant="secondary">{group.projects.length} projects</Badge>
                                    </div>
                                </div>
                            </CardHeader>
                            
                            {expandedCompanies.has(group.id) && (
                                <CardContent className="pt-0">
                                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                                        {group.projects.map((project) => (
                                            <Card key={project.id} className="bg-muted/30">
                                                <CardHeader className="pb-2">
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex items-center gap-2">
                                                            <Briefcase className="h-4 w-4 text-muted-foreground" />
                                                            <span className="font-medium">{project.name}</span>
                                                        </div>
                                                    </div>
                                                </CardHeader>
                                                <CardContent className="space-y-3">
                                                    {/* Manager */}
                                                    <div>
                                                        <p className="text-xs text-muted-foreground mb-1">Manager</p>
                                                        {project.managers.length > 0 ? (
                                                            <div className="flex flex-wrap gap-1">
                                                                {project.managers.map((manager) => (
                                                                    <Badge 
                                                                        key={manager.id} 
                                                                        variant="outline" 
                                                                        className="bg-purple-50 text-purple-700 border-purple-200 text-xs"
                                                                    >
                                                                        {manager.name}
                                                                    </Badge>
                                                                ))}
                                                            </div>
                                                        ) : (
                                                            <span className="text-xs text-muted-foreground italic">No manager</span>
                                                        )}
                                                    </div>
                                                    
                                                    {/* Inspectors */}
                                                    <div>
                                                        <p className="text-xs text-muted-foreground mb-1">
                                                            Inspectors ({project.inspectors.length})
                                                        </p>
                                                        {project.inspectors.length > 0 ? (
                                                            <div className="flex flex-col gap-1 max-h-24 overflow-y-auto">
                                                                {project.inspectors.map((inspector) => (
                                                                    <div 
                                                                        key={inspector.id} 
                                                                        className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded px-2 py-1"
                                                                    >
                                                                        <div className="flex items-center gap-1 overflow-hidden">
                                                                            <Badge 
                                                                                variant="outline" 
                                                                                className="bg-amber-50 text-amber-700 border-amber-200 text-xs"
                                                                            >
                                                                                {inspector.name}
                                                                            </Badge>
                                                                        </div>
                                                                        {canEdit && (
                                                                            <button
                                                                                onClick={() => inspector.assignmentId && removeInspector(inspector.assignmentId)}
                                                                                disabled={deletingId === inspector.assignmentId}
                                                                                className="text-red-500 hover:text-red-700 p-1"
                                                                            >
                                                                                <X className="h-3 w-3" />
                                                                            </button>
                                                                        )}
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        ) : (
                                                            <span className="text-xs text-muted-foreground italic">No inspectors</span>
                                                        )}
                                                    </div>

                                                    {/* Actions */}
                                                    <div className="flex gap-2 mt-2">
                                                        <Button 
                                                            variant="outline" 
                                                            size="sm" 
                                                            className="flex-1"
                                                            onClick={() => {
                                                                // Export only this project
                                                                exportToExcel(project)
                                                            }}
                                                        >
                                                            <Download className="h-3 w-3 mr-1" />
                                                            Export
                                                        </Button>
                                                        <Button 
                                                            variant="default" 
                                                            size="sm" 
                                                            className="flex-1"
                                                            asChild
                                                        >
                                                            <Link href={`/groups?projectId=${project.id}`}>
                                                                View Details
                                                            </Link>
                                                        </Button>
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        ))}
                                    </div>
                                </CardContent>
                            )}
                        </Card>
                    ))}
                </div>
            )}
        </div>
    )
}
