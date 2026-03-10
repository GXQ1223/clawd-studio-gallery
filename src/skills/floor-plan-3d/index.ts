import type {
  SkillPlugin,
  SkillManifest,
  SkillContext,
  SkillToolResult,
} from "../../lib/skills/types";
import { validateAndSanitizeParams } from "../../lib/skills/param-validation";
import { FLOOR_PLAN_UPDATED } from "../../lib/skills/event-bus";
import manifest from "./skill.json";

interface WallSegment {
  id: string;
  start: { x: number; y: number };
  end: { x: number; y: number };
  thickness: number;
  height: number;
  material?: string;
}

interface Opening {
  id: string;
  wallId: string;
  type: "door" | "window" | "archway";
  position: number; // 0-1 along the wall
  width: number;
  height: number;
}

interface Room {
  id: string;
  name: string;
  wallIds: string[];
  area: number;
  ceilingHeight: number;
}

interface FurnitureItem {
  id: string;
  name: string;
  position: { x: number; y: number; z: number };
  rotation: number;
  width: number;
  depth: number;
  height: number;
}

interface FloorPlanData {
  walls: WallSegment[];
  openings: Opening[];
  rooms: Room[];
  furniture: FurnitureItem[];
  ceilingHeight: number;
}

class FloorPlanSkill implements SkillPlugin {
  manifest: SkillManifest = manifest as unknown as SkillManifest;

  private context: SkillContext | null = null;

  private floorPlanData: FloorPlanData = {
    walls: [],
    openings: [],
    rooms: [],
    furniture: [],
    ceilingHeight: 2.7,
  };

  async onLoad(context: SkillContext): Promise<void> {
    this.context = context;
    console.log(
      `[FloorPlanSkill] Loaded for project ${context.projectId}, type: ${context.projectType}`
    );
  }

  async onUnload(): Promise<void> {
    this.context = null;
    this.floorPlanData = {
      walls: [],
      openings: [],
      rooms: [],
      furniture: [],
      ceilingHeight: 2.7,
    };
    console.log("[FloorPlanSkill] Unloaded");
  }

  /**
   * Receive floor plan data from UI components (e.g., the 3D editor canvas).
   * Emits a FLOOR_PLAN_UPDATED event so other skills can react.
   */
  setFloorPlanData(data: Partial<FloorPlanData>): void {
    this.floorPlanData = { ...this.floorPlanData, ...data };

    if (this.context) {
      this.context.emitEvent({
        type: FLOOR_PLAN_UPDATED,
        payload: this.floorPlanData,
        source: "floor-plan-3d",
        timestamp: Date.now(),
      });
    }
  }

  async executeTool(
    toolName: string,
    params: Record<string, any>,
    _context: SkillContext
  ): Promise<SkillToolResult> {
    const validTools = ["export_floor_plan_view", "get_room_data", "size_furniture"];
    if (!validTools.includes(toolName)) {
      return { success: false, error: `Unknown tool: ${toolName}` };
    }

    // Validate params for size_furniture
    if (toolName === "size_furniture") {
      const paramError = validateAndSanitizeParams(
        params,
        ["furniture_id"],
        ["width", "depth", "height"],
      );
      if (paramError) return { success: false, error: paramError };
    }

    switch (toolName) {
      case "export_floor_plan_view":
        return this.handleExportFloorPlanView(params);

      case "get_room_data":
        return this.handleGetRoomData();

      case "size_furniture":
        return this.handleSizeFurniture(params);

      default:
        return { success: false, error: `Unknown tool: ${toolName}` };
    }
  }

  // --- Tool handlers ---

  private handleExportFloorPlanView(
    _params: Record<string, any>
  ): SkillToolResult {
    return {
      success: true,
      data: {
        message:
          "Floor plan export initiated. Use the 3D viewer's Finalize Plan button.",
      },
    };
  }

  private handleGetRoomData(): SkillToolResult {
    const { walls, rooms, openings, ceilingHeight } = this.floorPlanData;

    return {
      success: true,
      data: {
        walls: walls.map((w) => ({
          id: w.id,
          start: w.start,
          end: w.end,
          thickness: w.thickness,
          height: w.height,
          material: w.material,
        })),
        rooms: rooms.map((r) => ({
          id: r.id,
          name: r.name,
          area: r.area,
          ceilingHeight: r.ceilingHeight,
          wallIds: r.wallIds,
        })),
        openings: openings.map((o) => ({
          id: o.id,
          wallId: o.wallId,
          type: o.type,
          position: o.position,
          width: o.width,
          height: o.height,
        })),
        ceilingHeight,
      },
    };
  }

