import { useState, useEffect } from "react";

interface Props {
  active: boolean;
  onComplete: () => void;
}

const messages = ["Analyzing your workflow...", "Rebuilding workspace..."];

const WorkspaceTransition = ({ active, onComplete }: Props) => {
  const [messageIndex, setMessageIndex] = useState(0);
  const [charIndex, setCharIndex] = useState(0);
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    if (!active) {
      setMessageIndex(0);
      setCharIndex(0);
      setFadeOut(false);
      return;
    }

    const currentMsg = messages[messageIndex];
    if (charIndex < currentMsg.length) {
      const t = setTimeout(() => setCharIndex((c) => c + 1), 30);
      return () => clearTimeout(t);
    }

    if (messageIndex < messages.length - 1) {
      const t = setTimeout(() => {
        setMessageIndex((m) => m + 1);
        setCharIndex(0);
      }, 400);
      return () => clearTimeout(t);
    }

    // Done typing, fade out
    const t = setTimeout(() => setFadeOut(true), 300);
    const t2 = setTimeout(() => onComplete(), 600);
    return () => { clearTimeout(t); clearTimeout(t2); };
  }, [active, messageIndex, charIndex, onComplete]);

  if (!active) return null;

  return (
    <div
      className={`fixed inset-0 z-[100] bg-background flex items-center justify-center transition-opacity duration-300 ${
        fadeOut ? "opacity-0" : "opacity-100"
      }`}
    >
      <div className="text-center">
        <span className="font-mono text-[13px] text-muted-foreground">
          {messages[messageIndex].slice(0, charIndex)}
          <span className="animate-pulse-dot">|</span>
        </span>
      </div>
    </div>
  );
};

export default WorkspaceTransition;
