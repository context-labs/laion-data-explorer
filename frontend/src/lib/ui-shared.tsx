// Stub for @kuzco/ui-shared
// This file contains minimal stubs to replace imports from the monorepo @kuzco/ui-shared package

import { useCallback, useState } from "react";
import type { TouchEvent } from "react";

export const ICONS = {
  // Add icon definitions as needed
  // Example: HOME: "home-icon"
};

export function useSwipeRightDetector(callback: (open: boolean) => void) {
  const [touchStartX, setTouchStartX] = useState(0);

  const onTouchStart = useCallback((e: TouchEvent) => {
    setTouchStartX(e.touches[0]?.clientX ?? 0);
  }, []);

  const onTouchMove = useCallback((_e: TouchEvent) => {
    // Can be used to provide visual feedback during swipe
  }, []);

  const onTouchEnd = useCallback(
    (e: TouchEvent) => {
      const touchEndX = e.changedTouches[0]?.clientX ?? 0;
      if (touchEndX - touchStartX > 50) {
        callback(false);
      }
    },
    [touchStartX, callback]
  );

  return {
    onTouchStart,
    onTouchMove,
    onTouchEnd,
  };
}
