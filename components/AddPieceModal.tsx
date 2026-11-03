"use client";

import { useEffect, useRef, useState } from "react";
import {
	SlidingPillGroup,
	SmoothHeight,
	useAnimatedPresence,
} from "@/components/AnimatedUI";

interface AddPieceModalProps {
	isOpen: boolean;
	initialUrl?: string;
	initialError?: string | null;
	categories: string[];
	onClose: () => void;
	onScrapeUrl: (url: string) => Promise<void>;
	onCreateManual: (payload: {
		url: string;
		brand: string;
		title: string;
		price: string;
		category: string;
		image: string;
		notes: string;
	}) => Promise<void>;
}

export function AddPieceModal({
	isOpen,
	initialUrl = "",
	initialError = null,
	categories,
	onClose,
	onScrapeUrl,
	onCreateManual,
}: AddPieceModalProps) {
	const { shouldRender, isVisible } = useAnimatedPresence(isOpen, 220);

	const [mode, setMode] = useState<"url" | "manual">("url");
	const [urlInput, setUrlInput] = useState(initialUrl);
	const [brand, setBrand] = useState("");
	const [title, setTitle] = useState("");
	const [price, setPrice] = useState("");
	const [category, setCategory] = useState("Tech");
	const [image, setImage] = useState("");
	const [notes, setNotes] = useState("");
	const [error, setError] = useState<string | null>(initialError);

	const urlRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		if (!isOpen) return;
		setUrlInput(initialUrl);
		setError(initialError);
		setMode(initialError ? "manual" : "url");
		const t = setTimeout(() => {
			urlRef.current?.focus();
		}, 40);
		return () => clearTimeout(t);
	}, [isOpen, initialUrl, initialError]);

	useEffect(() => {
		if (!isOpen) return;
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Escape") {
				onClose();
			}
		};
		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [isOpen, onClose]);

	if (!shouldRender) return null;

	const collectionOptions = Array.from(
		new Set([
			"Tech",
			"Audio",
			"Home & Carry",
			"Footwear & Apparel",
			"Collectibles",
			...categories,
		]),
	);

	const handleUrlSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!urlInput.trim()) return;
		await onScrapeUrl(urlInput.trim());
	};

	const handleManualSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!title.trim()) return;
		await onCreateManual({
			url: urlInput.trim() || "https://example.com",
			brand: brand.trim() || "Curated",
			title: title.trim(),
			price: price.trim(),
			category: category.trim() || "Curated",
			image: image.trim(),
			notes: notes.trim(),
		});
	};

	return (
		<div
			role="dialog"
			aria-modal="true"
			aria-label="Add piece to gallery"
			onClick={onClose}
			className={`fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm backdrop-transition ${
				isVisible ? "backdrop-open" : "backdrop-closed"
			}`}
		>
			<div
				onClick={(e) => e.stopPropagation()}
				className={`w-full max-w-lg rounded-3xl bg-[#0A0A0C] border border-white/[0.12] p-6 sm:p-7 text-[#F7F6F2] shadow-2xl modal-transition ${
					isVisible ? "modal-open" : "modal-closed"
				}`}
			>
				{/* Modal Header with Flush Gliding Pill Switcher */}
				<div className="flex items-center justify-between gap-4 pb-5 border-b border-white/[0.08]">
					<SlidingPillGroup
						ariaLabel="Entry mode"
						value={mode}
						onChange={setMode}
						containerClassName="rounded-full bg-[#121216] ring-1 ring-inset ring-white/[0.08]"
						buttonClassName="px-4 py-1.5 text-xs font-medium"
						options={[
							{ id: "url", label: "Paste Link" },
							{ id: "manual", label: "Manual Entry" },
						]}
					/>

					<button
						type="button"
						onClick={onClose}
						aria-label="Close modal"
						className="rounded-full bg-white/[0.06] px-3 py-1 text-xs font-medium text-zinc-400 hover:bg-white/15 hover:text-white press-scale"
					>
						ESC
					</button>
				</div>

				{error && (
					<p className="mt-4 text-xs text-rose-300">
						{error} — You can enter the details manually below.
					</p>
				)}

				{/* Smooth Height Morphing + Crossfade Between "Paste Link" and "Manual Entry" */}
				<SmoothHeight className="mt-5">
					<div className="relative">
						{mode === "url" ? (
							<form
								key="url-form"
								onSubmit={handleUrlSubmit}
								className="space-y-6 animate-[fadeIn_200ms_cubic-bezier(0.22,1,0.36,1)]"
							>
								<label className="block">
									<span className="block text-xs font-medium uppercase tracking-wider text-zinc-400">
										Product URL
									</span>
									<input
										ref={urlRef}
										type="text"
										required
										value={urlInput}
										onChange={(e) => {
											setUrlInput(e.target.value);
											if (error) setError(null);
										}}
										placeholder="https://www.apple.com/ca/shop/..."
										className="mt-2 w-full border-b border-white/20 bg-transparent py-2.5 text-base text-[#F7F6F2] placeholder:text-zinc-600 transition-colors duration-200 outline-none focus:border-white"
									/>
									<span className="mt-2 block text-xs text-zinc-500">
										Automatically extracts title, brand, imagery, variants, and
										price—and sizes the card dynamically.
									</span>
								</label>

								<div className="flex items-center justify-end gap-2.5 pt-2">
									<button
										type="button"
										onClick={onClose}
										className="rounded-full bg-white/[0.06] px-4 py-2 text-xs font-medium text-zinc-300 hover:bg-white/15 press-scale"
									>
										Cancel
									</button>
									<button
										type="submit"
										className="rounded-full bg-[#F7F6F2] px-5 py-2 text-xs font-semibold uppercase tracking-wider text-black hover:bg-white press-scale"
									>
										Curate Piece ↵
									</button>
								</div>
							</form>
						) : (
							<form
								key="manual-form"
								onSubmit={handleManualSubmit}
								className="space-y-4 animate-[fadeIn_200ms_cubic-bezier(0.22,1,0.36,1)]"
							>
								<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
									<label className="block">
										<span className="text-xs text-zinc-400">Brand</span>
										<input
											type="text"
											required
											placeholder="e.g. Leica"
											value={brand}
											onChange={(e) => setBrand(e.target.value)}
											className="mt-1 w-full border-b border-white/15 bg-transparent py-1.5 text-sm text-[#F7F6F2] transition-colors duration-200 outline-none focus:border-white"
										/>
									</label>

									<label className="block">
										<span className="text-xs text-zinc-400">Price (CAD)</span>
										<input
											type="text"
											inputMode="decimal"
											placeholder="e.g. 6895.00"
											value={price}
											onChange={(e) => setPrice(e.target.value)}
											className="mt-1 w-full border-b border-white/15 bg-transparent py-1.5 text-sm tabular text-[#F7F6F2] transition-colors duration-200 outline-none focus:border-white"
										/>
									</label>
								</div>

								<label className="block">
									<span className="text-xs text-zinc-400">Product Title</span>
									<input
										type="text"
										required
										placeholder="e.g. Leica Q3 43 Full-Frame Compact Camera"
										value={title}
										onChange={(e) => setTitle(e.target.value)}
										className="mt-1 w-full border-b border-white/15 bg-transparent py-1.5 text-sm text-[#F7F6F2] transition-colors duration-200 outline-none focus:border-white"
									/>
								</label>

								<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
									<label className="block">
										<span className="text-xs text-zinc-400">Collection</span>
										<select
											value={category}
											onChange={(e) => setCategory(e.target.value)}
											className="mt-1 w-full border-b border-white/15 bg-[#0A0A0C] py-1.5 text-sm text-[#F7F6F2] transition-colors duration-200 outline-none focus:border-white"
										>
											{collectionOptions.map((cat) => (
												<option key={cat} value={cat}>
													{cat}
												</option>
											))}
										</select>
									</label>

									<label className="block">
										<span className="text-xs text-zinc-400">Product URL</span>
										<input
											type="text"
											placeholder="https://..."
											value={urlInput}
											onChange={(e) => setUrlInput(e.target.value)}
											className="mt-1 w-full border-b border-white/15 bg-transparent py-1.5 text-sm text-[#F7F6F2] transition-colors duration-200 outline-none focus:border-white"
										/>
									</label>
								</div>

								<label className="block">
									<span className="text-xs text-zinc-400">Image URL</span>
									<input
										type="url"
										placeholder="https://..."
										value={image}
										onChange={(e) => setImage(e.target.value)}
										className="mt-1 w-full border-b border-white/15 bg-transparent py-1.5 text-sm text-[#F7F6F2] transition-colors duration-200 outline-none focus:border-white"
									/>
								</label>

								<label className="block">
									<span className="text-xs text-zinc-400">
										Notes (Optional)
									</span>
									<input
										type="text"
										placeholder="Finish, sizing, or target price…"
										value={notes}
										onChange={(e) => setNotes(e.target.value)}
										className="mt-1 w-full border-b border-white/15 bg-transparent py-1.5 text-sm text-[#F7F6F2] transition-colors duration-200 outline-none focus:border-white"
									/>
								</label>

								<div className="flex items-center justify-end gap-2.5 pt-3">
									<button
										type="button"
										onClick={onClose}
										className="rounded-full bg-white/[0.06] px-4 py-2 text-xs font-medium text-zinc-300 hover:bg-white/15 press-scale"
									>
										Cancel
									</button>
									<button
										type="submit"
										className="rounded-full bg-[#F7F6F2] px-5 py-2 text-xs font-semibold uppercase tracking-wider text-black hover:bg-white press-scale"
									>
										Add Piece
									</button>
								</div>
							</form>
						)}
					</div>
				</SmoothHeight>
			</div>
		</div>
	);
}
