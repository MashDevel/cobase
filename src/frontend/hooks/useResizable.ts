import { CSSProperties, MutableRefObject, MouseEvent as ReactMouseEvent, useEffect, useRef, useState } from 'react';

type Options = {
  axis: 'x' | 'y';
  initial: number;
  min?: number;
  max?: number;
  edge?: 'start' | 'end';
  storageKey?: string;
};

type Result<T extends HTMLElement> = {
  ref: MutableRefObject<T | null>;
  size: number;
  setSize: (n: number) => void;
  style: CSSProperties;
  handleProps: { onMouseDown: (event: MouseEvent | ReactMouseEvent) => void };
};

export default function useResizable<T extends HTMLElement>({ axis, initial, min = 100, max = 1000, edge = 'end', storageKey }: Options): Result<T> {
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
      e.preventDefault();
      const rect = ref.current.getBoundingClientRect();
      const pos = axis === 'x'
        ? edge === 'end'
          ? e.clientX - rect.left
          : rect.right - e.clientX
        : edge === 'end'
          ? e.clientY - rect.top
          : rect.bottom - e.clientY;
      const next = Math.min(Math.max(pos, min), max);
      setSize(next);
    };
    const onUp = () => {
      if (!dragging.current) return;
      dragging.current = false;
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
      window.getSelection()?.removeAllRanges();
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
  }, [axis, edge, min, max, storageKey]);

  const onMouseDown = (event: MouseEvent | ReactMouseEvent) => {
    event.preventDefault();
    dragging.current = true;
    document.body.style.userSelect = 'none';
    document.body.style.cursor = axis === 'x' ? 'col-resize' : 'row-resize';
    window.getSelection()?.removeAllRanges();
  };

  const style: CSSProperties = axis === 'x' ? { width: size } : { height: size };

  return { ref, size, setSize, style, handleProps: { onMouseDown } };
}
