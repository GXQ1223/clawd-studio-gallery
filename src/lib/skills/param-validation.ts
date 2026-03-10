/**
 * Shared parameter validation utilities for skill plugins.
 * Guards against injection, oversized inputs, and path traversal.
 */

const MAX_STRING_LENGTH = 5000;
const MAX_NUMBER_VALUE = 1e9;
const MIN_NUMBER_VALUE = -1e9;

/** Strip HTML tags and markdown formatting that could influence LLM prompts */
export function sanitizeStringForPrompt(value: string): string {
  return value
    .replace(/<[^>]*>/g, "") // strip HTML tags
    .replace(/!\[.*?\]\(.*?\)/g, "") // strip markdown images
    .replace(/\[([^\]]*)\]\(.*?\)/g, "$1") // strip markdown links, keep text
    .replace(/```[\s\S]*?```/g, "") // strip code blocks
    .replace(/`[^`]*`/g, "") // strip inline code
    .trim();
}

/** Validate that a value is a string within length limits; returns sanitized string or error */
export function validateString(
  value: unknown,
  paramName: string,
  maxLength = MAX_STRING_LENGTH,
): { valid: true; value: string } | { valid: false; error: string } {
  if (typeof value !== "string") {
    return { valid: false, error: `${paramName} must be a string` };
  }
  if (value.length > maxLength) {
    return {
      valid: false,
      error: `${paramName} exceeds maximum length of ${maxLength} characters`,
    };
  }
  return { valid: true, value: sanitizeStringForPrompt(value) };
}

/** Validate that a value is a number within reasonable range */
export function validateNumber(
  value: unknown,
  paramName: string,
  min = MIN_NUMBER_VALUE,
  max = MAX_NUMBER_VALUE,
): { valid: true; value: number } | { valid: false; error: string } {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return { valid: false, error: `${paramName} must be a finite number` };
  }
  if (value < min || value > max) {
    return {
      valid: false,
      error: `${paramName} must be between ${min} and ${max}`,
    };
  }
  return { valid: true, value };
}

/** Validate a storage path doesn't contain traversal or absolute paths */
export function validateStoragePath(
  value: unknown,
  paramName: string,
): { valid: true; value: string } | { valid: false; error: string } {
  if (typeof value !== "string") {
    return { valid: false, error: `${paramName} must be a string` };
  }
  if (value.includes("..") || value.startsWith("/") || value.startsWith("\\")) {
    return {
      valid: false,
      error: `${paramName} contains invalid path characters (no ".." or absolute paths)`,
    };
  }
  return { valid: true, value };
}

/** Validate a tool name contains only safe characters (a-z, 0-9, underscore) */
export function validateToolName(
  toolName: string,
): { valid: true } | { valid: false; error: string } {
  if (!/^[a-z0-9_]+$/.test(toolName)) {
    return {
      valid: false,
      error: `Invalid tool name "${toolName}": only lowercase a-z, 0-9, and underscore allowed`,
    };
  }
  return { valid: true };
}

/** Validate all string params in a record, sanitizing them in-place. Returns error string or null. */
export function validateAndSanitizeParams(
  params: Record<string, any>,
  stringKeys: string[],
  numberKeys: string[] = [],
  pathKeys: string[] = [],
): string | null {
  for (const key of stringKeys) {
    if (params[key] === undefined || params[key] === null) continue;
    const result = validateString(params[key], key);
    if (!result.valid) return result.error;
    params[key] = result.value;
  }
  for (const key of numberKeys) {
    if (params[key] === undefined || params[key] === null) continue;
    const result = validateNumber(params[key], key);
    if (!result.valid) return result.error;
  }
  for (const key of pathKeys) {
    if (params[key] === undefined || params[key] === null) continue;
    const result = validateStoragePath(params[key], key);
    if (!result.valid) return result.error;
  }
  return null;
}
