import { useState, useEffect } from "react";
import { useParams, Navigate, useNavigate } from "react-router-dom";
import { useProject } from "@/hooks/useProjects";
import { type DeckSlide, type SourcingProduct, type BudgetCategory } from "@/data/deck-data";
import { ArrowLeft, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import AgentInputBar from "@/components/workspace/AgentInputBar";
import { DesignerAgent, type RenderResult, type ProductResult } from "@/lib/designerAgent";

/* ── Auto-assemble slides from live data ── */

interface LiveDeckData {
  renders: RenderResult[];
  products: ProductResult[];
  brief: string | null;
}

function assembleSlides(project: any, data: LiveDeckData): DeckSlide[] {
  const slides: DeckSlide[] = [];

  // 1. Cover slide — always
  slides.push({ id: "cover", type: "cover", label: "Cover", aiGenerated: false });

  // 2. Brief slide — always
  slides.push({ id: "brief", type: "brief", label: "Brief", aiGenerated: true });

  // 3. Perspective slides — one per render
  data.renders.forEach((r, i) => {
    slides.push({
      id: `perspective-${r.id}`,
      type: "perspective",
      label: r.label || `Perspective ${i + 1}`,
      aiGenerated: true,
    });
  });

  // 4. Floor plan — if dimensions exist
  if (project.dimensions && project.dimensions !== "TBD") {
    slides.push({ id: "floor-plan", type: "floor-plan", label: "Floor Plan", aiGenerated: false });
  }

  // 5. Sourcing — if products exist
  if (data.products.length > 0) {
    slides.push({ id: "sourcing", type: "sourcing", label: "Sourcing", aiGenerated: true });
  }

  // 6. Budget — if budget or products exist
  if (project.budget || data.products.length > 0) {
    slides.push({ id: "budget", type: "budget", label: "Budget", aiGenerated: true });
  }

  // 7. Next steps — always
  slides.push({ id: "next-steps", type: "next-steps", label: "Next Steps", aiGenerated: true });

  return slides;
}

/* ── Slide Renderers ── */

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

const SlideContent = ({ slide, project, data }: { slide: DeckSlide; project: any; data: LiveDeckData }) => {
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
            {project.dimensions && project.dimensions !== "TBD" && (
              <span className="font-mono text-[18px] text-muted-foreground/60">{project.dimensions}</span>
            )}
            {project.budget && (
              <span className="font-mono text-[18px] text-muted-foreground/60">${project.budget}</span>
            )}
            <span className="font-mono text-[18px] text-muted-foreground/40">
              {new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })}
            </span>
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
                ["Client", project.project_type === "commercial" ? "Commercial" : "Residential"],
                ["Room", project.room || "—"],
                ["Dimensions", project.dimensions || "—"],
                ["Budget", project.budget ? `$${project.budget}` : "—"],
                ["Type", (project.project_type || "interior").charAt(0).toUpperCase() + (project.project_type || "interior").slice(1)],
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
              {data.brief || "Design brief pending — submit your vision in the workspace."}
            </div>
          </div>
        </div>
      );

    case "perspective": {
      // Find the render for this slide
      const renderIndex = data.renders.findIndex((r) => slide.id === `perspective-${r.id}`);
      const render = data.renders[renderIndex];
      return (
        <div className="absolute inset-0" style={{
          background: render?.url
            ? `url(${render.url}) center/cover`
            : renderIndex % 2 === 0
              ? "linear-gradient(135deg, #c9c0b4 0%, #a89880 100%)"
              : "linear-gradient(135deg, #d6cfc8 0%, #b0a89e 100%)",
        }}>
          <div className="absolute bottom-[40px] left-[48px] flex items-center gap-[16px]">
            <span className="font-mono text-[14px] text-white/70">{project.name}</span>
            <span className="font-mono text-[12px] text-white/40">{slide.label}</span>
          </div>
        </div>
      );
    }

    case "floor-plan":
      return (
        <div className="absolute inset-0 flex flex-col items-center justify-center" style={{ background: "#fafafa" }}>
          <div className="relative" style={{ width: "70%", height: "65%" }}>
            <PlanLines />
          </div>
          <div className="flex items-center gap-[40px] mt-[32px]">
            <span className="font-mono text-[16px] text-muted-foreground/50">{project.dimensions}</span>
            <span className="font-mono text-[14px] text-muted-foreground/30">{project.room || "Layout"}</span>
          </div>
        </div>
      );

    case "sourcing": {
      const displayProducts = data.products.slice(0, 3);
      return (
        <div className="absolute inset-0 flex flex-col p-[80px]" style={{ background: "#fff" }}>
          <div className="font-mono text-[14px] text-muted-foreground/40 tracking-[0.15em] uppercase mb-[60px]">Sourcing</div>
          <div className="flex-1 flex items-start gap-[40px]">
            {displayProducts.map((p) => (
              <div key={p.id} className="flex-1">
                <div className="w-full" style={{
                  aspectRatio: "4/3",
                  background: p.image
                    ? `url(${p.image}) center/cover`
                    : "linear-gradient(135deg, #e8e4e0 0%, #d1cbc4 100%)",
                }} />
                <div className="mt-[20px]">
                  <div className="font-sans text-[20px] font-medium">{p.name}</div>
                  <div className="flex items-center gap-[16px] mt-[8px]">
                    <span className="font-mono text-[18px]">${p.price.toLocaleString()}</span>
                    <span className="font-mono text-[14px] text-muted-foreground/50">{p.brand}</span>
                  </div>
                </div>
              </div>
            ))}
            {displayProducts.length === 0 && (
              <div className="flex-1 flex items-center justify-center text-muted-foreground/40 font-mono text-[16px]">
                No products sourced yet
              </div>
            )}
          </div>
        </div>
      );
    }

    case "budget": {
      const totalSourced = data.products.reduce((sum, p) => sum + p.price, 0);
      const budgetNum = project.budget ? parseFloat(String(project.budget).replace(/[^0-9.]/g, "")) : 0;
      const budgetVal = budgetNum > 0 ? (String(project.budget).toLowerCase().includes("k") ? budgetNum * 1000 : budgetNum) : totalSourced * 1.5;

      // Group products by category
      const categoryMap: Record<string, number> = {};
      for (const p of data.products) {
        const cat = p.category || "Other";
        categoryMap[cat] = (categoryMap[cat] || 0) + p.price;
      }
      const categories: BudgetCategory[] = Object.entries(categoryMap).map(([name, amount]) => ({
        name: name.charAt(0).toUpperCase() + name.slice(1),
        amount,
      }));
      const maxAmount = Math.max(...categories.map((c) => c.amount), 1);

      return (
        <div className="absolute inset-0 flex flex-col p-[80px]" style={{ background: "#fff" }}>
          <div className="font-mono text-[14px] text-muted-foreground/40 tracking-[0.15em] uppercase mb-[24px]">Budget Overview</div>
          <div className="flex items-baseline gap-[16px] mb-[60px]">
            <span className="font-sans text-[48px] font-medium">${totalSourced.toLocaleString()}</span>
            <span className="font-mono text-[20px] text-muted-foreground/50">
              {budgetVal > 0 ? `of $${budgetVal.toLocaleString()} sourced` : "total sourced"}
            </span>
          </div>
          {budgetVal > 0 && (
            <div className="w-full h-[8px] bg-secondary mb-[60px]">
              <div className="h-full bg-foreground" style={{ width: `${Math.min(100, (totalSourced / budgetVal) * 100)}%` }} />
            </div>
          )}
          <div className="flex-1 space-y-[28px]">
            {categories.map((cat) => (
              <div key={cat.name} className="flex items-center gap-[24px]">
                <span className="font-sans text-[18px] w-[200px] shrink-0">{cat.name}</span>
                <div className="flex-1 h-[6px] bg-secondary">
                  <div className="h-full" style={{ width: `${(cat.amount / maxAmount) * 100}%`, background: "rgba(0,0,0,0.2)" }} />
                </div>
                <span className="font-mono text-[16px] text-muted-foreground w-[100px] text-right">${cat.amount.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      );
    }

    case "next-steps":
      return (
        <div className="absolute inset-0 flex flex-col justify-center p-[120px]" style={{ background: "#fff" }}>
          <div className="font-mono text-[14px] text-muted-foreground/40 tracking-[0.15em] uppercase mb-[60px]">Next Steps</div>
          <div className="space-y-[48px]">
            {[
              data.renders.length > 0 ? "Review generated perspectives and select hero images" : "Submit a design brief to generate initial perspectives",
              data.products.length > 0 ? `Finalize product selections — ${data.products.length} items sourced so far` : "Begin product sourcing based on approved design direction",
              "Schedule client presentation walkthrough",
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

/* ── Scaled Slide ── */

const ScaledSlide = ({
  slide, project, data, containerWidth, containerHeight,
}: {
  slide: DeckSlide; project: any; data: LiveDeckData;
  containerWidth: number; containerHeight: number;
}) => {
  const BASE_W = 1920;
  const BASE_H = 1080;
  const scale = Math.min(containerWidth / BASE_W, containerHeight / BASE_H);

  return (
    <div className="relative w-full h-full overflow-hidden">
      <div style={{
        position: "absolute", width: BASE_W, height: BASE_H,
        left: "50%", top: "50%",
        marginLeft: -BASE_W / 2, marginTop: -BASE_H / 2,
        transform: `scale(${scale})`, transformOrigin: "center center",
      }}>
        <SlideContent slide={slide} project={project} data={data} />
      </div>
    </div>
  );
};

/* ── Thumbnail ── */

const SlideThumbnail = ({
  slide, project, data, index, active, onClick,
}: {
  slide: DeckSlide; project: any; data: LiveDeckData;
  index: number; active: boolean; onClick: () => void;
}) => (
  <button onClick={onClick} className="w-full text-left group transition-all"
    style={{ border: active ? "2px solid rgba(0,0,0,0.8)" : "2px solid transparent" }}>
    <div className="relative w-full overflow-hidden" style={{ aspectRatio: "16/9" }}>
      <ScaledSlide slide={slide} project={project} data={data} containerWidth={240} containerHeight={135} />
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

/* ── Main Page ── */

const ProjectDeck = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: project, isLoading } = useProject(id);
  const [activeIndex, setActiveIndex] = useState(0);
  const [hovered, setHovered] = useState(false);
  const [input, setInput] = useState("");

  const [slides, setSlides] = useState<DeckSlide[]>([]);
  const [liveData, setLiveData] = useState<LiveDeckData>({ renders: [], products: [], brief: null });
  const [isLoadingData, setIsLoadingData] = useState(true);

  // Load live data and assemble slides
  useEffect(() => {
    if (!id || !project) return;
    setIsLoadingData(true);

    Promise.all([
      DesignerAgent.loadPersistedResults(id),
      DesignerAgent.getProjectMessages(id),
    ]).then(([results, messages]) => {
      const renders = results?.renders || [];
      const products = results?.products || [];

      // Extract the original brief from user messages
      const userMessages = messages.filter((m) => m.message_type === "user_message");
      const brief = userMessages.length > 0 ? userMessages[0].content : null;

      const data: LiveDeckData = { renders, products, brief };
      setLiveData(data);
      setSlides(assembleSlides(project, data));
      setIsLoadingData(false);
    }).catch((err) => {
      console.error("Failed to load deck data:", err);
      // Still show basic slides even on error
      const data: LiveDeckData = { renders: [], products: [], brief: null };
      setLiveData(data);
      setSlides(assembleSlides(project, data));
      setIsLoadingData(false);
    });
  }, [id, project]);

  if (isLoading) return <div className="h-screen flex items-center justify-center bg-background"><span className="font-mono text-[12px] text-muted-foreground animate-pulse">loading…</span></div>;
  if (!project) return <Navigate to="/" replace />;

  if (isLoadingData) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <Loader2 size={20} className="animate-spin text-muted-foreground" />
        <span className="ml-3 font-mono text-[12px] text-muted-foreground">Assembling deck…</span>
      </div>
    );
  }

  const currentSlide = slides[activeIndex];
  if (!currentSlide) return null;

  const prev = () => setActiveIndex((i) => Math.max(0, i - 1));
  const next = () => setActiveIndex((i) => Math.min(slides.length - 1, i + 1));

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
            <span className="font-mono text-[11px] text-muted-foreground">
              {liveData.renders.length} renders · {liveData.products.length} products
            </span>
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
          <div className="relative bg-background" style={{ width: "82%", aspectRatio: "16/9", boxShadow: "0 2px 20px rgba(0,0,0,0.08)" }}>
            <ScaledSlide slide={currentSlide} project={project} data={liveData} containerWidth={960} containerHeight={540} />
            {hovered && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/5 transition-opacity animate-fade-in">
                <button className="px-3 py-1.5 bg-background text-[12px] font-medium gallery-border hover:bg-secondary transition-colors">
                  Edit Slide
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center gap-4 mt-6">
            <button onClick={prev} className="text-muted-foreground hover:text-foreground transition-colors disabled:opacity-20" disabled={activeIndex === 0}>
              <ChevronLeft size={18} />
            </button>
            <div className="flex items-center gap-1.5">
              {slides.map((_, i) => (
                <button key={i} onClick={() => setActiveIndex(i)} className="transition-all"
                  style={{ width: i === activeIndex ? 16 : 6, height: 6, background: i === activeIndex ? "rgba(0,0,0,0.7)" : "rgba(0,0,0,0.15)", borderRadius: 3 }} />
              ))}
            </div>
            <button onClick={next} className="text-muted-foreground hover:text-foreground transition-colors disabled:opacity-20" disabled={activeIndex === slides.length - 1}>
              <ChevronRight size={18} />
            </button>
            <span className="font-mono text-[11px] text-muted-foreground/40 ml-2">
              {activeIndex + 1} / {slides.length}
            </span>
          </div>
        </div>

        <div style={{ width: 1, background: "rgba(0,0,0,0.08)" }} />

        {/* RIGHT — Slide Manager */}
        <div className="flex-[35] flex flex-col min-h-0">
          <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
            <span className="font-mono text-[11px] text-muted-foreground">{slides.length} slides</span>
            <span className="font-mono text-[10px] text-muted-foreground/40">auto-assembled from project</span>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-0">
            {slides.map((slide, i) => (
              <SlideThumbnail key={slide.id} slide={slide} project={project} data={liveData}
                index={i} active={i === activeIndex} onClick={() => setActiveIndex(i)} />
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
          <span className="font-mono text-[11px] text-muted-foreground truncate">
            {liveData.renders.length > 0 || liveData.products.length > 0
              ? `Deck auto-assembled: ${liveData.renders.length} perspectives, ${liveData.products.length} products`
              : "Submit a brief in the workspace to populate this deck"}
          </span>
        </div>
        <div style={{ width: 1, height: 20, background: "rgba(0,0,0,0.08)" }} />
        <div className="w-[280px]">
          <AgentInputBar input={input} onInputChange={setInput} onSubmit={() => setInput("")} inline />
        </div>
      </div>
    </div>
  );
};

export default ProjectDeck;
