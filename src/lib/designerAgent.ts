import { supabase } from "@/integrations/supabase/client";

// Agent types
export type AgentType = "designer" | "plan" | "3d" | "render" | "sourcing" | "section" | "presentation";
export type AgentStatus = "spawned" | "active" | "completed" | "failed" | "waiting";
export type MessageType = "status_update" | "result" | "coordination" | "user_message";

export interface AgentSession {
  id: string;
  project_id: string;
  agent_type: AgentType;
  session_label: string;
  status: AgentStatus;
  task_description: string;
  dependencies: string[];
  priority: number;
  spawned_at: string;
  completed_at: string | null;
  result_data: Record<string, unknown> | null;
  created_at: string;
}

export interface AgentMessage {
  id: string;
  project_id: string;
  agent_session_id: string;
  message_type: MessageType;
  content: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

interface SpecialistPlan {
  type: AgentType;
  task: string;
  priority: number;
  dependencies: AgentType[];
}

interface BriefAnalysis {
  projectType: string;
  style: string | null;
  budget: number | null;
  timeline: string;
  providedAssets: string[];
  requiredDeliverables: string[];
}

/**
 * Designer Agent Orchestration Engine
 * Analyzes user briefs and assembles specialist sub-agent teams.
 */
export class DesignerAgent {
  constructor(
    public projectId: string,
    public userBrief: string
  ) {}

  /** Analyze user brief and determine project requirements */
  async analyzeBrief(): Promise<BriefAnalysis> {
    const brief = this.userBrief.toLowerCase();

    const analysis: BriefAnalysis = {
      projectType: this.getProjectType(brief),
      style: this.extractStyle(brief),
      budget: this.extractBudget(brief),
      timeline: this.extractTimeline(brief),
      providedAssets: this.identifyAssets(brief),
      requiredDeliverables: this.identifyDeliverables(brief),
    };

    // Log analysis message
    await this.postMessage("status_update", `Brief analyzed: ${analysis.projectType} project, ${analysis.style || "no style specified"}, ${analysis.requiredDeliverables.length} deliverables`);

    return analysis;
  }

  /** Spawn appropriate specialist agents based on project needs */
  async assembleTeam(analysis: BriefAnalysis): Promise<AgentSession[]> {
    const specialists = this.planSpecialists(analysis);
    const spawnedAgents: AgentSession[] = [];

    for (const spec of specialists) {
      try {
        const { data: agentSession, error } = await supabase
          .from("agent_sessions")
          .insert({
            project_id: this.projectId,
            agent_type: spec.type,
            session_label: `${this.projectId}-${spec.type}`,
            task_description: spec.task,
            dependencies: spec.dependencies,
            priority: spec.priority,
            status: "spawned" as AgentStatus,
          })
          .select()
          .single();

        if (error) throw error;
        if (agentSession) {
          spawnedAgents.push(agentSession as unknown as AgentSession);

          await this.postMessage(
            "coordination",
            `Spawned ${spec.type} agent: ${spec.task}`,
            { agent_session_id: agentSession.id }
          );

          console.log(`🚀 Spawned ${spec.type} agent:`, spec.task);
        }
      } catch (error) {
        console.error(`Failed to spawn ${spec.type} agent:`, error);
      }
    }

    return spawnedAgents;
  }

  /** Post a coordination message */
  async postMessage(type: MessageType, content: string, extra: Record<string, unknown> = {}) {
    await supabase.from("agent_messages").insert([{
      project_id: this.projectId,
      message_type: type,
      content,
      metadata: extra as Record<string, string>,
      agent_session_id: (extra.agent_session_id as string) || null,
    }]);
  }

  /** Get all sessions for this project */
  static async getProjectSessions(projectId: string): Promise<AgentSession[]> {
    const { data } = await supabase
      .from("agent_sessions")
      .select("*")
      .eq("project_id", projectId)
      .order("priority", { ascending: true });
    return (data || []) as unknown as AgentSession[];
  }

