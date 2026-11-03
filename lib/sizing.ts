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
 * based on their relative price distribution within the collection.
 *
 * Always preserves `autoSize` separately from `size` so the UI can truthfully show
 * `Auto (Medium)` even while the user has manually overridden the card to `Large`.
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
			return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
		});

	const count = pricedItems.length;
	const maxPrice = count > 0 ? (pricedItems[0].price ?? 0) : 0;

	const largeQuota = count <= 1 ? count : count <= 5 ? 1 : count <= 11 ? 2 : 3;

	const mediumQuota =
		count <= 2 ? 0 : count <= 5 ? 1 : Math.max(2, Math.round(count * 0.3));

	const autoSizes = new Map<string, CardSize>();

	for (let index = 0; index < pricedItems.length; index++) {
		const item = pricedItems[index];
		const price = item.price ?? 0;
		const ratioToMax = maxPrice > 0 ? price / maxPrice : 0;

		if (index < largeQuota && ratioToMax >= 0.3) {
			autoSizes.set(item.id, "large");
		} else if (index < largeQuota + mediumQuota && ratioToMax >= 0.1) {
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
 * Interleaves Large, Medium, and Small cards into alternating 4x2 Bento bands:
 * - On Desktop (4 cols): Alternates Large (2x2) between Left and Right columns, paired with 2 Smalls (1x1) and 1 Medium (2x1).
 * - On Mobile (2 cols): Emits Large (2 rows), followed immediately by 2 side-by-side Smalls (1x1 + 1x1), followed by Medium (1 full row),
 *   so the 2-column Bento mosaic is immediately visible on the first mobile screen.
 */
export function composeBentoFlow(
	items: WishlistItem[],
	sizeMap: Map<string, ItemSizingInfo>,
): WishlistItem[] {
	const large: WishlistItem[] = [];
	const medium: WishlistItem[] = [];
	const small: WishlistItem[] = [];

	for (const item of items) {
		const sz = sizeMap.get(item.id)?.size ?? "small";
		if (sz === "large") large.push(item);
		else if (sz === "medium") medium.push(item);
		else small.push(item);
	}

	const result: WishlistItem[] = [];
	let band = 0;

	while (large.length > 0 || medium.length > 0 || small.length > 0) {
		if (large.length > 0) {
			if (band % 2 === 0) {
				// Even band: Large (2x2), then 2 Smalls side-by-side (1x1 + 1x1), then Medium (2x1)
				const l = large.shift();
				if (l) result.push(l);
				for (let i = 0; i < 2 && small.length > 0; i++) {
					const s = small.shift();
					if (s) result.push(s);
				}
				if (medium.length > 0) {
					const m = medium.shift();
					if (m) result.push(m);
				} else if (small.length >= 2) {
					const s1 = small.shift();
					const s2 = small.shift();
					if (s1) result.push(s1);
					if (s2) result.push(s2);
				}
			} else {
				// Odd band: Medium on Top-Left (Cols 1-2), Large on Right (Cols 3-4), 2 Small on Bottom-Left
				if (medium.length > 0) {
					const m = medium.shift();
					if (m) result.push(m);
				} else if (small.length >= 2) {
					const s1 = small.shift();
					const s2 = small.shift();
					if (s1) result.push(s1);
					if (s2) result.push(s2);
				}
				const l = large.shift();
				if (l) result.push(l);
				for (let i = 0; i < 2 && small.length > 0; i++) {
					const s = small.shift();
					if (s) result.push(s);
				}
			}
		} else if (medium.length > 0) {
			const m = medium.shift();
			if (m) result.push(m);
			for (let i = 0; i < 2 && small.length > 0; i++) {
				const s = small.shift();
				if (s) result.push(s);
			}
		} else {
			const s = small.shift();
			if (s) result.push(s);
		}
		band++;
	}

	return result;
}
