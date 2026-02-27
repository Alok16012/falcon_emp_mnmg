"use client"

import { useState, useRef } from "react"
import * as XLSX from "xlsx"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import {
    Upload,
    Download,
    FileSpreadsheet,
    CheckCircle2,
    XCircle,
    Loader2,
    Users
} from "lucide-react"
import { toast } from "sonner"

interface InspectorData {
    Name?: string
    Email?: string
    Phone?: string
    name?: string
    email?: string
    phone?: string
}

interface CreatedInspector {
    name: string
    email: string
    id: string
    tempPassword: string
    phone?: string
}

interface FailedInspector {
    name: string
    email: string
    error: string
}

interface BulkImportInspectorsProps {
    onImportComplete?: () => void
}

export default function BulkImportInspectors({ onImportComplete }: BulkImportInspectorsProps) {
    const [open, setOpen] = useState(false)
    const [step, setStep] = useState<"template" | "upload" | "preview" | "importing" | "results">("template")
    const [file, setFile] = useState<File | null>(null)
    const [parsedData, setParsedData] = useState<InspectorData[]>([])
    const [importing, setImporting] = useState(false)
    const [results, setResults] = useState<{ created: CreatedInspector[]; failed: FailedInspector[] } | null>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)

    const downloadTemplate = () => {
        const ws = XLSX.utils.json_to_sheet([
            { Name: "John Doe", Email: "john@example.com", Phone: "1234567890" },
            { Name: "Jane Smith", Email: "jane@example.com", Phone: "9876543210" }
        ])
        const wb = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(wb, ws, "Inspectors")
        XLSX.writeFile(wb, "inspectors_template.xlsx")
    }

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0]
        if (!selectedFile) return

        setFile(selectedFile)

        const reader = new FileReader()
        reader.onload = (event) => {
            try {
                const data = new Uint8Array(event.target?.result as ArrayBuffer)
                const workbook = XLSX.read(data, { type: "array" })
                const firstSheet = workbook.Sheets[workbook.SheetNames[0]]
                const json = XLSX.utils.sheet_to_json<InspectorData>(firstSheet)

                const validData = json
                    .filter(row => row.Name && row.Email)
                    .map(row => ({
                        name: String(row.Name).trim(),
                        email: String(row.Email).trim().toLowerCase(),
                        phone: row.Phone ? String(row.Phone).trim() : ""
                    }))

                if (validData.length === 0) {
                    toast.error("No valid rows found in the file")
                    return
                }

                setParsedData(validData)
                setStep("preview")
            } catch (error) {
                toast.error("Failed to parse Excel file")
                console.error(error)
            }
        }
        reader.readAsArrayBuffer(selectedFile)
    }

    const handleImport = async () => {
        if (parsedData.length === 0) return

        setImporting(true)
        setStep("importing")

        try {
            const res = await fetch("/api/admin/inspectors/bulk", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ inspectors: parsedData })
            })

            const data = await res.json()

            if (!res.ok) {
                throw new Error(data.error || "Import failed")
            }

            setResults(data)
            setStep("results")
            toast.success(`Successfully imported ${data.created.length} inspectors`)
            onImportComplete?.()
        } catch (error: any) {
            toast.error(error.message || "Import failed")
            setStep("preview")
        } finally {
            setImporting(false)
        }
    }

    const exportResults = () => {
        if (!results) return

        const exportData = [
            ...results.created.map(c => ({
                Status: "Success",
                Name: c.name,
                Email: c.email,
                ID: c.id,
                "Temp Password": c.tempPassword,
                Phone: c.phone || ""
            })),
            ...results.failed.map(f => ({
                Status: "Failed",
                Name: f.name,
                Email: f.email,
                ID: "",
                "Temp Password": "",
                Error: f.error
            }))
        ]

        const ws = XLSX.utils.json_to_sheet(exportData)
        const wb = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(wb, ws, "Import Results")
        XLSX.writeFile(wb, "inspectors_import_results.xlsx")
    }

    const resetDialog = () => {
        setStep("template")
        setFile(null)
        setParsedData([])
        setResults(null)
    }

    const handleOpenChange = (isOpen: boolean) => {
        setOpen(isOpen)
        if (!isOpen) {
            setTimeout(resetDialog, 300)
        }
    }

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogTrigger asChild>
                <Button variant="outline">
                    <Users className="h-4 w-4 mr-2" />
                    Bulk Import
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Bulk Import Inspectors</DialogTitle>
                    <DialogDescription>
                        Import multiple inspectors from an Excel file
                    </DialogDescription>
                </DialogHeader>

                {step === "template" && (
                    <div className="space-y-4 py-4">
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <FileSpreadsheet className="h-5 w-5 text-green-600" />
                                    Step 1: Download Template
                                </CardTitle>
                                <CardDescription>
                                    Download the Excel template and fill in inspector details
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <Button onClick={downloadTemplate} className="w-full">
                                    <Download className="h-4 w-4 mr-2" />
                                    Download Excel Template
                                </Button>
                                <p className="text-xs text-muted-foreground mt-3 text-center">
                                    Template contains columns: Name, Email, Phone
                                </p>
                            </CardContent>
                        </Card>

                        <div className="text-center">
                            <p className="text-sm text-muted-foreground mb-2">After filling the template, upload it below</p>
                            <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
                                <Upload className="h-4 w-4 mr-2" />
                                Upload Filled Template
                            </Button>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".xlsx,.xls"
                                className="hidden"
                                onChange={handleFileChange}
                            />
                        </div>
                    </div>
                )}

                {step === "preview" && (
                    <div className="space-y-4 py-4">
                        <div className="flex items-center justify-between">
                            <h3 className="font-medium">Preview</h3>
                            <Badge variant="secondary">{parsedData.length} inspectors</Badge>
                        </div>

                        <div className="border rounded-lg overflow-hidden max-h-64 overflow-y-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-muted">
                                    <tr>
                                        <th className="px-3 py-2 text-left font-medium">Name</th>
                                        <th className="px-3 py-2 text-left font-medium">Email</th>
                                        <th className="px-3 py-2 text-left font-medium">Phone</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {parsedData.map((row, idx) => (
                                        <tr key={idx} className="border-t">
                                            <td className="px-3 py-2">{row.name}</td>
                                            <td className="px-3 py-2">{row.email}</td>
                                            <td className="px-3 py-2 text-muted-foreground">{row.phone || "-"}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <div className="flex gap-3">
                            <Button variant="outline" onClick={() => { setStep("template"); setFile(null); }}>
                                Back
                            </Button>
                            <Button className="flex-1" onClick={handleImport}>
                                Import {parsedData.length} Inspectors
                            </Button>
                        </div>
                    </div>
                )}

                {step === "importing" && (
                    <div className="py-12 text-center space-y-4">
                        <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary" />
                        <p className="text-muted-foreground">Importing inspectors...</p>
                    </div>
                )}

                {step === "results" && results && (
                    <div className="space-y-4 py-4">
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2 text-green-600">
                                <CheckCircle2 className="h-5 w-5" />
                                <span className="font-medium">{results.created.length} created</span>
                            </div>
                            {results.failed.length > 0 && (
                                <div className="flex items-center gap-2 text-red-600">
                                    <XCircle className="h-5 w-5" />
                                    <span className="font-medium">{results.failed.length} failed</span>
                                </div>
                            )}
                        </div>

                        {results.created.length > 0 && (
                            <div className="border rounded-lg overflow-hidden max-h-48 overflow-y-auto">
                                <table className="w-full text-sm">
                                    <thead className="bg-muted">
                                        <tr>
                                            <th className="px-3 py-2 text-left font-medium">Name</th>
                                            <th className="px-3 py-2 text-left font-medium">Email</th>
                                            <th className="px-3 py-2 text-left font-medium">Temp Password</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {results.created.map((row, idx) => (
                                            <tr key={idx} className="border-t bg-green-50/50">
                                                <td className="px-3 py-2">{row.name}</td>
                                                <td className="px-3 py-2">{row.email}</td>
                                                <td className="px-3 py-2 font-mono text-xs">{row.tempPassword}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {results.failed.length > 0 && (
                            <div className="border rounded-lg overflow-hidden max-h-32 overflow-y-auto">
                                <table className="w-full text-sm">
                                    <thead className="bg-muted">
                                        <tr>
                                            <th className="px-3 py-2 text-left font-medium">Name</th>
                                            <th className="px-3 py-2 text-left font-medium">Email</th>
                                            <th className="px-3 py-2 text-left font-medium">Error</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {results.failed.map((row, idx) => (
                                            <tr key={idx} className="border-t bg-red-50/50">
                                                <td className="px-3 py-2">{row.name}</td>
                                                <td className="px-3 py-2">{row.email}</td>
                                                <td className="px-3 py-2 text-red-600 text-xs">{row.error}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        <div className="flex gap-3 pt-2">
                            <Button variant="outline" onClick={exportResults}>
                                <Download className="h-4 w-4 mr-2" />
                                Export Results
                            </Button>
                            <Button className="flex-1" onClick={() => handleOpenChange(false)}>
                                Done
                            </Button>
                        </div>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    )
}
