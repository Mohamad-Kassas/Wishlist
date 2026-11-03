import { WishlistGallery } from "@/components/WishlistGallery";
import { getAllItems } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function Home() {
	const items = await getAllItems();
	return <WishlistGallery initialItems={items} />;
}
