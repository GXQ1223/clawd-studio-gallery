const BottomStrip = () => {
  return (
    <footer className="fixed bottom-0 left-0 right-0 z-50 h-[44px] bg-background flex items-center px-5 gallery-border border-b-0 border-l-0 border-r-0">
      <div className="flex items-center gap-2 text-[11px]">
        <span className="status-dot status-dot-agent animate-pulse-dot" />
        <span className="font-mono text-muted-foreground">
          agent working on Riverside Apartment — generating 3 perspectives
        </span>
      </div>
      <div className="mx-4 w-px h-4 bg-border" />
      <div className="text-[11px] font-mono text-muted-foreground">
        found 4 new products matching Chelsea Studio brief from RH + CB2
      </div>
      <div className="ml-auto">
        <span className="font-mono text-[11px] text-muted-foreground/50">⌘K</span>
      </div>
    </footer>
  );
};

export default BottomStrip;
