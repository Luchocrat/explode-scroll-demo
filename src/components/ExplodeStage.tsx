"use client";

import { useRef } from "react";
import dynamic from "next/dynamic";

const ExplodeOnScroll = dynamic(
  () =>
    import("@/components/ExplodeOnScroll").then((m) => m.ExplodeOnScroll),
  { ssr: false, loading: () => <div className="canvas-fallback" /> },
);

export default function ExplodeStage() {
  const scrollRef = useRef<HTMLDivElement>(null);

  return (
    <>
      <p className="hint">Scroll to explode · drag to orbit</p>
      <div ref={scrollRef} className="scroll-root">
        <div className="stage">
          <ExplodeOnScroll
            url="/model.glb"
            scrollRef={scrollRef}
            explodeDistance={1.6}
            showProgress
          />
        </div>
      </div>
    </>
  );
}
