"use client";

import {
	type ReactNode,
	type RefObject,
	useCallback,
	useEffect,
	useLayoutEffect,
	useRef,
	useState,
} from "react";

/**
 * Keeps a component mounted during its exit animation so modals, drawers, and popovers
 * smoothly animate out instead of vanishing in 1 frame.
 */
export function useAnimatedPresence(isOpen: boolean, exitDurationMs = 240) {
	const [shouldRender, setShouldRender] = useState(isOpen);
	const [phase, setPhase] = useState<"entering" | "open" | "exiting">(
		isOpen ? "open" : "exiting",
	);

	useEffect(() => {
		if (isOpen) {
			setShouldRender(true);
			const raf1 = requestAnimationFrame(() => {
				const raf2 = requestAnimationFrame(() => {
					setPhase("open");
				});
				return () => cancelAnimationFrame(raf2);
			});
			setPhase("entering");
			return () => cancelAnimationFrame(raf1);
		}

		setPhase("exiting");
		const timer = setTimeout(() => {
			setShouldRender(false);
		}, exitDurationMs);
		return () => clearTimeout(timer);
	}, [isOpen, exitDurationMs]);

	return { shouldRender, phase, isVisible: phase === "open" };
}

/**
 * Retains the last non-null value while an exit animation completes (e.g. for InspectorSheet item).
 */
export function useRetainedValue<T>(
	value: T | null,
	exitDurationMs = 250,
): {
	retained: T | null;
	phase: "entering" | "open" | "exiting";
	isVisible: boolean;
} {
	const [retained, setRetained] = useState<T | null>(value);
	const { shouldRender, phase, isVisible } = useAnimatedPresence(
		value !== null,
		exitDurationMs,
	);

	useEffect(() => {
		if (value !== null) {
			setRetained(value);
		} else if (!shouldRender) {
			setRetained(null);
		}
	}, [value, shouldRender]);

	return {
		retained: shouldRender ? retained : null,
		phase,
		isVisible,
	};
}

export interface SlidingPillOption<T extends string> {
	id: T;
	label: ReactNode;
	badge?: ReactNode;
	activePillClassName?: string;
	activeTextClassName?: string;
}

interface SlidingPillGroupProps<T extends string> {
	options: SlidingPillOption<T>[];
	value: T;
	onChange: (next: T) => void;
	containerClassName?: string;
	buttonClassName?: string;
	defaultActivePillClassName?: string;
	defaultActiveTextClassName?: string;
	inactiveTextClassName?: string;
	fullWidth?: boolean;
	ariaLabel?: string;
}

/**
 * Segmented toggle / tab bar with a single physical sliding pill indicator
 * that sits 100% flush with the edges of the toggle container on both desktop and mobile Retina screens:
 * - Uses `ring-1 ring-inset` instead of `border` so the padding-box and border-box are identical (zero 1px border step).
 * - Uses sub-pixel `offsetLeft` / `offsetWidth` + `getBoundingClientRect()` ratio (immune to parent scale/translate transforms)
 *   and snaps the first option to `0px` and the last option to `container.offsetWidth - left`.
 * - Suppresses width transition on initial mount so the bubble never animates from `0px` width when a modal/drawer opens.
 */
