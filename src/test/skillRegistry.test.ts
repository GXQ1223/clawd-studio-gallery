import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SkillRegistry } from '../lib/skills/registry';
import type { SkillPlugin, SkillManifest, SkillContext } from '../lib/skills/types';

function createMockSkill(overrides: Partial<SkillManifest> = {}): SkillPlugin {
  return {
    manifest: {
      slug: 'test-skill',
      name: 'Test Skill',
      version: '1.0.0',
      description: 'A test skill',
      disciplines: ['interior'],
      requiredSecrets: [],
      agentTools: [{ name: 'test_tool', description: 'Test tool', parameters: {} }],
      hooks: [],
      ...overrides,
    },
    onLoad: vi.fn().mockResolvedValue(undefined),
    executeTool: vi.fn().mockResolvedValue({ success: true, data: 'mock result' }),
    onUnload: vi.fn().mockResolvedValue(undefined),
  };
}

const mockContext: SkillContext = {
  projectId: 'test-project',
  userId: 'test-user',
  projectType: 'interior',
  supabase: {},
  config: {},
  addFeedEntry: vi.fn(),
  getEnabledSkills: () => [],
  emitEvent: vi.fn(),
};

describe('SkillRegistry', () => {
  let registry: SkillRegistry;

  beforeEach(() => {
    registry = new SkillRegistry();
  });

  describe('register()', () => {
    it('adds a skill to the registry', () => {
      const skill = createMockSkill();
      registry.register(skill);

      expect(registry.has('test-skill')).toBe(true);
      expect(registry.get('test-skill')).toBe(skill);
    });

    it('registers multiple skills with different slugs', () => {
      const skill1 = createMockSkill({ slug: 'skill-a' });
      const skill2 = createMockSkill({ slug: 'skill-b' });

      registry.register(skill1);
      registry.register(skill2);

      expect(registry.has('skill-a')).toBe(true);
      expect(registry.has('skill-b')).toBe(true);
    });

    it('registers skills as disabled by default', () => {
      const skill = createMockSkill();
      registry.register(skill);

      expect(registry.getEnabledSlugs()).toEqual([]);
    });
  });

  describe('setEnabled()', () => {
    it('excludes disabled skill from getAllToolDefinitions()', async () => {
      const skill = createMockSkill({ slug: 'toggle-skill' });
      registry.register(skill);

      // Enable the skill first
      await registry.setEnabled('toggle-skill', true, mockContext);
      expect(registry.getAllToolDefinitions()).toHaveLength(1);

      // Disable it
      await registry.setEnabled('toggle-skill', false);
      expect(registry.getAllToolDefinitions()).toHaveLength(0);
    });

    it('calls onLoad when enabling an unloaded skill with context', async () => {
      const skill = createMockSkill();
      registry.register(skill);

      await registry.setEnabled('test-skill', true, mockContext);

      expect(skill.onLoad).toHaveBeenCalledWith(mockContext);
      expect(registry.getEnabledSlugs()).toContain('test-skill');
    });

    it('calls onUnload when disabling a loaded skill', async () => {
      const skill = createMockSkill();
      registry.register(skill);

      await registry.setEnabled('test-skill', true, mockContext);
      await registry.setEnabled('test-skill', false);

      expect(skill.onUnload).toHaveBeenCalled();
      expect(registry.getEnabledSlugs()).not.toContain('test-skill');
    });

    it('does nothing for an unknown slug', async () => {
      // Should not throw
      await registry.setEnabled('nonexistent', true, mockContext);
      expect(registry.has('nonexistent')).toBe(false);
    });

    it('does not enable skill if onLoad throws', async () => {
      const skill = createMockSkill();
      (skill.onLoad as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('load failed'));
      registry.register(skill);

      await registry.setEnabled('test-skill', true, mockContext);

      expect(registry.getEnabledSlugs()).not.toContain('test-skill');
    });
  });

  describe('executeTool()', () => {
    it('routes to the correct skill executeTool method', async () => {
      const skillA = createMockSkill({
        slug: 'skill-a',
        agentTools: [{ name: 'tool_a', description: 'Tool A', parameters: {} }],
      });
      const skillB = createMockSkill({
        slug: 'skill-b',
        agentTools: [{ name: 'tool_b', description: 'Tool B', parameters: {} }],
      });

      registry.register(skillA);
      registry.register(skillB);
      await registry.loadAll(['skill-a', 'skill-b'], mockContext);

      const params = { foo: 'bar' };
      await registry.executeTool('tool_b', params, mockContext);

      expect(skillB.executeTool).toHaveBeenCalledWith('tool_b', params, mockContext);
      expect(skillA.executeTool).not.toHaveBeenCalled();
    });

    it('returns an error result when no skill handles the tool name', async () => {
      const skill = createMockSkill();
      registry.register(skill);
      await registry.loadAll(['test-skill'], mockContext);

      const result = await registry.executeTool('unknown_tool', {}, mockContext);

      expect(result.success).toBe(false);
      expect(result.error).toContain('No skill handles tool "unknown_tool"');
    });

    it('skips disabled skills when routing tools', async () => {
      const skill = createMockSkill();
      registry.register(skill);
      // Skill registered but not enabled

      const result = await registry.executeTool('test_tool', {}, mockContext);

      expect(result.success).toBe(false);
      expect(skill.executeTool).not.toHaveBeenCalled();
    });
  });

  describe('fireHook()', () => {
    it('calls the hook on all enabled skills that declare it', async () => {
      const skill1 = createMockSkill({
        slug: 'hook-skill-1',
        hooks: ['onBriefAnalyzed'],
      });
      skill1.onBriefAnalyzed = vi.fn().mockResolvedValue(undefined);

      const skill2 = createMockSkill({
        slug: 'hook-skill-2',
        hooks: ['onBriefAnalyzed'],
      });
      skill2.onBriefAnalyzed = vi.fn().mockResolvedValue(undefined);

      registry.register(skill1);
      registry.register(skill2);
      await registry.loadAll(['hook-skill-1', 'hook-skill-2'], mockContext);

      const analysis = { rooms: ['living room'] };
      await registry.fireHook('onBriefAnalyzed', analysis, mockContext);

      expect(skill1.onBriefAnalyzed).toHaveBeenCalledWith(analysis, mockContext);
      expect(skill2.onBriefAnalyzed).toHaveBeenCalledWith(analysis, mockContext);
    });

    it('does not call hook on disabled skills', async () => {
      const enabledSkill = createMockSkill({
        slug: 'enabled-skill',
        hooks: ['onBriefAnalyzed'],
      });
      enabledSkill.onBriefAnalyzed = vi.fn().mockResolvedValue(undefined);

      const disabledSkill = createMockSkill({
        slug: 'disabled-skill',
        hooks: ['onBriefAnalyzed'],
      });
      disabledSkill.onBriefAnalyzed = vi.fn().mockResolvedValue(undefined);

      registry.register(enabledSkill);
      registry.register(disabledSkill);
      await registry.loadAll(['enabled-skill'], mockContext);

      await registry.fireHook('onBriefAnalyzed', {}, mockContext);

      expect(enabledSkill.onBriefAnalyzed).toHaveBeenCalled();
      expect(disabledSkill.onBriefAnalyzed).not.toHaveBeenCalled();
    });

    it('does not call hook on skills that do not declare it', async () => {
      const skill = createMockSkill({
        slug: 'no-hook-skill',
        hooks: [],  // no hooks declared
      });
      skill.onBriefAnalyzed = vi.fn();

      registry.register(skill);
      await registry.loadAll(['no-hook-skill'], mockContext);

      await registry.fireHook('onBriefAnalyzed', {}, mockContext);

      expect(skill.onBriefAnalyzed).not.toHaveBeenCalled();
    });

    it('continues firing hooks even if one skill throws', async () => {
      const failSkill = createMockSkill({
        slug: 'fail-skill',
        hooks: ['onRenderGenerated'],
      });
      failSkill.onRenderGenerated = vi.fn().mockRejectedValue(new Error('hook error'));

      const okSkill = createMockSkill({
        slug: 'ok-skill',
        hooks: ['onRenderGenerated'],
      });
      okSkill.onRenderGenerated = vi.fn().mockResolvedValue(undefined);

      registry.register(failSkill);
      registry.register(okSkill);
      await registry.loadAll(['fail-skill', 'ok-skill'], mockContext);

      await registry.fireHook('onRenderGenerated', 'http://example.com/render.png', mockContext);

      expect(failSkill.onRenderGenerated).toHaveBeenCalled();
      expect(okSkill.onRenderGenerated).toHaveBeenCalled();
    });
  });

  describe('getSkillsForDiscipline()', () => {
    it('filters correctly by discipline', () => {
      const interiorSkill = createMockSkill({
        slug: 'interior-skill',
        disciplines: ['interior'],
      });
      const landscapeSkill = createMockSkill({
        slug: 'landscape-skill',
        disciplines: ['landscape'],
      });
      const multiSkill = createMockSkill({
        slug: 'multi-skill',
        disciplines: ['interior', 'architectural'],
      });

      registry.register(interiorSkill);
      registry.register(landscapeSkill);
      registry.register(multiSkill);

      const interiorSkills = registry.getSkillsForDiscipline('interior');
      expect(interiorSkills).toHaveLength(2);
      expect(interiorSkills.map(s => s.manifest.slug)).toContain('interior-skill');
      expect(interiorSkills.map(s => s.manifest.slug)).toContain('multi-skill');

      const landscapeSkills = registry.getSkillsForDiscipline('landscape');
      expect(landscapeSkills).toHaveLength(1);
      expect(landscapeSkills[0].manifest.slug).toBe('landscape-skill');

      const industrialSkills = registry.getSkillsForDiscipline('industrial');
      expect(industrialSkills).toHaveLength(0);
    });

    it('returns skills regardless of enabled state', () => {
      const skill = createMockSkill({ disciplines: ['architectural'] });
      registry.register(skill);
      // Not enabled

      const result = registry.getSkillsForDiscipline('architectural');
      expect(result).toHaveLength(1);
    });
  });

  describe('loadAll()', () => {
    it('enables skills in the enabledSlugs list', async () => {
      const skill1 = createMockSkill({ slug: 'load-a' });
      const skill2 = createMockSkill({ slug: 'load-b' });
      const skill3 = createMockSkill({ slug: 'load-c' });

      registry.register(skill1);
      registry.register(skill2);
      registry.register(skill3);

      await registry.loadAll(['load-a', 'load-c'], mockContext);

      expect(registry.getEnabledSlugs()).toContain('load-a');
      expect(registry.getEnabledSlugs()).not.toContain('load-b');
      expect(registry.getEnabledSlugs()).toContain('load-c');
    });

    it('calls onLoad with context for each enabled skill', async () => {
      const skill = createMockSkill({ slug: 'load-me' });
      registry.register(skill);

      await registry.loadAll(['load-me'], mockContext);

      expect(skill.onLoad).toHaveBeenCalledWith(mockContext);
    });

    it('does not enable a skill whose onLoad throws', async () => {
      const skill = createMockSkill({ slug: 'fail-load' });
      (skill.onLoad as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('boom'));
      registry.register(skill);

      await registry.loadAll(['fail-load'], mockContext);

      expect(registry.getEnabledSlugs()).not.toContain('fail-load');
    });

    it('includes enabled skills tools in getAllToolDefinitions', async () => {
      const skill = createMockSkill({
        slug: 'tool-skill',
        agentTools: [
          { name: 'alpha', description: 'Alpha', parameters: {} },
          { name: 'beta', description: 'Beta', parameters: {} },
        ],
      });
      registry.register(skill);

      await registry.loadAll(['tool-skill'], mockContext);

      const tools = registry.getAllToolDefinitions();
      expect(tools).toHaveLength(2);
      expect(tools.map(t => t.name)).toEqual(['alpha', 'beta']);
    });
  });

  describe('unloadAll()', () => {
    it('calls onUnload on all loaded skills', async () => {
      const skill1 = createMockSkill({ slug: 'unload-a' });
      const skill2 = createMockSkill({ slug: 'unload-b' });

      registry.register(skill1);
      registry.register(skill2);
      await registry.loadAll(['unload-a', 'unload-b'], mockContext);

      await registry.unloadAll();

      expect(skill1.onUnload).toHaveBeenCalled();
      expect(skill2.onUnload).toHaveBeenCalled();
    });

    it('disables all skills after unloading', async () => {
      const skill = createMockSkill({ slug: 'unload-me' });
      registry.register(skill);
      await registry.loadAll(['unload-me'], mockContext);

      await registry.unloadAll();

      expect(registry.getEnabledSlugs()).toEqual([]);
      expect(registry.getAllToolDefinitions()).toEqual([]);
    });

    it('does not call onUnload on skills that were never loaded', async () => {
      const skill = createMockSkill({ slug: 'never-loaded' });
      registry.register(skill);

      await registry.unloadAll();

      expect(skill.onUnload).not.toHaveBeenCalled();
    });

    it('continues unloading remaining skills even if one throws', async () => {
      const failSkill = createMockSkill({ slug: 'fail-unload' });
      (failSkill.onUnload as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('unload error'));

      const okSkill = createMockSkill({ slug: 'ok-unload' });

      registry.register(failSkill);
      registry.register(okSkill);
      await registry.loadAll(['fail-unload', 'ok-unload'], mockContext);

      await registry.unloadAll();

      expect(failSkill.onUnload).toHaveBeenCalled();
      expect(okSkill.onUnload).toHaveBeenCalled();
      expect(registry.getEnabledSlugs()).toEqual([]);
    });
  });

  describe('getAllSkills()', () => {
    it('returns all registered skills with enabled status', async () => {
      const skill1 = createMockSkill({ slug: 'all-a' });
      const skill2 = createMockSkill({ slug: 'all-b' });

      registry.register(skill1);
      registry.register(skill2);
      await registry.loadAll(['all-a'], mockContext);

      const all = registry.getAllSkills();
      expect(all).toHaveLength(2);

      const aEntry = all.find(s => s.plugin.manifest.slug === 'all-a');
      const bEntry = all.find(s => s.plugin.manifest.slug === 'all-b');
      expect(aEntry?.enabled).toBe(true);
      expect(bEntry?.enabled).toBe(false);
    });
  });
});
