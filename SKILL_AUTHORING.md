# Skill Authoring Guide

This guide explains how to create a modular skill plugin for Clawd Studio Gallery.

## Directory Structure

Each skill lives in its own directory under `src/skills/`:

```
src/skills/<slug>/
  skill.json    # Manifest describing the skill
  index.ts      # Implementation of the SkillPlugin interface
```

For a working reference, see `src/skills/hello-world/`.

## skill.json Manifest

```jsonc
{
  "slug": "my-skill",              // Unique identifier (kebab-case)
  "name": "My Skill",             // Human-readable display name
  "version": "1.0.0",             // Semver version string
  "disciplines": ["interior"],     // Target disciplines: "interior", "landscape", "architectural", or "*"
  "requiredSecrets": ["MY_API_KEY"], // Environment variables the skill needs at runtime
  "agentTools": [                  // Tools exposed to the DesignerAgent
    {
      "name": "my_tool",
      "description": "Does something useful",
      "parameters": {              // JSON Schema for tool parameters
        "type": "object",
        "properties": {
          "input": { "type": "string", "description": "Tool input" }
        },
        "required": ["input"]
      }
    }
  ],
  "hooks": [                       // Lifecycle events this skill subscribes to
    "onBriefAnalyzed",
    "onFloorPlanUpdated"
  ],
  "configSchema": {                // Optional JSON Schema for user-facing config
    "type": "object",
    "properties": {
      "quality": { "type": "string", "enum": ["draft", "final"], "default": "draft" }
    }
  }
}
```

### Field Reference

| Field | Required | Description |
|---|---|---|
| `slug` | Yes | Unique kebab-case identifier used for registration and storage paths. |
| `name` | Yes | Display name shown in the Skill Manager UI. |
| `version` | Yes | Semver version string. |
| `disciplines` | Yes | Array of design disciplines the skill applies to, or `["*"]` for all. |
| `requiredSecrets` | No | Env vars the skill needs. The registry warns if any are missing. |
| `agentTools` | No | Tools the agent can call. Each needs `name`, `description`, and `parameters` (JSON Schema). |
| `hooks` | No | Lifecycle events to subscribe to. |
| `configSchema` | No | JSON Schema for user-configurable settings. |

## Implementing the SkillPlugin Interface

Your `index.ts` must export a default object implementing `SkillPlugin`:

```typescript
import { SkillPlugin, SkillContext, ToolCall, ToolResult } from "@/lib/skillTypes";

const plugin: SkillPlugin = {
  async onLoad(context: SkillContext): Promise<void> {
    // Called when the skill is registered. Use for initialization.
    console.log(`${context.manifest.name} loaded`);
  },

  async executeTool(call: ToolCall, context: SkillContext): Promise<ToolResult> {
    // Called when the agent invokes one of your agentTools.
    switch (call.toolName) {
      case "my_tool":
        const result = await doWork(call.parameters.input);
        return { success: true, data: result };
      default:
        return { success: false, error: `Unknown tool: ${call.toolName}` };
    }
  },

  async onUnload(context: SkillContext): Promise<void> {
    // Called when the skill is deregistered. Clean up resources.
  },
};

export default plugin;
```

## Defining Agent Tools

Tools declared in `agentTools` are available to the LLM during tool planning (in `analyze-brief`). Define parameters using standard JSON Schema so the agent can construct valid calls.

Keep tool descriptions concise and specific. The agent uses them to decide when and how to call your tool.

## Lifecycle Hooks

Subscribe to hooks by listing them in `skill.json`. The skill registry calls your `executeTool` (or a dedicated handler) when these events fire:

| Hook | Fires When |
|---|---|
| `onBriefAnalyzed` | The brief analysis step completes. |
| `onFloorPlanUpdated` | A floor plan is created or modified. |
| `onRenderComplete` | A render finishes generating. |
| `onProductsSourced` | Product sourcing returns results. |
| `onSessionStart` | A new agent session begins. |
| `onSessionEnd` | An agent session completes. |

## Using the Event Bus

Skills can emit and listen for custom events via the `SkillContext`:

```typescript
// Emit an event for other skills to consume
context.emitEvent("my-skill:analysis-ready", { data: analysisResult });

// Listen handled automatically if declared in hooks
```

Use namespaced event names (`<slug>:<event>`) to avoid collisions.

## Adding a Supabase Edge Function

If your skill needs a server-side component:

1. Create `supabase/functions/<function-name>/index.ts`.
2. Include CORS headers in the response.
3. Verify the JWT using `supabase.auth.getUser()`.
4. Reference the function from your skill via `fetch` to the Supabase functions URL.
5. Add any required secrets to your Supabase project environment.

## Testing Your Skill

1. Place tests in `src/test/skill-<slug>.test.ts`.
2. Mock `SkillContext` and verify `executeTool` returns expected results.
3. Test edge cases: missing parameters, invalid input, API failures.
4. Run with `npm run test`.

```typescript
import { describe, it, expect, vi } from "vitest";
import plugin from "@/skills/my-skill";

describe("my-skill", () => {
  const mockContext = {
    manifest: { name: "My Skill", slug: "my-skill" },
    emitEvent: vi.fn(),
  } as any;

  it("executes my_tool successfully", async () => {
    const result = await plugin.executeTool(
      { toolName: "my_tool", parameters: { input: "test" } },
      mockContext
    );
    expect(result.success).toBe(true);
  });
});
```

## Example

See the hello-world skill at `src/skills/hello-world/` for a minimal working example that demonstrates the manifest, plugin interface, and a simple agent tool.
