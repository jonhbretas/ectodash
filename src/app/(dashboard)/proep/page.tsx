"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  Users, BookOpen, ClipboardCheck, GraduationCap, ArrowRight,
  ExternalLink, Plus, Trash2, Sparkles, FolderOpen,
  FileSpreadsheet, FileText, Printer, CheckCircle2, Circle,
  Zap, Brain, Eye, Loader2, CalendarDays,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
interface Edition { id: number; name: string; start_date: string | null; description: string | null; location: string | null; }
interface Student { id: string; edition_id: number; name: string; email: string | null; phone: string | null; role: string; drive_folder_url: string | null; planilha_url: string | null; parapercepciograma_url: string | null; form_responder_url: string | null; status: string; }
interface Material { id: string; edition_id: number | null; category: string; title: string; description: string | null; url: string | null; file_id: string | null; file_type: string | null; is_template: boolean; sort_order: number; }
interface ChecklistItem { id: string; edition_id: number; day_number: number; phase: string; title: string; description: string | null; done: boolean; sort_order: number; }
interface Assignment { id: string; edition_id: number; role: string; title: string; description: string | null; sort_order: number; }
interface Progression { id: string; edition_id: number | null; from_role: string; to_role: string; requirements: string | null; sort_order: number; }

const ROLES = [
  { value: "participant", label: "Participante", color: "bg-slate-400" },
  { value: "M2", label: "Monitor 2", color: "bg-blue-400" },
  { value: "M1", label: "Monitor 1", color: "bg-blue-600" },
  { value: "P2", label: "Professor 2", color: "bg-purple-500" },
  { value: "P1", label: "Professor 1", color: "bg-purple-700" },
];

const MATERIAL_CATEGORIES = [
  { value: "student", label: "Material do Aluno", icon: BookOpen },
  { value: "teacher", label: "Material Docente", icon: GraduationCap },
  { value: "study", label: "Materiais de Estudo", icon: Brain },
  { value: "print", label: "Material Impresso", icon: Printer },
  { value: "checklist", label: "Checklist", icon: ClipboardCheck },
];

const TABS = [
  { key: "students", label: "Alunos", icon: Users },
  { key: "materials", label: "Materiais", icon: BookOpen },
  { key: "checklist", label: "Checklist", icon: ClipboardCheck },
  { key: "assignments", label: "Atribuições", icon: GraduationCap },
  { key: "progression", label: "Progressão", icon: ArrowRight },
];

const roleColor = (role: string) => ROLES.find(r => r.value === role)?.color || "bg-slate-400";
const roleLabel = (role: string) => ROLES.find(r => r.value === role)?.label || role;

async function api(path: string, init?: RequestInit) {
  const res = await fetch(path, { ...init, headers: { "Content-Type": "application/json", ...(init?.headers || {}) } });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error || `Erro ${res.status}`);
  return json;
}

