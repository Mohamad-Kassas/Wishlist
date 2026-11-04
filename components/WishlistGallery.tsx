"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AddPieceModal } from "@/components/AddPieceModal";
import { SlidingPillGroup, useFlipGrid } from "@/components/AnimatedUI";
import { BentoCard, BentoSkeletonCard } from "@/components/BentoCard";
import { InspectorSheet } from "@/components/InspectorSheet";
import {
	extractDomainClient,
	formatCurrency,
	formatExactCurrency,
} from "@/lib/format";
import { composeBentoFlow, computeDynamicSizes } from "@/lib/sizing";
import type { WishlistItem } from "@/lib/types";

interface WishlistGalleryProps {
	initialItems: WishlistItem[];
}

type ViewScope = "active" | "owned";

export function WishlistGallery({ initialItems }: WishlistGalleryProps) {
	const [items, setItems] = useState<WishlistItem[]>(initialItems);
	const [isAddModalOpen, setIsAddModalOpen] = useState(false);
	const [modalInitialUrl, setModalInitialUrl] = useState("");
	const [scrapeError, setScrapeError] = useState<string | null>(null);
	const [pendingScrapes, setPendingScrapes] = useState<
		{ id: string; domain: string }[]
	>([]);

	// Minimal scope & category state
	const [scope, setScope] = useState<ViewScope>("active");
	const [selectedCategory, setSelectedCategory] = useState<string>("All");

	// Active item in Slide-Over Inspector
	const [inspectedId, setInspectedId] = useState<string | null>(null);

	const submitScrapeUrl = useCallback(
		async (rawUrl: string) => {
			const trimmed = rawUrl.trim();
			if (!trimmed) return;

			setScrapeError(null);
			const normalized = /^https?:\/\//i.test(trimmed)
				? trimmed
				: `https://${trimmed}`;
			const domain = extractDomainClient(normalized);
			const tempId = `scraping-${Date.now()}`;

			setPendingScrapes((prev) => [{ id: tempId, domain }, ...prev]);
			setIsAddModalOpen(false);
			setModalInitialUrl("");
			if (scope === "owned") setScope("active");

			try {
				const res = await fetch("/api/scrape", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						url: normalized,
					}),
				});
				const data = await res.json();
				if (!res.ok || !data.item) {
					throw new Error(data.error || "Could not extract product metadata.");
				}

				setItems((prev) => [data.item, ...prev]);

				if (
					(data.item.variants && data.item.variants.length > 1) ||
					data.item.price === null
				) {
					setInspectedId(data.item.id);
				}
			} catch (err) {
				const msg =
					err instanceof Error ? err.message : "Failed to scrape product URL.";
				setScrapeError(msg);
				setModalInitialUrl(trimmed);
				setIsAddModalOpen(true);
			} finally {
				setPendingScrapes((prev) => prev.filter((p) => p.id !== tempId));
			}
		},
		[scope],
	);

	// Global ⌘K shortcut to open Add Piece modal, and global ⌘V to paste a URL directly from anywhere on the page
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
				e.preventDefault();
				setScrapeError(null);
				setModalInitialUrl("");
				setIsAddModalOpen((prev) => !prev);
			}
		};

		const handleGlobalPaste = (e: ClipboardEvent) => {
			const target = e.target as HTMLElement | null;
			if (
				target &&
				(target.tagName === "INPUT" ||
					target.tagName === "TEXTAREA" ||
					target.tagName === "SELECT" ||
					target.isContentEditable)
			) {
				return;
			}
			const pasted = e.clipboardData?.getData("text")?.trim();
			if (pasted && /^https?:\/\/[^\s]+$/i.test(pasted)) {
				e.preventDefault();
				submitScrapeUrl(pasted);
			}
		};

		window.addEventListener("keydown", handleKeyDown);
		window.addEventListener("paste", handleGlobalPaste);
		return () => {
			window.removeEventListener("keydown", handleKeyDown);
			window.removeEventListener("paste", handleGlobalPaste);
		};
	}, [submitScrapeUrl]);

	// Compute portfolio metrics
	const activeItems = useMemo(
		() => items.filter((i) => i.status === "active"),
		[items],
	);
	const ownedItems = useMemo(
		() => items.filter((i) => i.status === "owned"),
		[items],
	);

	// Dynamically compute Small / Medium / Large sizes across the active collection based on price distribution
	const sizeMap = useMemo(() => {
		const activeMap = computeDynamicSizes(activeItems);
		const ownedMap = computeDynamicSizes(ownedItems);
		const combined = new Map(activeMap);
		for (const [k, v] of ownedMap.entries()) {
			combined.set(k, v);
		}
		return combined;
	}, [activeItems, ownedItems]);

	const totalActiveValue = useMemo(
		() => activeItems.reduce((sum, i) => sum + (i.price ?? 0), 0),
		[activeItems],
	);
	const totalOwnedValue = useMemo(
		() => ownedItems.reduce((sum, i) => sum + (i.price ?? 0), 0),
		[ownedItems],
	);

	const highestValuePiece = useMemo(() => {
		if (activeItems.length === 0) return null;
		return [...activeItems].sort((a, b) => (b.price ?? 0) - (a.price ?? 0))[0];
	}, [activeItems]);

	const categories = useMemo(() => {
		const baseItems = scope === "owned" ? ownedItems : activeItems;
		const counts = new Map<string, number>();
		for (const item of baseItems) {
			const cat = item.category || "Curated";
			counts.set(cat, (counts.get(cat) || 0) + 1);
		}
		return Array.from(counts.entries())
			.sort((a, b) => b[1] - a[1])
			.map(([name]) => name);
	}, [activeItems, ownedItems, scope]);

	// Filtered items arranged in alternating Bento bands (Large + 2 Small + Medium) for balanced scrolling
	const displayedItems = useMemo(() => {
		const list = scope === "owned" ? ownedItems : activeItems;
		const filtered =
			selectedCategory === "All"
				? list
				: list.filter((i) => i.category === selectedCategory);
		return composeBentoFlow(filtered, sizeMap);
	}, [activeItems, ownedItems, scope, selectedCategory, sizeMap]);

	// FLIP layout animation key: triggers smooth card gliding when scope, category, order, or sizes change
	const flipKey = useMemo(
		() =>
			`${scope}:${selectedCategory}:${displayedItems
				.map((i) => `${i.id}-${sizeMap.get(i.id)?.size ?? "small"}`)
				.join(",")}`,
		[scope, selectedCategory, displayedItems, sizeMap],
	);
	const gridRef = useFlipGrid(flipKey);

	const inspectedItem = useMemo(
		() => items.find((i) => i.id === inspectedId) || null,
		[items, inspectedId],
	);

	const inspectedSizeInfo = useMemo(() => {
		if (!inspectedItem) {
			return {
				size: "small" as const,
				autoSize: "small" as const,
				isAuto: true,
			};
		}
		return (
			sizeMap.get(inspectedItem.id) ?? {
				size: "small" as const,
				autoSize: "small" as const,
				isAuto: true,
			}
		);
	}, [inspectedItem, sizeMap]);

	const handleCreateManual = async (payload: {
		url: string;
		brand: string;
		title: string;
		price: string;
		category: string;
		image: string;
		notes: string;
	}) => {
		try {
			const res = await fetch("/api/items", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(payload),
			});
			const data = await res.json();
			if (res.ok && data.item) {
				setItems((prev) => [data.item, ...prev]);
				setScrapeError(null);
				setModalInitialUrl("");
				setIsAddModalOpen(false);
			}
		} catch {
			setScrapeError("Could not save manual item.");
		}
	};

	const handleUpdateItem = async (id: string, patch: Partial<WishlistItem>) => {
		setItems((prev) =>
			prev.map((item) => {
				if (item.id !== id) return item;
				const updated: WishlistItem = {
					...item,
					...patch,
					updatedAt: new Date().toISOString(),
				};
				if ("notes" in patch) {
					const trimmed =
						typeof patch.notes === "string" ? patch.notes.trim() : "";
					if (trimmed) {
						updated.notes = trimmed;
					} else {
						delete updated.notes;
					}
				}
				return updated;
			}),
		);

		try {
			const res = await fetch(`/api/items/${id}`, {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(patch),
			});
			if (res.ok) {
				const data = await res.json();
				if (data.item) {
					setItems((prev) =>
						prev.map((item) => (item.id === id ? data.item : item)),
					);
				}
			}
		} catch {
			// Retain optimistic state on transient error
		}
	};

	const handleDeleteItem = async (id: string) => {
		setInspectedId(null);
		setItems((prev) => prev.filter((item) => item.id !== id));
		try {
			await fetch(`/api/items/${id}`, { method: "DELETE" });
		} catch {
			// Ignore
		}
	};

	return (
		<div className="min-h-screen bg-black text-[#F7F6F2]">
			<div className="mx-auto max-w-[1400px] px-3.5 sm:px-8 py-4 sm:py-8 space-y-4 sm:space-y-6">
				{/* Single Integrated Editorial Summary Card */}
				<section
					aria-label="Gallery valuation summary"
					className="rounded-3xl bg-[#0A0A0C] border border-white/[0.08] p-4 sm:p-7"
				>
					{/* Top Bar inside Card: Brand Eyebrow + Flush Gliding Scope Toggle & + Add Piece Button */}
					<div className="flex flex-wrap items-center justify-between gap-3 pb-4 sm:pb-5 border-b border-white/[0.06]">
						<div className="flex items-center gap-2">
							<span
								aria-hidden="true"
								className="h-2 w-2 rounded-full bg-amber-400"
							/>
							<h1 className="text-xs font-semibold uppercase tracking-[0.18em] text-[#F7F6F2]">
								Wishlist
							</h1>
						</div>

						<div className="flex items-center gap-1.5 shrink-0">
							<SlidingPillGroup
								ariaLabel="Gallery scope"
								value={scope}
								onChange={(next) => {
									setScope(next);
									setSelectedCategory("All");
								}}
								containerClassName="rounded-full bg-[#121216] ring-1 ring-inset ring-white/[0.08]"
								buttonClassName="px-3.5 py-1.5 text-xs font-medium"
								options={[
									{
										id: "active",
										label: "Wishlist",
										badge: `(${activeItems.length})`,
										activePillClassName: "bg-white/15",
										activeTextClassName: "text-[#F7F6F2] font-semibold",
									},
									{
										id: "owned",
										label: "Archive",
										badge: `(${ownedItems.length})`,
										activePillClassName: "bg-emerald-500/20",
										activeTextClassName: "text-emerald-300 font-semibold",
									},
								]}
							/>

							<button
								type="button"
								onClick={() => {
									setScrapeError(null);
									setModalInitialUrl("");
									setIsAddModalOpen(true);
								}}
								className="rounded-full bg-[#F7F6F2] px-3.5 py-1.5 text-xs font-semibold whitespace-nowrap text-black hover:bg-white press-scale"
							>
								+ Add Piece
							</button>
						</div>
					</div>

					{/* Valuation & Supporting Metrics Row */}
					<div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 items-end pt-4 sm:pt-5">
						{/* Primary Hero Metric */}
						<div className="lg:col-span-4">
							<span className="block text-xs font-medium uppercase tracking-wider text-zinc-400">
								{scope === "owned"
									? "Acquired Collection Value"
									: "Total Wishlist Valuation"}
							</span>
							<div className="mt-1 flex items-baseline gap-2">
								<span className="text-3xl sm:text-4xl font-semibold tracking-tight text-[#F7F6F2] tabular whitespace-nowrap">
									{formatExactCurrency(
										scope === "owned" ? totalOwnedValue : totalActiveValue,
										"CAD",
									)}
								</span>
								<span className="text-xs font-medium uppercase tracking-wider text-zinc-500">
									CAD
								</span>
							</div>
						</div>

						{/* Supporting Secondary Metrics separated by 1px vertical hairlines */}
						<div className="lg:col-span-8 grid grid-cols-2 sm:grid-cols-12 gap-3 sm:gap-6 pt-3.5 lg:pt-0 border-t lg:border-t-0 border-white/[0.08]">
							<div className="col-span-1 sm:col-span-3 sm:border-l sm:border-white/[0.08] sm:pl-5">
								<span className="block text-xs font-medium uppercase tracking-wider text-zinc-400">
									Curated Pieces
								</span>
								<p className="mt-0.5 sm:mt-1 text-base sm:text-lg font-medium text-[#F7F6F2] tabular whitespace-nowrap">
									{activeItems.length} Active
								</p>
							</div>

							<div className="col-span-1 sm:col-span-4 border-l border-white/[0.08] pl-3.5 sm:pl-5">
								<span className="block text-xs font-medium uppercase tracking-wider text-zinc-400">
									Acquired Archive
								</span>
								<p className="mt-0.5 sm:mt-1 text-base sm:text-lg font-medium text-emerald-300 tabular whitespace-nowrap">
									{ownedItems.length} Owned{" "}
									<span className="text-zinc-500">·</span>{" "}
									{formatCurrency(totalOwnedValue, "CAD")}
								</p>
							</div>

							<div className="hidden sm:block sm:col-span-5 sm:border-l sm:border-white/[0.08] sm:pl-5 min-w-0">
								<span className="block text-xs font-medium uppercase tracking-wider text-zinc-400">
									Highest-Value Piece
								</span>
								{highestValuePiece ? (
									<button
										type="button"
										onClick={() => setInspectedId(highestValuePiece.id)}
										className="mt-1 block text-left truncate max-w-full text-base sm:text-lg font-medium text-[#F7F6F2] hover:text-amber-300 transition-colors duration-200"
									>
										{highestValuePiece.brand} · {highestValuePiece.title}
									</button>
								) : (
									<p className="mt-1 text-base text-zinc-500">None yet</p>
								)}
							</div>
						</div>
					</div>

					{/* Flush Gliding Collection Filter Strip along the bottom of the card */}
					{categories.length > 1 && (
						<div className="mt-4 sm:mt-5 pt-3.5 sm:pt-4 border-t border-white/[0.06] overflow-x-auto no-scrollbar">
							<SlidingPillGroup
								ariaLabel="Collection filter"
								value={selectedCategory}
								onChange={(next) =>
									setSelectedCategory(
										next === selectedCategory && next !== "All" ? "All" : next,
									)
								}
								containerClassName="rounded-full"
								buttonClassName="px-3.5 py-1.5 text-xs font-medium"
								defaultActivePillClassName="bg-white/15"
								defaultActiveTextClassName="text-[#F7F6F2] font-semibold"
								inactiveTextClassName="text-zinc-500 hover:text-zinc-300"
								options={[
									{ id: "All", label: "All Collections" },
									...categories.map((cat) => ({ id: cat, label: cat })),
								]}
							/>
						</div>
					)}
				</section>

				{/* Responsive 2-Column Mobile / 4-Column Desktop Bento Grid with FLIP Layout Transitions */}
				{displayedItems.length === 0 && pendingScrapes.length === 0 ? (
					<div className="rounded-3xl bg-[#0A0A0C] border border-white/[0.08] p-12 text-center">
						<p className="text-base font-medium text-[#F7F6F2]">
							{scope === "owned"
								? "No acquired pieces in your archive yet."
								: "No pieces in this collection."}
						</p>
						<p className="mt-1.5 text-xs text-zinc-400 max-w-md mx-auto">
							Press ⌘V anywhere on the page to paste a product link, or click +
							Add Piece above.
						</p>
					</div>
				) : (
					<section
						ref={(el) => {
							gridRef.current = el;
						}}
						aria-label="Wishlist Bento Grid"
						className="grid grid-cols-2 lg:grid-cols-4 grid-flow-row-dense gap-3 sm:gap-5"
					>
						{pendingScrapes.map((job) => (
							<BentoSkeletonCard key={job.id} domain={job.domain} />
						))}

						{displayedItems.map((item) => {
							const resolved = sizeMap.get(item.id)?.size ?? "small";
							return (
								<BentoCard
									key={item.id}
									item={item}
									size={resolved}
									onSelect={(selected) => setInspectedId(selected.id)}
								/>
							);
						})}
					</section>
				)}
			</div>

			{/* Centered Add Piece Popup Modal (Smoothly Animates In & Out) */}
			<AddPieceModal
				isOpen={isAddModalOpen}
				initialUrl={modalInitialUrl}
				initialError={scrapeError}
				categories={categories}
				onClose={() => setIsAddModalOpen(false)}
				onScrapeUrl={submitScrapeUrl}
				onCreateManual={handleCreateManual}
			/>

			{/* Minimal Slide-Over Inspector (Smoothly Slides In & Out) */}
			<InspectorSheet
				item={inspectedItem}
				autoSize={inspectedSizeInfo.autoSize}
				categories={categories}
				onClose={() => setInspectedId(null)}
				onUpdate={handleUpdateItem}
				onDelete={handleDeleteItem}
			/>
		</div>
	);
}
