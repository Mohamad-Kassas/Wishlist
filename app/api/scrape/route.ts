import { NextResponse } from "next/server";
import { scrapeProductUrl } from "@/lib/scraper";
import { addItem } from "@/lib/store";
import type { CardSize, WishlistItem } from "@/lib/types";

export async function POST(request: Request) {
	try {
		const body = await request.json();
		const rawUrl = typeof body?.url === "string" ? body.url.trim() : "";

		if (!rawUrl) {
			return NextResponse.json(
				{ error: "Please enter a valid product URL." },
				{ status: 400 },
			);
		}

		let normalizedUrl = rawUrl;
		if (!/^https?:\/\//i.test(normalizedUrl)) {
			normalizedUrl = `https://${normalizedUrl}`;
		}

		try {
			new URL(normalizedUrl);
		} catch {
			return NextResponse.json(
				{ error: "Invalid URL format. Include a domain like apple.com/..." },
				{ status: 400 },
			);
		}

		const scraped = await scrapeProductUrl(normalizedUrl);
		const shouldSave = body?.save !== false;
		const sizeOverride: CardSize | null =
			body?.sizeOverride === "small" ||
			body?.sizeOverride === "medium" ||
			body?.sizeOverride === "large"
				? body.sizeOverride
				: null;

		const now = new Date().toISOString();
		const newItem: WishlistItem = {
			id: `item-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
			url: scraped.url,
			domain: scraped.domain,
			title: scraped.title,
			brand: scraped.brand,
			description: scraped.description,
			image: scraped.image,
			gallery: scraped.gallery,
			price: scraped.price,
			highPrice: scraped.highPrice,
			currency: scraped.currency || "CAD",
			sizeOverride,
			status: "active",
			category:
				typeof body?.category === "string" && body.category.trim()
					? body.category.trim()
					: scraped.category,
			selectedVariantId: scraped.selectedVariantId,
			variants: scraped.variants,
			sku: scraped.sku,
			inStock: scraped.inStock,
			rating: scraped.rating,
			reviewCount: scraped.reviewCount,
			createdAt: now,
			updatedAt: now,
			scrapeMethod: scraped.scrapeMethod,
		};

		if (shouldSave) {
			await addItem(newItem);
		}

		return NextResponse.json({
			item: newItem,
			scraped,
		});
	} catch (error) {
		const message =
			error instanceof Error ? error.message : "Failed to scrape URL";
		return NextResponse.json({ error: message }, { status: 500 });
	}
}
