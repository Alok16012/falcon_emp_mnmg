
"use client"

import Link from "next/link"

import { useState, useEffect, useCallback } from "react"
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent,
} from "@dnd-kit/core"
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    useSortable,
    verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import {
    Plus, GripVertical, Pencil, Trash2, X, Save, Loader2,
    AlignLeft, Hash, Calendar, ChevronDown, CheckSquare, FileText, FileUp, Copy, ChevronLeft
} from "lucide-react"

type FieldType = "text" | "number" | "date" | "dropdown" | "checkbox" | "textarea" | "file"

type FormField = {
    id: string
    projectId: string
    fieldLabel: string
    fieldType: FieldType
    options: string | null
    defaultValue: string | null
    isRequired: boolean
    displayOrder: number
}

const FIELD_TYPES: { value: FieldType; label: string; icon: React.ReactNode }[] = [
    { value: "text", label: "Text", icon: <AlignLeft className="h-3 w-3" /> },
    { value: "number", label: "Number", icon: <Hash className="h-3 w-3" /> },
    { value: "date", label: "Date", icon: <Calendar className="h-3 w-3" /> },
    { value: "dropdown", label: "Dropdown", icon: <ChevronDown className="h-3 w-3" /> },
    { value: "checkbox", label: "Checkbox", icon: <CheckSquare className="h-3 w-3" /> },
    { value: "textarea", label: "Textarea", icon: <FileText className="h-3 w-3" /> },
    { value: "file", label: "File Upload", icon: <FileUp className="h-3 w-3" /> },
]

type FieldEditorFormProps = {
    initialData?: Partial<FormField>
    onSave: (data: Partial<FormField>) => Promise<void>
    onCancel: () => void
    saving: boolean
}

