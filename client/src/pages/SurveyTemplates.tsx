import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Plus, Pencil, Trash2, FileText, GripVertical, Upload, Image, ArrowLeft, Eye, EyeOff, Settings2, ChevronRight, Monitor } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor, TouchSensor, useSensor, useSensors, type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

const FIELD_TYPES = [
  { value: "text", label: "ข้อความ" },
  { value: "number", label: "ตัวเลข" },
  { value: "textarea", label: "ข้อความยาว" },
  { value: "select", label: "เลือก (Dropdown)" },
  { value: "checkbox", label: "ช่องติ๊ก (เดี่ยว)" },
  { value: "checkbox_group", label: "ช่องติ๊ก (หลายตัวเลือก)" },
  { value: "radio", label: "ตัวเลือก (Radio)" },
  { value: "date", label: "วันที่" },
  { value: "distance", label: "ระยะทาง (เมตร)" },
  { value: "yes_no", label: "มี / ไม่มี" },
  { value: "section_header", label: "หัวข้อ Section" },
] as const;

type FieldType = typeof FIELD_TYPES[number]["value"];

function getFieldTypeLabel(type: string) {
  return FIELD_TYPES.find(f => f.value === type)?.label || type;
}

// ==================== MAIN PAGE ====================
export default function SurveyTemplates() {
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null);

  return (
    <DashboardLayout>
      {selectedTemplateId ? (
        <TemplateEditor templateId={selectedTemplateId} onBack={() => setSelectedTemplateId(null)} />
      ) : (
        <TemplateList onSelect={setSelectedTemplateId} />
      )}
    </DashboardLayout>
  );
}

