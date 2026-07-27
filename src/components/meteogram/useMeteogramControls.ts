import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { anchoredScrollLeft, clampZoom, type ZoomBounds } from '../../lib/zoom';

const ZOOM_STEP = 1.35;
const TAP_THRESHOLD_PX = 6;
const INERTIA_DECAY = 0.94;
const INERTIA_MIN_VELOCITY = 0.2;

interface Options {
  bounds: ZoomBounds;
  defaultPxPerHour: number;
  coarsePointer: boolean;
  reducedMotion: boolean;
  /** Volá se při ťuknutí nebo tažení – nastavuje ukazatel. */
  onPoint: (offsetX: number) => void;
  onClearPoint: () => void;
}

/**
 * Ovládání grafu: kolečko, štipec, tažení, setrvačnost. Drží se pohromadě,
 * protože všechny tyhle vstupy mění tytéž dvě veličiny – přiblížení a posun.
 */
export function useMeteogramControls({
  bounds,
  defaultPxPerHour,
  coarsePointer,
  reducedMotion,
  onPoint,
  onClearPoint,
}: Options) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState<number | null>(null);
  const pxPerHour = clampZoom(zoom ?? defaultPxPerHour, bounds);

  const pendingScroll = useRef<number | null>(null);
  const pointers = useRef(new Map<number, number>());
  const dragState = useRef<{ startX: number; lastX: number; scrollLeft: number; moved: boolean } | null>(null);
  const pinchState = useRef<{ distance: number; pxPerHour: number; midpoint: number } | null>(null);
  const velocity = useRef(0);
  const inertiaFrame = useRef<number | null>(null);

  // Posun spočítaný při přiblížení se musí uplatnit až po překreslení,
  // jinak by ho prohlížeč ořízl podle staré šířky obsahu.
  useLayoutEffect(() => {
    if (pendingScroll.current === null || !scrollerRef.current) return;
    scrollerRef.current.scrollLeft = pendingScroll.current;
    pendingScroll.current = null;
  }, [pxPerHour]);

  const stopInertia = useCallback(() => {
    if (inertiaFrame.current !== null) cancelAnimationFrame(inertiaFrame.current);
    inertiaFrame.current = null;
  }, []);

  const zoomTo = useCallback(
    (nextPxPerHour: number, anchorOffsetX: number) => {
      const scroller = scrollerRef.current;
      if (!scroller) return;
      const next = clampZoom(nextPxPerHour, bounds);
      pendingScroll.current = anchoredScrollLeft(
        scroller.scrollLeft,
        anchorOffsetX,
        pxPerHour,
        next,
      );
      setZoom(next);
    },
    [bounds, pxPerHour],
  );

  const zoomByStep = useCallback(
    (direction: 1 | -1) => {
      const scroller = scrollerRef.current;
      const anchor = scroller ? scroller.clientWidth / 2 : 0;
      zoomTo(pxPerHour * (direction > 0 ? ZOOM_STEP : 1 / ZOOM_STEP), anchor);
    },
    [pxPerHour, zoomTo],
  );

  const resetZoom = useCallback(() => {
    pendingScroll.current = 0;
    setZoom(null);
  }, []);

  // Kolečko přibližuje k místu pod kurzorem; s klávesou Shift posouvá.
  // Listener musí být „aktivní“, jinak nejde zrušit výchozí chování.
  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;

    const onWheel = (event: WheelEvent) => {
      if (event.shiftKey) {
        event.preventDefault();
        scroller.scrollLeft += event.deltaY + event.deltaX;
        return;
      }
      if (Math.abs(event.deltaY) < Math.abs(event.deltaX)) return; // vodorovný trackpad
      event.preventDefault();
      const rect = scroller.getBoundingClientRect();
      const factor = event.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP;
      zoomTo(pxPerHour * factor, event.clientX - rect.left);
    };

    scroller.addEventListener('wheel', onWheel, { passive: false });
    return () => scroller.removeEventListener('wheel', onWheel);
  }, [pxPerHour, zoomTo]);

  const onPointerDown = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      stopInertia();
      pointers.current.set(event.pointerId, event.clientX);
      const scroller = scrollerRef.current;
      if (!scroller) return;

      if (pointers.current.size === 2) {
        const [a, b] = [...pointers.current.values()];
        const rect = scroller.getBoundingClientRect();
        pinchState.current = {
          distance: Math.max(1, Math.abs((a ?? 0) - (b ?? 0))),
          pxPerHour,
          midpoint: ((a ?? 0) + (b ?? 0)) / 2 - rect.left,
        };
        dragState.current = null;
        return;
      }

      dragState.current = {
        startX: event.clientX,
        lastX: event.clientX,
        scrollLeft: scroller.scrollLeft,
        moved: false,
      };
      velocity.current = 0;
    },
    [pxPerHour, stopInertia],
  );

  const onPointerMove = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      const scroller = scrollerRef.current;
      if (!scroller) return;

      if (pointers.current.has(event.pointerId)) {
        pointers.current.set(event.pointerId, event.clientX);
      }

      const pinch = pinchState.current;
      if (pinch && pointers.current.size === 2) {
        const [a, b] = [...pointers.current.values()];
        const distance = Math.max(1, Math.abs((a ?? 0) - (b ?? 0)));
        zoomTo((pinch.pxPerHour * distance) / pinch.distance, pinch.midpoint);
        return;
      }

      const drag = dragState.current;
      if (drag) {
        const dx = event.clientX - drag.lastX;
        if (Math.abs(event.clientX - drag.startX) > TAP_THRESHOLD_PX) drag.moved = true;
        if (drag.moved) {
          scroller.scrollLeft -= dx;
          velocity.current = -dx;
        }
        drag.lastX = event.clientX;
        return;
      }

      // Bez stisknutého tlačítka jde o přejezd myší – ukazatel sleduje kurzor.
      if (!coarsePointer) {
        onPoint(event.clientX - scroller.getBoundingClientRect().left + scroller.scrollLeft);
      }
    },
    [coarsePointer, onPoint, zoomTo],
  );

  const startInertia = useCallback(() => {
    if (reducedMotion || Math.abs(velocity.current) < INERTIA_MIN_VELOCITY) return;
    const tick = () => {
      const scroller = scrollerRef.current;
      if (!scroller) return;
      scroller.scrollLeft += velocity.current;
      velocity.current *= INERTIA_DECAY;
      if (Math.abs(velocity.current) > INERTIA_MIN_VELOCITY) {
        inertiaFrame.current = requestAnimationFrame(tick);
      }
    };
    inertiaFrame.current = requestAnimationFrame(tick);
  }, [reducedMotion]);

  const onPointerUp = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      pointers.current.delete(event.pointerId);
      if (pointers.current.size < 2) pinchState.current = null;

      const drag = dragState.current;
      dragState.current = null;
      const scroller = scrollerRef.current;
      if (!drag || !scroller) return;

      if (drag.moved) {
        startInertia();
      } else {
        // Ťuknutí bez tažení nastaví ukazatel – na dotyku není hover.
        onPoint(event.clientX - scroller.getBoundingClientRect().left + scroller.scrollLeft);
      }
    },
    [onPoint, startInertia],
  );

  useEffect(() => stopInertia, [stopInertia]);

  return {
    scrollerRef,
    pxPerHour,
    isZoomed: zoom !== null,
    zoomByStep,
    resetZoom,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel: onPointerUp,
      onPointerLeave: (event: React.PointerEvent<HTMLElement>) => {
        pointers.current.delete(event.pointerId);
        dragState.current = null;
        if (!coarsePointer) onClearPoint();
      },
    },
  };
}
