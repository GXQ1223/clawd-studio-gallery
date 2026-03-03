import { useState } from "react";
import { useParams, Navigate, useNavigate } from "react-router-dom";
import { projects } from "@/data/projects";
import {
  deckSlides,
  materialPalette,
  sourcingProducts,
  budgetCategories,
  type DeckSlide,
} from "@/data/deck-data";
import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";

/* ═══════════════════════════════════════════
   SLIDE RENDERERS — each at 1920×1080 coords
   ═══════════════════════════════════════════ */

const PlanLines = () => (
  <svg className="absolute inset-0 w-full h-full" xmlns="http://www.w3.org/2000/svg">
    {Array.from({ length: 12 }).map((_, i) => (
      <line key={`v${i}`} x1={`${(i + 1) * 8}%`} y1="8%" x2={`${(i + 1) * 8}%`} y2="92%" stroke="rgba(0,0,0,0.04)" strokeWidth="1" />
    ))}
    {Array.from({ length: 8 }).map((_, i) => (
      <line key={`h${i}`} x1="8%" y1={`${(i + 1) * 11}%`} x2="92%" y2={`${(i + 1) * 11}%`} stroke="rgba(0,0,0,0.04)" strokeWidth="1" />
    ))}
    <rect x="20%" y="18%" width="60%" height="50%" fill="none" stroke="rgba(0,0,0,0.2)" strokeWidth="2" />
    <rect x="20%" y="18%" width="35%" height="25%" fill="none" stroke="rgba(0,0,0,0.12)" strokeWidth="1.5" />
    <line x1="55%" y1="18%" x2="55%" y2="43%" stroke="rgba(0,0,0,0.12)" strokeWidth="1.5" />
    <path d="M 55% 68% Q 68% 68% 68% 55%" fill="none" stroke="rgba(0,0,0,0.1)" strokeWidth="1.2" strokeDasharray="4 3" />
  </svg>
);

