"use client";

import { useEffect, useRef } from "react";
import type p5 from "p5";

export type Pin = { id: string; x: number; y: number; targetBoardId: string | null };

export function PinboardCanvas({ width, height, pins, draggingId }: { width: number; height: number; pins: Pin[]; draggingId: string | null }) {
  const holder = useRef<HTMLDivElement>(null);
  const sketch = useRef<p5 | null>(null);
  const visual = useRef({ pins, draggingId });
  visual.current = { pins, draggingId };

  useEffect(() => {
    let removed = false;
    void import("p5").then(({ default: P5 }) => {
      if (removed || !holder.current) return;
      sketch.current = new P5((p) => {
        p.setup = () => {
          p.createCanvas(width, height);
          p.pixelDensity(1);
          p.frameRate(24);
        };
        p.draw = () => {
          p.background(246, 243, 235);
          p.noStroke();
          p.fill(204, 199, 182, 120);
          for (let x = 18; x < p.width; x += 28) {
            for (let y = 18; y < p.height; y += 28) p.circle(x, y, 2);
          }

          const current = visual.current;
          const assigned = current.pins.filter((pin) => pin.targetBoardId);
          for (let i = 0; i < assigned.length; i++) {
            for (let j = i + 1; j < assigned.length; j++) {
              if (assigned[i].targetBoardId !== assigned[j].targetBoardId) continue;
              p.stroke(112, 145, 113, 80);
              p.strokeWeight(2);
              p.line(assigned[i].x + 124, assigned[i].y + 76, assigned[j].x + 124, assigned[j].y + 76);
            }
          }

          const active = current.pins.find((pin) => pin.id === current.draggingId);
          if (active) {
            const pulse = Math.sin(p.frameCount * 0.15) * 8;
            p.noStroke();
            p.fill(105, 148, 112, 22);
            p.circle(active.x + 124, active.y + 80, 290 + pulse);
            p.fill(105, 148, 112, 35);
            p.circle(active.x + 124, active.y + 80, 215 + pulse);
          }
        };
      }, holder.current);
    }).catch(() => { /* The notes remain usable if canvas rendering is unavailable. */ });
    return () => { removed = true; sketch.current?.remove(); sketch.current = null; };
  }, []);

  useEffect(() => { sketch.current?.resizeCanvas(width, height); }, [width, height]);

  return <div ref={holder} className="pinboard-canvas" aria-hidden="true" />;
}
