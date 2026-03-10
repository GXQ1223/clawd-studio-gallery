import { useState, useCallback, useRef } from "react";
import { parseIfcFile, type IfcEntity, type IfcProjectSummary } from "@/lib/ifcUtils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  projectId?: string;
}

const ModelViewerPlaceholder = ({ projectId }: Props) => {
  const [summary, setSummary] = useState<IfcProjectSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedEntity, setSelectedEntity] = useState<IfcEntity | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const ext = file.name.split(".").pop()?.toLowerCase();
    if (ext !== "ifc") {
      toast.error("Please upload an IFC file (.ifc)");
      return;
    }

    setLoading(true);
    try {
      const content = await file.text();
      const parsed = parseIfcFile(content);
      setSummary(parsed);
      setExpandedIds(new Set());
      setSelectedEntity(null);

      // Upload to Supabase Storage if project context available
      if (projectId) {
        const storagePath = `${projectId}/bim/${file.name}`;
        const { error } = await supabase.storage
          .from("project-assets")
          .upload(storagePath, file, { upsert: true });
        if (error) {
          console.warn("Failed to upload IFC to storage:", error.message);
        } else {
          toast.success(`${file.name} uploaded and parsed`);
        }
      } else {
        toast.success(`Parsed ${parsed.totalEntities} entities from ${file.name}`);
      }
    } catch (err) {
      console.error("IFC parse error:", err);
      toast.error("Failed to parse IFC file");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.name.endsWith(".ifc")) {
      // Trigger through the same handler
      const dt = new DataTransfer();
      dt.items.add(file);
      if (fileInputRef.current) {
        fileInputRef.current.files = dt.files;
        fileInputRef.current.dispatchEvent(new Event("change", { bubbles: true }));
      }
    }
  }, []);

  const toggleExpand = useCallback((id: number) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // Empty state
  if (!summary) {
    return (
      <div
        className="flex-1 flex items-center justify-center"
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
      >
        <div className="text-center space-y-4 max-w-[320px]">
          <div
            className="w-[200px] h-[200px] mx-auto flex items-center justify-center gallery-border-dashed"
            style={{ background: "linear-gradient(135deg, hsl(var(--secondary)) 0%, hsl(var(--muted)) 100%)" }}
          >
            {loading ? (
              <span className="font-mono text-[11px] text-muted-foreground animate-pulse">Parsing IFC...</span>
            ) : (
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="text-muted-foreground/40">
                <path d="M12 2L2 7l10 5 10-5-10-5z" />
                <path d="M2 17l10 5 10-5" />
                <path d="M2 12l10 5 10-5" />
              </svg>
            )}
          </div>
          <div>
            <p className="font-mono text-[12px] text-foreground">BIM / IFC Viewer</p>
            <p className="font-mono text-[10px] text-muted-foreground mt-1">
              Supports IFC 2x3 and IFC4 files from Revit, ArchiCAD, and others
            </p>
            <p className="font-mono text-[10px] text-muted-foreground mt-0.5">
              Drop an .ifc file or click to upload
            </p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".ifc"
            onChange={handleFileUpload}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="h-[30px] px-4 gallery-border font-mono text-[11px] text-muted-foreground hover:text-foreground transition-colors"
          >
            Upload IFC File
          </button>
        </div>
      </div>
    );
  }

  // Parsed view
  return (
    <div className="flex-1 flex flex-col h-full">
      {/* Header bar */}
      <div className="flex items-center justify-between px-4 py-2 shrink-0" style={{ borderBottom: "1px solid hsl(var(--border))" }}>
        <div className="flex items-center gap-3">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted-foreground">
            <path d="M12 2L2 7l10 5 10-5-10-5z" />
            <path d="M2 17l10 5 10-5" />
            <path d="M2 12l10 5 10-5" />
          </svg>
          <span className="font-mono text-[12px] font-medium">{summary.projectName}</span>
          <span className="font-mono text-[10px] text-muted-foreground">{summary.schema}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] text-muted-foreground">
            {summary.totalEntities} entities
          </span>
          <button
            onClick={() => { setSummary(null); setSelectedEntity(null); }}
            className="h-[24px] px-2 gallery-border text-[10px] font-mono text-muted-foreground hover:text-foreground"
          >
            Close
          </button>
        </div>
      </div>

      <div className="flex flex-1 min-h-0">
        {/* Entity tree */}
        <div className="w-[280px] shrink-0 overflow-y-auto py-2" style={{ borderRight: "1px solid hsl(var(--border))" }}>
          <p className="px-3 font-mono text-[9px] text-muted-foreground uppercase tracking-wider mb-2">Spatial Structure</p>
          {summary.entities.length === 0 ? (
            <p className="px-3 font-mono text-[10px] text-muted-foreground/50">No spatial entities found</p>
          ) : (
            summary.entities.map((entity) => (
              <EntityTreeNode
                key={entity.id}
                entity={entity}
                depth={0}
                expandedIds={expandedIds}
                selectedId={selectedEntity?.id ?? null}
                onToggle={toggleExpand}
                onSelect={setSelectedEntity}
              />
            ))
          )}

          {/* Entity type summary */}
          <div className="mt-4 px-3 pt-3" style={{ borderTop: "1px solid hsl(var(--border))" }}>
            <p className="font-mono text-[9px] text-muted-foreground uppercase tracking-wider mb-2">Entity Counts</p>
            <div className="space-y-0.5">
              {Object.entries(summary.entityCounts)
                .filter(([type]) => !type.startsWith("IFCREPRESENTATION") && !type.startsWith("IFCCARTESIAN") && !type.startsWith("IFCDIRECTION"))
                .sort(([, a], [, b]) => b - a)
                .slice(0, 20)
                .map(([type, count]) => (
                  <div key={type} className="flex items-center justify-between">
                    <span className="font-mono text-[9px] text-muted-foreground truncate">{type.replace("IFC", "")}</span>
                    <span className="font-mono text-[9px] text-foreground ml-2">{count}</span>
                  </div>
                ))}
            </div>
          </div>
        </div>

        {/* Properties panel */}
        <div className="flex-1 overflow-y-auto p-4">
          {selectedEntity ? (
            <div className="space-y-4">
              <div>
                <p className="font-mono text-[9px] text-muted-foreground uppercase tracking-wider mb-1">Selected Element</p>
                <p className="text-[14px] font-medium">{selectedEntity.name || `#${selectedEntity.id}`}</p>
                <p className="font-mono text-[11px] text-muted-foreground mt-0.5">{selectedEntity.type}</p>
              </div>

              {selectedEntity.description && selectedEntity.description !== "—" && (
                <div>
                  <p className="font-mono text-[9px] text-muted-foreground uppercase tracking-wider mb-1">Description</p>
                  <p className="text-[12px]">{selectedEntity.description}</p>
                </div>
              )}

              <div>
                <p className="font-mono text-[9px] text-muted-foreground uppercase tracking-wider mb-1">Properties</p>
                <div className="space-y-1">
                  <PropertyRow label="Entity ID" value={`#${selectedEntity.id}`} />
                  <PropertyRow label="IFC Type" value={selectedEntity.type} />
                  {selectedEntity.children.length > 0 && (
                    <PropertyRow label="Children" value={`${selectedEntity.children.length} elements`} />
                  )}
                </div>
              </div>

              {selectedEntity.attributes.length > 0 && (
                <div>
                  <p className="font-mono text-[9px] text-muted-foreground uppercase tracking-wider mb-1">Raw Attributes</p>
                  <div className="bg-secondary/50 p-2 overflow-x-auto" style={{ border: "1px solid hsl(var(--border))" }}>
                    <pre className="font-mono text-[9px] text-muted-foreground whitespace-pre-wrap break-all">
                      {selectedEntity.attributes.map((a, i) => `[${i}] ${a}`).join("\n")}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-center">
              <div className="space-y-2">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="text-muted-foreground/30 mx-auto">
                  <path d="M12 2L2 7l10 5 10-5-10-5z" />
                  <path d="M2 17l10 5 10-5" />
                  <path d="M2 12l10 5 10-5" />
                </svg>
                <p className="font-mono text-[11px] text-muted-foreground">
                  Select an element to view properties
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Sub-components ──────────────────────────────────────────

const ENTITY_ICONS: Record<string, string> = {
  IFCPROJECT: "P",
  IFCSITE: "S",
  IFCBUILDING: "B",
  IFCBUILDINGSTOREY: "F",
  IFCSPACE: "R",
  IFCWALL: "W",
  IFCWALLSTANDARDCASE: "W",
  IFCSLAB: "S",
  IFCDOOR: "D",
  IFCWINDOW: "Wi",
  IFCCOLUMN: "C",
  IFCBEAM: "Bm",
  IFCFURNISHINGELEMENT: "Fu",
  IFCROOF: "Rf",
  IFCSTAIR: "St",
};

function EntityTreeNode({
  entity,
  depth,
  expandedIds,
  selectedId,
  onToggle,
  onSelect,
}: {
  entity: IfcEntity;
  depth: number;
  expandedIds: Set<number>;
  selectedId: number | null;
  onToggle: (id: number) => void;
  onSelect: (e: IfcEntity) => void;
}) {
  const isExpanded = expandedIds.has(entity.id);
  const hasChildren = entity.children.length > 0;
  const isSelected = entity.id === selectedId;
  const icon = ENTITY_ICONS[entity.type] || "E";
  const displayName = entity.name && entity.name !== "—" ? entity.name : entity.type.replace("IFC", "");

  return (
    <>
      <div
        className={`flex items-center gap-1 px-2 py-0.5 cursor-pointer hover:bg-secondary/50 transition-colors ${isSelected ? "bg-secondary" : ""}`}
        style={{ paddingLeft: `${depth * 14 + 8}px` }}
        onClick={() => onSelect(entity)}
      >
        {hasChildren ? (
          <button
            onClick={(e) => { e.stopPropagation(); onToggle(entity.id); }}
            className="w-[14px] h-[14px] flex items-center justify-center text-[10px] text-muted-foreground shrink-0"
          >
            {isExpanded ? "▾" : "▸"}
          </button>
        ) : (
          <span className="w-[14px] shrink-0" />
        )}
        <span className="w-[18px] h-[14px] flex items-center justify-center bg-secondary text-[8px] font-mono text-muted-foreground shrink-0" style={{ border: "1px solid hsl(var(--border))" }}>
          {icon}
        </span>
        <span className="font-mono text-[10px] truncate">{displayName}</span>
        {hasChildren && (
          <span className="font-mono text-[9px] text-muted-foreground/50 ml-auto shrink-0">{entity.children.length}</span>
        )}
      </div>
      {isExpanded && entity.children.map((child) => (
        <EntityTreeNode
          key={child.id}
          entity={child}
          depth={depth + 1}
          expandedIds={expandedIds}
          selectedId={selectedId}
          onToggle={onToggle}
          onSelect={onSelect}
        />
      ))}
    </>
  );
}

function PropertyRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start gap-3 py-1" style={{ borderBottom: "1px solid hsl(var(--border) / 0.3)" }}>
      <span className="font-mono text-[10px] text-muted-foreground w-[90px] shrink-0">{label}</span>
      <span className="font-mono text-[10px] text-foreground">{value}</span>
    </div>
  );
}

export default ModelViewerPlaceholder;