// ─── Material Card ────────────────────────────────────────────────────────────
function MaterialCard({ material, onDelete }: { material: Material; onDelete?: () => void }) {
  const typeIcons: Record<string, typeof FileSpreadsheet> = {
    spreadsheet: FileSpreadsheet, form: FileText, doc: FileText, pdf: FileText, folder: FolderOpen,
  };
  const Icon = typeIcons[material.file_type || ""] || ExternalLink;
  const isLink = Boolean(material.url);

  return (
    <a
      href={material.url || "#"}
      target={isLink ? "_blank" : undefined}
      rel={isLink ? "noopener noreferrer" : undefined}
      className={`group flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 transition-all duration-200 ${
        isLink ? "hover:border-[#2195B9]/40 hover:shadow-md cursor-pointer" : "cursor-default"
      }`}
    >
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg transition-colors ${
        isLink ? "bg-[#2195B9]/10 text-[#2195B9] group-hover:bg-[#2195B9]/20" : "bg-slate-100 text-slate-400"
      }`}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-slate-900 truncate">{material.title}</span>
          {material.is_template && <Badge variant="secondary">Template</Badge>}
        </div>
        {material.description && <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{material.description}</p>}
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {isLink && <ExternalLink className="h-3.5 w-3.5 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />}
        {onDelete && (
          <button onClick={(e) => { e.preventDefault(); onDelete(); }} className="p-1 rounded-md text-slate-400 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all" aria-label="Excluir">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </a>
  );
}

// ─── Student Card ─────────────────────────────────────────────────────────────
function StudentCard({ student, onProvision, onEdit, onDelete }: {
  student: Student;
  onProvision?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  const hasLinks = Boolean(student.planilha_url || student.parapercepciograma_url || student.drive_folder_url);
  const [provisioning, setProvisioning] = useState(false);

  async function handleProvision() {
    setProvisioning(true);
    try { await onProvision?.(); } finally { setProvisioning(false); }
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 transition-all hover:border-slate-300">
      <div className="flex items-start gap-3">
        <div className="relative shrink-0">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-[#2195B9] to-[#1a7a96] text-xs font-bold text-white">
            {student.name.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase()}
          </div>
          <span className={`absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-white ${roleColor(student.role)}`} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-slate-900">{student.name}</span>
            <Badge variant={student.role === "participant" ? "secondary" : "default"}>{roleLabel(student.role)}</Badge>
          </div>
          {student.email && <p className="text-xs text-slate-500 mt-0.5">{student.email}</p>}
          <div className="flex flex-wrap gap-1.5 mt-2">
            {student.planilha_url && (
              <a href={student.planilha_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 hover:bg-emerald-100 transition-colors">
                <FileSpreadsheet className="h-3 w-3" /> Planilha
              </a>
            )}
            {student.parapercepciograma_url && (
              <a href={student.parapercepciograma_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700 hover:bg-blue-100 transition-colors">
                <FileText className="h-3 w-3" /> Parapercepciograma
              </a>
            )}
            {student.form_responder_url && (
              <a href={student.form_responder_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700 hover:bg-amber-100 transition-colors">
                <Eye className="h-3 w-3" /> Formulário
              </a>
            )}
            {student.drive_folder_url && (
              <a href={student.drive_folder_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-md bg-purple-50 px-2 py-0.5 text-[11px] font-medium text-purple-700 hover:bg-purple-100 transition-colors">
                <FolderOpen className="h-3 w-3" /> Drive
              </a>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {!hasLinks && (
            <button onClick={handleProvision} disabled={provisioning} title="Criar materiais no Google" className="flex items-center gap-1 rounded-lg bg-[#2195B9]/10 px-2.5 py-1.5 text-xs font-medium text-[#2195B9] hover:bg-[#2195B9]/20 transition-colors disabled:opacity-50">
              {provisioning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
              <span className="hidden sm:inline">Gerar</span>
            </button>
          )}
          {onEdit && (
            <button onClick={onEdit} className="p-1.5 rounded-md text-slate-400 hover:bg-slate-100 transition-colors" aria-label="Editar">
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 3a2.85 2.85 0 0 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
            </button>
          )}
          {onDelete && (
            <button onClick={onDelete} className="p-1.5 rounded-md text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors" aria-label="Excluir">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Modal ────────────────────────────────────────────────────────────────────
function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-label={title} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-xl border border-slate-200 bg-white p-5 shadow-2xl">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-slate-900">{title}</h2>
          <button type="button" onClick={onClose} className="rounded-md px-2 py-1 text-lg text-slate-400 hover:bg-slate-100" aria-label="Fechar">×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function ProepPage() {
  const [editions, setEditions] = useState<Edition[]>([]);
  const [selectedEdition, setSelectedEdition] = useState<string>("");
  const [tab, setTab] = useState<"students" | "materials" | "checklist" | "assignments" | "progression">("students");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [students, setStudents] = useState<Student[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [progression, setProgression] = useState<Progression[]>([]);

  const [showStudentModal, setShowStudentModal] = useState(false);
  const [showMaterialModal, setShowMaterialModal] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [editingMaterial, setEditingMaterial] = useState<Material | null>(null);
  const [materialFilter, setMaterialFilter] = useState<string>("student");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    api("/api/proep/editions").then((data: Edition[]) => {
      setEditions(data);
      if (data.length > 0) setSelectedEdition(String(data[0].id));
    }).catch(e => setError(e.message)).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedEdition) return;
    const params = `edition_id=${selectedEdition}`;
    Promise.all([
      api(`/api/proep/students?${params}`),
      api(`/api/proep/materials?${params}`),
      api(`/api/proep/checklist?${params}`),
      api(`/api/proep/assignments?${params}`),
      api(`/api/proep/progression?${params}`),
    ]).then(([s, m, c, a, p]) => {
      setStudents(s); setMaterials(m); setChecklist(c); setAssignments(a); setProgression(p);
    }).catch(e => setError(e.message));
  }, [selectedEdition]);

  async function saveStudent(formData: FormData) {
    const payload: Record<string, unknown> = {
      edition_id: Number(selectedEdition),
      name: formData.get("name"),
      email: formData.get("email") || null,
      phone: formData.get("phone") || null,
      role: formData.get("role") || "participant",
    };
    if (editingStudent) payload.id = editingStudent.id;
    setSubmitting(true);
    setFormError(null);
    try {
      const result = await api("/api/proep/students", { method: editingStudent ? "PATCH" : "POST", body: JSON.stringify(payload) });
      setStudents(prev => {
        const idx = prev.findIndex(s => s.id === result.id);
        if (idx >= 0) { const next = [...prev]; next[idx] = result; return next; }
        return [...prev, result];
      });
      setShowStudentModal(false);
      setEditingStudent(null);
    } catch (e: unknown) {
      setFormError(e instanceof Error ? e.message : "Erro ao salvar aluno");
    } finally {
      setSubmitting(false);
    }
  }

  async function deleteStudent(id: string) {
    if (!confirm("Excluir este aluno?")) return;
    await api(`/api/proep/students?id=${id}`, { method: "DELETE" });
    setStudents(prev => prev.filter(s => s.id !== id));
  }

  async function provisionStudent(studentId: string) {
    const result = await api("/api/proep/provision", { method: "POST", body: JSON.stringify({ student_id: studentId, edition_id: Number(selectedEdition) }) });
    setStudents(prev => prev.map(s => s.id === studentId ? { ...s, ...result.links } : s));
    return result;
  }

  async function saveMaterial(formData: FormData) {
    const payload: Record<string, unknown> = {
      edition_id: Number(selectedEdition),
      category: formData.get("category"),
      title: formData.get("title"),
      description: formData.get("description") || null,
      url: formData.get("url") || null,
      file_id: formData.get("file_id") || null,
      file_type: formData.get("file_type") || null,
      is_template: formData.get("is_template") === "on",
      sort_order: Number(formData.get("sort_order") || 0),
    };
    if (editingMaterial) payload.id = editingMaterial.id;
    setSubmitting(true);
    setFormError(null);
    try {
      const result = await api("/api/proep/materials", { method: editingMaterial ? "PATCH" : "POST", body: JSON.stringify(payload) });
      setMaterials(prev => {
        const idx = prev.findIndex(m => m.id === result.id);
        if (idx >= 0) { const next = [...prev]; next[idx] = result; return next; }
        return [...prev, result];
      });
      setShowMaterialModal(false);
      setEditingMaterial(null);
    } catch (e: unknown) {
      setFormError(e instanceof Error ? e.message : "Erro ao salvar material");
    } finally {
      setSubmitting(false);
    }
  }

  async function deleteMaterial(id: string) {
    if (!confirm("Excluir este material?")) return;
    await api(`/api/proep/materials?id=${id}`, { method: "DELETE" });
    setMaterials(prev => prev.filter(m => m.id !== id));
  }

  async function toggleChecklist(id: string, done: boolean) {
    await api("/api/proep/checklist", { method: "PATCH", body: JSON.stringify({ id, done: !done }) });
    setChecklist(prev => prev.map(c => c.id === id ? { ...c, done: !done } : c));
  }

  async function addChecklistItem(dayNumber: number, phase: string) {
    const title = prompt(`Item para o dia ${dayNumber} (${phase === "before" ? "antes" : "depois"}):`);
    if (!title) return;
    const result = await api("/api/proep/checklist", {
      method: "POST",
      body: JSON.stringify({ edition_id: Number(selectedEdition), day_number: dayNumber, phase, title, sort_order: checklist.filter(c => c.day_number === dayNumber && c.phase === phase).length }),
    });
    setChecklist(prev => [...prev, result]);
  }

  async function deleteChecklist(id: string) {
    await api(`/api/proep/checklist?id=${id}`, { method: "DELETE" });
    setChecklist(prev => prev.filter(c => c.id !== id));
  }

  async function saveAssignment(form: HTMLFormElement) {
    const fd = new FormData(form);
    const payload = {
      edition_id: Number(selectedEdition),
      role: fd.get("role"),
      title: fd.get("title"),
      description: fd.get("description") || null,
      sort_order: assignments.filter(a => a.role === fd.get("role")).length,
    };
    const result = await api("/api/proep/assignments", { method: "POST", body: JSON.stringify(payload) });
    setAssignments(prev => [...prev, result]);
  }

  async function deleteAssignment(id: string) {
    await api(`/api/proep/assignments?id=${id}`, { method: "DELETE" });
    setAssignments(prev => prev.filter(a => a.id !== id));
  }

  async function saveProgression(form: HTMLFormElement) {
    const fd = new FormData(form);
    const payload = {
      edition_id: Number(selectedEdition),
      from_role: fd.get("from_role"),
      to_role: fd.get("to_role"),
      requirements: fd.get("requirements") || null,
      sort_order: progression.length,
    };
    const result = await api("/api/proep/progression", { method: "POST", body: JSON.stringify(payload) });
    setProgression(prev => [...prev, result]);
  }

  async function deleteProgression(id: string) {
    await api(`/api/proep/progression?id=${id}`, { method: "DELETE" });
    setProgression(prev => prev.filter(p => p.id !== id));
  }

  const currentEdition = useMemo(() => editions.find(e => String(e.id) === selectedEdition), [editions, selectedEdition]);

  const filteredMaterials = useMemo(() => {
    let list = materials;
    if (tab === "materials") list = list.filter(m => m.category === materialFilter);
    return list.sort((a, b) => a.sort_order - b.sort_order);
  }, [materials, tab, materialFilter]);

  const checklistByDay = useMemo(() => {
    const map: Record<number, { before: ChecklistItem[]; after: ChecklistItem[] }> = {};
    for (const item of checklist) {
      if (!map[item.day_number]) map[item.day_number] = { before: [], after: [] };
      map[item.day_number][item.phase as "before" | "after"].push(item);
    }
    return Object.entries(map).sort(([a], [b]) => Number(a) - Number(b)).map(([day, items]) => ({ day: Number(day), ...items }));
  }, [checklist]);

  const assignmentsByRole = useMemo(() => {
    const map: Record<string, Assignment[]> = {};
    for (const a of assignments) {
      if (!map[a.role]) map[a.role] = [];
      map[a.role].push(a);
    }
    return map;
  }, [assignments]);

  if (loading) {
    return (
      <main id="main-content" className="flex flex-1 flex-col gap-6 overflow-y-auto px-6 py-6">
        <div className="h-10 w-48 animate-pulse rounded-lg bg-slate-100" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-32 animate-pulse rounded-xl bg-slate-100" />)}</div>
      </main>
    );
  }

  return (
    <main id="main-content" className="flex flex-1 flex-col gap-6 overflow-y-auto px-6 py-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2 text-slate-900">
            <Sparkles className="h-6 w-6 text-[#2195B9]" />
            PROEP
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">Programa de Estimulação Parapsíquica Ectoplásmica</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={selectedEdition}
            onChange={e => setSelectedEdition(e.target.value)}
            className="flex h-10 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#2195B9]/50"
          >
            <option value="">Selecione a turma</option>
            {editions.map(ed => (
              <option key={ed.id} value={ed.id}>
                {ed.name} {ed.start_date ? `(${new Date(ed.start_date + "T00:00:00").toLocaleDateString("pt-BR")})` : ""}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Event details card */}
      {currentEdition && (
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#2195B9]/10 text-[#2195B9]">
                  <CalendarDays className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900">{currentEdition.name}</p>
                  <p className="text-xs text-slate-500">
                    {currentEdition.start_date ? new Date(currentEdition.start_date + "T00:00:00").toLocaleDateString("pt-BR") : ""}
                    {currentEdition.location ? ` · ${currentEdition.location}` : ""}
                  </p>
                </div>
              </div>
              <Badge variant="default">Ativa</Badge>
            </div>
          </CardContent>
        </Card>
      )}

      {error && (
        <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg border border-red-200 bg-red-50 text-sm text-red-600" role="status">
          <span className="flex-1">{error}</span>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600 bg-transparent border-none cursor-pointer p-0 text-sm" aria-label="Fechar">✕</button>
        </div>
      )}

      {!selectedEdition ? (
        <div className="text-center py-8 px-4 text-slate-500">
          <Sparkles className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm font-semibold text-slate-900 mb-1">Nenhum evento PROEP encontrado</p>
          <p className="text-xs max-w-[42ch] mx-auto leading-relaxed">Cadastre aulas do PROEP no Eventos com &quot;PROEP&quot; no título para que apareçam aqui como turmas.</p>
        </div>
      ) : (
        <>
          {/* Tabs */}
          <div className="flex gap-1 overflow-x-auto pb-1 -mb-1">
            {TABS.map(t => {
              const Icon = t.icon;
              return (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key as typeof tab)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                    tab === t.key ? "bg-[#2195B9]/10 text-[#2195B9]" : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                  }`}
                >
                  <Icon className="h-4 w-4" /> {t.label}
                </button>
              );
            })}
          </div>

          {/* Tab: Students */}
          {tab === "students" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-slate-500">{students.length} aluno{students.length !== 1 ? "s" : ""}</p>
                <Button variant="secondary" size="sm" onClick={() => { setEditingStudent(null); setFormError(null); setShowStudentModal(true); }}>
                  <Plus className="h-3.5 w-3.5 mr-1" /> Aluno
                </Button>
              </div>
              {students.length === 0 ? (
                <div className="text-center py-8 px-4 text-slate-500">
                  <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm font-semibold text-slate-900 mb-1">Nenhum aluno cadastrado</p>
                  <p className="text-xs max-w-[42ch] mx-auto leading-relaxed">Adicione participantes e papéis do programa.</p>
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {students.map(s => (
                    <StudentCard
                      key={s.id}
                      student={s}
                      onProvision={() => provisionStudent(s.id)}
                      onEdit={() => { setEditingStudent(s); setShowStudentModal(true); }}
                      onDelete={() => deleteStudent(s.id)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Tab: Materials */}
          {tab === "materials" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex gap-1">
                  {MATERIAL_CATEGORIES.map(c => (
                    <button
                      key={c.value}
                      onClick={() => setMaterialFilter(c.value)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                        materialFilter === c.value ? "bg-[#2195B9]/10 text-[#2195B9]" : "text-slate-500 hover:bg-slate-100"
                      }`}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
                <Button variant="secondary" size="sm" onClick={() => { setEditingMaterial(null); setFormError(null); setShowMaterialModal(true); }}>
                  <Plus className="h-3.5 w-3.5 mr-1" /> Material
                </Button>
              </div>
              {filteredMaterials.length === 0 ? (
                <div className="text-center py-8 px-4 text-slate-500">
                  <BookOpen className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm font-semibold text-slate-900 mb-1">Nenhum material</p>
                  <p className="text-xs max-w-[42ch] mx-auto leading-relaxed">Adicione materiais com links do Google Drive.</p>
                </div>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {filteredMaterials.map(m => (
                    <MaterialCard key={m.id} material={m} onDelete={() => deleteMaterial(m.id)} />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Tab: Checklist */}
          {tab === "checklist" && (
            <div className="space-y-4">
              {checklistByDay.length === 0 ? (
                <div className="text-center py-8 px-4 text-slate-500">
                  <ClipboardCheck className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm font-semibold text-slate-900 mb-1">Nenhum item de checklist</p>
                  <p className="text-xs max-w-[42ch] mx-auto leading-relaxed">Adicione itens do dia-a-dia do programa.</p>
                </div>
              ) : (
                checklistByDay.map(({ day, before, after }) => (
                  <details key={day} open={day <= 2} className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                    <summary className="flex items-center gap-3 px-4 py-3 bg-slate-50/50 cursor-pointer select-none">
                      <span className="text-sm font-bold text-slate-900">Dia {day}</span>
                      <Badge variant={before.every(c => c.done) && after.every(c => c.done) ? "default" : "secondary"}>
                        {before.filter(c => c.done).length + after.filter(c => c.done).length}/{before.length + after.length}
                      </Badge>
                    </summary>
                    <div className="px-4 py-3 border-t border-slate-100">
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                          <p className="text-xs font-semibold uppercase text-slate-500 mb-2">Antes da Aula</p>
                          <div className="space-y-1">
                            {before.map(item => (
                              <div key={item.id} className="flex items-center gap-2 group">
                                <button onClick={() => toggleChecklist(item.id, item.done)} className="shrink-0 bg-transparent border-none p-0 cursor-pointer">
                                  {item.done ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <Circle className="h-4 w-4 text-slate-300 hover:text-[#2195B9]" />}
                                </button>
                                <span className={`text-sm flex-1 ${item.done ? "line-through text-slate-400" : "text-slate-700"}`}>{item.title}</span>
                                <button onClick={() => deleteChecklist(item.id)} className="shrink-0 p-0.5 rounded text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity bg-transparent border-none cursor-pointer">
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              </div>
                            ))}
                            <button onClick={() => addChecklistItem(day, "before")} className="flex items-center gap-1 text-xs text-slate-400 hover:text-[#2195B9] mt-1 bg-transparent border-none p-0 cursor-pointer">
                              <Plus className="h-3 w-3" /> Adicionar
                            </button>
                          </div>
                        </div>
                        <div>
                          <p className="text-xs font-semibold uppercase text-slate-500 mb-2">Depois da Aula</p>
                          <div className="space-y-1">
                            {after.map(item => (
                              <div key={item.id} className="flex items-center gap-2 group">
                                <button onClick={() => toggleChecklist(item.id, item.done)} className="shrink-0 bg-transparent border-none p-0 cursor-pointer">
                                  {item.done ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <Circle className="h-4 w-4 text-slate-300 hover:text-[#2195B9]" />}
                                </button>
                                <span className={`text-sm flex-1 ${item.done ? "line-through text-slate-400" : "text-slate-700"}`}>{item.title}</span>
                                <button onClick={() => deleteChecklist(item.id)} className="shrink-0 p-0.5 rounded text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity bg-transparent border-none cursor-pointer">
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              </div>
                            ))}
                            <button onClick={() => addChecklistItem(day, "after")} className="flex items-center gap-1 text-xs text-slate-400 hover:text-[#2195B9] mt-1 bg-transparent border-none p-0 cursor-pointer">
                              <Plus className="h-3 w-3" /> Adicionar
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </details>
                ))
              )}
            </div>
          )}

          {/* Tab: Assignments */}
          {tab === "assignments" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-slate-500">Atribuições por papel no programa</p>
                <Button variant="secondary" size="sm" onClick={() => {
                  const title = prompt("Título da atribuição:");
                  if (!title) return;
                  const role = prompt("Papel (P1, P2, M1, M2):") || "P1";
                  saveAssignment({ get: (k: string) => k === "role" ? role : k === "title" ? title : null } as any);
                }}>
                  <Plus className="h-3.5 w-3.5 mr-1" /> Atribuição
                </Button>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                {["P1", "P2", "M1", "M2"].map(role => (
                  <Card key={role}>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <span className={`h-3 w-3 rounded-full ${roleColor(role)}`} />
                        <span className="text-sm font-bold text-slate-900">{roleLabel(role)}</span>
                      </div>
                      <div className="space-y-1.5">
                        {(assignmentsByRole[role] || []).map(a => (
                          <div key={a.id} className="flex items-start gap-2 group">
                            <CheckCircle2 className="h-3.5 w-3.5 mt-0.5 shrink-0 text-[#2195B9]/60" />
                            <span className="text-sm flex-1 text-slate-700">{a.title}</span>
                            <button onClick={() => deleteAssignment(a.id)} className="shrink-0 p-0.5 rounded text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity bg-transparent border-none cursor-pointer">
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        ))}
                        {(!assignmentsByRole[role] || assignmentsByRole[role].length === 0) && (
                          <p className="text-xs text-slate-400 italic">Nenhuma atribuição definida</p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Tab: Progression */}
          {tab === "progression" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-slate-500">Fluxograma de progressão docente</p>
                <Button variant="secondary" size="sm" onClick={() => {
                  const from = prompt("De (M2, M1, P2, P1):") || "M2";
                  const to = prompt("Para (M2, M1, P2, P1):") || "M1";
                  const req = prompt("Requisitos (opcional):") || "";
                  saveProgression({ get: (k: string) => k === "from_role" ? from : k === "to_role" ? to : k === "requirements" ? req : null } as any);
                }}>
                  <Plus className="h-3.5 w-3.5 mr-1" /> Progressão
                </Button>
              </div>
              <div className="flex items-center justify-center gap-2 flex-wrap py-4">
                {["M2", "M1", "P2", "P1"].map((role, i) => (
                  <div key={role} className="flex items-center gap-2">
                    <div className="flex flex-col items-center gap-1">
                      <span className={`h-10 w-10 rounded-full flex items-center justify-center text-xs font-bold text-white ${roleColor(role)}`}>{role}</span>
                      <span className="text-[11px] font-medium text-slate-600">{roleLabel(role)}</span>
                    </div>
                    {i < 3 && (
                      <div className="flex flex-col items-center gap-0.5 px-2">
                        <ArrowRight className="h-5 w-5 text-[#2195B9]" />
                        {(() => {
                          const prog = progression.find(p => p.from_role === role && p.to_role === ["M2", "M1", "P2", "P1"][i + 1]);
                          return prog?.requirements ? <span className="text-[10px] text-slate-400 max-w-20 text-center leading-tight">{prog.requirements}</span> : null;
                        })()}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <div className="space-y-2">
                {progression.map(p => (
                  <div key={p.id} className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-3 group">
                    <span className={`h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white ${roleColor(p.from_role)}`}>{p.from_role}</span>
                    <ArrowRight className="h-4 w-4 text-slate-400" />
                    <span className={`h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white ${roleColor(p.to_role)}`}>{p.to_role}</span>
                    <span className="text-sm flex-1 text-slate-700">{p.requirements || "—"}</span>
                    <button onClick={() => deleteProgression(p.id)} className="p-1 rounded text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity bg-transparent border-none cursor-pointer">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Student Modal */}
      {showStudentModal && (
        <Modal title={editingStudent ? "Editar Aluno" : "Novo Aluno"} onClose={() => { setShowStudentModal(false); setEditingStudent(null); setFormError(null); }}>
          <form onSubmit={async (e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); await saveStudent(fd); }} className="space-y-3">
            <Input name="name" placeholder="Nome completo" defaultValue={editingStudent?.name || ""} required />
            <Input name="email" type="email" placeholder="E-mail (opcional)" defaultValue={editingStudent?.email || ""} />
            <Input name="phone" placeholder="Telefone (opcional)" defaultValue={editingStudent?.phone || ""} />
            <select name="role" defaultValue={editingStudent?.role || "participant"} className="flex h-10 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
              {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
            {formError && (
              <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{formError}</div>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" type="button" onClick={() => { setShowStudentModal(false); setEditingStudent(null); setFormError(null); }}>Cancelar</Button>
              <Button type="submit" disabled={submitting}>
                {submitting && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                {editingStudent ? "Salvar" : "Adicionar"}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Material Modal */}
      {showMaterialModal && (
        <Modal title={editingMaterial ? "Editar Material" : "Novo Material"} onClose={() => { setShowMaterialModal(false); setEditingMaterial(null); setFormError(null); }}>
          <form onSubmit={async (e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); await saveMaterial(fd); }} className="space-y-3">
            <Input name="title" placeholder="Título do material" defaultValue={editingMaterial?.title || ""} required />
            <Input name="description" placeholder="Descrição (opcional)" defaultValue={editingMaterial?.description || ""} />
            <select name="category" defaultValue={editingMaterial?.category || materialFilter} className="flex h-10 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
              {MATERIAL_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
            <Input name="url" placeholder="Link do Google Drive (URL)" defaultValue={editingMaterial?.url || ""} />
            <div className="grid grid-cols-2 gap-3">
              <select name="file_type" defaultValue={editingMaterial?.file_type || ""} className="flex h-10 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
                <option value="">Tipo do arquivo</option>
                <option value="spreadsheet">Planilha</option>
                <option value="form">Formulário</option>
                <option value="doc">Documento</option>
                <option value="pdf">PDF</option>
                <option value="folder">Pasta</option>
              </select>
              <Input name="file_id" placeholder="File ID (Drive)" defaultValue={editingMaterial?.file_id || ""} />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="is_template" defaultChecked={editingMaterial?.is_template || false} className="rounded" />
              Usar como template (para clonar)
            </label>
            {formError && (
              <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{formError}</div>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" type="button" onClick={() => { setShowMaterialModal(false); setEditingMaterial(null); setFormError(null); }}>Cancelar</Button>
              <Button type="submit" disabled={submitting}>
                {submitting && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                {editingMaterial ? "Salvar" : "Adicionar"}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </main>
  );
}