function FieldEditorForm({ initialData, onSave, onCancel, saving }: FieldEditorFormProps) {
    const [label, setLabel] = useState(initialData?.fieldLabel || "")
    const [type, setType] = useState<FieldType>(initialData?.fieldType || "text")
    const [required, setRequired] = useState(initialData?.isRequired || false)
    const [options, setOptions] = useState(initialData?.options || "")
    const [defaultValue, setDefaultValue] = useState(initialData?.defaultValue || "")

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        onSave({ fieldLabel: label, fieldType: type, isRequired: required, options: type === "dropdown" ? options : null, defaultValue: defaultValue || null })
    }

    return (
        <form onSubmit={handleSubmit} className="border border-[var(--border)] bg-[var(--surface2)]/50 rounded-[9px] p-[16px] space-y-[12px] relative relative">
            <div>
                <label className="block text-[12px] font-medium text-[var(--text)] mb-[5px]">Field Label <span className="text-[var(--red)]">*</span></label>
                <input
                    value={label}
                    onChange={e => setLabel(e.target.value)}
                    placeholder="e.g. Inspector Name"
                    required
                    className="w-full p-[8px_12px] bg-white border border-[var(--border)] rounded-[8px] text-[13px] text-[var(--text)] outline-none focus:border-[var(--accent)] transition-colors"
                />
            </div>
            <div>
                <label className="block text-[12px] font-medium text-[var(--text)] mb-[5px]">Field Type</label>
                <select
                    value={type}
                    onChange={e => setType(e.target.value as FieldType)}
                    className="w-full p-[8px_12px] bg-white border border-[var(--border)] rounded-[8px] text-[13px] text-[var(--text)] outline-none focus:border-[var(--accent)] transition-colors appearance-none"
                >
                    {FIELD_TYPES.map(t => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                </select>
            </div>
            {type === "dropdown" && (
                <div>
                    <label className="block text-[12px] font-medium text-[var(--text)] mb-[5px]">Options (comma separated)</label>
                    <input
                        value={options}
                        onChange={e => setOptions(e.target.value)}
                        placeholder="e.g. Good, Average, Poor"
                        className="w-full p-[8px_12px] bg-white border border-[var(--border)] rounded-[8px] text-[13px] text-[var(--text)] outline-none focus:border-[var(--accent)] transition-colors"
                    />
                </div>
            )}
            <div>
                <label className="block text-[12px] font-medium text-[var(--text)] mb-[5px]">Default Value</label>
                {type === "dropdown" ? (
                    <select
                        value={defaultValue}
                        onChange={e => setDefaultValue(e.target.value)}
                        className="w-full p-[8px_12px] bg-white border border-[var(--border)] rounded-[8px] text-[13px] text-[var(--text)] outline-none focus:border-[var(--accent)] transition-colors appearance-none"
                    >
                        <option value="">No Default</option>
                        {options.split(",").map(o => o.trim()).filter(Boolean).map(o => (
                            <option key={o} value={o}>{o}</option>
                        ))}
                    </select>
                ) : (
                    <input
                        value={defaultValue}
                        onChange={e => setDefaultValue(e.target.value)}
                        placeholder={type === "number" ? "e.g. 0" : "e.g. Sample"}
                        className="w-full p-[8px_12px] bg-white border border-[var(--border)] rounded-[8px] text-[13px] text-[var(--text)] outline-none focus:border-[var(--accent)] transition-colors"
                    />
                )}
            </div>
            <div className="flex items-center gap-2 pt-1">
                <label className="flex items-center gap-2 cursor-pointer text-[13px] font-medium text-[var(--text)] select-none">
                    <div
                        onClick={() => setRequired(r => !r)}
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors cursor-pointer ${required ? "bg-[var(--accent)]" : "bg-[var(--border2)]"}`}
                    >
                        <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${required ? "translate-x-4" : "translate-x-1"}`} />
                    </div>
                    Required Field
                </label>
            </div>
            <div className="flex gap-2 pt-2 border-t border-[var(--border)] mt-4 items-center">
                <button
                    type="submit"
                    disabled={saving || !label.trim()}
                    className="inline-flex items-center justify-center bg-[var(--accent)] text-white rounded-[8px] text-[12.5px] font-medium h-[34px] px-4 hover:opacity-90 disabled:opacity-50 transition-opacity"
                >
                    {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Save className="h-3.5 w-3.5 mr-1.5" />}
                    Save Field
                </button>
                <button
                    type="button"
                    onClick={onCancel}
                    className="inline-flex items-center justify-center bg-white border border-[var(--border)] text-[var(--text2)] rounded-[8px] text-[12.5px] font-medium h-[34px] px-4 hover:bg-[var(--surface2)] hover:text-[var(--text)] transition-colors"
                >
                    <X className="h-3.5 w-3.5 mr-1.5" /> Cancel
                </button>
            </div>
        </form>
    )
}

// Sortable row
function SortableFieldRow({
    field,
    onEdit,
    onDelete,
    isDeleting,
}: {
    field: FormField
    onEdit: () => void
    onDelete: () => void
    isDeleting: boolean
}) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: field.id })
    const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }

    const typeInfo = FIELD_TYPES.find(t => t.value === field.fieldType)

    return (
        <div ref={setNodeRef} style={style} className="flex items-center gap-[10px] p-[10px_12px] bg-white border border-[var(--border)] rounded-[9px] hover:shadow-[0_2px_8px_rgba(0,0,0,0.06)] hover:border-[var(--border2)] transition-all group">
            <button {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing text-[var(--text3)] opacity-50 hover:opacity-100 touch-none w-4 flex justify-center shrink-0">
                <GripVertical className="h-[14px] w-[14px]" />
            </button>
            <div className="flex-1 min-w-0">
                <span className="text-[12.5px] font-medium text-[var(--text)]">{field.fieldLabel}</span>
                {field.isRequired && <span className="text-[var(--red)] ml-1 text-[12px]">*</span>}
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
                <span className="flex items-center gap-1 text-[11.5px] text-[var(--text3)] bg-[var(--surface2)] border border-[var(--border)] rounded-full px-[9px] py-[3px]">
                    {typeInfo?.icon && <span className="[&>svg]:w-[11px] [&>svg]:h-[11px]">{typeInfo.icon}</span>}
                    {typeInfo?.label}
                </span>
                {field.isRequired ? (
                    <span className="text-[10.5px] font-medium rounded-full bg-[var(--red-light)] text-[var(--red)] px-[9px] py-[3px]">Required</span>
                ) : (
                    <span className="text-[10.5px] font-normal rounded-full bg-[var(--surface2)] border border-[var(--border)] text-[var(--text3)] px-[9px] py-[3px]">Optional</span>
                )}
            </div>
            <div className="flex gap-1 shrink-0">
                <button onClick={onEdit} className="w-[26px] h-[26px] rounded-[6px] flex items-center justify-center text-[var(--text3)] hover:bg-[var(--surface2)] hover:text-[var(--text)] transition-colors">
                    <Pencil className="h-[13px] w-[13px]" />
                </button>
                <button onClick={onDelete} disabled={isDeleting} className="w-[26px] h-[26px] rounded-[6px] flex items-center justify-center text-[var(--text3)] hover:bg-[var(--red-light)] hover:text-[var(--red)] disabled:opacity-50 transition-colors">
                    {isDeleting ? <Loader2 className="h-[13px] w-[13px] animate-spin" /> : <Trash2 className="h-[13px] w-[13px]" />}
                </button>
            </div>
        </div>
    )
}

