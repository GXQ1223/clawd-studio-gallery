# @clawd/agent-core

Modular AI designer agent with a skill plugin architecture for Clawd Studio. Provides a registry for discovering, loading, and orchestrating skill plugins that extend the designer agent with new tools, lifecycle hooks, and cross-skill event communication.

## Install

```bash
npm install @clawd/agent-core
```

## Quick Start

```ts
import { SkillRegistry } from "@clawd/agent-core";

// 1. Create a registry
const registry = new SkillRegistry();

// 2. Register a skill plugin
registry.register({
  manifest: {
    slug: "hello-world",
    name: "Hello World",
    version: "1.0.0",
    description: "Minimal example skill",
    disciplines: ["interior", "architectural", "landscape", "industrial"],
    requiredSecrets: [],
    agentTools: [
      {
        name: "say_hello",
        description: "Returns a greeting",
        parameters: { message: { type: "string" } },
      },
    ],
  },
  async onLoad() {},
  async onUnload() {},
  async executeTool(toolName, params) {
    if (toolName === "say_hello") {
      return { success: true, data: `Hello, ${params.message}!` };
    }
    return { success: false, error: "Unknown tool" };
  },
});

// 3. Load enabled skills
await registry.loadAll(["hello-world"], context);

// 4. Execute a tool
const result = await registry.executeTool("say_hello", { message: "world" }, context);
console.log(result.data); // "Hello, world!"
```

## Architecture

```
SkillRegistry
  |
  +-- register(plugin: SkillPlugin)
  |     Stores the plugin keyed by manifest.slug
  |
  +-- loadAll(enabledSlugs, context)
  |     Calls onLoad() for each enabled plugin
  |
  +-- executeTool(toolName, params, context)
  |     Finds the plugin whose manifest.agentTools includes
  |     the tool name and delegates execution
  |
  +-- fireHook(hookName, ...args)
  |     Broadcasts lifecycle hooks to all enabled plugins
  |     that declare them in manifest.hooks
  |
  +-- SkillEventBus (cross-skill pub/sub)
        Skills subscribe in onLoad(), emit via context.emitEvent()
```

Each skill is a **SkillPlugin** that declares:

- A **SkillManifest** with metadata, discipline compatibility, required secrets, and agent tool definitions.
- Lifecycle methods: `onLoad`, `onUnload`, `executeTool`.
- Optional **hooks** (`onBriefAnalyzed`, `onRenderGenerated`, etc.) for reacting to agent lifecycle events.

The registry connects plugins to the agent by aggregating their **AgentToolDefinition** arrays and dispatching tool calls to the correct plugin at runtime.

## API Reference

### SkillRegistry

| Method | Signature | Description |
|--------|-----------|-------------|
| `register` | `(plugin: SkillPlugin) => void` | Register a skill plugin with the registry. |
| `loadAll` | `(enabledSlugs: string[], context: SkillContext) => Promise<void>` | Enable and load all skills matching the given slug list, calling `onLoad` for each. |
| `executeTool` | `(toolName: string, params: Record<string, any>, context: SkillContext) => Promise<SkillToolResult>` | Find the skill that owns the named tool and execute it. Returns `{ success: false }` if no skill handles the tool. |
| `fireHook` | `(hookName: keyof SkillHooks, ...args) => Promise<void>` | Broadcast a lifecycle hook to all enabled skills that declare it in their manifest. |
| `setEnabled` | `(slug: string, enabled: boolean, context?: SkillContext) => Promise<void>` | Enable or disable a skill at runtime. Calls `onLoad`/`onUnload` as needed. |
| `getAllToolDefinitions` | `() => AgentToolDefinition[]` | Return all tool definitions from all currently enabled skills. |
| `getSkillsForDiscipline` | `(discipline: Discipline) => SkillPlugin[]` | Return all registered skills compatible with the given discipline. |
| `getAllSkills` | `() => { plugin: SkillPlugin; enabled: boolean }[]` | Return all registered skills with their enabled state. |
| `getEnabledSlugs` | `() => string[]` | Return slugs of all currently enabled skills. |
| `has` | `(slug: string) => boolean` | Check if a skill is registered. |
| `get` | `(slug: string) => SkillPlugin \| undefined` | Get a specific skill by slug. |
| `unloadAll` | `() => Promise<void>` | Unload all loaded skills, calling `onUnload` on each. |

### SkillPlugin Interface

```ts
interface SkillPlugin extends SkillHooks {
  manifest: SkillManifest;
  onLoad(context: SkillContext): Promise<void>;
  executeTool(
    toolName: string,
    params: Record<string, any>,
    context: SkillContext
  ): Promise<SkillToolResult>;
  onUnload(): Promise<void>;
}
```

**SkillManifest** fields:

| Field | Type | Description |
|-------|------|-------------|
| `slug` | `string` | Unique identifier for the skill. |
| `name` | `string` | Human-readable display name. |
| `version` | `string` | Semver version string. |
| `description` | `string` | Short description of the skill. |
| `disciplines` | `Discipline[]` | Applicable design disciplines (`interior`, `architectural`, `landscape`, `industrial`). |
| `requiredSecrets` | `string[]` | Environment variable names the skill needs. |
| `agentTools` | `AgentToolDefinition[]` | Tools the skill provides to the agent. |
| `hooks` | `(keyof SkillHooks)[]` | Lifecycle hooks the skill wants to receive. |
| `requiredTables` | `string[]` | Optional. Database tables the skill depends on. |
| `edgeFunctions` | `string[]` | Optional. Supabase Edge Functions the skill uses. |
| `uiComponents` | `string[]` | Optional. React component paths to render in the workspace. |
| `configSchema` | `Record<string, any>` | Optional. JSON schema for skill configuration. |

### SkillEventBus

Cross-skill event pub/sub for decoupled communication between plugins.

| Method | Signature | Description |
|--------|-----------|-------------|
| `on` | `(eventType: string, handler: (event: SkillEvent) => void) => void` | Subscribe to events of the given type. |
| `off` | `(eventType: string, handler: (event: SkillEvent) => void) => void` | Unsubscribe a handler from events of the given type. |
| `emit` | `(event: SkillEvent) => void` | Broadcast an event to all subscribed handlers. |
| `clear` | `() => void` | Remove all listeners. |

Built-in event types: `FLOOR_PLAN_UPDATED`, `RENDER_GENERATED`, `PRODUCTS_FOUND`, `FURNITURE_PLACED`, `SESSION_COMPLETE`, `BRIEF_ANALYZED`.

## Writing Skills

See [SKILL_AUTHORING.md](../../SKILL_AUTHORING.md) for a complete guide to writing custom skill plugins.

## License

MIT
