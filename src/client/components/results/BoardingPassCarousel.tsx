"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { BoardingPass } from "./BoardingPass";

export type CarouselPass = {
  id: string;
  destName: string;
  destAddress?: string;
  continuity?: number;
};

type Props = {
  sourceName: string;
  sourceAddress?: string;
  passes: CarouselPass[];
  activeId?: string | null;
  onSelect: (id: string) => void;
};

const CARD_WIDTH_PX = 352; // 22rem
const GAP_PX = 8;
const STRIDE_PX = CARD_WIDTH_PX + GAP_PX;

type Slide = CarouselPass & { key: string; logicalIndex: number };

function buildSlides(passes: CarouselPass[]): Slide[] {
  if (passes.length === 0) return [];
  const copies = passes.length === 1 ? [0] : [0, 1, 2];
  const slides: Slide[] = [];
  for (const copy of copies) {
    passes.forEach((p, logicalIndex) => {
      slides.push({
        ...p,
        logicalIndex,
        key: `${copy}:${logicalIndex}:${p.id}`,
      });
    });
  }
  return slides;
}

/** ScrollLeft that centers slide i when side padding is (viewport - card) / 2. */
function slideCenterOffset(slideIndex: number): number {
  return slideIndex * STRIDE_PX;
}

function readPadLeft(el: HTMLElement): number {
  return parseFloat(getComputedStyle(el).paddingLeft) || 0;
}

