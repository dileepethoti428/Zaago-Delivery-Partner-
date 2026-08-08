import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowRight, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SwipeToAcceptProps {
  onAccept: () => void;
  disabled?: boolean;
  loading?: boolean;
  label?: string;
  busyLabel?: string;
}

const THUMB_SIZE = 52;
const THRESHOLD = 0.75;

export function SwipeToAccept({
  onAccept,
  disabled,
  loading,
  label = 'Swipe to accept',
  busyLabel = 'Accepting…',
}: SwipeToAcceptProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const startXRef = useRef(0);
  const maxXRef = useRef(0);

  const reset = useCallback(() => {
    setDragX(0);
    setDragging(false);
  }, []);

  const handleStart = (clientX: number) => {
    if (disabled || loading || confirmed) return;
    const track = trackRef.current;
    if (!track) return;
    maxXRef.current = track.clientWidth - THUMB_SIZE - 4;
    startXRef.current = clientX;
    setDragging(true);
  };

  const handleMove = useCallback(
    (clientX: number) => {
      if (!dragging) return;
      const delta = clientX - startXRef.current;
      const clamped = Math.max(0, Math.min(maxXRef.current, delta));
      setDragX(clamped);
    },
    [dragging]
  );

  const handleEnd = useCallback(() => {
    if (!dragging) return;
    const max = maxXRef.current || 1;
    if (dragX / max >= THRESHOLD) {
      setDragX(max);
      setDragging(false);
      setConfirmed(true);
      onAccept();
    } else {
      reset();
    }
  }, [dragging, dragX, onAccept, reset]);

  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: PointerEvent) => handleMove(e.clientX);
    const onUp = () => handleEnd();
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [dragging, handleMove, handleEnd]);

  // Reset when parent stops loading (e.g. accept failed)
  useEffect(() => {
    if (!loading && confirmed) {
      // If parent unmounts on success, this never runs. On failure, allow retry after a tick.
      const t = setTimeout(() => {
        setConfirmed(false);
        setDragX(0);
      }, 400);
      return () => clearTimeout(t);
    }
  }, [loading, confirmed]);

  const max = maxXRef.current || 1;
  const progress = dragX / max;
  const isBusy = loading || confirmed;

  return (
    <div
      ref={trackRef}
      onClick={(e) => e.stopPropagation()}
      className={cn(
        'relative w-full h-14 rounded-full bg-primary/10 overflow-hidden select-none',
        disabled && 'opacity-60'
      )}
      style={{ touchAction: 'none' }}
    >
      {/* Fill */}
      <div
        className="absolute inset-y-0 left-0 bg-primary/20 transition-[width]"
        style={{
          width: `${THUMB_SIZE + dragX}px`,
          transitionDuration: dragging ? '0ms' : '200ms',
        }}
      />
      {/* Label */}
      <div
        className="absolute inset-0 flex items-center justify-center pointer-events-none text-primary font-semibold text-sm"
        style={{ opacity: 1 - progress * 0.9 }}
      >
        {isBusy ? busyLabel : label}
      </div>
      {/* Thumb */}
      <button
        type="button"
        aria-label="Swipe to accept"
        disabled={disabled || isBusy}
        onPointerDown={(e) => {
          e.stopPropagation();
          (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
          handleStart(e.clientX);
        }}
        className={cn(
          'absolute top-1 left-1 h-[52px] rounded-full bg-primary text-primary-foreground',
          'flex items-center justify-center shadow-md',
          'active:scale-[0.98] disabled:opacity-80'
        )}
        style={{
          width: `${THUMB_SIZE}px`,
          transform: `translateX(${dragX}px)`,
          transition: dragging ? 'none' : 'transform 200ms ease-out',
        }}
      >
        {isBusy ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          <ArrowRight className="h-5 w-5" />
        )}
      </button>
    </div>
  );
}
