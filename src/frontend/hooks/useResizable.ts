import { CSSProperties, MutableRefObject, useEffect, useRef, useState } from 'react';

type Options = {
  axis: 'x' | 'y';
  initial: number;
  min?: number;
  max?: number;
  storageKey?: string;
};

type Result<T extends HTMLElement> = {
  ref: MutableRefObject<T | null>;
  size: number;
  setSize: (n: number) => void;
  style: CSSProperties;
  handleProps: { onMouseDown: () => void };
};

export default function useResizable<T extends HTMLElement>({ axis, initial, min = 100, max = 1000, storageKey }: Options): Result<T> {
  const [size, setSize] = useState<number>(() => {
    if (!storageKey) return initial;
    const raw = localStorage.getItem(storageKey);
    const v = raw ? parseInt(raw, 10) : initial;
    return Number.isFinite(v) ? v : initial;
  });
  const ref = useRef<T | null>(null);
  const dragging = useRef(false);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragging.current || !ref.current) return;
      const rect = ref.current.getBoundingClientRect();
      const pos = axis === 'x' ? e.clientX - rect.left : e.clientY - rect.top;
      const next = Math.min(Math.max(pos, min), max);
      setSize(next);
    };
    const onUp = () => {
      if (!dragging.current) return;
      dragging.current = false;
      document.body.style.userSelect = '';
      if (storageKey && ref.current) {
        const rect = ref.current.getBoundingClientRect();
        const finalSize = axis === 'x' ? Math.round(rect.width) : Math.round(rect.height);
        localStorage.setItem(storageKey, String(finalSize));
      }
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [axis, min, max, storageKey]);

  const onMouseDown = () => {
    dragging.current = true;
    document.body.style.userSelect = 'none';
  };

  const style: CSSProperties = axis === 'x' ? { width: size } : { height: size };

  return { ref, size, setSize, style, handleProps: { onMouseDown } };
}

