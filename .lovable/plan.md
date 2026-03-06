

## Plan: Universal Cron Jobs for All Agent Types

### Concept

Every deliverable type (Renders, Plan, Sketches, Elevations, Sections, Inspiration) gets an optional "Auto-generate" toggle. When enabled, the system periodically generates new variations based on the user's existing preferences and brief — like having a tireless design assistant that keeps exploring options while you sleep.

### How It Works

```text
User adds a deliverable (e.g., Perspective)
        │
        ▼
  Gallery header shows toggle: "Auto-generate ⟳"
        │
        ▼
  User enables it → picks interval (hourly / every 6h / daily)
        │
        ▼
  Edge function `agent-cron` is called on schedule via pg_cron + pg_net
  It reads the project brief + conversation history + existing results
  Calls the appropriate mock-render/mock-sourcing function with variation params
        │
        ▼
  New variations appear in the gallery, tagged "Auto-generated · 2h ago"
  User reviews: Keep / Delete / Refine
```

### Database Changes

**Migration — add cron config to `agent_sessions`:**
- Add `cron_enabled boolean DEFAULT false` and `cron_interval text DEFAULT null` columns to `agent_sessions`
- These store per-agent scheduling preferences

**pg_cron + pg_net setup (via insert tool, not migration):**
- Enable extensions, create a single master cron job that runs every hour
- The job calls the `agent-cron` edge function, which checks all sessions with `cron_enabled = true` and runs the ones whose interval has elapsed

### New Edge Function: `agent-cron`

`supabase/functions/agent-cron/index.ts`:
- Queries `agent_sessions` where `cron_enabled = true`
- For each, checks if enough time has elapsed since last `completed_at` based on `cron_interval`
- Calls the appropriate generation logic (mock-render for perspective/sketch, mock-sourcing for shopping, etc.)
- Stores results in `result_data` and creates an `agent_message` so the feed shows "Auto-generated 3 new perspective variations"

### UI Changes

**Per-deliverable cron toggle** (in `AssetGallery.tsx` or a new `DeliverableHeader` component):
- Small toggle row at the top of each deliverable's gallery view: `"Auto-generate ⟳"` + interval selector (Hourly / Every 6h / Daily)
- Enabling it updates the agent session's `cron_enabled` and `cron_interval` via Supabase
- Auto-generated assets get a subtle badge: "Auto · 3h ago"

**Feed integration** (`AgentFeed.tsx`):
- Auto-generated results appear in the feed with a distinct style: "⟳ Auto-generated 3 new render variations"

### Files to Create/Modify

| File | Change |
|---|---|
| DB migration | Add `cron_enabled`, `cron_interval` to `agent_sessions` |
| pg_cron setup (insert tool) | Enable pg_cron + pg_net, create hourly master job calling `agent-cron` |
| New: `supabase/functions/agent-cron/index.ts` | Master cron handler that dispatches to per-agent generation |
| `supabase/config.toml` | Add `[functions.agent-cron]` with `verify_jwt = false` |
| `src/components/workspace/AssetGallery.tsx` | Add auto-generate toggle per deliverable |
| `src/hooks/useDesignerAgent.ts` | Add `toggleCron(sessionId, enabled, interval)` method |
| `src/lib/designerAgent.ts` | Add `AgentSession.cron_enabled` and `cron_interval` to types |

### Behavior Per Agent Type

| Agent | What auto-generate does |
|---|---|
| **Perspective** | Generates style variations of renders every interval |
| **Plan** | Creates layout alternatives exploring different arrangements |
| **Sketch** | Quick concept sketches exploring different angles |
| **Elevation** | Finish/material variations on wall views |
| **Section** | Construction detail alternatives |
| **Sourcing** | Refreshes product matches with new inventory |
| **Inspiration** | Searches for new reference images and articles |

