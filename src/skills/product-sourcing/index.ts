import { supabase } from '@/integrations/supabase/client';
import type {
  SkillPlugin,
  SkillManifest,
  SkillContext,
  SkillToolResult,
} from '../../lib/skills/types';
import { validateAndSanitizeParams } from '../../lib/skills/param-validation';
import manifest from './skill.json';

class ProductSourcingSkill implements SkillPlugin {
  manifest: SkillManifest = manifest as SkillManifest;

  async onLoad(context: SkillContext): Promise<void> {
    console.log('Product Sourcing skill loaded for project', context.projectId);
  }

  async executeTool(
    toolName: string,
    params: Record<string, any>,
    context: SkillContext,
  ): Promise<SkillToolResult> {
    if (toolName === 'search_products') {
      // Validate params
      const paramError = validateAndSanitizeParams(
        params,
        ['style', 'description', 'project_type'],
        ['budget'],
      );
      if (paramError) return { success: false, error: paramError };

      try {
        const { data, error } = await supabase.functions.invoke('mock-sourcing', {
          body: {
            style: params.style,
            budget: params.budget,
            project_id: context.projectId,
            description: params.description,
            project_type: params.project_type,
          },
        });

        if (error) throw error;

        return {
          success: true,
          data: {
            products: data.products || [],
            shopping_list: data.shopping_list || { total: 0, item_count: 0, budget_remaining: null },
          },
        };
      } catch (err) {
        console.error('Product sourcing failed:', err);
        return { success: false, error: String(err) };
      }
    }

    return { success: false, error: `Unknown tool: ${toolName}` };
  }

  async onRenderGenerated(renderUrl: string, context: SkillContext): Promise<void> {
    console.log(
      `Renders available for product matching — project ${context.projectId}, render: ${renderUrl}`,
    );
  }

  async onUnload(): Promise<void> {
    console.log('Product Sourcing skill unloaded');
  }
}

export default ProductSourcingSkill;
