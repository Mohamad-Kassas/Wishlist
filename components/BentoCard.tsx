"use client";

import { useState } from "react";
import { formatCurrency } from "@/lib/format";
import type { CardSize, WishlistItem } from "@/lib/types";

interface BentoCardProps {
	item: WishlistItem;
	size: CardSize;
	onSelect: (item: WishlistItem) => void;
}

export function BentoCard({ item, size, onSelect }: BentoCardProps) {
	const [imgError, setImgError] = useState(false);

	const isLarge = size === "large";
	const isMedium = size === "medium";

	// Mobile (2-col grid) + Desktop (4-col grid) Bento spans:
	// - Large: 2 cols wide × 2 rows tall on both mobile and desktop
	// - Medium: 2 cols wide × 1 row tall (full-width banner on mobile, half-width on desktop)
	// - Small: 1 col wide × 1 row tall (fits 2 side-by-side on mobile, 4 across on desktop)
	const spanClasses = isLarge
		? "col-span-2 row-span-2 min-h-[250px] sm:min-h-[360px] lg:min-h-[468px] p-4 sm:p-5"
		: isMedium
			? "col-span-2 row-span-1 min-h-[148px] sm:min-h-[204px] lg:min-h-[224px] p-4 sm:p-5"
			: "col-span-1 row-span-1 min-h-[164px] sm:min-h-[210px] lg:min-h-[224px] p-3.5 sm:p-5";

	const selectedVariant = item.variants?.find(
		(v) => v.id === item.selectedVariantId,
	);
	const displayImage = selectedVariant?.image || item.image;
	const hasValidImage = Boolean(displayImage && !imgError);

	return (
		<article
			data-flip-id={item.id}
			onClick={() => onSelect(item)}
			onKeyDown={(e) => {
				if (e.key === "Enter" || e.key === " ") {
					e.preventDefault();
					onSelect(item);
				}
			}}
			tabIndex={0}
			role="button"
			aria-label={`${item.brand} ${item.title}`}
			className={`group relative flex flex-col justify-between overflow-hidden rounded-3xl bg-[#0A0A0C] border border-white/[0.08] text-left outline-none focus-visible:border-white/40 card-interactive press-scale cursor-pointer ${spanClasses}`}
		>
			{/* Ambient radial spotlight behind product photography */}
			<div
				aria-hidden="true"
				className={`pointer-events-none absolute inset-0 transition-opacity duration-200 ${
					isLarge
						? "bg-[radial-gradient(circle_at_50%_44%,rgba(245,158,11,0.11),rgba(22,22,27,0.55)_55%,transparent_80%)]"
						: isMedium
							? "bg-[radial-gradient(circle_at_72%_50%,rgba(255,255,255,0.07),rgba(22,22,27,0.45)_55%,transparent_80%)]"
							: "bg-[radial-gradient(circle_at_50%_44%,rgba(255,255,255,0.06),transparent_70%)]"
				}`}
			/>

			{/* Top Row: Clean Brand · Category Eyebrow */}
			<div className="relative z-10 flex items-center justify-between gap-1.5">
				<div className="flex items-center gap-1.5 min-w-0 truncate text-xs font-medium uppercase tracking-wider text-zinc-400">
					<span className="truncate text-[#F7F6F2]">{item.brand}</span>
					<span
						aria-hidden="true"
						className={`text-zinc-600 ${!isLarge && !isMedium ? "hidden sm:inline" : ""}`}
					>
						·
					</span>
					<span
						className={`truncate ${!isLarge && !isMedium ? "hidden sm:inline" : ""}`}
					>
						{item.category}
					</span>
				</div>

				{selectedVariant && (isLarge || isMedium) && (
					<span className="text-xs text-zinc-500 truncate max-w-[130px]">
						{selectedVariant.name}
					</span>
				)}
			</div>

			{/* Center & Bottom Layout: Horizontal architectural split for Medium cards; Vertical showcase for Large & Small */}
			{isMedium ? (
				<div className="relative z-10 mt-2 sm:mt-3 flex flex-1 items-center justify-between gap-3 sm:gap-5">
					<div className="flex flex-1 flex-col justify-between h-full min-w-0 pt-1 sm:pt-2">
						<div>
							<h3 className="text-base sm:text-xl font-medium tracking-tight text-[#F7F6F2] line-clamp-2">
								{item.title}
							</h3>
							{item.notes && (
								<p className="mt-1 hidden sm:block text-xs text-zinc-400 line-clamp-1">
									{item.notes}
								</p>
							)}
						</div>

						<div className="mt-2 sm:mt-4 pt-2 sm:pt-2.5 border-t border-white/[0.06]">
							<span className="text-base sm:text-xl font-semibold tracking-tight tabular whitespace-nowrap text-[#F7F6F2]">
								{item.price === null
									? "Set price +"
									: formatCurrency(item.price, item.currency, item.highPrice)}
							</span>
						</div>
					</div>

					<div className="flex h-[104px] w-[124px] sm:h-[136px] sm:w-[172px] shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-white/[0.03] p-2">
						{hasValidImage ? (
							<img
								src={displayImage}
								alt={item.title}
								loading="lazy"
								onError={() => setImgError(true)}
								className="max-h-full max-w-full object-contain rounded-xl transition-transform duration-200 ease-out group-hover:scale-[1.04]"
							/>
						) : (
							<span className="text-xl font-semibold text-zinc-500 uppercase">
								{item.brand.slice(0, 2)}
							</span>
						)}
					</div>
				</div>
			) : (
				<>
					{/* Studio Image Area */}
					<div className="relative z-10 my-1.5 sm:my-2 flex flex-1 items-center justify-center overflow-hidden">
						{hasValidImage ? (
							<img
								src={displayImage}
								alt={item.title}
								loading="lazy"
								onError={() => setImgError(true)}
								className={`object-contain transition-transform duration-200 ease-out group-hover:scale-[1.03] rounded-2xl ${
									isLarge
										? "max-h-[190px] sm:max-h-[275px] w-auto max-w-[88%]"
										: "max-h-[82px] sm:max-h-[104px] w-auto max-w-[84%]"
								}`}
							/>
						) : (
							<div className="flex flex-col items-center justify-center text-center select-none py-2">
								<span className="text-xl font-semibold tracking-tight text-zinc-500 uppercase">
									{item.brand.slice(0, 2)}
								</span>
								<span className="mt-0.5 text-xs uppercase tracking-wider text-zinc-600">
									{item.domain}
								</span>
							</div>
						)}
					</div>

					{/* Footer: Title + Tabular Price */}
					{isLarge ? (
						<div className="relative z-10 flex items-end justify-between gap-3 pt-2.5 sm:pt-3 border-t border-white/[0.06]">
							<div className="min-w-0 flex-1">
								<h3 className="text-base sm:text-xl font-medium tracking-tight text-[#F7F6F2] line-clamp-1">
									{item.title}
								</h3>
								{item.notes && (
									<p className="mt-0.5 text-xs text-zinc-400 line-clamp-1">
										{item.notes}
									</p>
								)}
							</div>

							<span className="text-base sm:text-xl font-semibold tracking-tight tabular whitespace-nowrap text-[#F7F6F2] shrink-0">
								{item.price === null
									? "Set price +"
									: formatCurrency(item.price, item.currency, item.highPrice)}
							</span>
						</div>
					) : (
						<div className="relative z-10 pt-2 border-t border-white/[0.06] space-y-0.5">
							<h3 className="text-xs sm:text-base font-medium tracking-tight text-[#F7F6F2] truncate">
								{item.title}
							</h3>

							<span
								className={`block font-semibold tracking-tight tabular whitespace-nowrap ${
									item.price === null
										? "text-xs uppercase tracking-wider text-amber-300/90"
										: "text-xs sm:text-base text-zinc-300"
								}`}
							>
								{item.price === null
									? "Set price +"
									: formatCurrency(item.price, item.currency, item.highPrice)}
							</span>
						</div>
					)}
				</>
			)}
		</article>
	);
}

export function BentoSkeletonCard({ domain }: { domain: string }) {
	return (
		<div
			aria-busy="true"
			aria-label={`Curating item from ${domain}`}
			className="col-span-1 row-span-1 relative flex flex-col justify-between overflow-hidden rounded-3xl bg-[#0A0A0C] border border-white/[0.12] p-3.5 sm:p-5 min-h-[178px] sm:min-h-[224px]"
		>
			<div className="flex items-center justify-between gap-2">
				<span className="text-xs font-medium uppercase tracking-wider text-amber-300/90 truncate">
					Curating · {domain}
				</span>
			</div>

			<div className="my-3 flex flex-1 items-center justify-center">
				<div className="h-20 w-20 rounded-3xl bg-white/[0.04] animate-pulse" />
			</div>

			<div className="space-y-1.5 pt-2 border-t border-white/[0.06]">
				<div className="h-3.5 w-3/4 rounded-full bg-white/[0.07] animate-pulse" />
				<div className="h-3.5 w-1/3 rounded-full bg-white/[0.05] animate-pulse" />
			</div>
		</div>
	);
}
