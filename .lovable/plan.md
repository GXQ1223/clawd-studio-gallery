

## What's needed to move from demo to production E2E

### Current state
The orchestration pipeline works end-to-end **within mock mode**: user types a brief → `DesignerAgent` analyzes it → calls `mock-render` and `mock-sourcing` edge functions → results appear in the feed and gallery. The project list, data, and assets are all **hardcoded static files** (`src/data/projects.ts`, `src/data/workspace-data.ts`).

### Gaps to close (grouped by priority)

#### 1. Projects in the database (not static files)
- **Create a `projects` table** in the database with columns matching the `Project` interface (name, room, status, dimensions, budget, image, folders as JSONB)
- **CRUD operations**: create, read, update, delete projects via the database instead of importing from `src/data/projects.ts`
- **Project creation flow**: add a "New Project" form/modal on Index page that inserts into the database and navigates to the workspace
- Replace all `projects.find(p => p.id === id)` lookups with database queries (React Query)

#### 2. Authentication
- The `agent_sessions` and `agent_messages` tables have permissive RLS (`true`). To go production:
  - Add user authentication (sign-up/login pages)
  - Add `user_id` column to `projects`, `agent_sessions`, `agent_messages`
  - Replace permissive RLS with user-scoped policies (`auth.uid() = user_id`)
  - Gate all workspace routes behind auth

#### 3. File/image storage
- Currently no storage bucket exists. Need one for:
  - User-uploaded photos (the "photo upload → agent" flow)
  - AI-generated render images (currently Unsplash URLs; in production these would be stored)
- Create a `project-assets` storage bucket with RLS
- Wire the `AgentInputBar` file attachments to actually upload to storage and pass URLs to the agent

#### 4. Real AI render & sourcing APIs
- Replace `mock-render` edge function with a real render API (intdesign.ai or similar) — requires API key + secret
- Replace `mock-sourcing` edge function with a real product sourcing API — requires API key + secret
- The edge function signatures are already correct; just swap the mock logic for real HTTP calls

#### 5. Persisted agent results
- Currently `OrchestrationResult` lives only in React state — refreshing loses everything
- Store render results and product lists in the database (e.g., a `project_assets` table or use `result_data` JSONB on `agent_sessions`)
- Load previous results when re-opening a project workspace

#### 6. Workspace views wired to real data
- ProjectJournal, ProjectWall, ProjectDeck all use static data from `src/data/journal-data.ts`, `src/data/wall-data.ts`, `src/data/deck-data.ts`
- These need to pull from the database (agent messages, stored renders, products)

#### 7. Minor fixes
- `CustomizeModal` ref warning (function component given ref) — cosmetic but should be fixed
- Agent feed doesn't persist across navigation — state resets when leaving workspace

### Summary priority order

| # | Gap | Effort |
|---|-----|--------|
| 1 | Projects table + CRUD | Medium |
| 2 | Authentication + RLS | Medium |
| 3 | File storage bucket + upload wiring | Small |
| 4 | Real render/sourcing API integration | Small (code), depends on API access |
| 5 | Persist agent results in DB | Small |
| 6 | Wire Journal/Wall/Deck to DB data | Medium |
| 7 | Minor fixes (ref warning, state persistence) | Small |

Items 1-3 are foundational. Item 4 is a config swap once you have API keys. Items 5-7 complete the picture.