const SlideContent = ({ slide, project }: { slide: DeckSlide; project: any }) => {
  switch (slide.type) {
    case "cover":
      return (
        <div className="absolute inset-0 flex flex-col justify-end p-[80px]" style={{ background: "#fff" }}>
          <div className="font-sans text-[72px] font-medium leading-[1.1] tracking-tight text-foreground">
            {project.name}
          </div>
          {project.room && (
            <div className="font-mono text-[22px] text-muted-foreground mt-[16px]">{project.room}</div>
          )}
          <div className="flex items-center gap-[32px] mt-[40px]">
            {project.dimensions && (
              <span className="font-mono text-[18px] text-muted-foreground/60">{project.dimensions}</span>
            )}
            {project.budget && (
              <span className="font-mono text-[18px] text-muted-foreground/60">${project.budget.toLocaleString()}</span>
            )}
            <span className="font-mono text-[18px] text-muted-foreground/40">March 2026</span>
          </div>
          <div className="absolute top-[60px] right-[80px] font-mono text-[14px] text-muted-foreground/30 tracking-[0.15em]">
            clawd·studio
          </div>
        </div>
      );

    case "brief":
      return (
        <div className="absolute inset-0 flex p-[80px] gap-[80px]" style={{ background: "#fff" }}>
          <div className="flex-1">
            <div className="font-mono text-[14px] text-muted-foreground/40 tracking-[0.15em] uppercase mb-[40px]">Project Brief</div>
            <div className="space-y-[24px]">
              {[
                ["Client", "Residential"],
                ["Room", project.room || "Living Room"],
                ["Dimensions", project.dimensions || "24ft × 16ft × 9ft"],
                ["Budget", project.budget ? `$${project.budget.toLocaleString()}` : "$28,000"],
                ["Layout", "L-shaped, 2 north-facing windows"],
                ["Flooring", "Existing white oak hardwood"],
              ].map(([k, v]) => (
                <div key={k} className="flex items-baseline gap-[16px]">
                  <span className="font-mono text-[16px] text-muted-foreground/50 w-[140px] shrink-0">{k}</span>
                  <span className="font-sans text-[18px] text-foreground">{v}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="flex-1">
            <div className="font-mono text-[14px] text-muted-foreground/40 tracking-[0.15em] uppercase mb-[40px]">Direction</div>
            <div className="font-sans text-[20px] leading-[1.6] text-foreground/80">
              Japandi-inspired living space emphasizing natural materials, muted earth tones, and clean lines. Balance warmth with restraint — oak, linen, stone. Maximize natural light from north-facing windows.
            </div>
            <div className="flex gap-[12px] mt-[48px] flex-wrap">
              {["Japandi", "Natural Materials", "Warm Minimal", "Earth Tones"].map((tag) => (
                <span key={tag} className="px-[16px] py-[8px] font-mono text-[14px] text-muted-foreground" style={{ border: "1px solid rgba(0,0,0,0.1)" }}>
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </div>
      );

    case "perspective":
      return (
        <div className="absolute inset-0" style={{
          background: slide.id === "s3"
            ? "linear-gradient(135deg, #c9c0b4 0%, #a89880 100%)"
            : "linear-gradient(135deg, #d6cfc8 0%, #b0a89e 100%)",
        }}>
          <div className="absolute bottom-[40px] left-[48px] flex items-center gap-[16px]">
            <span className="font-mono text-[14px] text-white/70">{project.name}</span>
            <span className="font-mono text-[12px] text-white/40">{slide.label}</span>
          </div>
        </div>
      );

    case "floor-plan":
      return (
        <div className="absolute inset-0 flex flex-col items-center justify-center" style={{ background: "#fafafa" }}>
          <div className="relative" style={{ width: "70%", height: "65%" }}>
            <PlanLines />
          </div>
          <div className="flex items-center gap-[40px] mt-[32px]">
            <span className="font-mono text-[16px] text-muted-foreground/50">24ft × 16ft</span>
            <span className="font-mono text-[14px] text-muted-foreground/30">L-shaped layout</span>
            <span className="font-mono text-[14px] text-muted-foreground/30">2 windows north</span>
          </div>
        </div>
      );

    case "palette":
      return (
        <div className="absolute inset-0 flex flex-col p-[80px]" style={{ background: "#fff" }}>
          <div className="font-mono text-[14px] text-muted-foreground/40 tracking-[0.15em] uppercase mb-[60px]">Material Palette</div>
          <div className="flex-1 flex items-center gap-[24px]">
            {materialPalette.map((c) => (
              <div key={c.name} className="flex-1 flex flex-col items-center">
                <div className="w-full rounded-none" style={{ aspectRatio: "1", background: c.hex }} />
                <span className="font-sans text-[16px] mt-[20px] text-foreground">{c.name}</span>
                <span className="font-mono text-[13px] text-muted-foreground/40 mt-[4px]">{c.hex}</span>
              </div>
            ))}
          </div>
        </div>
      );

    case "sourcing":
      return (
        <div className="absolute inset-0 flex flex-col p-[80px]" style={{ background: "#fff" }}>
          <div className="font-mono text-[14px] text-muted-foreground/40 tracking-[0.15em] uppercase mb-[60px]">Sourcing</div>
          <div className="flex-1 flex items-start gap-[40px]">
            {sourcingProducts.map((p) => (
              <div key={p.name} className="flex-1">
                <div className="w-full" style={{ aspectRatio: "4/3", background: "linear-gradient(135deg, #e8e4e0 0%, #d1cbc4 100%)" }} />
                <div className="mt-[20px]">
                  <div className="font-sans text-[20px] font-medium">{p.name}</div>
                  <div className="flex items-center gap-[16px] mt-[8px]">
                    <span className="font-mono text-[18px]">{p.price}</span>
                    <span className="font-mono text-[14px] text-muted-foreground/50">{p.brand}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      );

    case "budget":
      return (
        <div className="absolute inset-0 flex flex-col p-[80px]" style={{ background: "#fff" }}>
          <div className="font-mono text-[14px] text-muted-foreground/40 tracking-[0.15em] uppercase mb-[24px]">Budget Overview</div>
          <div className="flex items-baseline gap-[16px] mb-[60px]">
            <span className="font-sans text-[48px] font-medium">$12,400</span>
            <span className="font-mono text-[20px] text-muted-foreground/50">of $28,000 sourced</span>
          </div>
          {/* Progress bar */}
          <div className="w-full h-[8px] bg-secondary mb-[60px]">
            <div className="h-full bg-foreground" style={{ width: `${(12400 / 28000) * 100}%` }} />
          </div>
          {/* Breakdown */}
          <div className="flex-1 space-y-[28px]">
            {budgetCategories.map((cat) => (
              <div key={cat.name} className="flex items-center gap-[24px]">
                <span className="font-sans text-[18px] w-[200px] shrink-0">{cat.name}</span>
                <div className="flex-1 h-[6px] bg-secondary">
                  <div className="h-full" style={{ width: `${(cat.amount / 5000) * 100}%`, background: "rgba(0,0,0,0.2)" }} />
                </div>
                <span className="font-mono text-[16px] text-muted-foreground w-[100px] text-right">${cat.amount.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      );

    case "next-steps":
      return (
        <div className="absolute inset-0 flex flex-col justify-center p-[120px]" style={{ background: "#fff" }}>
          <div className="font-mono text-[14px] text-muted-foreground/40 tracking-[0.15em] uppercase mb-[60px]">Next Steps</div>
          <div className="space-y-[48px]">
            {[
              "Finalize accent chair selection — targeting 2 options under $800",
              "Client review of Japandi direction — schedule walkthrough of perspectives",
              "Source window treatments — linen Roman shades, north-facing light optimization",
            ].map((step, i) => (
              <div key={i} className="flex items-start gap-[24px]">
                <span className="font-mono text-[20px] text-muted-foreground/30 mt-[2px]">{String(i + 1).padStart(2, "0")}</span>
                <span className="font-sans text-[24px] leading-[1.5] text-foreground/80">{step}</span>
              </div>
            ))}
          </div>
        </div>
      );

    default:
      return <div className="absolute inset-0 bg-secondary" />;
  }
};

/* ═══════════════════
   SCALED SLIDE
   ═══════════════════ */

const ScaledSlide = ({
  slide,
  project,
  containerWidth,
  containerHeight,
}: {
  slide: DeckSlide;
  project: any;
  containerWidth: number;
  containerHeight: number;
}) => {
  const BASE_W = 1920;
  const BASE_H = 1080;
  const scale = Math.min(containerWidth / BASE_W, containerHeight / BASE_H);

  return (
    <div className="relative w-full h-full overflow-hidden">
      <div
        style={{
          position: "absolute",
          width: BASE_W,
          height: BASE_H,
          left: "50%",
          top: "50%",
          marginLeft: -BASE_W / 2,
          marginTop: -BASE_H / 2,
          transform: `scale(${scale})`,
          transformOrigin: "center center",
        }}
      >
        <SlideContent slide={slide} project={project} />
      </div>
    </div>
  );
};

/* ═══════════════════
   THUMBNAIL
   ═══════════════════ */

const SlideThumbnail = ({
  slide,
  project,
  index,
  active,
  onClick,
}: {
  slide: DeckSlide;
  project: any;
  index: number;
  active: boolean;
  onClick: () => void;
}) => (
  <button
    onClick={onClick}
    className="w-full text-left group transition-all"
    style={{
      border: active ? "2px solid rgba(0,0,0,0.8)" : "2px solid transparent",
    }}
  >
    <div className="relative w-full overflow-hidden" style={{ aspectRatio: "16/9" }}>
      <ScaledSlide slide={slide} project={project} containerWidth={240} containerHeight={135} />
    </div>
    <div className="flex items-center gap-2 mt-1.5 px-0.5 mb-4">
      <span className="font-mono text-[10px] text-muted-foreground/40">{String(index + 1).padStart(2, "0")}</span>
      <span className="font-mono text-[11px] text-muted-foreground group-hover:text-foreground transition-colors truncate">
        {slide.label}
      </span>
      {slide.aiGenerated && <span className="text-[10px] opacity-40 select-none">★</span>}
    </div>
  </button>
);

/* ═══════════════════
   MAIN PAGE
   ═══════════════════ */

const ProjectDeck = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const project = projects.find((p) => p.id === id);
  const [activeIndex, setActiveIndex] = useState(0);
  const [hovered, setHovered] = useState(false);
  const [input, setInput] = useState("");

  if (!project) return <Navigate to="/" replace />;

  const currentSlide = deckSlides[activeIndex];
  const prev = () => setActiveIndex((i) => Math.max(0, i - 1));
  const next = () => setActiveIndex((i) => Math.min(deckSlides.length - 1, i + 1));

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Nav */}
      <header className="h-[48px] shrink-0 bg-background flex items-center px-5 gallery-border border-t-0 border-l-0 border-r-0 z-50">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/")} className="text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft size={16} />
          </button>
          <button onClick={() => navigate("/")} className="font-mono text-[12px] text-muted-foreground hover:text-foreground transition-colors">Projects</button>
          <span className="text-muted-foreground/30 text-[12px]">/</span>
          <span className="text-[13px] font-medium truncate max-w-[200px]">{project.name}</span>
          <span className="text-muted-foreground/30 text-[12px]">/</span>
          <span className="font-mono text-[12px] text-muted-foreground">Deck</span>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <button className="h-[30px] px-4 bg-foreground text-background text-[12px] font-medium hover:opacity-90 transition-opacity">
            Present
          </button>
          <button className="h-[30px] px-3 gallery-border text-[12px] font-medium hover:bg-secondary transition-colors">Export PDF</button>
          <div className="flex items-center gap-2 ml-2">
            <span className="status-dot status-dot-active animate-pulse-dot" />
            <span className="font-mono text-[11px] text-muted-foreground">agent</span>
          </div>
        </div>
      </header>

      {/* Main area */}
      <div className="flex flex-1 min-h-0">
        {/* LEFT — Slide Canvas */}
        <div
          className="flex-[65] flex flex-col items-center justify-center relative"
          style={{ background: "#f5f5f5" }}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
        >
          {/* Slide */}
          <div
            className="relative bg-background"
            style={{
              width: "82%",
              aspectRatio: "16/9",
              boxShadow: "0 2px 20px rgba(0,0,0,0.08)",
            }}
          >
            <ScaledSlide
              slide={currentSlide}
              project={project}
              containerWidth={960}
              containerHeight={540}
            />

            {/* Hover edit overlay */}
            {hovered && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/5 transition-opacity animate-fade-in">
                <button className="px-3 py-1.5 bg-background text-[12px] font-medium gallery-border hover:bg-secondary transition-colors">
                  Edit Slide
                </button>
              </div>
            )}
          </div>

          {/* Navigation */}
          <div className="flex items-center gap-4 mt-6">
            <button onClick={prev} className="text-muted-foreground hover:text-foreground transition-colors disabled:opacity-20" disabled={activeIndex === 0}>
              <ChevronLeft size={18} />
            </button>

            <div className="flex items-center gap-1.5">
              {deckSlides.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setActiveIndex(i)}
                  className="transition-all"
                  style={{
                    width: i === activeIndex ? 16 : 6,
                    height: 6,
                    background: i === activeIndex ? "rgba(0,0,0,0.7)" : "rgba(0,0,0,0.15)",
                    borderRadius: 3,
                  }}
                />
              ))}
            </div>

            <button onClick={next} className="text-muted-foreground hover:text-foreground transition-colors disabled:opacity-20" disabled={activeIndex === deckSlides.length - 1}>
              <ChevronRight size={18} />
            </button>

            <span className="font-mono text-[11px] text-muted-foreground/40 ml-2">
              {activeIndex + 1} / {deckSlides.length}
            </span>
          </div>
        </div>

        {/* Divider */}
        <div style={{ width: 1, background: "rgba(0,0,0,0.08)" }} />

        {/* RIGHT — Slide Manager */}
        <div className="flex-[35] flex flex-col min-h-0">
          <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
            <span className="font-mono text-[11px] text-muted-foreground">
              {deckSlides.length} slides
            </span>
            <span className="font-mono text-[10px] text-muted-foreground/40">drag to reorder</span>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-0">
            {deckSlides.map((slide, i) => (
              <SlideThumbnail
                key={slide.id}
                slide={slide}
                project={project}
                index={i}
                active={i === activeIndex}
                onClick={() => setActiveIndex(i)}
              />
            ))}
          </div>

          <div className="px-4 py-3" style={{ borderTop: "1px solid rgba(0,0,0,0.06)" }}>
            <button className="w-full h-[36px] gallery-border-dashed font-mono text-[11px] text-muted-foreground hover:text-foreground hover:border-foreground/20 transition-colors">
              + Add Slide
            </button>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="h-[44px] shrink-0 bg-background flex items-center px-5 gap-4" style={{ borderTop: "1px solid rgba(0,0,0,0.08)" }}>
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="status-dot status-dot-agent animate-pulse-dot shrink-0" />
          <span className="font-mono text-[11px] text-muted-foreground truncate">
            agent added Material Palette slide — sourcing accent chairs
          </span>
        </div>
        <div style={{ width: 1, height: 20, background: "rgba(0,0,0,0.08)" }} />
        <div className="flex items-center gap-2 w-[280px]">
          <button className="shrink-0 text-muted-foreground hover:text-foreground transition-colors">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" x2="12" y1="19" y2="22" />
            </svg>
          </button>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Direct the agent..."
            className="flex-1 bg-transparent text-[12px] placeholder:text-muted-foreground/40 focus:outline-none font-mono"
          />
        </div>
      </div>
    </div>
  );
};

export default ProjectDeck;
