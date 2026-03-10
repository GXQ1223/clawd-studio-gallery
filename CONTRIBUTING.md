# Contributing to Clawd Studio Gallery

Thank you for your interest in contributing to Clawd Studio Gallery.

## Prerequisites

- **Node.js 22+** and **npm**
- **Supabase CLI** (`npm install -g supabase`)
- A Supabase project (local or hosted) for development

## Setup

```bash
git clone https://github.com/your-org/clawd-studio-gallery.git
cd clawd-studio-gallery
npm install
cp supabase/.env.example supabase/.env   # Add your API keys
npm run dev                               # Starts dev server on port 8080
```

Edit `supabase/.env` with your Supabase URL, anon key, and any AI provider keys (Gemini, OpenAI, Replicate) needed for the features you are working on.

## Testing

```bash
npm run test          # Run all tests once (vitest + @testing-library/react)
npm run test:watch    # Watch mode — re-runs on file changes
```

All new features and bug fixes should include tests. Place test files in `src/test/` following the `*.test.{ts,tsx}` naming convention.

## Linting

```bash
npm run lint          # ESLint
```

Fix all lint errors before submitting a PR. The project uses ESLint with Tailwind CSS utilities.

## Pull Request Process

1. **Create a feature branch** from `main`:
   ```bash
   git checkout -b feature/your-feature main
   ```
2. **Make your changes** following the code style guidelines below.
3. **Run tests and lint**:
   ```bash
   npm run test && npm run lint
   ```
4. **Commit** with a clear, descriptive message.
5. **Push** and open a Pull Request against `main`.
6. Ensure CI passes before requesting review.

## Code Style

- Follow existing patterns in the codebase.
- Use **TypeScript** for all new code.
- UI components use **shadcn/ui + Radix UI + Tailwind CSS**.
- React components go in `src/components/`, hooks in `src/hooks/`, utilities in `src/lib/`.
- Edge functions (Deno) go in `supabase/functions/<name>/index.ts` and must include CORS headers.

## Writing a Skill

Clawd Studio supports a modular skill plugin system. See [SKILL_AUTHORING.md](./SKILL_AUTHORING.md) for the full guide on creating new skills, including directory structure, manifest format, lifecycle hooks, and testing.

## Security

If you discover a security vulnerability, please do **not** open a public issue. Instead, follow the process described in [SECURITY.md](./SECURITY.md).
