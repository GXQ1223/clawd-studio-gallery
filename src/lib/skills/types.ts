export type Discipline = 'interior' | 'architectural' | 'landscape' | 'industrial';

export interface SkillToolResult {
  success: boolean;
  data?: any;
  error?: string;
}

export interface SkillEvent {
  type: string;
  payload: any;
  source: string;
  timestamp: number;
}

export interface AgentToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, any>;
}

export interface SkillHooks {
  onBriefAnalyzed?(analysis: any, context: SkillContext): void | Promise<void>;
  onSessionComplete?(session: any, result: any, context: SkillContext): void | Promise<void>;
  onFloorPlanUpdated?(floorPlanUrl: string, roomData: any, context: SkillContext): void | Promise<void>;
  onRenderGenerated?(renderUrl: string, context: SkillContext): void | Promise<void>;
  onProductsFound?(products: any[], context: SkillContext): void | Promise<void>;
}

export interface SkillManifest {
  slug: string;
  name: string;
  version: string;
  description: string;
  disciplines: Discipline[];
  requiredSecrets: string[];
  requiredTables?: string[];
  edgeFunctions?: string[];
  uiComponents?: string[];
  optional?: boolean;
  defaultEnabled?: boolean;
  agentTools: AgentToolDefinition[];
  hooks?: (keyof SkillHooks)[];
  configSchema?: Record<string, any>;
}

export interface SkillContext {
  projectId: string;
  userId: string;
  projectType: Discipline;
  supabase: any;
  config: Record<string, any>;
  addFeedEntry: (entry: any) => void | Promise<void>;
  getEnabledSkills: () => string[];
  emitEvent: (event: SkillEvent) => void;
}

export interface SkillPlugin extends SkillHooks {
  manifest: SkillManifest;
  onLoad(context: SkillContext): Promise<void>;
  executeTool(toolName: string, params: Record<string, any>, context: SkillContext): Promise<SkillToolResult>;
  onUnload(): Promise<void>;
}
