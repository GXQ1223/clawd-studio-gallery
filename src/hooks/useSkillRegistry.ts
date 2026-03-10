import { useState, useRef, useEffect, useCallback } from "react";
import { SkillRegistry } from "@/lib/skills/registry";
import type { SkillContext, SkillEvent, Discipline } from "@/lib/skills/types";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

export function useSkillRegistry(projectId: string, projectType: string) {
  const [enabledSlugs, setEnabledSlugs] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const registryRef = useRef(new SkillRegistry());
  const { user } = useAuth();

  // Build a SkillContext for the registry
  const buildContext = useCallback((): SkillContext => {
    return {
      projectId,
      userId: user?.id ?? "",
      projectType: (projectType || "interior") as Discipline,
      supabase,
      config: {},
      addFeedEntry: () => {},
      getEnabledSkills: () => registryRef.current.getEnabledSlugs(),
      emitEvent: (event: SkillEvent) => {
        console.debug("[SkillRegistry] event:", event);
      },
    };
  }, [projectId, projectType, user?.id]);

  // Load enabled skills from project_skills table on mount
  useEffect(() => {
    if (!projectId) {
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    async function loadSkills() {
      try {
        const { data, error } = await supabase
          .from("project_skills")
          .select("*")
          .eq("project_id", projectId)
          .eq("enabled", true);

        if (error) {
          // Table may not exist yet — treat as empty
          console.warn("Failed to load project_skills (table may not exist):", error.message);
          if (!cancelled) {
            setEnabledSlugs([]);
            setIsLoading(false);
          }
          return;
        }

        const slugs = (data ?? []).map((row: any) => row.skill_slug as string);

        if (!cancelled) {
          setEnabledSlugs(slugs);

          const context = buildContext();
          await registryRef.current.loadAll(slugs, context);
          setIsLoading(false);
        }
      } catch (err) {
        console.warn("Error loading skill registry:", err);
        if (!cancelled) {
          setEnabledSlugs([]);
          setIsLoading(false);
        }
      }
    }

    loadSkills();

    return () => {
      cancelled = true;
    };
  }, [projectId, buildContext]);

  // Unload all skills on unmount
  useEffect(() => {
    const registry = registryRef.current;
    return () => {
      registry.unloadAll();
    };
  }, []);

  // Toggle a skill on/off — upserts to project_skills and updates the registry
  const toggleSkill = useCallback(
    async (slug: string, enabled: boolean) => {
      try {
        const { error } = await supabase
          .from("project_skills")
          .upsert(
            {
              project_id: projectId,
              skill_slug: slug,
              enabled,
            },
            { onConflict: "project_id,skill_slug" }
          );

        if (error) {
          console.error("Failed to upsert project_skills:", error.message);
          return;
        }

        const context = buildContext();
        await registryRef.current.setEnabled(slug, enabled, context);

        setEnabledSlugs(registryRef.current.getEnabledSlugs());
      } catch (err) {
        console.error("Error toggling skill:", err);
      }
    },
    [projectId, buildContext]
  );

  return {
    registry: registryRef.current,
    enabledSlugs,
    toggleSkill,
    isLoading,
  };
}
