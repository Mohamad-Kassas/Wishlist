import type { CardSize, WishlistItem } from "./types";

export const CARD_SIZE_LABELS: Record<CardSize, string> = {
	small: "Small",
	medium: "Medium",
	large: "Large",
};

export interface ItemSizingInfo {
	/** Effective size currently rendered on the grid (override if present, otherwise autoSize) */
	size: CardSize;
	/** The underlying size calculated purely from the price distribution if "Auto" is chosen */
	autoSize: CardSize;
	/** True when no manual override is active */
	isAuto: boolean;
}

/**
 * Dynamically computes "small" | "medium" | "large" card sizes for a list of wishlist items
 * using pure rank-percentile quotas (~22% Large, ~28% Medium, ~50% Small) scaled to the collection size.
 *
 * - No hard-coded ceiling on Large items: scales naturally whether you have 8 items or 80 items.
 * - Immune to single-item price outliers: a $10,000 grail piece will not demote $600 pieces into Small.
 * - Always preserves `autoSize` separately from `size` so the Inspector UI truthfully shows
 *   `Auto (Medium)` even while the user has manually pinned the card to `Large`.
 */
export function computeDynamicSizes(
	items: WishlistItem[],
): Map<string, ItemSizingInfo> {
	const result = new Map<string, ItemSizingInfo>();
	if (items.length === 0) return result;

	const pricedItems = items
		.filter(
			(item) =>
				item.price !== null && Number.isFinite(item.price) && item.price > 0,
		)
		.sort((a, b) => {
			const diff = (b.price ?? 0) - (a.price ?? 0);
			if (diff !== 0) return diff;
			const timeDiff =
				new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
			if (timeDiff !== 0) return timeDiff;
			return a.id.localeCompare(b.id);
		});

	const count = pricedItems.length;

	// Pure percentile quotas (~22% Large, ~28% Medium, ~50% Small)
	const largeQuota =
		count <= 0 ? 0 : count <= 3 ? 1 : Math.max(1, Math.round(count * 0.22));

	const mediumQuota =
		count <= 1 ? 0 : count <= 3 ? 1 : Math.max(1, Math.round(count * 0.28));

	const autoSizes = new Map<string, CardSize>();

	for (let index = 0; index < pricedItems.length; index++) {
		const item = pricedItems[index];
		if (index < largeQuota) {
			autoSizes.set(item.id, "large");
		} else if (index < largeQuota + mediumQuota) {
			autoSizes.set(item.id, "medium");
		} else {
			autoSizes.set(item.id, "small");
		}
	}

	for (const item of items) {
		const autoSize = autoSizes.get(item.id) ?? "small";
		if (
			item.sizeOverride === "small" ||
			item.sizeOverride === "medium" ||
			item.sizeOverride === "large"
		) {
			result.set(item.id, {
				size: item.sizeOverride,
				autoSize,
				isAuto: false,
			});
		} else {
			result.set(item.id, {
				size: autoSize,
				autoSize,
				isAuto: true,
			});
		}
	}

	return result;
}

/**
 * Composes Large, Medium, and Small cards into a continuous, alternating Bento mosaic
 * from the top of the gallery to the very last row:
 *
 * - Band A (Hero Left, 4x2):  Large (Cols 1-2, Rows 1-2) paired with 2 Smalls + 1 Medium in Cols 3-4
 * - Band B (Hero Right, 4x2): Large (Cols 3-4, Rows 1-2) paired with 1 Medium + 2 Smalls in Cols 1-2
 * - Band C (Zig-Zag 1-Row, 4x1): Interleaved evenly when Medium > Large, alternating
 *   `[Medium (Cols 1-2), Small, Small]` and `[Small, Small, Medium (Cols 3-4)]`.
 * - Tracks `prevRowMediumSide` ("left" | "right" | "none") across every single row so two Medium cards
 *   never stack vertically in the same columns—even across Hero/Zig-Zag band transitions.
 */