export function SlidingPillGroup<T extends string>({
	options,
	value,
	onChange,
	containerClassName = "",
	buttonClassName = "px-3.5 py-1.5 text-xs font-medium",
	defaultActivePillClassName = "bg-[#F7F6F2]",
	defaultActiveTextClassName = "text-black font-semibold",
	inactiveTextClassName = "text-zinc-400 hover:text-zinc-200",
	fullWidth = false,
	ariaLabel,
}: SlidingPillGroupProps<T>) {
	const containerRef = useRef<HTMLDivElement>(null);
	const buttonRefs = useRef<Map<T, HTMLButtonElement>>(new Map());
	const [pillRect, setPillRect] = useState<{
		left: number;
		width: number;
		ready: boolean;
		animate: boolean;
	}>({ left: 0, width: 0, ready: false, animate: false });

	const hasMeasuredRef = useRef(false);
	const prevValueRef = useRef<T>(value);
	const optionsRef = useRef(options);
	optionsRef.current = options;

	const optionsKey = options
		.map(
			(o) =>
				`${o.id}:${typeof o.label === "string" || typeof o.label === "number" ? o.label : ""}:${typeof o.badge === "string" || typeof o.badge === "number" ? o.badge : ""}`,
		)
		.join("|");

	const activeOption = options.find((o) => o.id === value) ?? options[0];

	const updatePillGeometry = useCallback(() => {
		const btn = buttonRefs.current.get(value);
		const container = containerRef.current;
		if (!btn || !container) return;

		const currentOptions = optionsRef.current;
		const isFirst = currentOptions[0]?.id === value;
		const isLast = currentOptions[currentOptions.length - 1]?.id === value;

		// Use subpixel rect math normalized by scale factor so it works accurately even during modal scale(0.95 -> 1) animations
		const cRect = container.getBoundingClientRect();
		const bRect = btn.getBoundingClientRect();
		const scaleX =
			container.offsetWidth > 0 ? cRect.width / container.offsetWidth : 1;

		const totalWidth =
			scaleX > 0 ? cRect.width / scaleX : container.offsetWidth;
		const subLeft =
			scaleX > 0 ? (bRect.left - cRect.left) / scaleX : btn.offsetLeft;
		const subWidth = scaleX > 0 ? bRect.width / scaleX : btn.offsetWidth;

		const left = isFirst ? 0 : Math.max(0, subLeft);
		const width = isLast ? Math.max(subWidth, totalWidth - left) : subWidth;

		const valueChanged = prevValueRef.current !== value;
		const shouldAnimate = hasMeasuredRef.current && valueChanged;
		hasMeasuredRef.current = true;
		prevValueRef.current = value;

		setPillRect((prev) => {
			const nextAnimate = valueChanged ? shouldAnimate : prev.animate;
			if (
				prev.ready &&
				Math.abs(prev.left - left) < 0.05 &&
				Math.abs(prev.width - width) < 0.05 &&
				prev.animate === nextAnimate
			) {
				return prev;
			}
			return {
				left,
				width,
				ready: true,
				animate: nextAnimate,
			};
		});
	}, [value]);

	useLayoutEffect(() => {
		if (!optionsKey) return;
		updatePillGeometry();
	}, [updatePillGeometry, optionsKey]);

	useEffect(() => {
		const container = containerRef.current;
		if (!container) return;

		const observer = new ResizeObserver(() => {
			updatePillGeometry();
		});
		observer.observe(container);
		for (const btn of buttonRefs.current.values()) {
			observer.observe(btn);
		}

		window.addEventListener("resize", updatePillGeometry);
		return () => {
			observer.disconnect();
			window.removeEventListener("resize", updatePillGeometry);
		};
	}, [updatePillGeometry]);

	const pillColorClass =
		activeOption?.activePillClassName ?? defaultActivePillClassName;

	return (
		<div
			ref={containerRef}
			role="tablist"
			aria-label={ariaLabel}
			className={`relative ${
				fullWidth ? "flex w-full" : "inline-flex w-max max-w-full"
			} items-center p-0 overflow-hidden select-none ${containerClassName}`}
		>
			{/* Flush Gliding Active Pill Backdrop */}
			<span
				aria-hidden="true"
				style={{
					transform: `translate3d(${pillRect.left}px, 0, 0)`,
					width: `${pillRect.width}px`,
					opacity: pillRect.ready ? 1 : 0,
				}}
				className={`pointer-events-none absolute inset-y-0 left-0 h-full rounded-full ${
					pillRect.animate ? "sliding-pill" : ""
				} ${pillColorClass}`}
			/>

			{options.map((opt) => {
				const isActive = opt.id === value;
				const activeText =
					opt.activeTextClassName ?? defaultActiveTextClassName;
				return (
					<button
						key={opt.id}
						ref={(el) => {
							if (el) buttonRefs.current.set(opt.id, el);
							else buttonRefs.current.delete(opt.id);
						}}
						type="button"
						role="tab"
						aria-selected={isActive}
						onClick={() => onChange(opt.id)}
						className={`relative z-10 m-0 border-0 rounded-full whitespace-nowrap transition-colors duration-200 ${
							fullWidth ? "flex-1 text-center" : "shrink-0"
						} ${buttonClassName} ${
							isActive ? activeText : inactiveTextClassName
						}`}
					>
						<span>{opt.label}</span>
						{opt.badge !== undefined && (
							<span className="ml-1 opacity-70 tabular">{opt.badge}</span>
						)}
					</button>
				);
			})}
		</div>
	);
}

