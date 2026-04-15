"use client";

import React, { useLayoutEffect, useRef, useState } from "react";
import { useIsMobileLayout } from "hooks/useIsMobileLayout";
import type { TableActions, TableSceneModel } from "./tableScene";
import MobileTableLayout from "./mobile/MobileTableLayout";
import DesktopTableLayout from "./desktop/DesktopTableLayout";

export interface TableLayoutProps {
  scene: TableSceneModel["layout"];
  actions: TableActions;
}

const TOTAL_SEATS = 10;

/* Reference dimensions for uniform scaling (desktop only) — content is laid
   out at this fixed size then CSS-transformed to fill the actual 16:9
   container, so every element scales proportionally on resize. */
const DESKTOP_REF_W = 2560;
const DESKTOP_REF_H = 1440;  // 2560 × 9/16

const TableLayout: React.FC<TableLayoutProps> = ({ scene, actions }) => {
  const isMobileLayout = useIsMobileLayout();
  const [desktopScale, setDesktopScale] = useState(1);
  // Desktop-only: scale wrapper refs + ResizeObserver
  const containerRef = useRef<HTMLDivElement>(null);
  const scaleRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (isMobileLayout) return; // mobile fills viewport natively — no scaling
    const container = containerRef.current;
    const wrapper = scaleRef.current;
    if (!container || !wrapper) return;
    const update = () => {
      const scale = Math.min(
        container.offsetWidth / DESKTOP_REF_W,
        container.offsetHeight / DESKTOP_REF_H,
      );
      wrapper.style.transform = `scale(${scale})`;
      wrapper.style.setProperty("--desktop-scale", `${scale}`);
      setDesktopScale(scale);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(container);
    return () => ro.disconnect();
  }, [isMobileLayout]);

  if (isMobileLayout) {
    // Mobile: fill the full viewport — no bezels, no scale wrapper.
    // The flex-1 community-cards zone in MobileTableLayout stretches
    // to absorb extra height on taller devices.
    return (
      <div className="fixed inset-0 bg-gray-950 overflow-hidden flex items-center justify-center">
        {/* Inner container: minimum 10:16 aspect (portrait 16:10). Stretches taller on narrow phones. */}
        <div
          className="relative w-full h-full overflow-hidden"
          style={{ maxWidth: "calc(100dvh * 10 / 16)" }}
        >
          <MobileTableLayout scene={scene} actions={actions} totalSeats={TOTAL_SEATS} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center h-dvh w-screen bg-gray-950">
      <div
        ref={containerRef}
        className="relative overflow-hidden"
        style={{
          width: "min(100vw, calc(100dvh * 16 / 9))",
          height: "min(100dvh, calc(100vw * 9 / 16))",
        }}
      >
        <div
          ref={scaleRef}
          style={{
            position: "relative",
            width: DESKTOP_REF_W,
            height: DESKTOP_REF_H,
            transformOrigin: "top left",
            ["--desktop-scale" as string]: `${desktopScale}`,
          }}
        >
          <DesktopTableLayout scene={scene} actions={actions} desktopScale={desktopScale} />
        </div>
      </div>
    </div>
  );
};

export default TableLayout;
