import type { PlanningQuestion } from "@/components/workspace/PlanningQuestions";

/** Generate contextual discovery questions based on the user's initial brief */
export function generatePlanningQuestions(brief: string): PlanningQuestion[] {
  const lower = brief.toLowerCase();
  const questions: PlanningQuestion[] = [];

  // 1. Room / space type — skip if already clearly stated
  const hasRoom = /living room|bedroom|kitchen|bathroom|office|restaurant|lobby|garden|patio|terrace/.test(lower);
  if (!hasRoom) {
    questions.push({
      id: "room",
      question: "What space are you designing?",
      type: "chips",
      options: ["Living Room", "Bedroom", "Kitchen", "Office", "Restaurant", "Outdoor / Landscape", "Other"],
    });
  }

  // 2. Size
  const hasSize = /\d+\s*(sq|ft|m²|sqft|square|x\s*\d)/.test(lower);
  if (!hasSize) {
    questions.push({
      id: "size",
      question: "How large is the space?",
      type: "chips",
      options: ["Small (< 150 sqft)", "Medium (150–400 sqft)", "Large (400–800 sqft)", "Very large (800+ sqft)"],
    });
  }

  // 3. Style — skip if user already specified a clear style
  const hasStyle = /modern|minimalist|japandi|scandinavian|industrial|traditional|bohemian|mid-century|rustic|coastal|art deco/.test(lower);
  if (!hasStyle) {
    questions.push({
      id: "style",
      question: "What style direction appeals to you?",
      type: "chips",
      options: ["Modern / Minimalist", "Warm & Natural", "Industrial / Urban", "Classic / Traditional", "Eclectic / Bohemian", "Scandinavian / Japandi"],
    });
  }

  // 4. Function / usage
  questions.push({
    id: "function",
    question: "What's the primary use of this space?",
    type: "chips",
    options: ["Everyday living", "Entertaining guests", "Work / productivity", "Relaxation & wellness", "Client-facing / commercial"],
  });

  // 5. Budget — skip if already mentioned
  const hasBudget = /\$|budget|k\b|thousand/.test(lower);
  if (!hasBudget) {
    questions.push({
      id: "budget",
      question: "What's your budget range?",
      type: "chips",
      options: ["Under $5k", "$5k – $15k", "$15k – $30k", "$30k – $50k", "$50k+", "No fixed budget"],
    });
  }

  // 6. Special requirements — always ask
  questions.push({
    id: "special",
    question: "Anything specific I should know?",
    type: "text",
  });

  return questions;
}

/** Compose a comprehensive prompt from brief + answers for image generation */
export function composeFinalPrompt(originalBrief: string, answers: Record<string, string>): string {
  const parts: string[] = [];

  parts.push(originalBrief);

  if (answers.room) parts.push(`Space: ${answers.room}`);
  if (answers.size) parts.push(`Size: ${answers.size}`);
  if (answers.style) parts.push(`Style: ${answers.style}`);
  if (answers.function) parts.push(`Function: ${answers.function}`);
  if (answers.budget) parts.push(`Budget: ${answers.budget}`);
  if (answers.special) parts.push(`Special requirements: ${answers.special}`);

  return parts.join(". ") + ".";
}