  private handleSizeFurniture(params: Record<string, any>): SkillToolResult {
    const { furniture_id, width, depth, height } = params;

    if (!furniture_id) {
      return { success: false, error: "furniture_id is required" };
    }

    const item = this.floorPlanData.furniture.find(
      (f) => f.id === furniture_id
    );

    if (!item) {
      // Store as a new sizing entry if the item doesn't exist yet
      this.floorPlanData.furniture.push({
        id: furniture_id,
        name: furniture_id,
        position: { x: 0, y: 0, z: 0 },
        rotation: 0,
        width: width ?? 1,
        depth: depth ?? 1,
        height: height ?? 1,
      });
    } else {
      if (width !== undefined) item.width = width;
      if (depth !== undefined) item.depth = depth;
      if (height !== undefined) item.height = height;
    }

    // Emit update event
    if (this.context) {
      this.context.emitEvent({
        type: FLOOR_PLAN_UPDATED,
        payload: this.floorPlanData,
        source: "floor-plan-3d",
        timestamp: Date.now(),
      });
    }

    return {
      success: true,
      data: {
        furniture_id,
        width: width ?? item?.width,
        depth: depth ?? item?.depth,
        height: height ?? item?.height,
      },
    };
  }

  // --- Hooks ---

  async onBriefAnalyzed(analysis: any, context: SkillContext): Promise<void> {
    console.log("[FloorPlanSkill] Brief analyzed, extracting spatial hints");

    const hints: Partial<FloorPlanData> = {};

    // Extract ceiling height from analysis if available
    if (analysis?.dimensions?.ceilingHeight) {
      hints.ceilingHeight = analysis.dimensions.ceilingHeight;
    } else if (analysis?.ceiling_height) {
      hints.ceilingHeight = analysis.ceiling_height;
    }

    // Extract room type to seed initial room data
    if (analysis?.room_type || analysis?.roomType) {
      const roomType = analysis.room_type || analysis.roomType;
      hints.rooms = [
        {
          id: "room-initial",
          name: roomType,
          wallIds: [],
          area: analysis?.dimensions?.area || analysis?.area || 0,
          ceilingHeight: hints.ceilingHeight || 2.7,
        },
      ];
    }

    // Extract dimensions for wall generation hints
    if (analysis?.dimensions?.width && analysis?.dimensions?.length) {
      const w = analysis.dimensions.width;
      const l = analysis.dimensions.length;
      hints.walls = [
        {
          id: "wall-n",
          start: { x: 0, y: 0 },
          end: { x: w, y: 0 },
          thickness: 0.15,
          height: hints.ceilingHeight || 2.7,
        },
        {
          id: "wall-e",
          start: { x: w, y: 0 },
          end: { x: w, y: l },
          thickness: 0.15,
          height: hints.ceilingHeight || 2.7,
        },
        {
          id: "wall-s",
          start: { x: w, y: l },
          end: { x: 0, y: l },
          thickness: 0.15,
          height: hints.ceilingHeight || 2.7,
        },
        {
          id: "wall-w",
          start: { x: 0, y: l },
          end: { x: 0, y: 0 },
          thickness: 0.15,
          height: hints.ceilingHeight || 2.7,
        },
      ];
    }

    if (Object.keys(hints).length > 0) {
      this.setFloorPlanData(hints);

      await context.addFeedEntry({
        type: "floor_plan_hint",
        message: `Spatial hints extracted from brief: ${
          hints.rooms?.[0]?.name || "room"
        }${hints.ceilingHeight ? `, ceiling ${hints.ceilingHeight}m` : ""}${
          hints.walls ? `, ${hints.walls.length} walls` : ""
        }`,
      });
    }
  }

  async onRenderGenerated(
    renderUrl: string,
    context: SkillContext
  ): Promise<void> {
    console.log(
      `[FloorPlanSkill] Render generated from floor plan: ${renderUrl}`
    );

    await context.addFeedEntry({
      type: "floor_plan_render",
      message:
        "Render generated from floor plan data. View it in the workspace gallery.",
      renderUrl,
    });
  }
}

export default FloorPlanSkill;