// Live Preview of a single field
function FieldPreview({ field }: { field: FormField }) {
    const optionList = field.options ? field.options.split(",").map((o) => o.trim()) : []
    return (
        <div className="mb-[16px]">
            <label className="block text-[12px] font-medium text-[var(--text)] mb-[5px]">
                {field.fieldLabel}
                {field.isRequired && <span className="text-[var(--red)] ml-0.5">*</span>}
            </label>
            {field.fieldType === "text" && <input type="text" disabled defaultValue={field.defaultValue || ""} placeholder={`Enter ${field.fieldLabel.toLowerCase()}`} className="w-full p-[9px_12px] bg-[var(--surface2)] border border-[var(--border)] rounded-[8px] text-[13px] text-[var(--text3)] cursor-not-allowed box-border outline-none focus:border-[var(--accent)] focus:bg-white focus:text-[var(--text)]" />}
            {field.fieldType === "number" && <input type="number" disabled defaultValue={field.defaultValue || ""} placeholder="0" className="w-full p-[9px_12px] bg-[var(--surface2)] border border-[var(--border)] rounded-[8px] text-[13px] text-[var(--text3)] cursor-not-allowed box-border outline-none focus:border-[var(--accent)] focus:bg-white focus:text-[var(--text)]" />}
            {field.fieldType === "date" && <input type="date" disabled defaultValue={field.defaultValue || ""} className="w-full p-[9px_12px] bg-[var(--surface2)] border border-[var(--border)] rounded-[8px] text-[13px] text-[var(--text3)] cursor-not-allowed box-border outline-none focus:border-[var(--accent)] focus:bg-white focus:text-[var(--text)]" />}
            {field.fieldType === "dropdown" && (
                <select disabled defaultValue={field.defaultValue || ""} className="w-full p-[9px_12px] bg-[var(--surface2)] border border-[var(--border)] rounded-[8px] text-[13px] text-[var(--text3)] cursor-not-allowed box-border outline-none focus:border-[var(--accent)] focus:bg-white focus:text-[var(--text)] appearance-none">
                    <option value="">Select an option</option>
                    {optionList.map(o => <option key={o}>{o}</option>)}
                </select>
            )}
            {field.fieldType === "checkbox" && (
                <div className="flex items-center gap-2 mt-1">
                    <input type="checkbox" disabled defaultChecked={field.defaultValue === "true"} className="h-4 w-4 cursor-not-allowed rounded accent-[var(--accent)]" />
                    <span className="text-[13px] text-[var(--text3)]">{field.fieldLabel}</span>
                </div>
            )}
            {field.fieldType === "textarea" && <textarea disabled placeholder={field.defaultValue || `Enter ${field.fieldLabel.toLowerCase()}`} rows={3} className="w-full p-[9px_12px] bg-[var(--surface2)] border border-[var(--border)] rounded-[8px] text-[13px] text-[var(--text3)] cursor-not-allowed box-border outline-none focus:border-[var(--accent)] focus:bg-white focus:text-[var(--text)] resize-none" />}
            {field.fieldType === "file" && <input type="file" disabled className="w-full p-[6px_10px] bg-[var(--surface2)] border border-[var(--border)] rounded-[8px] text-[13px] text-[var(--text3)] cursor-not-allowed box-border file:mr-3 file:py-1 file:px-2 file:rounded-[4px] file:border-0 file:text-[11px] file:font-semibold file:bg-[var(--bg)] file:text-[var(--text2)]" />}
        </div>
    )
}

