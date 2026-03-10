# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| 1.x     | Yes       |
| < 1.0   | No        |

## Reporting a Vulnerability

If you discover a security vulnerability in Clawd Studio Gallery, please report it responsibly. **Do not open a public GitHub issue.**

### How to Report

- **Preferred**: Create a [GitHub Security Advisory](https://github.com/your-org/clawd-studio-gallery/security/advisories/new) on this repository.
- **Alternative**: Email **security@clawd.studio** with a description of the vulnerability, steps to reproduce, and any relevant logs or screenshots.

### Response Timeline

| Step | Timeframe |
|---|---|
| Acknowledgement | Within 48 hours |
| Initial assessment | Within 5 business days |
| Patch for critical issues | Within 14 days |
| Patch for non-critical issues | Next scheduled release |

You will be kept informed of progress toward a fix. We ask that you do not publicly disclose the vulnerability until a patch is available.

## Skill Author Security Guidelines

If you are writing a skill plugin, follow these practices:

### Validate Tool Parameters

Always validate parameters received in `executeTool`. Do not trust input from the LLM or the client.

```typescript
if (typeof call.parameters.input !== "string" || call.parameters.input.length > 10000) {
  return { success: false, error: "Invalid input parameter" };
}
```

### Sanitize LLM Prompt Inputs

When constructing prompts that include user-provided or agent-provided content, sanitize inputs to reduce prompt injection risk:

- Strip or escape control characters and prompt-like directives from user text.
- Use structured prompt templates with clearly delimited user content sections.
- Limit input length before including it in prompts.

### Scope Storage Paths

When reading or writing to Supabase Storage, always scope paths to the current project:

```typescript
const path = `${projectId}/skill-output/${filename}`;
```

Never allow user input to control the full storage path. Validate that paths stay within the expected prefix.

### API Key Handling

- Never commit API keys or secrets to the repository.
- Declare required secrets in `skill.json` under `requiredSecrets`.
- Access secrets via environment variables on the server side (edge functions), never on the client.

## Known Considerations

- **Prompt injection**: LLM-based tool planning is susceptible to prompt injection via user briefs or reference images. Input sanitization and output validation are both important.
- **API key exposure**: Client-side code must never contain API keys. All AI provider calls should go through Supabase Edge Functions where keys are stored as environment variables.
- **JWT verification**: All edge functions must verify JWTs via `supabase.auth.getUser()` before processing requests. Disabling JWT verification is a security and financial risk.
- **Storage RLS**: Supabase Storage policies should check project ownership, not just `auth.uid()`, to prevent unauthorized access to other users' assets.
