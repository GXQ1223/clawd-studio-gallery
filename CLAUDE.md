# Clawd Studio Gallery

AI-powered design workspace for architectural, interior, and landscape designers.

## Stack

- **Frontend**: Vite + React 18 + TypeScript, react-router-dom v6, TanStack React Query
- **UI**: shadcn/ui + Radix UI + Tailwind CSS
- **Backend**: Supabase (Postgres with RLS, Auth, Storage, Edge Functions/Deno, Realtime)
- **AI**: Google Gemini 2.5 Flash (image generation), OpenAI GPT-4o-mini (brief analysis, style transfer, product curation), Replicate (ControlNet SDXL)
- **Testing**: vitest + @testing-library/react (jsdom)

## Key Commands

```bash
npm run dev          # Start dev server (port 8080)
npm run build        # Production build
npm run test         # Run tests once
npm run test:watch   # Watch mode
npm run lint         # ESLint
```

## Architecture

### Agent Orchestration
- `src/lib/designerAgent.ts` — `DesignerAgent` class: brief analysis → team assembly → render generation → product sourcing
- `src/hooks/useDesignerAgent.ts` — React hook wrapping orchestration, Supabase Realtime subscriptions, cron toggling
- Render engine priority: Gemini `generate-render` → fallback `mock-render` (ControlNet/DALL-E 3/Replicate/mock)

### Edge Functions (supabase/functions/)
- `generate-render` — Gemini 2.5 Flash image generation (primary)
- `mock-render` — Multi-engine fallback: ControlNet, DALL-E 3, Replicate SDXL, Unsplash mock
- `analyze-brief` — GPT-4o-mini structured brief extraction
- `generate-questions` — GPT-4o-mini contextual planning questions
- `mock-sourcing` — Product catalog (pgvector) + GPT-4o-mini curation
- `agent-cron` — Scheduled orchestration via pg_cron

### Data Flow
- Projects → agent_sessions → agent_messages (all in Supabase)
- Renders stored in `project-assets` Storage bucket at `{projectId}/render-*.png`
- Product catalog with pgvector similarity search (384-dim embeddings)
- Realtime subscriptions on agent_messages and agent_sessions

## Current Status (March 9, 2026)

All 27 original tasks from v1 report complete. Branch `claude/add-image-generation-api-xevPk` merged.
18 new tasks from v2 report in `task.txt` — being implemented via hourly cron (job b2e57a58).

### Active v2 Issues
- JWT verification disabled on generate-render (security/financial risk)
- Prompt hardcoded to "interior design" regardless of project_type
- Storage delete policy mismatch (projectId vs auth.uid)
- Sequential Gemini calls may timeout on free tier
- No input validation on generate-render
- .env still committed to git

## File Conventions

- Components: `src/components/` (workspace/, mvp/, ui/)
- Pages: `src/pages/`
- Hooks: `src/hooks/`
- Data/utils: `src/lib/`, `src/data/`
- Tests: `src/test/*.test.{ts,tsx}`
- Migrations: `supabase/migrations/`
- Edge functions: `supabase/functions/*/index.ts`
