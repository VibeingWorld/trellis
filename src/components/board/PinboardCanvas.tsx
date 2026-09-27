"use client";

import { useEffect, useRef } from "react";
import type p5 from "p5";

export type Pin = { id: string; x: number; y: number; targetBoardId: string | null };

export function PinboardCanvas({ width, height, pins, draggingId }: { width: number; height: number; pins: Pin[]; draggingId: string | null }) {
  const holder = useRef<HTMLDivElement>(null);
  const sketch = useRef<p5 | null>(null);
  const dimensions = useRef({ width, height });
  dimensions.current = { width, height };
  const visual = useRef({ pins, draggingId });
  visual.current = { pins, draggingId };

  useEffect(() => {
    let removed = false;
    void import("p5").then(({ default: P5 }) => {
      if (removed || !holder.current) return;
      sketch.current = new P5((p) => {
        p.setup = () => {
          p.createCanvas(dimensions.current.width, dimensions.current.height);
          p.pixelDensity(1);
          p.frameRate(24);
        };
        p.draw = () => {
          p.clear();

          const current = visual.current;
          const assigned = current.pins.filter((pin) => pin.targetBoardId);
          for (let i = 0; i < assigned.length; i++) {
            for (let j = i + 1; j < assigned.length; j++) {
              if (assigned[i].targetBoardId !== assigned[j].targetBoardId) continue;
              p.stroke(97, 69, 42, 110);
              p.strokeWeight(2);
              p.line(assigned[i].x + 160, assigned[i].y + 96, assigned[j].x + 160, assigned[j].y + 96);
            }
          }

          const active = current.pins.find((pin) => pin.id === current.draggingId);
          if (active) {
            const pulse = Math.sin(p.frameCount * 0.15) * 8;
            p.noStroke();
            p.fill(255, 240, 207, 25);
            p.circle(active.x + 160, active.y + 150, 420 + pulse);
            p.fill(255, 243, 217, 40);
            p.circle(active.x + 160, active.y + 150, 345 + pulse);
          }
        };
      }, holder.current);
    }).catch(() => { /* The notes remain usable if canvas rendering is unavailable. */ });
    return () => { removed = true; sketch.current?.remove(); sketch.current = null; };
  }, []);

  useEffect(() => { sketch.current?.resizeCanvas(width, height); }, [width, height]);

  return <div ref={holder} className="pinboard-canvas" aria-hidden="true" />;
}