// ==================== TEMPLATE LIST ====================
function TemplateList({ onSelect }: { onSelect: (id: number) => void }) {
  const { data: templates, isLoading, refetch } = trpc.surveyTemplate.list.useQuery();
  const { data: sources } = trpc.source.list.useQuery();
  const [showCreate, setShowCreate] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; name: string } | null>(null);

  const deleteMutation = trpc.surveyTemplate.delete.useMutation({
    onSuccess: () => { toast.success("ลบ Template สำเร็จ"); refetch(); setDeleteTarget(null); },
    onError: (e) => toast.error(e.message),
  });

  const getSourceName = (sourceId: number | null) => {
    if (!sourceId || !sources) return null;
    const src = sources.find((s: any) => s.id === sourceId);
    return src?.name || null;
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <FileText className="h-6 w-6" /> จัดการ Template ฟอร์มสำรวจ
          </h1>
          <p className="text-sm text-muted-foreground mt-1">สร้างและจัดการ Template ฟอร์มสำรวจสำหรับแต่ละแหล่งที่มา</p>
        </div>
        <Button onClick={() => setShowCreate(true)} size="sm" className="gap-1.5">
          <Plus className="h-4 w-4" /> สร้าง Template
        </Button>
      </div>

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[1,2,3].map(i => <Skeleton key={i} className="h-40 rounded-xl" />)}
        </div>
      ) : !templates?.length ? (
        <Card className="p-8 text-center">
          <FileText className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
          <p className="text-muted-foreground">ยังไม่มี Template</p>
          <p className="text-sm text-muted-foreground/70 mt-1">สร้าง Template เพื่อกำหนดฟิลด์ฟอร์มสำรวจสำหรับแต่ละแหล่งที่มา</p>
          <Button onClick={() => setShowCreate(true)} size="sm" className="mt-4 gap-1.5">
            <Plus className="h-4 w-4" /> สร้าง Template แรก
          </Button>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map((t: any) => (
            <Card
              key={t.id}
              className="p-4 hover:shadow-md transition-shadow cursor-pointer group"
              onClick={() => onSelect(t.id)}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold truncate">{t.name}</h3>
                  <div className="flex items-center gap-2 mt-1.5">
                    {t.sourceId && getSourceName(t.sourceId) ? (
                      <Badge variant="secondary" className="text-xs">{getSourceName(t.sourceId)}</Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">ไม่ผูกแหล่งที่มา</span>
                    )}
                    {!t.isActive && <Badge variant="outline" className="text-xs text-orange-600">ปิดใช้งาน</Badge>}
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground/40 group-hover:text-foreground transition-colors shrink-0" />
              </div>
              <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
                {t.pdfLogoUrl && <span className="flex items-center gap-1"><Image className="h-3 w-3" /> มีโลโก้</span>}
                {t.pdfHeaderTitle && <span className="truncate">PDF: {t.pdfHeaderTitle}</span>}
              </div>
              <div className="mt-2 flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  สร้างเมื่อ {new Date(t.createdAt).toLocaleDateString("th-TH")}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 text-destructive hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={(e) => { e.stopPropagation(); setDeleteTarget({ id: t.id, name: t.name }); }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <CreateTemplateDialog open={showCreate} onOpenChange={setShowCreate} onCreated={(id) => { refetch(); onSelect(id); }} />

      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ลบ Template "{deleteTarget?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>ข้อมูลฟิลด์ทั้งหมดใน Template นี้จะถูกลบ รวมถึงข้อมูลที่กรอกไว้ในงานสำรวจที่ใช้ Template นี้</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteTarget && deleteMutation.mutate({ id: deleteTarget.id })}
            >
              ลบ
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ==================== CREATE TEMPLATE DIALOG ====================
function CreateTemplateDialog({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (v: boolean) => void; onCreated: (id: number) => void }) {
  const [name, setName] = useState("");
  const [sourceId, setSourceId] = useState<number | null>(null);
  const { data: sources } = trpc.source.list.useQuery();

  const createMutation = trpc.surveyTemplate.create.useMutation({
    onSuccess: (data) => {
      toast.success("สร้าง Template สำเร็จ");
      onOpenChange(false);
      setName("");
      setSourceId(null);
      onCreated(data.id);
    },
    onError: (e) => toast.error(e.message),
  });

  const handleSubmit = () => {
    if (!name.trim()) { toast.error("กรุณาระบุชื่อ Template"); return; }
    createMutation.mutate({ name: name.trim(), sourceId });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>สร้าง Template ฟอร์มสำรวจ</DialogTitle>
          <DialogDescription>กำหนดชื่อและเลือกแหล่งที่มาที่จะใช้ Template นี้</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label>ชื่อ Template *</Label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="เช่น Gulf SSR" className="mt-1" />
          </div>
          <div>
            <Label>ผูกกับแหล่งที่มา</Label>
            <Select value={sourceId?.toString() || "none"} onValueChange={v => setSourceId(v === "none" ? null : parseInt(v))}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="เลือกแหล่งที่มา (ไม่บังคับ)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">ไม่ผูก</SelectItem>
                {sources?.map((s: any) => (
                  <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1">เมื่อผูกแล้ว งานสำรวจที่มาจากแหล่งนี้จะใช้ฟอร์มตาม Template นี้อัตโนมัติ</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>ยกเลิก</Button>
          <Button onClick={handleSubmit} disabled={createMutation.isPending}>
            {createMutation.isPending ? "กำลังสร้าง..." : "สร้าง Template"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ==================== TEMPLATE EDITOR ====================
function TemplateEditor({ templateId, onBack }: { templateId: number; onBack: () => void }) {
  const { data: template, isLoading, refetch } = trpc.surveyTemplate.getById.useQuery({ id: templateId });
  const { data: sources } = trpc.source.list.useQuery();
  const [showFieldDialog, setShowFieldDialog] = useState(false);
  const [editingField, setEditingField] = useState<any>(null);
  const [deleteFieldTarget, setDeleteFieldTarget] = useState<{ id: number; label: string } | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const deleteFieldMutation = trpc.surveyTemplate.deleteField.useMutation({
    onSuccess: () => { toast.success("ลบฟิลด์สำเร็จ"); refetch(); setDeleteFieldTarget(null); },
    onError: (e) => toast.error(e.message),
  });

  const reorderMutation = trpc.surveyTemplate.reorderFields.useMutation({
    onError: (e) => toast.error(e.message),
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id || !template?.fields) return;
    const oldIndex = template.fields.findIndex((f: any) => f.id === active.id);
    const newIndex = template.fields.findIndex((f: any) => f.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const newOrder = arrayMove(template.fields, oldIndex, newIndex);
    // Optimistic: refetch will correct
    reorderMutation.mutate({ templateId, fieldIds: newOrder.map((f: any) => f.id) }, {
      onSuccess: () => refetch(),
    });
  }, [template?.fields, templateId, reorderMutation, refetch]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  if (!template) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">ไม่พบ Template</p>
        <Button variant="outline" onClick={onBack} className="mt-4">กลับ</Button>
      </div>
    );
  }

  const sourceName = template.sourceId && sources ? sources.find((s: any) => s.id === template.sourceId)?.name : null;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onBack} className="gap-1.5 -ml-2">
            <ArrowLeft className="h-4 w-4" /> กลับ
          </Button>
          <div>
            <h1 className="text-xl font-bold tracking-tight">{template.name}</h1>
            <div className="flex items-center gap-2 mt-0.5">
              {sourceName && <Badge variant="secondary" className="text-xs">{sourceName}</Badge>}
              {!template.isActive && <Badge variant="outline" className="text-xs text-orange-600">ปิดใช้งาน</Badge>}
              {template.pdfHeaderTitle && <span className="text-xs text-muted-foreground">PDF: {template.pdfHeaderTitle}</span>}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowPreview(true)} className="gap-1.5">
            <Monitor className="h-4 w-4" /> ดูตัวอย่าง
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowSettings(true)} className="gap-1.5">
            <Settings2 className="h-4 w-4" /> ตั้งค่า
          </Button>
          <Button size="sm" onClick={() => { setEditingField(null); setShowFieldDialog(true); }} className="gap-1.5">
            <Plus className="h-4 w-4" /> เพิ่มฟิลด์
          </Button>
        </div>
      </div>

      {/* Fields List */}
      {!template.fields?.length ? (
        <Card className="p-8 text-center">
          <FileText className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
          <p className="text-muted-foreground">ยังไม่มีฟิลด์ใน Template นี้</p>
          <p className="text-sm text-muted-foreground/70 mt-1">เพิ่มฟิลด์เพื่อกำหนดข้อมูลที่ต้องกรอกในฟอร์มสำรวจ</p>
          <Button size="sm" onClick={() => { setEditingField(null); setShowFieldDialog(true); }} className="mt-4 gap-1.5">
            <Plus className="h-4 w-4" /> เพิ่มฟิลด์แรก
          </Button>
        </Card>
      ) : (
        <Card className="divide-y">
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={template.fields.map((f: any) => f.id)} strategy={verticalListSortingStrategy}>
              {template.fields.map((field: any) => (
                <SortableField
                  key={field.id}
                  field={field}
                  onEdit={() => { setEditingField(field); setShowFieldDialog(true); }}
                  onDelete={() => setDeleteFieldTarget({ id: field.id, label: field.fieldLabel })}
                />
              ))}
            </SortableContext>
          </DndContext>
        </Card>
      )}

      {/* Field Dialog */}
      <FieldFormDialog
        open={showFieldDialog}
        onOpenChange={(v) => { setShowFieldDialog(v); if (!v) setEditingField(null); }}
        templateId={templateId}
        editingField={editingField}
        currentFieldCount={template.fields?.length || 0}
        onSaved={refetch}
      />

      {/* Preview Dialog */}
      <FormPreviewDialog
        open={showPreview}
        onOpenChange={setShowPreview}
        template={template}
      />

      {/* Settings Dialog */}
      <TemplateSettingsDialog
        open={showSettings}
        onOpenChange={setShowSettings}
        template={template}
        sources={sources || []}
        onSaved={refetch}
      />

      {/* Delete Field Confirm */}
      <AlertDialog open={!!deleteFieldTarget} onOpenChange={() => setDeleteFieldTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ลบฟิลด์ "{deleteFieldTarget?.label}"?</AlertDialogTitle>
            <AlertDialogDescription>ข้อมูลที่กรอกไว้ในฟิลด์นี้ทุกงานสำรวจจะถูกลบด้วย</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteFieldTarget && deleteFieldMutation.mutate({ id: deleteFieldTarget.id })}
            >
              ลบ
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ==================== SORTABLE FIELD ITEM ====================
function SortableField({ field, onEdit, onDelete }: { field: any; onEdit: () => void; onDelete: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: field.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };

  const isSectionHeader = field.fieldType === "section_header";

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 px-3 py-2.5 sm:px-4 sm:py-3 group ${isSectionHeader ? "bg-muted/50" : ""}`}
    >
      <button {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing touch-none p-1 -m-1 text-muted-foreground/40 hover:text-muted-foreground">
        <GripVertical className="h-4 w-4" />
      </button>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={`text-sm ${isSectionHeader ? "font-bold text-foreground" : "font-medium"}`}>
            {field.fieldLabel}
          </span>
          {field.required && <span className="text-xs text-red-500">*</span>}
        </div>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          <Badge variant="outline" className="text-[10px] h-5">{getFieldTypeLabel(field.fieldType)}</Badge>
          {field.sectionGroup && <span className="text-[10px] text-muted-foreground">กลุ่ม: {field.sectionGroup}</span>}
          {field.hasOtherOption && <Badge variant="secondary" className="text-[10px] h-5">มีช่อง "อื่นๆ"</Badge>}
          {field.fieldOptions && (
            <span className="text-[10px] text-muted-foreground truncate max-w-[200px]">
              ตัวเลือก: {field.fieldOptions}
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={onEdit}>
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={onDelete}>
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

// ==================== FIELD FORM DIALOG ====================
function FieldFormDialog({ open, onOpenChange, templateId, editingField, currentFieldCount, onSaved }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  templateId: number;
  editingField: any;
  currentFieldCount: number;
  onSaved: () => void;
}) {
  const [fieldName, setFieldName] = useState("");
  const [fieldLabel, setFieldLabel] = useState("");
  const [fieldType, setFieldType] = useState<FieldType>("text");
  const [fieldOptions, setFieldOptions] = useState("");
  const [hasOtherOption, setHasOtherOption] = useState(false);
  const [placeholder, setPlaceholder] = useState("");
  const [defaultValue, setDefaultValue] = useState("");
  const [required, setRequired] = useState(false);
  const [sectionGroup, setSectionGroup] = useState("");

  const addMutation = trpc.surveyTemplate.addField.useMutation({
    onSuccess: () => { toast.success("เพิ่มฟิลด์สำเร็จ"); onOpenChange(false); onSaved(); },
    onError: (e) => toast.error(e.message),
  });

  const updateMutation = trpc.surveyTemplate.updateField.useMutation({
    onSuccess: () => { toast.success("อัพเดทฟิลด์สำเร็จ"); onOpenChange(false); onSaved(); },
    onError: (e) => toast.error(e.message),
  });

  // Reset form when dialog opens
  const handleOpenChange = (v: boolean) => {
    if (v && editingField) {
      setFieldName(editingField.fieldName || "");
      setFieldLabel(editingField.fieldLabel || "");
      setFieldType(editingField.fieldType || "text");
      setFieldOptions(editingField.fieldOptions || "");
      setHasOtherOption(editingField.hasOtherOption || false);
      setPlaceholder(editingField.placeholder || "");
      setDefaultValue(editingField.defaultValue || "");
      setRequired(editingField.required || false);
      setSectionGroup(editingField.sectionGroup || "");
    } else if (v && !editingField) {
      setFieldName("");
      setFieldLabel("");
      setFieldType("text");
      setFieldOptions("");
      setHasOtherOption(false);
      setPlaceholder("");
      setDefaultValue("");
      setRequired(false);
      setSectionGroup("");
    }
    onOpenChange(v);
  };

  const handleSubmit = () => {
    if (!fieldLabel.trim()) { toast.error("กรุณาระบุชื่อฟิลด์"); return; }
    const autoName = fieldName.trim() || fieldLabel.trim().replace(/\s+/g, "_").toLowerCase();

    if (editingField) {
      updateMutation.mutate({
        id: editingField.id,
        fieldName: autoName,
        fieldLabel: fieldLabel.trim(),
        fieldType,
        fieldOptions: fieldOptions.trim() || null,
        hasOtherOption,
        placeholder: placeholder.trim() || null,
        defaultValue: defaultValue.trim() || null,
        required,
        sectionGroup: sectionGroup.trim() || null,
      });
    } else {
      addMutation.mutate({
        templateId,
        fieldName: autoName,
        fieldLabel: fieldLabel.trim(),
        fieldType,
        fieldOptions: fieldOptions.trim() || undefined,
        hasOtherOption,
        placeholder: placeholder.trim() || undefined,
        defaultValue: defaultValue.trim() || undefined,
        required,
        sectionGroup: sectionGroup.trim() || undefined,
        sortOrder: currentFieldCount,
      });
    }
  };

  const showOptions = ["select", "checkbox_group", "radio"].includes(fieldType);
  const showOtherOption = ["checkbox_group", "radio", "select"].includes(fieldType);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editingField ? "แก้ไขฟิลด์" : "เพิ่มฟิลด์ใหม่"}</DialogTitle>
          <DialogDescription>กำหนดรายละเอียดฟิลด์สำหรับฟอร์มสำรวจ</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label>ชื่อฟิลด์ (แสดงในฟอร์ม) *</Label>
            <Input value={fieldLabel} onChange={e => setFieldLabel(e.target.value)} placeholder="เช่น Installation Capacity" className="mt-1" />
          </div>

          <div>
            <Label>ประเภทฟิลด์ *</Label>
            <Select value={fieldType} onValueChange={v => setFieldType(v as FieldType)}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FIELD_TYPES.map(ft => (
                  <SelectItem key={ft.value} value={ft.value}>{ft.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {showOptions && (
            <div>
              <Label>ตัวเลือก (คั่นด้วยเครื่องหมาย , )</Label>
              <Textarea
                value={fieldOptions}
                onChange={e => setFieldOptions(e.target.value)}
                placeholder="เช่น 3 kW 1P, 5 kW 1P, 5 kW 3P, 10 kW 1P, 10 kW 3P"
                className="mt-1"
                rows={3}
              />
              <p className="text-xs text-muted-foreground mt-1">แต่ละตัวเลือกคั่นด้วย comma (,)</p>
            </div>
          )}

          {showOtherOption && (
            <div className="flex items-center gap-2">
              <Checkbox id="hasOther" checked={hasOtherOption} onCheckedChange={(v) => setHasOtherOption(!!v)} />
              <Label htmlFor="hasOther" className="text-sm cursor-pointer">มีตัวเลือก "อื่นๆ" (ให้กรอกเพิ่ม)</Label>
            </div>
          )}

          {fieldType !== "section_header" && (
            <>
              <div>
                <Label>Placeholder</Label>
                <Input value={placeholder} onChange={e => setPlaceholder(e.target.value)} placeholder="ข้อความตัวอย่างในช่องกรอก" className="mt-1" />
              </div>
              <div>
                <Label>ค่าเริ่มต้น</Label>
                <Input value={defaultValue} onChange={e => setDefaultValue(e.target.value)} placeholder="ค่าที่กรอกไว้ล่วงหน้า" className="mt-1" />
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id="required" checked={required} onCheckedChange={(v) => setRequired(!!v)} />
                <Label htmlFor="required" className="text-sm cursor-pointer">จำเป็นต้องกรอก</Label>
              </div>
            </>
          )}

          <div>
            <Label>กลุ่ม Section</Label>
            <Input value={sectionGroup} onChange={e => setSectionGroup(e.target.value)} placeholder="เช่น ข้อมูลโปรเจค, Rooftop Survey" className="mt-1" />
            <p className="text-xs text-muted-foreground mt-1">ใช้จัดกลุ่มฟิลด์ในฟอร์ม (ไม่บังคับ)</p>
          </div>

          <div>
            <Label>Field Name (ระบบ)</Label>
            <Input value={fieldName} onChange={e => setFieldName(e.target.value)} placeholder="สร้างอัตโนมัติจากชื่อฟิลด์" className="mt-1" />
            <p className="text-xs text-muted-foreground mt-1">ใช้อ้างอิงในระบบ ถ้าไม่กรอกจะสร้างจากชื่อฟิลด์อัตโนมัติ</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>ยกเลิก</Button>
          <Button onClick={handleSubmit} disabled={addMutation.isPending || updateMutation.isPending}>
            {(addMutation.isPending || updateMutation.isPending) ? "กำลังบันทึก..." : editingField ? "อัพเดท" : "เพิ่มฟิลด์"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ==================== TEMPLATE SETTINGS DIALOG ====================
function TemplateSettingsDialog({ open, onOpenChange, template, sources, onSaved }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  template: any;
  sources: any[];
  onSaved: () => void;
}) {
  const [name, setName] = useState(template.name || "");
  const [sourceId, setSourceId] = useState<number | null>(template.sourceId || null);
  const [pdfHeaderTitle, setPdfHeaderTitle] = useState(template.pdfHeaderTitle || "");
  const [pdfHeaderSubtitle, setPdfHeaderSubtitle] = useState(template.pdfHeaderSubtitle || "");
  const [isActive, setIsActive] = useState(template.isActive !== false);
  const [logoPreview, setLogoPreview] = useState<string | null>(template.pdfLogoUrl || null);

  const updateMutation = trpc.surveyTemplate.update.useMutation({
    onSuccess: () => { toast.success("อัพเดทตั้งค่าสำเร็จ"); onSaved(); onOpenChange(false); },
    onError: (e) => toast.error(e.message),
  });

  const uploadLogoMutation = trpc.surveyTemplate.uploadLogo.useMutation({
    onSuccess: (data) => { setLogoPreview(data.url); toast.success("อัพโหลดโลโก้สำเร็จ"); onSaved(); },
    onError: (e) => toast.error(e.message),
  });

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { toast.error("ไฟล์ใหญ่เกินไป (สูงสุด 2MB)"); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(",")[1];
      uploadLogoMutation.mutate({
        templateId: template.id,
        fileName: file.name,
        base64,
        mimeType: file.type,
      });
    };
    reader.readAsDataURL(file);
  };

  const handleSave = () => {
    if (!name.trim()) { toast.error("กรุณาระบุชื่อ Template"); return; }
    updateMutation.mutate({
      id: template.id,
      name: name.trim(),
      sourceId,
      pdfHeaderTitle: pdfHeaderTitle.trim() || null,
      pdfHeaderSubtitle: pdfHeaderSubtitle.trim() || null,
      isActive,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>ตั้งค่า Template</DialogTitle>
          <DialogDescription>แก้ไขข้อมูลทั่วไปและการตั้งค่า PDF</DialogDescription>
        </DialogHeader>
        <div className="space-y-5 py-2">
          {/* General */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">ข้อมูลทั่วไป</h3>
            <div>
              <Label>ชื่อ Template *</Label>
              <Input value={name} onChange={e => setName(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label>ผูกกับแหล่งที่มา</Label>
              <Select value={sourceId?.toString() || "none"} onValueChange={v => setSourceId(v === "none" ? null : parseInt(v))}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">ไม่ผูก</SelectItem>
                  {sources.map((s: any) => (
                    <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label>สถานะ</Label>
                <p className="text-xs text-muted-foreground">เปิด/ปิดการใช้งาน Template</p>
              </div>
              <Switch checked={isActive} onCheckedChange={setIsActive} />
            </div>
          </div>

          {/* PDF Settings */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">ตั้งค่า PDF</h3>
            <div>
              <Label>ชื่อหัวกระดาษ PDF</Label>
              <Input value={pdfHeaderTitle} onChange={e => setPdfHeaderTitle(e.target.value)} placeholder="เช่น ปันอาทิตย์ by GULF1" className="mt-1" />
            </div>
            <div>
              <Label>ข้อความรอง PDF</Label>
              <Input value={pdfHeaderSubtitle} onChange={e => setPdfHeaderSubtitle(e.target.value)} placeholder="เช่น Site Survey Report" className="mt-1" />
            </div>
            <div>
              <Label>โลโก้ PDF</Label>
              <div className="mt-1 flex items-center gap-3">
                {logoPreview ? (
                  <div className="relative">
                    <img src={logoPreview} alt="Logo" className="h-12 w-auto rounded border" />
                    <Button
                      variant="ghost"
                      size="sm"
                      className="absolute -top-2 -right-2 h-5 w-5 p-0 rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/80"
                      onClick={() => { setLogoPreview(null); updateMutation.mutate({ id: template.id, pdfLogoUrl: null, pdfLogoFileKey: null }); }}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ) : (
                  <label className="flex items-center gap-2 px-3 py-2 border border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
                    <Upload className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">อัพโหลดโลโก้</span>
                    <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
                  </label>
                )}
                {uploadLogoMutation.isPending && <span className="text-xs text-muted-foreground">กำลังอัพโหลด...</span>}
              </div>
              <p className="text-xs text-muted-foreground mt-1">แนะนำขนาด 200x60 px, สูงสุด 2MB</p>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>ยกเลิก</Button>
          <Button onClick={handleSave} disabled={updateMutation.isPending}>
            {updateMutation.isPending ? "กำลังบันทึก..." : "บันทึก"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ==================== FORM PREVIEW DIALOG ====================
function FormPreviewDialog({ open, onOpenChange, template }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  template: any;
}) {
  if (!template) return null;

  const fields = template.fields || [];

  // Group fields by sectionGroup
  const groupedFields: { section: string | null; fields: any[] }[] = [];
  let currentSection: string | null = null;
  let currentGroup: any[] = [];

  fields.forEach((field: any) => {
    if (field.fieldType === "section_header") {
      if (currentGroup.length > 0 || currentSection !== null) {
        groupedFields.push({ section: currentSection, fields: currentGroup });
      }
      currentSection = field.fieldLabel;
      currentGroup = [];
    } else {
      currentGroup.push(field);
    }
  });
  if (currentGroup.length > 0 || currentSection !== null) {
    groupedFields.push({ section: currentSection, fields: currentGroup });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Monitor className="h-5 w-5" /> ตัวอย่างฟอร์ม: {template.name}
          </DialogTitle>
          <DialogDescription>
            แสดงตัวอย่างฟอร์มที่ผู้ใช้จะเห็นเมื่อกรอกข้อมูลสำรวจ (ข้อมูลที่กรอกในตัวอย่างจะไม่ถูกบันทึก)
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* PDF Header Preview */}
          {(template.pdfLogoUrl || template.pdfHeaderTitle) && (
            <div className="border rounded-lg p-4 bg-muted/30">
              <div className="flex items-center gap-3">
                {template.pdfLogoUrl && (
                  <img src={template.pdfLogoUrl} alt="Logo" className="h-10 w-auto" />
                )}
                <div>
                  {template.pdfHeaderTitle && <p className="font-semibold text-sm">{template.pdfHeaderTitle}</p>}
                  {template.pdfHeaderSubtitle && <p className="text-xs text-muted-foreground">{template.pdfHeaderSubtitle}</p>}
                </div>
              </div>
            </div>
          )}

          {/* Form Fields */}
          {groupedFields.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-3 opacity-40" />
              <p>ยังไม่มีฟิลด์ใน Template นี้</p>
            </div>
          ) : (
            groupedFields.map((group, gi) => (
              <div key={gi} className="space-y-4">
                {group.section && (
                  <div className="border-b pb-2">
                    <h3 className="font-semibold text-base text-foreground">{group.section}</h3>
                  </div>
                )}
                {group.fields.map((field: any) => (
                  <PreviewField key={field.id} field={field} />
                ))}
              </div>
            ))
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>ปิด</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ==================== PREVIEW FIELD RENDERER ====================
function PreviewField({ field }: { field: any }) {
  const options = field.fieldOptions ? field.fieldOptions.split(",").map((o: string) => o.trim()).filter(Boolean) : [];

  return (
    <div className="space-y-1.5">
      <Label className="flex items-center gap-1">
        {field.fieldLabel}
        {field.required && <span className="text-red-500 text-xs">*</span>}
      </Label>

      {field.fieldType === "text" && (
        <Input
          placeholder={field.placeholder || `กรอก${field.fieldLabel}`}
          defaultValue={field.defaultValue || ""}
          disabled
          className="bg-background"
        />
      )}

      {field.fieldType === "number" && (
        <Input
          type="number"
          placeholder={field.placeholder || "0"}
          defaultValue={field.defaultValue || ""}
          disabled
          className="bg-background"
        />
      )}

      {field.fieldType === "textarea" && (
        <Textarea
          placeholder={field.placeholder || `กรอก${field.fieldLabel}`}
          defaultValue={field.defaultValue || ""}
          disabled
          rows={3}
          className="bg-background"
        />
      )}

      {field.fieldType === "select" && (
        <Select disabled defaultValue={field.defaultValue || undefined}>
          <SelectTrigger className="bg-background">
            <SelectValue placeholder={field.placeholder || "เลือก..."} />
          </SelectTrigger>
          <SelectContent>
            {options.map((opt: string, i: number) => (
              <SelectItem key={i} value={opt}>{opt}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {field.fieldType === "checkbox" && (
        <div className="flex items-center gap-2">
          <Checkbox disabled defaultChecked={field.defaultValue === "true"} />
          <span className="text-sm text-muted-foreground">{field.placeholder || field.fieldLabel}</span>
        </div>
      )}

      {field.fieldType === "checkbox_group" && (
        <div className="space-y-2">
          {options.map((opt: string, i: number) => (
            <div key={i} className="flex items-center gap-2">
              <Checkbox disabled />
              <span className="text-sm">{opt}</span>
            </div>
          ))}
          {field.hasOtherOption && (
            <div className="flex items-center gap-2">
              <Checkbox disabled />
              <span className="text-sm">อื่นๆ:</span>
              <Input disabled placeholder="ระบุ..." className="h-7 text-sm flex-1 bg-background" />
            </div>
          )}
        </div>
      )}

      {field.fieldType === "radio" && (
        <div className="space-y-2">
          {options.map((opt: string, i: number) => (
            <div key={i} className="flex items-center gap-2">
              <div className="h-4 w-4 rounded-full border-2 border-muted-foreground/40" />
              <span className="text-sm">{opt}</span>
            </div>
          ))}
          {field.hasOtherOption && (
            <div className="flex items-center gap-2">
              <div className="h-4 w-4 rounded-full border-2 border-muted-foreground/40" />
              <span className="text-sm">อื่นๆ:</span>
              <Input disabled placeholder="ระบุ..." className="h-7 text-sm flex-1 bg-background" />
            </div>
          )}
        </div>
      )}

      {field.fieldType === "date" && (
        <Input
          type="date"
          disabled
          defaultValue={field.defaultValue || ""}
          className="bg-background"
        />
      )}

      {field.fieldType === "distance" && (
        <div className="flex items-center gap-2">
          <Input
            type="number"
            placeholder={field.placeholder || "0"}
            defaultValue={field.defaultValue || ""}
            disabled
            className="bg-background flex-1"
          />
          <span className="text-sm text-muted-foreground whitespace-nowrap">เมตร</span>
        </div>
      )}

      {field.fieldType === "yes_no" && (
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 rounded-full border-2 border-muted-foreground/40" />
            <span className="text-sm">มี</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 rounded-full border-2 border-muted-foreground/40" />
            <span className="text-sm">ไม่มี</span>
          </div>
        </div>
      )}

      {field.sectionGroup && (
        <p className="text-[10px] text-muted-foreground">กลุ่ม: {field.sectionGroup}</p>
      )}
    </div>
  );
}
