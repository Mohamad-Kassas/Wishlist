import { NextResponse } from "next/server";
import { deleteItemById, getAllItems, updateItemById } from "@/lib/store";
import type { WishlistItem } from "@/lib/types";

interface RouteContext {
	params: Promise<{ id: string }>;
}

export async function PATCH(request: Request, context: RouteContext) {
	try {
		const { id } = await context.params;
		const patch = (await request.json()) as Partial<WishlistItem>;

		// If the user switched variants, automatically apply the variant's price/image/sku unless overridden in the same patch
		if (patch.selectedVariantId) {
			const allItems = await getAllItems();
			const existing = allItems.find((item) => item.id === id);
			const matchedVariant = existing?.variants?.find(
				(v) => v.id === patch.selectedVariantId,
			);
			if (matchedVariant) {
				if (patch.price === undefined && matchedVariant.price !== null) {
					patch.price = matchedVariant.price;
				}
				if (patch.image === undefined && matchedVariant.image) {
					patch.image = matchedVariant.image;
				}
				if (patch.sku === undefined && matchedVariant.sku) {
					patch.sku = matchedVariant.sku;
				}
			}
		}

		const updated = await updateItemById(id, patch);
		if (!updated) {
			return NextResponse.json({ error: "Item not found" }, { status: 404 });
		}

		return NextResponse.json({ item: updated });
	} catch (error) {
		const message =
			error instanceof Error ? error.message : "Failed to update item";
		return NextResponse.json({ error: message }, { status: 500 });
	}
}

export async function DELETE(_request: Request, context: RouteContext) {
	try {
		const { id } = await context.params;
		const deleted = await deleteItemById(id);
		if (!deleted) {
			return NextResponse.json({ error: "Item not found" }, { status: 404 });
		}
		return NextResponse.json({ success: true });
	} catch (error) {
		const message =
			error instanceof Error ? error.message : "Failed to delete item";
		return NextResponse.json({ error: message }, { status: 500 });
	}
}
