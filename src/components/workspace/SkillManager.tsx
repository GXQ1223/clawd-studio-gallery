import { useMemo, useState } from "react";
import { Switch } from "@/components/ui/switch";
import { Settings } from "lucide-react";
import type { SkillRegistry } from "@/lib/skills/registry";
import type { Discipline } from "@/lib/skills/types";

interface Props {
  registry: SkillRegistry | null;
  projectType: string;
  onToggle: (slug: string, enabled: boolean) => void;
  onConfigSave?: (slug: string, config: Record<string, any>) => void;
}

const DISCIPLINE_COLORS: Record<string, string> = {
  interior: "bg-blue-100 text-blue-700",
  architectural: "bg-amber-100 text-amber-700",
  landscape: "bg-green-100 text-green-700",
  industrial: "bg-gray-100 text-gray-700",
};

const SkillConfigPanel = ({
  slug,
  configSchema,
  onSave,
  onClose,
}: {
  slug: string;
  configSchema: Record<string, any>;
  onSave: (slug: string, config: Record<string, any>) => void;
  onClose: () => void;
}) => {
  const [values, setValues] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const key of Object.keys(configSchema)) {
      initial[key] = "";
    }
    return initial;
  });

  const handleSave = () => {
    onSave(slug, { ...values });
    onClose();
  };

  return (
    <div className="mt-2 rounded-sm border border-border bg-muted/30 p-2 flex flex-col gap-2">
      {Object.entries(configSchema).map(([key, schema]) => (
        <label key={key} className="flex flex-col gap-0.5">
          <span className="font-mono text-[10px] text-muted-foreground">
            {(schema as any)?.label || key}
          </span>
          <input
            type="text"
            value={values[key] || ""}
            onChange={(e) =>
              setValues((prev) => ({ ...prev, [key]: e.target.value }))
            }
            placeholder={(schema as any)?.placeholder || key}
            className="rounded-sm border border-border bg-background px-2 py-1 font-mono text-[11px] outline-none focus:ring-1 focus:ring-ring"
          />
        </label>
      ))}
      <div className="flex gap-1.5 justify-end mt-1">
        <button
          onClick={onClose}
          className="rounded-sm border border-border px-2 py-0.5 font-mono text-[10px] hover:bg-muted"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          className="rounded-sm bg-primary px-2 py-0.5 font-mono text-[10px] text-primary-foreground hover:bg-primary/90"
        >
          Save
        </button>
      </div>
    </div>
  );
};

const SkillManager = ({ registry, projectType, onToggle, onConfigSave }: Props) => {
  const skills = useMemo(() => registry?.getAllSkills() ?? [], [registry]);
  const [configOpenSlug, setConfigOpenSlug] = useState<string | null>(null);

  const grouped = useMemo(() => {
    const map = new Map<string, typeof skills>();
    for (const s of skills) {
      const cat = s.plugin.manifest.disciplines[0] ?? "general";
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(s);
    }
    return map;
  }, [skills]);

  if (!registry) {
    return (
      <div className="p-4 text-center font-mono text-[10px] text-muted-foreground">
        No skills loaded
      </div>
    );
  }

  if (skills.length === 0) {
    return (
      <div className="p-4 text-center font-mono text-[10px] text-muted-foreground">
        No skills registered
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 p-2">
      {Array.from(grouped.entries()).map(([category, items]) => (
        <div key={category}>
          <h4 className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5 px-1">
            {category}
          </h4>
          <div className="flex flex-col gap-1">
            {items.map(({ plugin, enabled }) => {
              const { manifest } = plugin;
              const compatible = manifest.disciplines.includes(
                projectType as Discipline
              );

              return (
                <div
                  key={manifest.slug}
                  className={`rounded-sm border border-border px-3 py-2 transition-colors ${
                    compatible
                      ? "bg-background"
                      : "bg-muted/40 opacity-50 pointer-events-none"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex flex-col gap-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[12px] font-medium truncate">
                          {manifest.name}
                        </span>
                        <span className="shrink-0 rounded-sm bg-secondary px-1.5 py-0.5 font-mono text-[9px] text-muted-foreground leading-none">
                          v{manifest.version}
                        </span>
                      </div>

                      <p className="font-mono text-[10px] text-muted-foreground truncate">
                        {manifest.description}
                      </p>

                      <div className="flex flex-wrap gap-1 mt-0.5">
                        {manifest.disciplines.map((d) => (
                          <span
                            key={d}
                            className={`inline-block rounded-sm px-1.5 py-0.5 font-mono text-[9px] leading-none ${
                              DISCIPLINE_COLORS[d] ?? "bg-secondary text-muted-foreground"
                            }`}
                          >
                            {d}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0 mt-0.5">
                      {manifest.configSchema &&
                        Object.keys(manifest.configSchema).length > 0 &&
                        onConfigSave && (
                          <button
                            onClick={() =>
                              setConfigOpenSlug(
                                configOpenSlug === manifest.slug
                                  ? null
                                  : manifest.slug
                              )
                            }
                            className="rounded-sm p-0.5 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                            title="Skill settings"
                          >
                            <Settings className="h-3.5 w-3.5" />
                          </button>
                        )}
                      <Switch
                        checked={enabled}
                        onCheckedChange={(checked) =>
                          onToggle(manifest.slug, checked)
                        }
                        disabled={!compatible}
                      />
                    </div>
                  </div>

                  {configOpenSlug === manifest.slug &&
                    manifest.configSchema &&
                    onConfigSave && (
                      <SkillConfigPanel
                        slug={manifest.slug}
                        configSchema={manifest.configSchema}
                        onSave={onConfigSave}
                        onClose={() => setConfigOpenSlug(null)}
                      />
                    )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
};

export default SkillManager;
