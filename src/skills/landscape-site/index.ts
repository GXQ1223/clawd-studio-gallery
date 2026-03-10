import type {
  SkillPlugin,
  SkillManifest,
  SkillContext,
  SkillToolResult,
} from "@/lib/skills/types";
import { validateAndSanitizeParams, validateNumber } from "@/lib/skills/param-validation";
import manifest from "./skill.json";

interface Vertex {
  x: number;
  y: number;
}

interface PlantingZone {
  zone_type: "lawn" | "shrubs" | "trees" | "hardscape" | "water";
  vertices: Vertex[];
  label?: string;
  color: string;
}

const ZONE_COLORS: Record<string, string> = {
  lawn: "#4ade80",
  shrubs: "#16a34a",
  trees: "#15803d",
  hardscape: "#a8a29e",
  water: "#38bdf8",
};

function calculatePolygonArea(vertices: Vertex[]): number {
  // Shoelace formula
  let area = 0;
  const n = vertices.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += vertices[i].x * vertices[j].y;
    area -= vertices[j].x * vertices[i].y;
  }
  return Math.abs(area / 2);
}

class LandscapeSiteSkill implements SkillPlugin {
  manifest = manifest as unknown as SkillManifest;

  private context: SkillContext | null = null;
  private siteBoundary: Vertex[] = [];
  private plantingZones: PlantingZone[] = [];

  async onLoad(context: SkillContext): Promise<void> {
    this.context = context;
  }

  async executeTool(
    toolName: string,
    params: Record<string, any>,
    _context: SkillContext,
  ): Promise<SkillToolResult> {
    switch (toolName) {
      case "draw_site_boundary":
        return this.drawSiteBoundary(params.vertices);
      case "add_planting_zone":
        return this.addPlantingZone(params);
      case "generate_site_plan_render":
        return this.generateSitePlanRender(params);
      default:
        return { success: false, error: `Unknown tool: ${toolName}` };
    }
  }

  private drawSiteBoundary(vertices: Vertex[]): SkillToolResult {
    if (!vertices || vertices.length < 3) {
      return {
        success: false,
        error: "Site boundary requires at least 3 vertices",
      };
    }

    this.siteBoundary = vertices;
    const area = calculatePolygonArea(vertices);

    return {
      success: true,
      data: {
        message: `Site boundary defined with ${vertices.length} vertices`,
        area_sqm: Math.round(area * 100) / 100,
        vertex_count: vertices.length,
      },
    };
  }

  private addPlantingZone(params: Record<string, any>): SkillToolResult {
    const { zone_type, vertices, label } = params;

    if (!vertices || vertices.length < 3) {
      return {
        success: false,
        error: "Planting zone requires at least 3 vertices",
      };
    }

    const color = ZONE_COLORS[zone_type] || "#94a3b8";

    const zone: PlantingZone = {
      zone_type,
      vertices,
      label,
      color,
    };

    this.plantingZones.push(zone);
    const area = calculatePolygonArea(vertices);

    return {
      success: true,
      data: {
        message: `Planting zone "${label || zone_type}" added`,
        zone_type,
        color,
        area_sqm: Math.round(area * 100) / 100,
        total_zones: this.plantingZones.length,
      },
    };
  }

  private generateSitePlanRender(
    _params: Record<string, any>,
  ): SkillToolResult {
    return {
      success: true,
      data: {
        message:
          "Site plan render generation queued. Configure render-gen skill for Gemini API.",
      },
    };
  }

  async onBriefAnalyzed(
    analysis: any,
    _context: SkillContext,
  ): Promise<void> {
    if (!analysis) return;

    const text =
      typeof analysis === "string"
        ? analysis
        : JSON.stringify(analysis).toLowerCase();

    const landscapeKeywords = [
      "garden",
      "outdoor",
      "landscape",
      "yard",
      "patio",
      "terrace",
      "planting",
      "lawn",
      "deck",
      "pergola",
      "pool",
      "fountain",
      "pathway",
      "driveway",
      "hedge",
      "flowerbed",
    ];

    const matchedKeywords = landscapeKeywords.filter((kw) =>
      text.includes(kw),
    );

    if (matchedKeywords.length > 0 && this.context) {
      this.context.emitEvent({
        type: "landscape_keywords_detected",
        payload: { keywords: matchedKeywords },
        source: "landscape-site",
        timestamp: Date.now(),
      });
    }
  }

  async onUnload(): Promise<void> {
    this.context = null;
    this.siteBoundary = [];
    this.plantingZones = [];
  }
}

export default LandscapeSiteSkill;
