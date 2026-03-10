import { supabase } from "@/integrations/supabase/client";
import type {
  SkillPlugin,
  SkillManifest,
  SkillContext,
  SkillToolResult,
} from "@/lib/skills/types";
import { validateAndSanitizeParams, validateStoragePath } from "@/lib/skills/param-validation";
import manifest from "./skill.json";

class RenderGenSkill implements SkillPlugin {
  manifest = manifest as unknown as SkillManifest;

  private context: SkillContext | null = null;
  private floorPlanUrl: string | null = null;

  async onLoad(context: SkillContext): Promise<void> {
    this.context = context;
  }

  async executeTool(
    toolName: string,
    params: Record<string, any>,
    context: SkillContext,
  ): Promise<SkillToolResult> {
    if (toolName !== "generate_render") {
      return { success: false, error: `Unknown tool: ${toolName}` };
    }

    // Validate string params
    const paramError = validateAndSanitizeParams(
      params,
      ["style", "description", "project_type"],
      [],
      ["floor_plan_url"],
    );
    if (paramError) return { success: false, error: paramError };

    // Validate reference_image_urls if present
    if (params.reference_image_urls) {
      if (!Array.isArray(params.reference_image_urls)) {
        return { success: false, error: "reference_image_urls must be an array" };
      }
      for (const url of params.reference_image_urls) {
        const pathCheck = validateStoragePath(url, "reference_image_url");
        if (!pathCheck.valid) return { success: false, error: pathCheck.error };
      }
    }

    const body = {
      style: params.style,
      description: params.description,
      project_id: context.projectId,
      project_type: params.project_type || context.projectType,
      reference_image_urls: params.reference_image_urls || [],
      floor_plan_url: params.floor_plan_url || this.floorPlanUrl,
    };

    try {
      // Try Gemini-powered generate-render first
      const { data, error } = await supabase.functions.invoke(
        "generate-render",
        { body },
      );

      if (!error && data?.renders?.length > 0) {
        return { success: true, data: { renders: data.renders } };
      }

      // Fall back to mock-render (ControlNet / DALL-E / Replicate / mock)
      const { data: fallbackData, error: fallbackError } =
        await supabase.functions.invoke("mock-render", { body });

      if (fallbackError) {
        return {
          success: false,
          error: `Render generation failed: ${fallbackError.message}`,
        };
      }

      return {
        success: true,
        data: { renders: fallbackData?.renders || [] },
      };
    } catch (err: any) {
      return {
        success: false,
        error: `Render generation failed: ${err.message || String(err)}`,
      };
    }
  }

  async onFloorPlanUpdated(
    floorPlanUrl: string,
    _roomData: any,
    _context: SkillContext,
  ): Promise<void> {
    this.floorPlanUrl = floorPlanUrl;
  }

  async onUnload(): Promise<void> {
    this.context = null;
    this.floorPlanUrl = null;
  }
}

export default RenderGenSkill;
