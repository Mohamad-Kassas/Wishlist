export type CardSize = "small" | "medium" | "large";

export type ItemStatus = "active" | "owned";

export interface ProductVariant {
	id: string;
	name: string;
	color?: string;
	size?: string;
	price: number | null;
	currency: string;
	image?: string;
	sku?: string;
	url?: string;
	inStock?: boolean;
}

export interface WishlistItem {
	id: string;
	url: string;
	domain: string;
	title: string;
	brand: string;
	description?: string;
	image: string;
	gallery?: string[];
	price: number | null;
	highPrice?: number | null;
	currency: string;
	/**
	 * Optional user override for card size.
	 * When null or undefined, size is computed dynamically from the collection's price distribution.
	 */
	sizeOverride?: CardSize | null;
	status: ItemStatus;
	category: string;
	selectedVariantId?: string;
	variants?: ProductVariant[];
	sku?: string;
	inStock?: boolean;
	rating?: number | null;
	reviewCount?: number | null;
	notes?: string;
	createdAt: string;
	updatedAt: string;
	acquiredAt?: string | null;
	scrapeMethod?: "shopify-json" | "http-ld-json" | "playwright" | "manual";
}

export interface ScrapedProductResult {
	url: string;
	domain: string;
	title: string;
	brand: string;
	description?: string;
	image: string;
	gallery: string[];
	price: number | null;
	highPrice?: number | null;
	currency: string;
	category: string;
	sku?: string;
	inStock?: boolean;
	rating?: number | null;
	reviewCount?: number | null;
	variants: ProductVariant[];
	selectedVariantId?: string;
	scrapeMethod: "shopify-json" | "http-ld-json" | "playwright" | "manual";
}
