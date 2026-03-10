import type {
  SkillPlugin,
  SkillManifest,
  SkillContext,
  SkillToolResult,
} from '../../lib/skills/types';
import manifest from './skill.json';

class HelloWorldSkill implements SkillPlugin {
  manifest: SkillManifest = manifest as SkillManifest;

  async onLoad(context: SkillContext): Promise<void> {
    console.log('Hello World skill loaded');
  }

  async executeTool(
    toolName: string,
    params: Record<string, any>,
    context: SkillContext,
  ): Promise<SkillToolResult> {
    if (toolName === 'say_hello') {
      const name = params.name ?? 'World';
      return { success: true, data: `Hello, ${name}! Welcome to Clawd Studio.` };
    }
    return { success: false, error: `Unknown tool: ${toolName}` };
  }

  async onUnload(): Promise<void> {
    console.log('Hello World skill unloaded');
  }

  async onBriefAnalyzed(analysis: any, context: SkillContext): Promise<void> {
    console.log('Hello World skill received brief analysis:', analysis);
  }
}

export default HelloWorldSkill;
