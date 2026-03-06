import { useState, useEffect } from "react";

const steps = [
  {
    target: "sidebar",
    title: "Add an output",
    desc: 'Click "+" to add Renders, Floor Plans, or other deliverables to your project.',
  },
  {
    target: "chat",
    title: "Describe your vision",
    desc: "Tell the assistant what you're designing — style, mood, materials. It will generate options for you.",
  },
  {
    target: "gallery",
    title: "Review & refine",
    desc: "Keep what you like, refine or delete what you don't. Each output has its own layout.",
  },
];

interface Props {
  projectId: string;
}

const OnboardingOverlay = ({ projectId }: Props) => {
  const storageKey = `onboarding-done-${projectId}`;
  const [step, setStep] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem(storageKey)) {
      setVisible(true);
    }
  }, [storageKey]);

  if (!visible) return null;

  const dismiss = () => {
    localStorage.setItem(storageKey, "1");
    setVisible(false);
  };

  const current = steps[step];
  const isLast = step === steps.length - 1;

  const positions: Record<string, string> = {
    sidebar: "left-[260px] top-1/3",
    chat: "right-[380px] top-1/3",
    gallery: "left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2",
  };

  return (
    <div className="fixed inset-0 z-[100]">
      <div className="absolute inset-0 bg-background/60 backdrop-blur-[2px]" onClick={dismiss} />
      <div className={`absolute ${positions[current.target]} z-[101]`}>
        <div className="bg-popover border border-border shadow-lg p-5 w-[280px]" style={{ borderRadius: "2px" }}>
          <div className="flex items-center gap-2 mb-2">
            <span className="font-mono text-[10px] text-muted-foreground">{step + 1}/{steps.length}</span>
          </div>
          <h3 className="text-[14px] font-medium mb-1">{current.title}</h3>
          <p className="text-[12px] text-muted-foreground leading-relaxed">{current.desc}</p>
          <div className="flex items-center justify-between mt-4">
            <button onClick={dismiss} className="font-mono text-[11px] text-muted-foreground hover:text-foreground transition-colors">Skip</button>
            <button
              onClick={() => (isLast ? dismiss() : setStep(step + 1))}
              className="px-3 py-1.5 bg-foreground text-background font-mono text-[11px] hover:opacity-90 transition-opacity"
            >
              {isLast ? "Got it" : "Next"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OnboardingOverlay;
