

## Plan: Fix UX Issues and Redesign Agent-Driven Workspace

This addresses all 6 points from your feedback. The changes are substantial — I'll break them into focused implementation steps.

---

### 1. Fix "Drop Files Here" — Make It Actually Work

**Problem:** The drop zone is a static div with no drag/drop or click handlers.

**Fix:**
- Add `onClick` to trigger a hidden file input
- Add `onDragOver`/`onDrop` handlers to accept dragged files
- Wire uploaded files to the storage bucket and pass them into the agent pipeline
- Apply the same fix to all drop zones across workspace views

---

### 2. Remove Preset Agent Categories — Start Empty, Add via "+"

**Problem:** New projects show all categories (perspective, plan, sketch, elevation, section, model photo, 3d model, misc) even when empty.

**Fix:**
- New projects start with **no folders/agents** — the left sidebar and gallery filter pills only show categories that exist
- The "+" button in the sidebar creates a new agent of the chosen type (perspective, plan, elevation, section, sketch, 3d model)
- When "+" is clicked, show a small picker: "What type of agent?" → selecting one adds that category to the project's folders and spawns the corresponding agent
- Store active agent types in the project's `folders` JSONB column in the database

---

### 3. Chat → Gallery Interaction: Delete, Refine, Select Images

**Problem:** Generated images go straight to the gallery with no way to delete or refine individual images.

**Fix:**
- When chat generates images, show them as selectable cards in the feed first (before committing to gallery)
- Each image gets hover actions: **Keep** (moves to gallery), **Refine** (sends back to agent with refinement prompt), **Delete** (removes)
- In the gallery view, add hover actions on each asset: **Delete**, **Refine** (opens chat with that image as context), **Set as primary**
- Refine action pre-fills the chat input with "Refine this render: [image ref]" and attaches the image

---

### 4. Onboarding Flow for New Users

**Problem:** Users don't know what to do when they first open a project workspace.

**Fix:**
- Create an `OnboardingOverlay` component that shows on first project visit (track via localStorage flag)
- 3-step walkthrough:
  1. **"Add an agent"** — highlights the "+" button in sidebar. "Start by adding a Perspective agent to generate renders."
  2. **"Chat with your agent"** — highlights the chat panel. "Describe your design direction. The agent will generate options."
  3. **"Review & refine"** — highlights the gallery. "Keep what you like, refine what you don't."
- Each step has a spotlight/highlight on the relevant UI area with a tooltip
- "Skip" button to dismiss, "Got it" to advance
- Also show a welcome message in the chat feed when it's empty: "Welcome! Start by adding an agent with + or type a brief below."

---

### 5. Define User Flow for Newbie vs Power Users

This is addressed by the structural changes above:

- **Newbie user flow:** Create project → Onboarding guides them to add a Perspective agent → Type brief → Get renders → Keep/refine → Done. They never see plan/section/elevation unless they add them.
- **Power user flow:** Create project → Add multiple agents (perspective, plan, elevation, section) via "+" → Each agent type has its own display format (see point 6) → Chat directs commands to specific agents or all at once.

No separate code needed — the empty-start + "+" pattern naturally serves both.

---

### 6. Different Display Formats Per Agent Type

**Problem:** All categories use the same masonry grid, but plan/3d model need different layouts.

**Fix — per-category gallery views:**

| Agent Type | Layout |
|---|---|
| **Perspective** | Masonry grid (current), many images side by side |
| **Sketch** | Masonry grid, same as perspective |
| **Plan** | Single primary image (large, centered) + version sidebar on the right showing thumbnails of previous versions. Click a version to swap it to primary. |
| **Elevation** | Similar to plan — single primary + version history |
| **Section** | Similar to plan — single primary + version history |
| **3D Model** | Placeholder viewer pane with message "3D viewer — supports Rhino, SketchUp, Revit formats" (actual 3D rendering requires a dedicated library like three.js — will stub the UI now) |
| **Model Photo** | Grid layout like perspective |

**Implementation:**
- `AssetGallery` checks `activeFolder` and renders the appropriate layout component
- Create `PrimaryVersionLayout` component for plan/elevation/section: large primary image + scrollable version sidebar
- Create `ModelViewerPlaceholder` for 3D model view
- Keep masonry grid for perspective/sketch/model photo/misc

---

### Technical Summary

| File | Changes |
|---|---|
| `AssetGallery.tsx` | Drop zone handlers, per-category layouts, remove preset filters for empty categories |
| `ProjectBrief.tsx` | Dynamic folders from DB, "+" button with agent type picker |
| `AgentFeed.tsx` | Image action buttons (keep/refine/delete), welcome message when empty |
| `ProjectWorkspace.tsx` | Wire file uploads to storage, pass to agent |
| New: `OnboardingOverlay.tsx` | 3-step onboarding walkthrough |
| New: `PrimaryVersionLayout.tsx` | Plan/elevation/section single-primary + version sidebar |
| New: `ModelViewerPlaceholder.tsx` | 3D model viewer stub |
| New: `AgentTypePicker.tsx` | Small popover to pick agent type when clicking "+" |
| `useProjects.ts` | Add mutation to update project folders |
| DB migration | Update projects table if needed for folder structure |

