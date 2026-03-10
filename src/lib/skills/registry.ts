import type {
  SkillPlugin,
  SkillManifest,
  SkillContext,
  SkillToolResult,
  AgentToolDefinition,
  SkillHooks,
  Discipline,
} from "./types";
import { validateToolName } from "./param-validation";

interface RegisteredSkill {
  plugin: SkillPlugin;
  enabled: boolean;
  loaded: boolean;
}

/**
 * SkillRegistry — manages skill plugins for the designer agent.
 * Handles discovery, registration, enabling/disabling, tool dispatch, and lifecycle hooks.
 */
export class SkillRegistry {
  private skills = new Map<string, RegisteredSkill>();

  /** Register a skill plugin */
  register(plugin: SkillPlugin): void {
    this.skills.set(plugin.manifest.slug, {
      plugin,
      enabled: false,
      loaded: false,
    });
  }

  /** Load all skills matching the enabledSlugs list, calling onLoad for each */
  async loadAll(enabledSlugs: string[], context: SkillContext): Promise<void> {
    for (const [slug, entry] of this.skills) {
      if (enabledSlugs.includes(slug)) {
        entry.enabled = true;
        try {
          await entry.plugin.onLoad(context);
          entry.loaded = true;
        } catch (err) {
          console.warn(`Skill "${slug}" failed to load:`, err);
          entry.enabled = false;
          entry.loaded = false;
        }
      }
    }
  }

  /** Enable or disable a skill at runtime */
  async setEnabled(slug: string, enabled: boolean, context?: SkillContext): Promise<void> {
    const entry = this.skills.get(slug);
    if (!entry) return;

    if (enabled && !entry.loaded && context) {
      try {
        await entry.plugin.onLoad(context);
        entry.loaded = true;
      } catch (err) {
        console.warn(`Skill "${slug}" failed to load:`, err);
        return;
      }
    } else if (!enabled && entry.loaded) {
      try {
        await entry.plugin.onUnload();
      } catch (err) {
        console.warn(`Skill "${slug}" failed to unload:`, err);
      }
      entry.loaded = false;
    }

    entry.enabled = enabled;
  }

  /** Unload all loaded skills */
  async unloadAll(): Promise<void> {
    for (const [slug, entry] of this.skills) {
      if (entry.loaded) {
        try {
          await entry.plugin.onUnload();
        } catch (err) {
          console.warn(`Skill "${slug}" failed to unload:`, err);
        }
        entry.loaded = false;
        entry.enabled = false;
      }
    }
  }

  /** Get all tool definitions from enabled skills */
  getAllToolDefinitions(): AgentToolDefinition[] {
    const tools: AgentToolDefinition[] = [];
    for (const entry of this.skills.values()) {
      if (entry.enabled) {
        tools.push(...entry.plugin.manifest.agentTools);
      }
    }
    return tools;
  }

  /** Execute a tool by name, dispatching to the correct skill */
  async executeTool(
    toolName: string,
    params: Record<string, any>,
    context: SkillContext
  ): Promise<SkillToolResult> {
    // Validate toolName contains only safe characters
    const nameCheck = validateToolName(toolName);
    if (!nameCheck.valid) {
      return { success: false, error: nameCheck.error };
    }

    for (const entry of this.skills.values()) {
      if (!entry.enabled) continue;
      const hasTool = entry.plugin.manifest.agentTools.some(
        (t) => t.name === toolName
      );
      if (hasTool) {
        return entry.plugin.executeTool(toolName, params, context);
      }
    }
    return { success: false, error: `No skill handles tool "${toolName}"` };
  }

  /** Fire a lifecycle hook on all enabled skills that declare it */
  async fireHook<K extends keyof SkillHooks>(
    hookName: K,
    ...args: Parameters<NonNullable<SkillHooks[K]>>
  ): Promise<void> {
    for (const entry of this.skills.values()) {
      if (!entry.enabled) continue;
      const hooks = entry.plugin.manifest.hooks;
      if (hooks && hooks.includes(hookName)) {
        const fn = entry.plugin[hookName];
        if (typeof fn === "function") {
          try {
            await (fn as (...a: any[]) => any).apply(entry.plugin, args);
          } catch (err) {
            console.warn(
              `Hook "${hookName}" failed on skill "${entry.plugin.manifest.slug}":`,
              err
            );
          }
        }
      }
    }
  }

  /** Get all skills compatible with a given discipline */
  getSkillsForDiscipline(discipline: Discipline): SkillPlugin[] {
    const result: SkillPlugin[] = [];
    for (const entry of this.skills.values()) {
      if (entry.plugin.manifest.disciplines.includes(discipline)) {
        result.push(entry.plugin);
      }
    }
    return result;
  }

  /** Get all registered skills */
  getAllSkills(): { plugin: SkillPlugin; enabled: boolean }[] {
    return Array.from(this.skills.values()).map((e) => ({
      plugin: e.plugin,
      enabled: e.enabled,
    }));
  }

  /** Check if a skill is registered */
  has(slug: string): boolean {
    return this.skills.has(slug);
  }

  /** Get a specific skill by slug */
  get(slug: string): SkillPlugin | undefined {
    return this.skills.get(slug)?.plugin;
  }

  /** Get enabled skill slugs */
  getEnabledSlugs(): string[] {
    return Array.from(this.skills.entries())
      .filter(([, e]) => e.enabled)
      .map(([slug]) => slug);
  }
}
