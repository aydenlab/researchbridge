"use client";

import { useEffect, useState } from "react";

export function RotatingPhrase({ phrases, intervalMs = 2600 }: { phrases: string[]; intervalMs?: number }) {
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce || phrases.length < 2) return;

    const timer = window.setInterval(() => {
      setVisible(false);
      window.setTimeout(() => {
        setIndex((current) => (current + 1) % phrases.length);
        setVisible(true);
      }, 320);
    }, intervalMs);

    return () => window.clearInterval(timer);
  }, [phrases.length, intervalMs]);

  return (
    <span className="relative inline-block align-baseline">
      <span
        aria-live="polite"
        className="inline-block italic transition-[opacity,transform] duration-300 ease-out"
        style={{ opacity: visible ? 1 : 0, transform: visible ? "translateY(0)" : "translateY(12px)" }}
      >
        {phrases[index]}
      </span>
    </span>
  );
}
