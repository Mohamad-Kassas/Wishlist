"use client";

import { useEffect, useRef, useState } from "react";
import {
	SlidingPillGroup,
	SmoothCollapse,
	useRetainedValue,
} from "@/components/AnimatedUI";
import { formatCurrency } from "@/lib/format";
import { CARD_SIZE_LABELS } from "@/lib/sizing";
import type { CardSize, WishlistItem } from "@/lib/types";

interface InspectorSheetProps {
	item: WishlistItem | null;
	/** The underlying price-computed size if Auto is selected */
	autoSize: CardSize;
	categories: string[];
	onClose: () => void;
	onUpdate: (id: string, patch: Partial<WishlistItem>) => Promise<void>;
	onDelete: (id: string) => Promise<void>;
}

export function InspectorSheet({
	item,
	autoSize,
	categories,
	onClose,
	onUpdate,
	onDelete,
}: InspectorSheetProps) {
	// Retain item while the slide-out exit animation completes
	const { retained: activeItem, isVisible } = useRetainedValue(item, 250);
	const [retainedAutoSize, setRetainedAutoSize] = useState<CardSize>(autoSize);

	const [isEditing, setIsEditing] = useState(false);
	const [title, setTitle] = useState("");
	const [brand, setBrand] = useState("");
	const [priceInput, setPriceInput] = useState("");
	const [category, setCategory] = useState("");
	const [imageInput, setImageInput] = useState("");
	const [notes, setNotes] = useState("");
	const [sizeOverride, setSizeOverride] = useState<CardSize | null>(null);
	const [confirmDelete, setConfirmDelete] = useState(false);

	const scrollBodyRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (!item) return;
		setRetainedAutoSize(autoSize);
		setTitle(item.title);
		setBrand(item.brand);
		setPriceInput(item.price !== null ? String(item.price) : "");
		setCategory(item.category);
		setImageInput(item.image || "");
		setNotes(item.notes || "");
		setSizeOverride(item.sizeOverride ?? null);
		setIsEditing(false);
		setConfirmDelete(false);
		if (scrollBodyRef.current) {
			scrollBodyRef.current.scrollTop = 0;
		}
	}, [item, autoSize]);

	useEffect(() => {
		if (!item) return;
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Escape") {
				onClose();
			}
		};
		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [item, onClose]);

	if (!activeItem) return null;

	const effectiveAutoSize = item ? autoSize : retainedAutoSize;
	const selectedVariant = activeItem.variants?.find(
		(v) => v.id === activeItem.selectedVariantId,
	);
	const displayImage = selectedVariant?.image || imageInput || activeItem.image;

	const handleSaveFields = async (e: React.FormEvent) => {
		e.preventDefault();
		const parsedPrice = priceInput.trim()
			? Number.parseFloat(priceInput.replace(/[^0-9.]/g, ""))
			: null;
		await onUpdate(activeItem.id, {
			title: title.trim() || activeItem.title,
			brand: brand.trim() || activeItem.brand,
			price:
				parsedPrice !== null && Number.isFinite(parsedPrice)
					? Math.round(parsedPrice * 100) / 100
					: null,
			highPrice: null,
			category: category.trim() || "Curated",
			image: imageInput.trim(),
			notes: notes.trim() ? notes.trim() : null,
			sizeOverride,
		});
		onClose();
	};

	const presetCategories = Array.from(
		new Set([
			"Audio",
			"Tech",
			"Footwear & Apparel",
			"Collectibles",
			"Home & Carry",
			...categories,
		]),
	);

	const sizeTabValue: "auto" | CardSize = sizeOverride ?? "auto";

	return (
		<div
			className={`fixed inset-0 z-50 flex justify-end bg-black/75 backdrop-blur-sm backdrop-transition ${
				isVisible ? "backdrop-open" : "backdrop-closed"
			}`}
			onClick={onClose}
		>
			<aside
				aria-label={`Inspector for ${activeItem.title}`}
				onClick={(e) => e.stopPropagation()}
				className={`relative flex h-full w-full max-w-md flex-col overflow-hidden bg-[#0A0A0C] border-l border-white/[0.1] p-6 sm:p-7 text-[#F7F6F2] sheet-transition ${
					isVisible ? "sheet-open" : "sheet-closed"
				}`}
			>
				{/* Pinned Top Bar (Never scrolls off-screen) */}
				<div className="shrink-0 flex items-center justify-between gap-4 pb-4 border-b border-white/[0.08]">
					<div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-zinc-400 min-w-0">
						<span className="text-[#F7F6F2] truncate">{activeItem.brand}</span>
						<span aria-hidden="true">·</span>
						<span className="truncate">{activeItem.category}</span>
					</div>

					<button
						type="button"
						onClick={onClose}
						aria-label="Close inspector"
						className="rounded-full bg-white/[0.06] px-3 py-1 text-xs font-medium text-zinc-400 hover:bg-white/15 hover:text-white press-scale"
					>
						ESC
					</button>
				</div>

				{/* Scrollable Middle Body with overflow-anchor disabled */}
				<div
					ref={scrollBodyRef}
					className="flex-1 overflow-y-auto overflow-x-hidden no-scrollbar [overflow-anchor:none]"
				>
					{/* Studio Image Well — smoothly compacts when Edit Details is open */}
					<div
						style={{
							height: isEditing ? "132px" : "196px",
							transition: "height 260ms cubic-bezier(0.22, 1, 0.36, 1)",
						}}
						className="relative my-5 flex items-center justify-center rounded-3xl bg-[#121216] p-4 overflow-hidden"
					>
						{displayImage ? (
							<img
								src={displayImage}
								alt={activeItem.title}
								className="max-h-full w-auto object-contain rounded-xl transition-all duration-200 ease-out"
							/>
						) : (
							<div className="text-center">
								<p className="text-2xl font-semibold text-zinc-500 uppercase">
									{activeItem.brand}
								</p>
							</div>
						)}
					</div>

					{/* Title, Price, Notes & Primary Actions */}
					<div className="pb-5 border-b border-white/[0.08]">
						<div className="flex items-baseline justify-between gap-4">
							<h2 className="text-xl font-semibold tracking-tight text-[#F7F6F2]">
								{activeItem.title}
							</h2>
							<span className="text-xl font-semibold tabular whitespace-nowrap text-[#F7F6F2]">
								{formatCurrency(
									activeItem.price,
									activeItem.currency,
									activeItem.highPrice,
								)}
							</span>
						</div>

						{(activeItem.notes || activeItem.description) && (
							<p className="mt-2 text-xs text-zinc-400 leading-relaxed line-clamp-3">
								{activeItem.notes || activeItem.description}
							</p>
						)}

						<div className="mt-4 flex items-center gap-2">
							<a
								href={selectedVariant?.url || activeItem.url}
								target="_blank"
								rel="noopener noreferrer"
								className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-[#F7F6F2] px-4 py-2 text-xs font-semibold uppercase tracking-wider text-black hover:bg-white press-scale"
							>
								<span>Visit {activeItem.domain}</span>
								<span aria-hidden="true">↗</span>
							</a>

							<button
								type="button"
								onClick={() =>
									onUpdate(activeItem.id, {
										status: activeItem.status === "owned" ? "active" : "owned",
									})
								}
								className={`rounded-full px-4 py-2 text-xs font-medium uppercase tracking-wider press-scale shrink-0 ${
									activeItem.status === "owned"
										? "bg-emerald-500/20 text-emerald-300"
										: "bg-white/[0.07] text-zinc-300 hover:bg-white/15"
								}`}
							>
								{activeItem.status === "owned" ? "✓ Acquired" : "Mark Acquired"}
							</button>
						</div>
					</div>

					{/* Compact Configuration Controls with Flush Full-Width Gliding Size Pill */}
					<div className="py-5 space-y-4 border-b border-white/[0.08]">
						{activeItem.variants && activeItem.variants.length > 0 && (
							<label className="flex items-center justify-between gap-4">
								<span className="text-xs font-medium uppercase tracking-wider text-zinc-400 shrink-0">
									Variant ({activeItem.variants.length})
								</span>
								<select
									value={
										activeItem.selectedVariantId || activeItem.variants[0]?.id
									}
									onChange={(e) => {
										const nextId = e.target.value;
										const matched = activeItem.variants?.find(
											(v) => v.id === nextId,
										);
										if (!matched) return;
										if (matched.price !== null) {
											setPriceInput(String(matched.price));
										}
										if (matched.image) {
											setImageInput(matched.image);
										}
										onUpdate(activeItem.id, {
											selectedVariantId: matched.id,
											price: matched.price ?? activeItem.price,
											image: matched.image || activeItem.image,
											sku: matched.sku || activeItem.sku,
										});
									}}
									className="max-w-[230px] truncate rounded-full bg-[#121216] ring-1 ring-inset ring-white/[0.1] px-3.5 py-1.5 text-xs font-medium text-[#F7F6F2] transition-colors duration-200 outline-none focus:ring-white/30"
								>
									{activeItem.variants.map((variant) => (
										<option key={variant.id} value={variant.id}>
											{variant.name}
											{variant.price !== null
												? ` · ${formatCurrency(variant.price, variant.currency)}`
												: ""}
										</option>
									))}
								</select>
							</label>
						)}

						<div className="space-y-2.5">
							<div className="flex items-center justify-between">
								<span className="text-xs font-medium uppercase tracking-wider text-zinc-400">
									Card Size
								</span>
								<span className="text-xs text-zinc-500">
									{sizeOverride === null ? "Dynamic by price" : "Pinned size"}
								</span>
							</div>

							<SlidingPillGroup
								ariaLabel="Card size"
								fullWidth
								value={sizeTabValue}
								onChange={(next) => {
									const nextOverride = next === "auto" ? null : next;
									setSizeOverride(nextOverride);
									onUpdate(activeItem.id, { sizeOverride: nextOverride });
								}}
								containerClassName="rounded-full bg-[#121216] ring-1 ring-inset ring-white/[0.08]"
								buttonClassName="px-2.5 py-1.5 text-xs font-medium"
								options={[
									{
										id: "auto",
										label: `Auto (${CARD_SIZE_LABELS[effectiveAutoSize]})`,
										activePillClassName: "bg-[#F7F6F2]",
										activeTextClassName: "text-black font-semibold",
									},
									{
										id: "small",
										label: "Small",
										activePillClassName: "bg-amber-500/20",
										activeTextClassName: "text-amber-300 font-semibold",
									},
									{
										id: "medium",
										label: "Medium",
										activePillClassName: "bg-amber-500/20",
										activeTextClassName: "text-amber-300 font-semibold",
									},
									{
										id: "large",
										label: "Large",
										activePillClassName: "bg-amber-500/20",
										activeTextClassName: "text-amber-300 font-semibold",
									},
								]}
							/>
						</div>
					</div>

					{/* Frame-Synchronized SmoothCollapse Accordion */}
					<SmoothCollapse isOpen={isEditing} scrollContainerRef={scrollBodyRef}>
						<form
							id="inspector-edit-form"
							onSubmit={handleSaveFields}
							className="py-5 space-y-4"
						>
							<div className="grid grid-cols-2 gap-4">
								<label className="block">
									<span className="text-xs text-zinc-400">Brand</span>
									<input
										type="text"
										value={brand}
										onChange={(e) => setBrand(e.target.value)}
										className="mt-1 w-full border-b border-white/15 bg-transparent py-1.5 text-sm text-[#F7F6F2] transition-colors duration-200 outline-none focus:border-white"
									/>
								</label>

								<label className="block">
									<span className="text-xs text-zinc-400">
										Price ({activeItem.currency || "CAD"})
									</span>
									<input
										type="text"
										inputMode="decimal"
										value={priceInput}
										onChange={(e) => setPriceInput(e.target.value)}
										className="mt-1 w-full border-b border-white/15 bg-transparent py-1.5 text-sm tabular text-[#F7F6F2] transition-colors duration-200 outline-none focus:border-white"
									/>
								</label>
							</div>

							<label className="block">
								<span className="text-xs text-zinc-400">Product Title</span>
								<input
									type="text"
									value={title}
									onChange={(e) => setTitle(e.target.value)}
									className="mt-1 w-full border-b border-white/15 bg-transparent py-1.5 text-sm text-[#F7F6F2] transition-colors duration-200 outline-none focus:border-white"
								/>
							</label>

							<div className="grid grid-cols-2 gap-4">
								<label className="block">
									<span className="text-xs text-zinc-400">Collection</span>
									<select
										value={category}
										onChange={(e) => setCategory(e.target.value)}
										className="mt-1 w-full border-b border-white/15 bg-[#0A0A0C] py-1.5 text-sm text-[#F7F6F2] transition-colors duration-200 outline-none focus:border-white"
									>
										{presetCategories.map((cat) => (
											<option key={cat} value={cat}>
												{cat}
											</option>
										))}
									</select>
								</label>

								<label className="block">
									<span className="text-xs text-zinc-400">Image URL</span>
									<input
										type="url"
										value={imageInput}
										onChange={(e) => setImageInput(e.target.value)}
										className="mt-1 w-full border-b border-white/15 bg-transparent py-1.5 text-sm text-zinc-300 transition-colors duration-200 outline-none focus:border-white"
									/>
								</label>
							</div>

							<label className="block">
								<span className="text-xs text-zinc-400">Notes</span>
								<input
									type="text"
									placeholder="Sizing, finish, or target price…"
									value={notes}
									onChange={(e) => setNotes(e.target.value)}
									className="mt-1 w-full border-b border-white/15 bg-transparent py-1.5 text-sm text-[#F7F6F2] transition-colors duration-200 outline-none focus:border-white"
								/>
							</label>
						</form>
					</SmoothCollapse>
				</div>

				{/* Pinned Bottom Footer Action Bar */}
				<div className="shrink-0 pt-4 border-t border-white/[0.08] flex items-center justify-between gap-3 bg-[#0A0A0C]">
					{/* Left: Smooth Delete <-> Confirm + Cancel Stack */}
					<div className="grid items-center justify-items-start [grid-template-areas:'left-stack']">
						<div
							style={{
								opacity: confirmDelete ? 1 : 0,
								transform: confirmDelete
									? "translate3d(0, 0, 0) scale(1)"
									: "translate3d(-6px, 0, 0) scale(0.95)",
								transition:
									"opacity 200ms cubic-bezier(0.22, 1, 0.36, 1), transform 200ms cubic-bezier(0.22, 1, 0.36, 1)",
							}}
							className={`[grid-area:left-stack] flex items-center gap-1.5 ${
								confirmDelete ? "" : "pointer-events-none"
							}`}
						>
							<button
								type="button"
								onClick={() => onDelete(activeItem.id)}
								className="rounded-full bg-rose-500 px-3.5 py-1.5 text-xs font-semibold text-white press-scale whitespace-nowrap"
							>
								Confirm
							</button>
							<button
								type="button"
								onClick={() => setConfirmDelete(false)}
								className="rounded-full bg-white/[0.06] px-3 py-1.5 text-xs text-zinc-400 hover:text-white press-scale whitespace-nowrap"
							>
								Cancel
							</button>
						</div>

						<div
							style={{
								opacity: confirmDelete ? 0 : 1,
								transform: confirmDelete
									? "translate3d(6px, 0, 0) scale(0.95)"
									: "translate3d(0, 0, 0) scale(1)",
								transition:
									"opacity 200ms cubic-bezier(0.22, 1, 0.36, 1), transform 200ms cubic-bezier(0.22, 1, 0.36, 1)",
							}}
							className={`[grid-area:left-stack] ${
								confirmDelete ? "pointer-events-none" : ""
							}`}
						>
							<button
								type="button"
								onClick={() => setConfirmDelete(true)}
								className="rounded-full bg-rose-500/10 px-3.5 py-1.5 text-xs font-medium text-rose-300 hover:bg-rose-500/20 press-scale whitespace-nowrap"
							>
								Remove
							</button>
						</div>
					</div>

					{/* Right: Smooth Edit Details <-> Cancel + Save Changes Stack */}
					<div className="grid items-center justify-items-end [grid-template-areas:'right-stack']">
						<div
							style={{
								opacity: isEditing ? 1 : 0,
								transform: isEditing
									? "translate3d(0, 0, 0) scale(1)"
									: "translate3d(6px, 0, 0) scale(0.95)",
								transition:
									"opacity 200ms cubic-bezier(0.22, 1, 0.36, 1), transform 200ms cubic-bezier(0.22, 1, 0.36, 1)",
							}}
							className={`[grid-area:right-stack] flex items-center gap-2 ${
								isEditing ? "" : "pointer-events-none"
							}`}
						>
							<button
								type="button"
								onClick={() => setIsEditing(false)}
								className="rounded-full bg-white/[0.06] px-3.5 py-1.5 text-xs font-medium text-zinc-400 hover:text-zinc-200 press-scale whitespace-nowrap"
							>
								Cancel
							</button>
							<button
								type="submit"
								form="inspector-edit-form"
								className="rounded-full bg-[#F7F6F2] px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-black hover:bg-white press-scale whitespace-nowrap"
							>
								Save Changes
							</button>
						</div>

						<div
							style={{
								opacity: isEditing ? 0 : 1,
								transform: isEditing
									? "translate3d(-6px, 0, 0) scale(0.95)"
									: "translate3d(0, 0, 0) scale(1)",
								transition:
									"opacity 200ms cubic-bezier(0.22, 1, 0.36, 1), transform 200ms cubic-bezier(0.22, 1, 0.36, 1)",
							}}
							className={`[grid-area:right-stack] ${
								isEditing ? "pointer-events-none" : ""
							}`}
						>
							<button
								type="button"
								onClick={() => setIsEditing(true)}
								className="rounded-full bg-white/[0.07] px-4 py-1.5 text-xs font-medium text-zinc-200 hover:bg-white/15 press-scale whitespace-nowrap"
							>
								Edit Details
							</button>
						</div>
					</div>
				</div>
			</aside>
		</div>
	);
}