export function BoardingPassCarousel({
  sourceName,
  sourceAddress,
  passes,
  activeId,
  onSelect,
}: Props) {
  const n = passes.length;
  const passIds = useMemo(() => passes.map((p) => p.id).join("|"), [passes]);
  const slides = useMemo(() => buildSlides(passes), [passes]);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const scrollAtPointerDownRef = useRef(0);
  const ignoreScrollRef = useRef(false);
  const [activeLogical, setActiveLogical] = useState(0);
  const [offsets, setOffsets] = useState<Record<string, number>>({});

  const middleCopyStart = n <= 1 ? 0 : n;

  const scrollToLogical = useCallback(
    (logicalIndex: number, behavior: ScrollBehavior = "smooth") => {
      const el = scrollerRef.current;
      if (!el || n === 0) return;
      const slideIndex = middleCopyStart + ((logicalIndex % n) + n) % n;
      ignoreScrollRef.current = true;
      el.scrollTo({
        left: slideCenterOffset(slideIndex),
        behavior,
      });
      setActiveLogical(((logicalIndex % n) + n) % n);
      window.setTimeout(
        () => {
          ignoreScrollRef.current = false;
        },
        behavior === "smooth" ? 450 : 0,
      );
    },
    [middleCopyStart, n],
  );

  useLayoutEffect(() => {
    if (n === 0) return;
    const found =
      activeId != null ? passes.findIndex((p) => p.id === activeId) : 0;
    scrollToLogical(found >= 0 ? found : 0, "auto");
    // Re-center when the destination set changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- passIds captures list identity
  }, [n, passIds]);

  const updateOffsets = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const padLeft = readPadLeft(el);
    const center = el.scrollLeft + el.clientWidth / 2;
    const next: Record<string, number> = {};
    let best = 0;
    let bestDist = Infinity;
    for (let i = 0; i < slides.length; i++) {
      const slideCenter =
        padLeft + i * STRIDE_PX + CARD_WIDTH_PX / 2;
      next[slides[i].key] = (slideCenter - center) / STRIDE_PX;
      const dist = Math.abs(slideCenter - center);
      if (dist < bestDist) {
        bestDist = dist;
        best = i;
      }
    }
    setOffsets(next);
    setActiveLogical(slides[best]?.logicalIndex ?? 0);
  }, [slides]);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;

    const onScroll = () => {
      updateOffsets();
      if (ignoreScrollRef.current || n <= 1) return;

      const maxScroll = el.scrollWidth - el.clientWidth;
      const x = el.scrollLeft;
      const copyWidth = n * STRIDE_PX;
      if (x < copyWidth * 0.5) {
        ignoreScrollRef.current = true;
        el.scrollLeft = x + copyWidth;
        ignoreScrollRef.current = false;
        updateOffsets();
      } else if (x > maxScroll - copyWidth * 0.5) {
        ignoreScrollRef.current = true;
        el.scrollLeft = x - copyWidth;
        ignoreScrollRef.current = false;
        updateOffsets();
      }
    };

    updateOffsets();
    el.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", updateOffsets);
    return () => {
      el.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", updateOffsets);
    };
  }, [n, updateOffsets]);

  if (n === 0) return null;

  // Side padding so the active card can sit in the true horizontal center.
  const pad = `calc(50% - ${CARD_WIDTH_PX / 2}px)`;

  return (
    <div className="relative mx-auto w-full max-w-5xl">
      <div
        ref={scrollerRef}
        className="flex snap-x snap-mandatory overflow-x-auto overflow-y-visible py-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={{
          gap: GAP_PX,
          paddingLeft: pad,
          paddingRight: pad,
          scrollPaddingInline: pad,
          WebkitOverflowScrolling: "touch",
          maskImage:
            "linear-gradient(to right, transparent 0%, black 12%, black 88%, transparent 100%)",
          WebkitMaskImage:
            "linear-gradient(to right, transparent 0%, black 12%, black 88%, transparent 100%)",
        }}
        onPointerDown={() => {
          scrollAtPointerDownRef.current = scrollerRef.current?.scrollLeft ?? 0;
        }}
      >
        {slides.map((slide) => {
          const measured = offsets[slide.key];
          const offset =
            measured ?? slide.logicalIndex - activeLogical;
          const abs = Math.min(2, Math.abs(offset));
          const isCenter =
            measured === undefined
              ? slide.logicalIndex === activeLogical
              : Math.abs(measured) < 0.45;
          const rotateY = Math.max(-28, Math.min(28, offset * -18));
          const scale = Math.max(0.86, 1 - abs * 0.08);
          const opacity = Math.max(0.45, 1 - abs * 0.28);

          return (
            <div
              key={slide.key}
              className="shrink-0 snap-center"
              style={{
                width: CARD_WIDTH_PX,
                transform: `perspective(1000px) rotateY(${rotateY}deg) scale(${scale})`,
                opacity,
                transition: "transform 80ms linear, opacity 80ms linear",
              }}
            >
              <BoardingPass
                sourceName={sourceName}
                sourceAddress={sourceAddress}
                destName={slide.destName}
                destAddress={slide.destAddress}
                continuity={slide.continuity}
                selected={isCenter && activeId === slide.id}
                interactive
                onClick={() => {
                  const scrolled = Math.abs(
                    (scrollerRef.current?.scrollLeft ?? 0) -
                      scrollAtPointerDownRef.current,
                  );
                  if (scrolled > 10) return;

                  if (isCenter) {
                    onSelect(slide.id);
                    return;
                  }
                  scrollToLogical(slide.logicalIndex, "smooth");
                }}
              />
            </div>
          );
        })}
      </div>

      {n > 1 && (
        <div className="mt-1 flex items-center justify-center gap-3">
          <button
            type="button"
            aria-label="Previous destination"
            onClick={() => scrollToLogical(activeLogical - 1)}
            className="rounded-full border border-zinc-300 bg-white/90 px-3 py-1 text-sm text-zinc-700 shadow-sm hover:bg-white"
          >
            ‹
          </button>
          <div className="flex gap-1.5">
            {passes.map((p, i) => (
              <button
                key={`dot-${i}-${p.id}`}
                type="button"
                aria-label={`Go to ${p.destName}`}
                onClick={() => scrollToLogical(i)}
                className={`h-1.5 w-1.5 rounded-full transition ${
                  i === activeLogical ? "bg-zinc-900" : "bg-zinc-300"
                }`}
              />
            ))}
          </div>
          <button
            type="button"
            aria-label="Next destination"
            onClick={() => scrollToLogical(activeLogical + 1)}
            className="rounded-full border border-zinc-300 bg-white/90 px-3 py-1 text-sm text-zinc-700 shadow-sm hover:bg-white"
          >
            ›
          </button>
        </div>
      )}
    </div>
  );
}
