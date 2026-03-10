# Changelog

All notable changes to Clawd Studio Gallery are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - Unreleased

### Added

- **Modular skill plugin architecture** with `SkillPlugin` interface, `skill.json` manifests, and auto-discovery of skills in `src/skills/`.
- **SkillRegistry** for loading, registering, and managing skill lifecycle (onLoad, executeTool, onUnload).
- **SkillEventBus** for inter-skill communication via namespaced events.
- **Built-in skills**:
  - `render-gen` — Gemini 2.5 Flash image generation with style-aware prompting.
  - `product-sourcing` — Product catalog search with GPT-4o-mini curation.
  - `floor-plan-3d` — Floor plan parsing and 3D visualization.
  - `ifc-export` — IFC file export for BIM interoperability.
  - `auto-generate` — Automated render generation triggered by brief analysis.
  - `landscape-site` — Landscape and site design tools.
- **DesignerAgent refactored** to use the skill system for tool execution instead of hardcoded function calls.
- **LLM-directed tool planning** in `analyze-brief` edge function, allowing the agent to select and sequence skill tools dynamically.
- **Skill Manager UI** component for enabling/disabling skills and configuring skill settings per project.
- **GitHub Actions CI** pipeline with test, lint, and build steps.
- **AGENTS.md and SOUL.md** workspace configuration files for agent behavior and project identity.

### Changed

- Render generation moved from direct Gemini calls in `DesignerAgent` to the `render-gen` skill plugin.
- Product sourcing moved from inline logic to the `product-sourcing` skill plugin.
- Brief analysis now returns a tool execution plan alongside structured brief data.

### Fixed

- Storage delete policy checks project ownership instead of `auth.uid()`.
- Hardcoded resolution metadata now matches Gemini 2.0 Flash output dimensions.
- Input validation and sanitization added to `generate-render` edge function.
- Parallelized render generation with per-call timeouts to avoid free-tier timeouts.
