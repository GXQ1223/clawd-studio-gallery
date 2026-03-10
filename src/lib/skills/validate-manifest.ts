import type { SkillManifest, Discipline } from "./types";

const VALID_DISCIPLINES: Discipline[] = ["interior", "architectural", "landscape", "industrial"];

const VALID_HOOKS = [
  "onBriefAnalyzed",
  "onSessionComplete",
  "onFloorPlanUpdated",
  "onRenderGenerated",
  "onProductsFound",
];

const SLUG_REGEX = /^[a-z0-9-]+$/;
const TOOL_NAME_REGEX = /^[a-z_][a-z0-9_]*$/;
const SEMVER_REGEX = /^\d+\.\d+\.\d+/;

/** Validate a manifest object against the skill.json schema. Returns null if valid, or an error string. */
export function validateManifest(obj: unknown): obj is SkillManifest {
  if (!obj || typeof obj !== "object") return false;

  const m = obj as Record<string, unknown>;

  // Required string fields
  if (typeof m.slug !== "string" || !SLUG_REGEX.test(m.slug)) return false;
  if (typeof m.name !== "string" || m.name.length === 0) return false;
  if (typeof m.version !== "string" || !SEMVER_REGEX.test(m.version)) return false;
  if (typeof m.description !== "string") return false;

  // disciplines
  if (!Array.isArray(m.disciplines) || m.disciplines.length === 0) return false;
  if (!m.disciplines.every((d: unknown) => typeof d === "string" && VALID_DISCIPLINES.includes(d as Discipline)))
    return false;

  // requiredSecrets
  if (!Array.isArray(m.requiredSecrets)) return false;
  if (!m.requiredSecrets.every((s: unknown) => typeof s === "string")) return false;

  // agentTools
  if (!Array.isArray(m.agentTools)) return false;
  for (const tool of m.agentTools) {
    if (!tool || typeof tool !== "object") return false;
    const t = tool as Record<string, unknown>;
    if (typeof t.name !== "string" || !TOOL_NAME_REGEX.test(t.name)) return false;
    if (typeof t.description !== "string") return false;
    if (!t.parameters || typeof t.parameters !== "object") return false;
  }

  // Optional array fields
  if (m.requiredTables !== undefined && !isStringArray(m.requiredTables)) return false;
  if (m.edgeFunctions !== undefined && !isStringArray(m.edgeFunctions)) return false;
  if (m.uiComponents !== undefined && !isStringArray(m.uiComponents)) return false;

  // hooks
  if (m.hooks !== undefined) {
    if (!Array.isArray(m.hooks)) return false;
    if (!m.hooks.every((h: unknown) => typeof h === "string" && VALID_HOOKS.includes(h))) return false;
  }

  // optional booleans
  if (m.optional !== undefined && typeof m.optional !== "boolean") return false;
  if (m.defaultEnabled !== undefined && typeof m.defaultEnabled !== "boolean") return false;

  // configSchema
  if (m.configSchema !== undefined && (typeof m.configSchema !== "object" || m.configSchema === null)) return false;

  return true;
}

function isStringArray(val: unknown): val is string[] {
  return Array.isArray(val) && val.every((v: unknown) => typeof v === "string");
}
