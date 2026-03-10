import TopNav from "@/components/TopNav";

const Inspiration = () => {
  return (
    <div className="min-h-screen bg-background">
      <TopNav />
      <div className="pt-[48px] flex flex-col items-center justify-center" style={{ minHeight: "calc(100vh - 48px)" }}>
        <div className="text-center space-y-4 px-6">
          <div className="text-[32px] select-none">✦</div>
          <h1 className="text-[20px] font-medium">Inspiration</h1>
          <p className="font-mono text-[12px] text-muted-foreground max-w-[400px] leading-relaxed">
            Curated design references, mood boards, and style explorations powered by AI.
          </p>
          <p className="font-mono text-[11px] text-muted-foreground/50">
            Upload reference images or describe a style to generate inspiration boards.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Inspiration;