export function composeBentoFlow(
	items: WishlistItem[],
	sizeMap: Map<string, ItemSizingInfo>,
): WishlistItem[] {
	const large: WishlistItem[] = [];
	const medium: WishlistItem[] = [];
	const small: WishlistItem[] = [];

	// Sort each tier by price descending (with recency tie-breaker) so top bands showcase highest-value pieces
	const sorted = [...items].sort((a, b) => {
		const diff = (b.price ?? 0) - (a.price ?? 0);
		if (diff !== 0) return diff;
		return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
	});

	for (const item of sorted) {
		const sz = sizeMap.get(item.id)?.size ?? "small";
		if (sz === "large") large.push(item);
		else if (sz === "medium") medium.push(item);
		else small.push(item);
	}

	const result: WishlistItem[] = [];
	let heroBandIndex = 0;
	let prevRowMediumSide: "left" | "right" | "none" = "none";
	let lastMediumSide: "left" | "right" = "right";

	const pullSmalls = (maxCount: number): WishlistItem[] => {
		const pulled: WishlistItem[] = [];
		while (pulled.length < maxCount && small.length > 0) {
			const s = small.shift();
			if (s) pulled.push(s);
		}
		return pulled;
	};

	/**
	 * Emits a 1-row Zig-Zag band (`1 Medium + 2 Smalls`), choosing Left (Cols 1-2) or Right (Cols 3-4)
	 * so the Medium card never lands in the same columns as the immediately preceding row's Medium.
	 */
	const emitZigZagMediumBand = () => {
		const m = medium.shift();
		if (!m) return;

		if (small.length >= 2) {
			const pair = pullSmalls(2);
			const placeOnLeft =
				prevRowMediumSide === "right" ||
				(prevRowMediumSide === "none" && lastMediumSide === "right");

			if (placeOnLeft) {
				// Medium in Cols 1-2, 2 Smalls in Cols 3-4
				result.push(m, ...pair);
				prevRowMediumSide = "left";
				lastMediumSide = "left";
			} else {
				// 2 Smalls in Cols 1-2, Medium in Cols 3-4
				result.push(...pair, m);
				prevRowMediumSide = "right";
				lastMediumSide = "right";
			}
		} else if (medium.length > 0) {
			// Pair 2 Mediums side-by-side in the same 4-col row (Cols 1-2 + Cols 3-4)
			const m2 = medium.shift();
			result.push(m);
			if (m2) result.push(m2);
			prevRowMediumSide = "right";
			lastMediumSide = "right";
		} else {
			result.push(m, ...pullSmalls(1));
			prevRowMediumSide = "left";
			lastMediumSide = "left";
		}
	};

	/**
	 * Emits a 2-row Hero band anchored by a 2x2 Large card, alternating Left (Cols 1-2) and Right (Cols 3-4).
	 * Dynamically places the companion Medium in Row 1 or Row 2 to prevent vertical Medium adjacency.
	 */
	const emitHeroBand = () => {
		const l = large.shift();
		if (!l) return;

		const isLeftHero = heroBandIndex % 2 === 0;
		heroBandIndex++;

		if (isLeftHero) {
			// Large occupies Cols 1-2 (Rows 1-2). Companion cards occupy Cols 3-4 ("right").
			// Placing 2 Smalls in Row 1 (Cols 3-4) and Medium in Row 2 (Cols 3-4) guarantees Row 1 has no Medium in Cols 3-4!
			result.push(l);
			if (small.length >= 2 && medium.length > 0) {
				const pair = pullSmalls(2);
				const m = medium.shift();
				result.push(...pair);
				if (m) result.push(m);
				prevRowMediumSide = "right";
				lastMediumSide = "right";
			} else if (medium.length > 0) {
				const m = medium.shift();
				if (m) result.push(m);
				result.push(...pullSmalls(1));
				prevRowMediumSide = "none";
				lastMediumSide = "right";
			} else {
				result.push(...pullSmalls(4));
				prevRowMediumSide = "none";
			}
		} else {
			// Large occupies Cols 3-4 (Rows 1-2). Companion cards occupy Cols 1-2 ("left").
			if (small.length >= 2 && medium.length > 0) {
				const pair = pullSmalls(2);
				const m = medium.shift();
				if (prevRowMediumSide === "left") {
					// Previous row had Medium in Cols 1-2 -> put 2 Smalls in Row 1 (Cols 1-2), Medium in Row 2 (Cols 1-2)!
					result.push(...pair, l);
					if (m) result.push(m);
					prevRowMediumSide = "left";
					lastMediumSide = "left";
				} else {
					// Put Medium in Row 1 (Cols 1-2), 2 Smalls in Row 2 (Cols 1-2)!
					if (m) result.push(m);
					result.push(l, ...pair);
					prevRowMediumSide = "none";
					lastMediumSide = "left";
				}
			} else if (medium.length > 0) {
				const m = medium.shift();
				if (m) result.push(m);
				result.push(l, ...pullSmalls(1));
				prevRowMediumSide = "none";
				lastMediumSide = "left";
			} else {
				const topPair = pullSmalls(2);
				const bottomPair = pullSmalls(2);
				result.push(...topPair, l, ...bottomPair);
				prevRowMediumSide = "none";
			}
		}
	};

	while (large.length > 0 || medium.length > 0 || small.length > 0) {
		if (large.length > 0) {
			emitHeroBand();

			// If there are more Mediums remaining than Large cards (each Hero band consumes 1 Medium),
			// interleave a 1-row Zig-Zag Medium band right now so Large anchors stay spread all the way down the page.
			if (medium.length > large.length && small.length >= 2) {
				emitZigZagMediumBand();
			}
		} else if (medium.length > 0) {
			emitZigZagMediumBand();
		} else {
			const s = small.shift();
			if (s) {
				result.push(s);
				prevRowMediumSide = "none";
			}
		}
	}

	return result;
}
