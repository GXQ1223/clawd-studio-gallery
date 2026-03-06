import { useState } from "react";

export interface PlanningQuestion {
  id: string;
  question: string;
  type: "chips" | "text";
  options?: string[];
  answer?: string;
}

interface Props {
  questions: PlanningQuestion[];
  onComplete: (answers: Record<string, string>) => void;
  isGenerating?: boolean;
}

const PlanningQuestions = ({ questions, onComplete, isGenerating }: Props) => {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [currentIdx, setCurrentIdx] = useState(0);

  const current = questions[currentIdx];
  const allAnswered = questions.every((q) => answers[q.id]);
  const progress = Object.keys(answers).length / questions.length;

  const setAnswer = (questionId: string, value: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
    // Auto-advance after chip selection
    if (current?.type === "chips") {
      setTimeout(() => {
        if (currentIdx < questions.length - 1) {
          setCurrentIdx((i) => i + 1);
        }
      }, 300);
    }
  };

  const handleTextSubmit = (questionId: string, value: string) => {
    if (!value.trim()) return;
    setAnswer(questionId, value.trim());
    if (currentIdx < questions.length - 1) {
      setCurrentIdx((i) => i + 1);
    }
  };

  return (
    <div className="space-y-4">
      {/* Progress bar */}
      <div className="flex gap-[2px]">
        {questions.map((_, i) => (
          <div
            key={i}
            className="h-[2px] flex-1 transition-all duration-300"
            style={{
              backgroundColor: i <= currentIdx && answers[questions[i].id]
                ? "hsl(var(--foreground))"
                : i === currentIdx
                ? "hsl(var(--foreground) / 0.3)"
                : "hsl(var(--border))",
            }}
          />
        ))}
      </div>

      {/* Questions */}
      <div className="space-y-3">
        {questions.slice(0, currentIdx + 1).map((q, idx) => (
          <div
            key={q.id}
            className={`transition-opacity duration-300 ${idx < currentIdx ? "opacity-50" : "opacity-100"}`}
          >
            <p className="text-[13px] font-medium mb-2">{q.question}</p>

            {q.type === "chips" && q.options && (
              <div className="flex flex-wrap gap-1.5">
                {q.options.map((opt) => (
                  <button
                    key={opt}
                    onClick={() => setAnswer(q.id, opt)}
                    className={`px-3 py-1.5 text-[11px] font-mono transition-all ${
                      answers[q.id] === opt
                        ? "bg-foreground text-background"
                        : "gallery-border text-muted-foreground hover:text-foreground hover:bg-secondary"
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            )}

            {q.type === "text" && (
              <div className="flex gap-2">
                <input
                  type="text"
                  defaultValue={answers[q.id] || ""}
                  placeholder="Type your answer…"
                  className="flex-1 h-[34px] px-3 bg-transparent gallery-border text-[12px] font-mono placeholder:text-muted-foreground/40 focus:outline-none"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleTextSubmit(q.id, (e.target as HTMLInputElement).value);
                  }}
                  onBlur={(e) => {
                    if (e.target.value.trim()) setAnswer(q.id, e.target.value.trim());
                  }}
                  autoFocus={idx === currentIdx}
                />
                {!answers[q.id] && (
                  <button
                    onClick={() => {
                      const input = document.querySelector(`[data-qid="${q.id}"]`) as HTMLInputElement;
                      if (input?.value) handleTextSubmit(q.id, input.value);
                    }}
                    className="h-[34px] px-3 gallery-border text-[11px] font-mono text-muted-foreground hover:text-foreground"
                  >
                    →
                  </button>
                )}
              </div>
            )}

            {/* Show answer badge for completed questions */}
            {answers[q.id] && idx < currentIdx && (
              <button
                onClick={() => setCurrentIdx(idx)}
                className="mt-1 text-[10px] font-mono text-muted-foreground hover:text-foreground transition-colors"
              >
                ✓ {answers[q.id]} — click to change
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Generate button — appears when all answered */}
      {allAnswered && (
        <div className="pt-2">
          <button
            onClick={() => onComplete(answers)}
            disabled={isGenerating}
            className="w-full h-[38px] bg-foreground text-background font-mono text-[12px] hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {isGenerating ? "Generating…" : "Generate designs ✦"}
          </button>
        </div>
      )}
    </div>
  );
};

export default PlanningQuestions;
