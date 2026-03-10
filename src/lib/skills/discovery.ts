import { SkillRegistry } from "./registry";
import type { SkillPlugin, SkillContext, SkillManifest, Discipline } from "./types";
import { validateManifest } from "./validate-manifest";

/**
 * Auto-discover skills from src/skills/* directories using Vite's import.meta.glob.
 * Each skill directory must have a skill.json manifest and a default-exported SkillPlugin class.
 */

// Vite glob imports for skill manifests and modules
const skillManifests = import.meta.glob<{ default: unknown }>(
  "../../skills/*/skill.json",
  { eager: true }
);

const skillModules = import.meta.glob<{ default: new () => SkillPlugin }>(
  "../../skills/*/index.ts"
);

/**
 * Discover all skills from src/skills/*, validate their manifests,
 * and register them with the given registry.
 *
 * @param projectDiscipline - If provided, only skills whose disciplines array
 *   contains this value will be included in the enabledSlugs filter.
 *   Skills with mismatched disciplines are still registered but not enabled.
 */
export async function discoverAndRegisterSkills(
  registry: SkillRegistry,
  enabledSlugs: string[],
  context: SkillContext,
  projectDiscipline?: Discipline
): Promise<void> {
  for (const [manifestPath, manifestModule] of Object.entries(skillManifests)) {
    const raw = (manifestModule as any).default || manifestModule;

    if (!validateManifest(raw)) {
      console.warn(`Invalid skill manifest at ${manifestPath} — skipping`);
      continue;
    }

    const manifest = raw as SkillManifest;

    // Find the matching skill module
    const dir = manifestPath.replace(/\/skill\.json$/, "");
    const modulePath = `${dir}/index.ts`;
    const moduleLoader = skillModules[modulePath];

    if (!moduleLoader) {
      console.warn(`No index.ts found for skill "${manifest.slug}" at ${modulePath} — skipping`);
      continue;
    }

    try {
      const mod = await moduleLoader();
      const SkillClass = mod.default;
      const plugin = new SkillClass();

      // Override the manifest with the one from skill.json
      (plugin as any).manifest = manifest;

      registry.register(plugin);
    } catch (err) {
      console.warn(`Failed to load skill module for "${manifest.slug}":`, err);
    }
  }

  // Filter enabledSlugs by project discipline if provided
  let filteredEnabledSlugs = enabledSlugs;
  if (projectDiscipline) {
    filteredEnabledSlugs = enabledSlugs.filter((slug) => {
      const skill = registry.get(slug);
      if (!skill) return false;
      return skill.manifest.disciplines.includes(projectDiscipline);
    });
  }

  // Now load all enabled skills
  await registry.loadAll(filteredEnabledSlugs, context);

  // Set up HMR in development mode
  if (import.meta.env.DEV && import.meta.hot) {
    import.meta.hot.accept(() => {
      console.log('[skills] Hot reload detected — please refresh to reload skills');
    });
  }
}
