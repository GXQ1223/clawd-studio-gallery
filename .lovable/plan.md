

## Production E2E Status

### ✅ Completed
1. **Projects table + CRUD** — `projects` table in DB with RLS, React Query hooks (`useProjects`, `useProject`, `useCreateProject`, `useUpdateProject`, `useDeleteProject`), New Project modal
2. **Authentication** — Auth page (sign-up/sign-in), `AuthProvider` context, `ProtectedRoute` wrapper, all routes gated behind auth, user-scoped RLS on all tables
3. **File storage** — `project-assets` bucket created with RLS policies for upload/view/delete
4. **User_id wiring** — `user_id` columns added to `projects`, `agent_sessions`, `agent_messages`; `DesignerAgent` passes user_id on all inserts
5. **Workspace views** — ProjectJournal, ProjectWall, ProjectDeck now use `useProject()` hook instead of static imports
6. **Profiles** — Auto-created via trigger on auth.users insert

### 🔲 Remaining
- **Real render/sourcing APIs** — Still using mock edge functions. Swap logic + add API key secrets when ready
- **File upload wiring** — Storage bucket exists but `AgentInputBar` doesn't upload to it yet (still uses local blob URLs)
- **Persist agent results across sessions** — `result_data` JSONB on `agent_sessions` exists but not loaded on workspace re-open
- **Journal/Wall/Deck real data** — These pages use `useProject()` for the project itself but still pull content from static data files
