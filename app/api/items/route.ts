import { NextResponse } from "next/server";
import {
	extractDomain,
	inferBrandFromDomain,
	inferCategory,
} from "@/lib/scraper";
import { addItem, getAllItems } from "@/lib/store";
import type { CardSize, WishlistItem } from "@/lib/types";

export async function GET() {
	const items = await getAllItems();
	return NextResponse.json({ items });
}

export async function POST(request: Request) {
	try {
		const body = await request.json();
		const rawUrl =
			typeof body?.url === "string" && body.url.trim()
				? body.url.trim()
				: "https://example.com";
		const normalizedUrl = /^https?:\/\//i.test(rawUrl)
			? rawUrl
			: `https://${rawUrl}`;
		const domain = extractDomain(normalizedUrl);
		const brand =
			typeof body?.brand === "string" && body.brand.trim()
				? body.brand.trim()
				: inferBrandFromDomain(domain);
		const title =
			typeof body?.title === "string" && body.title.trim()
				? body.title.trim()
				: `${brand} Piece`;

		const price =
			typeof body?.price === "number" && Number.isFinite(body.price)
				? Math.round(body.price * 100) / 100
				: typeof body?.price === "string" && body.price.trim()
					? Number.parseFloat(body.price.replace(/[^0-9.]/g, "")) || null
					: null;

		const sizeOverride: CardSize | null =
			body?.sizeOverride === "small" ||
			body?.sizeOverride === "medium" ||
			body?.sizeOverride === "large"
				? body.sizeOverride
				: null;

		const category =
			typeof body?.category === "string" && body.category.trim()
				? body.category.trim()
				: inferCategory({ title, brand, domain });

		const image = typeof body?.image === "string" ? body.image.trim() : "";
		const now = new Date().toISOString();

		const newItem: WishlistItem = {
			id: `item-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
			url: normalizedUrl,
			domain,
			title,
			brand,
			description:
				typeof body?.description === "string"
					? body.description.trim()
					: undefined,
			image,
			gallery: image ? [image] : [],
			price,
			currency:
				typeof body?.currency === "string" && body.currency.trim()
					? body.currency.trim().toUpperCase()
					: "CAD",
			sizeOverride,
			status: body?.status === "owned" ? "owned" : "active",
			category,
			notes: typeof body?.notes === "string" ? body.notes.trim() : undefined,
			inStock: true,
			createdAt: now,
			updatedAt: now,
			scrapeMethod: "manual",
		};

		await addItem(newItem);
		return NextResponse.json({ item: newItem }, { status: 201 });
	} catch (error) {
		const message =
			error instanceof Error ? error.message : "Failed to create item";
		return NextResponse.json({ error: message }, { status: 500 });
	}
}
