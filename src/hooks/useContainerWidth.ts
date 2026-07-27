import { useCallback, useRef, useState } from 'react';

/**
 * Šířka se měří na kontejneru, ne na okně (docs §3.6): jen tak graf reaguje
 * na split-screen, otočení displeje i na změny rozvržení kolem sebe.
 */
export function useContainerWidth<T extends HTMLElement>(): [
  (node: T | null) => void,
  number,
] {
  const [width, setWidth] = useState(0);
  const observer = useRef<ResizeObserver | null>(null);

  const ref = useCallback((node: T | null) => {
    observer.current?.disconnect();
    if (!node) return;

    setWidth(node.getBoundingClientRect().width);
    observer.current = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) setWidth(entry.contentRect.width);
    });
    observer.current.observe(node);
  }, []);

  return [ref, width];
}
