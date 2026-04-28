"use client";

import { motion, useAnimation } from "framer-motion";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef } from "react";

function RouteProgressInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const controls = useAnimation();
  const firstRun = useRef(true);

  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    let active = true;
    (async () => {
      // Quick climb to ~80% to communicate "navigation in progress"
      await controls.set({ scaleX: 0, opacity: 1 });
      await controls.start({
        scaleX: 0.8,
        transition: { duration: 0.5, ease: "easeOut" },
      });
      if (!active) return;
      // Snap to complete after a beat
      await controls.start({
        scaleX: 1,
        transition: { duration: 0.18, ease: "easeOut" },
      });
      await controls.start({
        opacity: 0,
        transition: { duration: 0.25, ease: "easeOut" },
      });
      await controls.set({ scaleX: 0 });
    })();
    return () => {
      active = false;
    };
  }, [pathname, searchParams, controls]);

  return (
    <motion.div
      className="nav-progress"
      initial={{ scaleX: 0, opacity: 0 }}
      animate={controls}
    />
  );
}

export function RouteProgress() {
  return (
    <Suspense fallback={null}>
      <RouteProgressInner />
    </Suspense>
  );
}