function easeOutCubic(t: number): number {
	return 1 - (1 - t) ** 3;
}

function easeInOutCubic(t: number): number {
	return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

/**
 * Frame-synchronized height & scroll accordion (`SmoothCollapse`).
 */
export function SmoothCollapse({
	isOpen,
	scrollContainerRef,
	children,
	className = "",
}: {
	isOpen: boolean;
	scrollContainerRef?: RefObject<HTMLElement | null>;
	children: ReactNode;
	className?: string;
}) {
	const wrapperRef = useRef<HTMLDivElement>(null);
	const innerRef = useRef<HTMLDivElement>(null);
	const rafRef = useRef<number | null>(null);
	const currentHeightRef = useRef<number>(0);
	const isFirstRender = useRef<boolean>(true);

	useLayoutEffect(() => {
		const wrapper = wrapperRef.current;
		const inner = innerRef.current;
		if (!wrapper || !inner) return;

		if (isFirstRender.current) {
			isFirstRender.current = false;
			const initialH = isOpen ? inner.scrollHeight : 0;
			currentHeightRef.current = initialH;
			wrapper.style.height = `${initialH}px`;
			wrapper.style.opacity = isOpen ? "1" : "0";
			return;
		}

		if (rafRef.current !== null) {
			cancelAnimationFrame(rafRef.current);
		}

		const startHeight = currentHeightRef.current;
		const targetHeight = isOpen ? inner.scrollHeight : 0;
		const startOpacity = isOpen ? 0 : 1;
		const targetOpacity = isOpen ? 1 : 0;

		const scrollEl = scrollContainerRef?.current ?? null;
		const startScrollTop = scrollEl ? scrollEl.scrollTop : 0;
		const shouldSyncScrollUp = !isOpen && startScrollTop > 0;

		const duration = shouldSyncScrollUp ? 280 : 250;
		const startTime = performance.now();

		const step = (now: number) => {
			const elapsed = Math.min(1, Math.max(0, (now - startTime) / duration));
			const eased = shouldSyncScrollUp
				? easeInOutCubic(elapsed)
				: easeOutCubic(elapsed);

			const nextH = startHeight + (targetHeight - startHeight) * eased;
			const nextOpacity = startOpacity + (targetOpacity - startOpacity) * eased;

			currentHeightRef.current = nextH;
			wrapper.style.height = `${nextH}px`;
			wrapper.style.opacity = `${nextOpacity}`;

			if (shouldSyncScrollUp && scrollEl) {
				scrollEl.scrollTop = startScrollTop * (1 - eased);
			}

			if (elapsed < 1) {
				rafRef.current = requestAnimationFrame(step);
			} else {
				rafRef.current = null;
				currentHeightRef.current = targetHeight;
				wrapper.style.height = isOpen ? "auto" : "0px";
				wrapper.style.opacity = `${targetOpacity}`;
				if (shouldSyncScrollUp && scrollEl) {
					scrollEl.scrollTop = 0;
				}
			}
		};

		if (!isOpen && wrapper.style.height === "auto") {
			const measured = inner.scrollHeight;
			currentHeightRef.current = measured;
			wrapper.style.height = `${measured}px`;
		}

		rafRef.current = requestAnimationFrame(step);

		return () => {
			if (rafRef.current !== null) {
				cancelAnimationFrame(rafRef.current);
			}
		};
	}, [isOpen, scrollContainerRef]);

	return (
		<div
			ref={wrapperRef}
			aria-hidden={!isOpen}
			style={{ height: "0px", opacity: 0 }}
			className={`overflow-hidden will-change-[height,opacity] ${
				isOpen ? "" : "pointer-events-none"
			} ${className}`}
		>
			<div ref={innerRef}>{children}</div>
		</div>
	);
}

/**
 * Smoothly interpolates container height when switching between tabs of different heights.
 */
export function SmoothHeight({
	children,
	className = "",
}: {
	children: ReactNode;
	className?: string;
}) {
	const innerRef = useRef<HTMLDivElement>(null);
	const [height, setHeight] = useState<number | "auto">("auto");

	useLayoutEffect(() => {
		const el = innerRef.current;
		if (!el) return;
		const observer = new ResizeObserver((entries) => {
			for (const entry of entries) {
				setHeight(entry.contentRect.height);
			}
		});
		observer.observe(el);
		setHeight(el.offsetHeight);
		return () => observer.disconnect();
	}, []);

	return (
		<div
			style={{
				height: typeof height === "number" ? `${height}px` : "auto",
				transition: "height 250ms cubic-bezier(0.22, 1, 0.36, 1)",
			}}
			className={`overflow-hidden ${className}`}
		>
			<div ref={innerRef}>{children}</div>
		</div>
	);
}

/**
 * FLIP layout animation hook for the Bento Grid.
 */
export function useFlipGrid(dependencyKey: string) {
	const containerRef = useRef<HTMLElement | null>(null);
	const prevRectsRef = useRef<Map<string, DOMRect>>(new Map());

	useLayoutEffect(() => {
		const container = containerRef.current;
		if (!container) return;

		const children = Array.from(
			container.querySelectorAll<HTMLElement>("[data-flip-id]"),
		);
		const nextRects = new Map<string, DOMRect>();

		for (const el of children) {
			const id = el.dataset.flipId;
			if (!id) continue;
			const nextRect = el.getBoundingClientRect();
			nextRects.set(id, nextRect);

			const prevRect = prevRectsRef.current.get(id);
			if (prevRect) {
				const dx = prevRect.left - nextRect.left;
				const dy = prevRect.top - nextRect.top;
				const dw = prevRect.width / Math.max(1, nextRect.width);
				const dh = prevRect.height / Math.max(1, nextRect.height);

				if (
					Math.abs(dx) > 1 ||
					Math.abs(dy) > 1 ||
					Math.abs(dw - 1) > 0.02 ||
					Math.abs(dh - 1) > 0.02
				) {
					el.animate(
						[
							{
								transform: `translate3d(${dx}px, ${dy}px, 0) scale(${dw}, ${dh})`,
								transformOrigin: "top left",
							},
							{
								transform: "translate3d(0, 0, 0) scale(1, 1)",
								transformOrigin: "top left",
							},
						],
						{
							duration: 280,
							easing: "cubic-bezier(0.22, 1, 0.36, 1)",
						},
					);
				}
			} else {
				el.animate(
					[
						{ opacity: 0, transform: "scale(0.95) translateY(8px)" },
						{ opacity: 1, transform: "scale(1) translateY(0)" },
					],
					{
						duration: 240,
						easing: "cubic-bezier(0.22, 1, 0.36, 1)",
					},
				);
			}
		}

		prevRectsRef.current = nextRects;
	}, [dependencyKey]);

	return containerRef;
}
