

## Critical UX Review: What's Holding This Product Back

After reviewing the entire codebase, here's an honest assessment of the fundamental UX problems and high-impact opportunities.

---

### Problem 1: The workspace is a 3-panel IDE, not a design tool

The current layout — left sidebar (brief), center (gallery), right (chat) — looks like a developer tool, not something a designer would feel excited to use. The three panels compete for attention. There's no visual hierarchy telling the user "start here."

**Fix:** Make the canvas (gallery) the dominant element — at least 60-70% of screen width. The chat should be a collapsible drawer or overlay, not a permanent 320px sidebar that eats space. The brief sidebar should collapse to an icon rail by default and expand on hover/click. The canvas should feel like opening a fresh workspace, not like staring at three empty columns.

---

### Problem 2: Empty state is dead space

When a user creates a new project, they see: an empty sidebar, an empty gallery with a drop zone, and a small chat with a ✦ icon and a cryptic message. There are three empty panels. This is the most critical moment — the user just committed to starting a project — and the app gives them nothing to work with.

**Fix:** The empty state should be a single full-screen prompt: "What are you designing?" with a large text input, drag-and-drop area for reference images, and quick-start templates ("Residential Living Room", "Restaurant Interior", "Office Lobby", "Landscape Garden"). Once the user submits their brief, THEN the workspace panels animate in with the agent already working. The first experience should feel like magic, not like configuring a tool.

---

### Problem 3: "Add agent" is a developer concept

Real designers don't think in "agents." They think in deliverables: "I need renders," "I need a floor plan," "I need a shopping list." The current AgentTypePicker asks users to "add agent" and pick from types like "Perspective" and "Section" — this is internal system language. A newbie designer has no idea what a "Section agent" does.

**Fix:** Rename from "agents" to "deliverables" or "outputs" in the UI. Instead of "add agent," say "Add output" with descriptions like:
- **Renders** — "Photorealistic images of your space" 
- **Floor Plan** — "Spatial layout with dimensions"
- **Shopping List** — "Furniture and materials with prices"
- **Presentation** — "Client-ready slide deck"

The system still uses agents internally, but the user never sees that word.

---

### Problem 4: The chat doesn't show what the agent understood

When a user types "Client hates yellow," the agent immediately runs the full orchestration pipeline (render + sourcing). There's no acknowledgment of what the agent understood, no confirmation of what it's about to do. The user has no control.

**Fix:** After the user submits a message, the agent should first respond with what it understood: "Got it — removing yellow tones. I'll regenerate 3 perspectives with warmer neutrals. This won't affect your shopping list." Then show a "Proceed" button or auto-proceed after 3 seconds. This gives users confidence and control.

---

### Problem 5: No concept of project phases or progress

The left sidebar shows a static "Design Development" status and a hardcoded budget bar ($12,400 of $28,000). There's no sense of progression. A designer working on a project goes through phases: Brief → Concepts → Development → Documentation → Handoff. The app should reflect this.

**Fix:** Replace the static status with a phase indicator that updates based on what exists in the project. If there are only renders, you're in "Concepts." If there's a floor plan + renders + shopping list, you're in "Development." Show a progress rail on the left that gives users a sense of where they are and what's next.

---

### Problem 6: No context awareness between messages

Each chat message triggers a full independent orchestration. If the user says "Japandi living room" and then says "Client hates yellow," the second message doesn't know about the first. It runs a completely fresh analysis. There's no conversation memory.

**Fix:** The `DesignerAgent` should receive the full conversation history, not just the latest message. Store previous briefs and results in context. When the user says "Client hates yellow," the agent should reference the existing Japandi renders and modify them, not start from scratch.

---

### Problem 7: Static data is still embedded everywhere

`riversideAssets` and `riversideFeed` are imported in `ProjectWorkspace.tsx` (line 4, lines 126, 147). Every new project shows ghost data from a "Riverside Apartment" project that doesn't belong to the user. `ProjectJournal` uses `journalFeed`, `ProjectDeck` uses `deckSlides` — all hardcoded.

**Fix:** Remove all static data imports from workspace components. Empty projects should show empty states. The workspace should only display data that came from the user's actual agent interactions.

---

### Problem 8: The "Customize" modal is solving a problem that doesn't exist

The `CustomizeModal` lets users describe "how they work" and then routes them to journal/wall/deck views. But users don't want to customize their workspace layout — they want to get design work done. This adds cognitive load and a detour before any real work happens.

**Fix:** Remove the Customize modal entirely. Instead, let the workspace layout adapt automatically based on what outputs exist. If the user only has renders, show the gallery. If they have renders + shopping list, show a split view. If they click "View Deck," go to the deck. No configuration needed.

---

### Problem 9: No scalability to other design disciplines

The agent types are hardcoded to interior design: "perspective," "elevation," "section," "floor plan." The data model, UI labels, and agent logic all assume interior design. If you want to support architecture, landscape, or industrial design, you'd need to rewrite most of the system.

**Fix:** Make agent types and deliverables configurable per project type. At project creation, ask "What kind of project?" (Interior, Architecture, Landscape, Industrial). Each project type has its own set of available deliverables. The database already supports this via the `folders` JSONB column — just make the agent type picker context-aware.

---

### Problem 10: No collaboration or sharing story

The "Share" button does nothing. There's no way for a designer to share a project with a client for review, or collaborate with another designer. This is table stakes for any design tool.

**Fix:** Not immediate, but the data model should prepare for this. Projects need a `shared_with` relationship and a read-only client view that shows the deck/gallery without editing capabilities.

---

### Priority Ranking

| # | Issue | Impact | Effort |
|---|-------|--------|--------|
| 1 | Empty state → full-screen brief prompt | 10x first impression | Medium |
| 2 | Remove static data (riverside/journal/deck) | Eliminates confusion | Small |
| 3 | Rename "agents" to "deliverables/outputs" | 3x clarity for new users | Small |
| 4 | Agent response acknowledgment before action | Trust + control | Small |
| 5 | Collapsible chat + brief panels | More canvas space | Medium |
| 6 | Remove CustomizeModal | Less cognitive load | Small |
| 7 | Conversation context/memory | Correct agent behavior | Medium |
| 8 | Project type selection at creation | Scalability | Medium |
| 9 | Phase/progress indicator | Sense of progression | Small |
| 10 | Collaboration/sharing foundation | Future-proofing | Large |

Items 1-4 would transform the first-time experience. Items 5-6 clean up unnecessary complexity. Items 7-10 build toward a scalable, professional product.