export default function FormBuilderClient({
    projectId,
    projectName,
    companyName,
    companyId,
}: {
    projectId: string
    projectName: string
    companyName: string
    companyId: string
}) {
    const [fields, setFields] = useState<FormField[]>([])
    const [loading, setLoading] = useState(true)
    const [showAddForm, setShowAddForm] = useState(false)
    const [editingId, setEditingId] = useState<string | null>(null)
    const [saving, setSaving] = useState(false)
    const [deletingId, setDeletingId] = useState<string | null>(null)
    const [loadingDefault, setLoadingDefault] = useState(false)

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    )

    const fetchFields = useCallback(async () => {
        try {
            const res = await fetch(`/api/form-templates?projectId=${projectId}`)
            const data = await res.json()
            setFields(data)
        } catch {
            console.error("Failed to fetch fields")
        } finally {
            setLoading(false)
        }
    }, [projectId])

    useEffect(() => { fetchFields() }, [fetchFields])

    const handleAddField = async (data: Partial<FormField>) => {
        setSaving(true)
        try {
            const res = await fetch("/api/form-templates", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ...data, projectId, displayOrder: fields.length }),
            })
            if (!res.ok) throw new Error("Failed")
            await fetchFields()
            setShowAddForm(false)
        } catch { /* ignore */ }
        finally { setSaving(false) }
    }

    const handleEditField = async (id: string, data: Partial<FormField>) => {
        setSaving(true)
        try {
            const res = await fetch(`/api/form-templates/${id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
            })
            if (!res.ok) throw new Error("Failed")
            await fetchFields()
            setEditingId(null)
        } catch { /* ignore */ }
        finally { setSaving(false) }
    }

    const handleDeleteField = async (id: string, label: string) => {
        if (!confirm(`Delete field "${label}"?`)) return
        setDeletingId(id)
        try {
            await fetch(`/api/form-templates/${id}`, { method: "DELETE" })
            await fetchFields()
        } catch { /* ignore */ }
        finally { setDeletingId(null) }
    }

    const handleDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event
        if (!over || active.id === over.id) return
        const oldIndex = fields.findIndex(f => f.id === active.id)
        const newIndex = fields.findIndex(f => f.id === over.id)
        const reordered = arrayMove(fields, oldIndex, newIndex)
        setFields(reordered)
        // Update displayOrder for all affected fields
        await Promise.all(
            reordered.map((field, index) =>
                fetch(`/api/form-templates/${field.id}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ displayOrder: index }),
                })
            )
        )
    }

    const handleLoadDefaultForm = async () => {
        if (!confirm("This will replace all your current fields with the default template. Continue?")) return
        setLoadingDefault(true)
        try {
            const res = await fetch("/api/form-templates/bulk-default", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ projectId }),
            })
            if (!res.ok) throw new Error("Failed to load default form")
            await fetchFields()
        } catch { /* ignore */ }
        finally { setLoadingDefault(false) }
    }

    return (
        <div className="min-h-[calc(100vh-54px)] bg-[var(--bg)] p-[22px_26px]">
            <div className="flex items-start gap-4 mb-[16px]">
                <Link
                    href={`/companies/${companyId}`}
                    className="w-8 h-8 bg-white border border-[var(--border)] rounded-[8px] flex items-center justify-center text-[var(--text2)] hover:bg-[var(--surface2)] transition-colors shrink-0 mt-1"
                >
                    <ChevronLeft className="h-4 w-4" />
                </Link>
                <div>
                    <h1 className="text-[20px] font-semibold tracking-[-0.3px] text-[var(--text)] leading-tight">Form Builder</h1>
                    <p className="text-[12px] text-[var(--text2)] mt-0.5">
                        {projectName} <span className="mx-1">•</span> {companyName}
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-[16px] h-[auto] min-h-[calc(100vh-160px)]">
                {/* LEFT PANEL — Field Editor */}
                <div className="bg-white border border-[var(--border)] rounded-[14px] overflow-hidden flex flex-col shadow-sm">
                    <div className="p-[14px_18px] border-b border-[var(--border)] flex items-center justify-between shrink-0">
                        <div className="flex items-center gap-2">
                            <h2 className="text-[13.5px] font-semibold text-[var(--text)]">Field Editor</h2>
                            <span className="bg-[var(--accent-light)] text-[var(--accent-text)] rounded-full text-[11px] font-medium px-2 py-0.5">
                                {fields.length}
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={handleLoadDefaultForm}
                                disabled={loadingDefault}
                                className="inline-flex items-center justify-center bg-white border border-[var(--border)] rounded-[8px] text-[12px] font-medium text-[var(--text2)] px-3 h-8 hover:bg-[var(--surface2)] transition-colors"
                            >
                                {loadingDefault ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Copy className="h-3.5 w-3.5 mr-1.5" />}
                                Load Default Form
                            </button>
                            {!showAddForm && (
                                <button
                                    onClick={() => { setShowAddForm(true); setEditingId(null) }}
                                    className="inline-flex items-center justify-center bg-[var(--accent)] text-white rounded-[8px] text-[12px] font-medium px-3 h-8 hover:opacity-90 transition-opacity"
                                >
                                    <Plus className="h-3.5 w-3.5 mr-1.5" /> Add Field
                                </button>
                            )}
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto p-[12px]">
                        {showAddForm && (
                            <div className="mb-[7px]">
                                <FieldEditorForm
                                    onSave={handleAddField}
                                    onCancel={() => setShowAddForm(false)}
                                    saving={saving}
                                />
                            </div>
                        )}

                        {loading ? (
                            <div className="flex items-center justify-center py-8">
                                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                            </div>
                        ) : fields.length === 0 && !showAddForm ? (
                            <div className="text-center py-8 text-[12px] text-[var(--text3)]">
                                No fields yet. Click "+ Add Field" to get started.
                            </div>
                        ) : (
                            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                                <SortableContext items={fields.map(f => f.id)} strategy={verticalListSortingStrategy}>
                                    <div className="space-y-[7px]">
                                        {fields.map(field => (
                                            <div key={field.id}>
                                                {editingId === field.id ? (
                                                    <FieldEditorForm
                                                        initialData={field}
                                                        onSave={(data) => handleEditField(field.id, data)}
                                                        onCancel={() => setEditingId(null)}
                                                        saving={saving}
                                                    />
                                                ) : (
                                                    <SortableFieldRow
                                                        field={field}
                                                        onEdit={() => { setEditingId(field.id); setShowAddForm(false) }}
                                                        onDelete={() => handleDeleteField(field.id, field.fieldLabel)}
                                                        isDeleting={deletingId === field.id}
                                                    />
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </SortableContext>
                            </DndContext>
                        )}
                    </div>
                </div>

                {/* RIGHT PANEL — Live Preview */}
                <div className="bg-white border border-[var(--border)] rounded-[14px] overflow-hidden flex flex-col shadow-sm">
                    <div className="p-[14px_18px] border-b border-[var(--border)] flex items-center justify-between shrink-0">
                        <div>
                            <h2 className="text-[13.5px] font-semibold text-[var(--text)]">Form Preview</h2>
                            <p className="text-[11.5px] text-[var(--text3)] mt-0.5">This is how inspectors will see the form</p>
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto p-[16px_18px]">
                        {fields.length === 0 ? (
                            <div className="text-center py-12 text-[12px] text-[var(--text3)] border border-dashed border-[var(--border2)] rounded-[8px]">
                                No fields yet. Add fields from the left panel.
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {fields.map(field => (
                                    <FieldPreview key={field.id} field={field} />
                                ))}
                                <div className="pt-4 border-t border-[var(--border)]">
                                    <button
                                        disabled
                                        className="w-full h-[38px] rounded-[8px] bg-[var(--surface2)] border border-[var(--border)] text-[var(--text3)] text-[13px] font-medium opacity-50 cursor-not-allowed"
                                    >
                                        Submit Inspection
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
