import { supabase } from '@/integrations/supabase/client';
import type {
  SkillPlugin,
  SkillManifest,
  SkillContext,
  SkillToolResult,
} from '@/lib/skills/types';
import { validateAndSanitizeParams } from '@/lib/skills/param-validation';
import manifest from './skill.json';

class AutoGenerateSkill implements SkillPlugin {
  manifest: SkillManifest = manifest as SkillManifest;

  async onLoad(context: SkillContext): Promise<void> {
    console.log(`[auto-generate] Skill loaded for project ${context.projectId}`);
  }

  async executeTool(
    toolName: string,
    params: Record<string, any>,
    context: SkillContext,
  ): Promise<SkillToolResult> {
    if (toolName !== 'schedule_auto_generate') {
      return { success: false, error: `Unknown tool: ${toolName}` };
    }

    // Validate params
    const paramError = validateAndSanitizeParams(params, ['session_id', 'interval']);
    if (paramError) return { success: false, error: paramError };
    if (params.enabled !== undefined && typeof params.enabled !== 'boolean') {
      return { success: false, error: 'enabled must be a boolean' };
    }

    const { enabled, interval, session_id } = params;

    if (!session_id) {
      return { success: false, error: 'session_id is required to toggle cron' };
    }

    const updatePayload: Record<string, any> = {
      cron_enabled: !!enabled,
    };

    if (enabled && interval) {
      updatePayload.cron_interval = interval;
    }

    const { error } = await supabase
      .from('agent_sessions')
      .update(updatePayload)
      .eq('id', session_id);

    if (error) {
      console.error('[auto-generate] Failed to update agent_sessions:', error.message);
      return { success: false, error: error.message };
    }

    const action = enabled ? `enabled (interval: ${interval ?? 'default'})` : 'disabled';
    console.log(`[auto-generate] Auto-generation ${action} for session ${session_id}`);

    return {
      success: true,
      data: { session_id, cron_enabled: !!enabled, cron_interval: interval ?? null },
    };
  }

  async onSessionComplete(
    session: any,
    result: any,
    context: SkillContext,
  ): Promise<void> {
    console.log(
      `[auto-generate] Session ${session?.id ?? 'unknown'} completed. ` +
        'Auto-generation can be scheduled for continued render regeneration.',
    );
  }

  async onUnload(): Promise<void> {
    console.log('[auto-generate] Skill unloaded');
  }
}

export default AutoGenerateSkill;
