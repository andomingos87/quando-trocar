"use client";

import type { ReactNode } from "react";
import { ScrollProgress } from "./scroll-progress";
import { KonamiEasterEgg } from "./konami-easter-egg";

export function RootLayoutClient({ children }: { children: ReactNode }) {
  return (
    <>
      <ScrollProgress />
      <KonamiEasterEgg />
      {children}
    </>
  );
}