  /** Get all messages for this project */
  static async getProjectMessages(projectId: string): Promise<AgentMessage[]> {
    const { data } = await supabase
      .from("agent_messages")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: true });
    return (data || []) as unknown as AgentMessage[];
  }

  /** Update an agent session status */
  static async updateSessionStatus(sessionId: string, status: AgentStatus, resultData?: Record<string, unknown>) {
    const update: Record<string, unknown> = { status };
    if (status === "completed") update.completed_at = new Date().toISOString();
    if (resultData) update.result_data = resultData;
    await supabase.from("agent_sessions").update(update).eq("id", sessionId);
  }

  // --- Private analysis helpers ---

  private getProjectType(brief: string): string {
    if (brief.includes("kitchen") || brief.includes("bedroom") || brief.includes("living room")) return "residential";
    if (brief.includes("office") || brief.includes("retail") || brief.includes("restaurant")) return "commercial";
    if (brief.includes("renovation") || brief.includes("remodel")) return "renovation";
    return "residential";
  }

  private extractStyle(brief: string): string | null {
    const styles: Record<string, string[]> = {
      modern: ["modern", "contemporary", "minimalist", "clean"],
      traditional: ["traditional", "classic", "formal"],
      industrial: ["industrial", "loft", "urban"],
      scandinavian: ["scandinavian", "nordic", "hygge"],
      bohemian: ["bohemian", "boho", "eclectic"],
      "mid-century": ["mid-century", "mid century", "mcm"],
      japandi: ["japandi", "japan", "wabi-sabi"],
    };
    for (const [style, keywords] of Object.entries(styles)) {
      if (keywords.some((kw) => brief.includes(kw))) return style;
    }
    return null;
  }

  private extractBudget(brief: string): number | null {
    const match = brief.match(/\$?(\d+(?:,\d{3})*(?:\.\d{2})?)\s*k?/i);
    if (match) {
      let amount = match[1].replace(/,/g, "");
      if (match[0].toLowerCase().includes("k")) amount = (parseFloat(amount) * 1000).toString();
      return parseInt(amount);
    }
    return null;
  }

  private extractTimeline(brief: string): string {
    if (brief.includes("rush") || brief.includes("urgent")) return "rush";
    if (brief.includes("comprehensive") || brief.includes("detailed")) return "comprehensive";
    return "standard";
  }

  private identifyAssets(brief: string): string[] {
    const assets: string[] = [];
    if (brief.includes("floor plan") || brief.includes("blueprint")) assets.push("floor_plan");
    if (brief.includes("photo") || brief.includes("image")) assets.push("photos");
    if (brief.match(/\d+x\d+|\d+'\s*x\s*\d+'/)) assets.push("dimensions");
    return assets;
  }

  private identifyDeliverables(brief: string): string[] {
    const deliverables: string[] = [];
    if (brief.includes("render") || brief.includes("visual")) deliverables.push("renders");
    if (brief.includes("shopping") || brief.includes("furniture")) deliverables.push("shopping");
    if (brief.includes("presentation")) deliverables.push("presentation");
    if (brief.includes("construction")) deliverables.push("construction");
    if (deliverables.length === 0) deliverables.push("renders", "shopping");
    return deliverables;
  }

  private planSpecialists(analysis: BriefAnalysis): SpecialistPlan[] {
    const specialists: SpecialistPlan[] = [];
    const { projectType, providedAssets, requiredDeliverables } = analysis;

    if (providedAssets.includes("floor_plan") || providedAssets.includes("dimensions")) {
      specialists.push({ type: "plan", task: `Analyze spatial layout for ${projectType} project`, priority: 1, dependencies: [] });
    }

    if (requiredDeliverables.includes("renders")) {
      specialists.push({ type: "3d", task: `Create 3D scene for ${analysis.style || "contemporary"} style`, priority: 2, dependencies: ["plan"] });
      specialists.push({ type: "render", task: "Generate photorealistic renders for presentation", priority: 3, dependencies: ["3d"] });
    }

    if (requiredDeliverables.includes("shopping") || analysis.budget) {
      specialists.push({
        type: "sourcing",
        task: `Source products within ${analysis.budget ? "$" + analysis.budget : "budget"} range`,
        priority: 3,
        dependencies: requiredDeliverables.includes("renders") ? ["render"] : [],
      });
    }

    if (projectType === "renovation" || requiredDeliverables.includes("construction")) {
      specialists.push({ type: "section", task: "Create construction documentation", priority: 2, dependencies: ["plan"] });
    }

    if (requiredDeliverables.includes("presentation")) {
      specialists.push({ type: "presentation", task: "Assemble client presentation materials", priority: 4, dependencies: ["render", "sourcing"] });
    }

    return specialists;
  }
}
