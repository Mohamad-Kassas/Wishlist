import chromium from "@sparticuz/chromium";
import { chromium as playwright } from "playwright-core";
import type { ProductVariant, ScrapedProductResult } from "./types";

const USER_AGENT =
	"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const KNOWN_BRANDS: Record<string, string> = {
	"apple.com": "Apple",
	"kef.com": "KEF",
	"ca.kef.com": "KEF",
	"us.kef.com": "KEF",
	"nike.com": "Nike",
	"lego.com": "LEGO",
	"bestbuy.ca": "Best Buy",
	"bestbuy.com": "Best Buy",
	"allbirds.ca": "Allbirds",
	"allbirds.com": "Allbirds",
	"owalalife.com": "Owala",
	"store.google.com": "Google",
	"amazon.ca": "Amazon",
	"amazon.com": "Amazon",
	"ssense.com": "SSENSE",
	"endclothing.com": "END.",
};

export function extractDomain(rawUrl: string): string {
	try {
		const parsed = new URL(rawUrl);
		return parsed.hostname.replace(/^www\./i, "").toLowerCase();
	} catch {
		return "unknown";
	}
}

export function inferBrandFromDomain(domain: string): string {
	if (KNOWN_BRANDS[domain]) return KNOWN_BRANDS[domain];
	for (const [key, brand] of Object.entries(KNOWN_BRANDS)) {
		if (domain.endsWith(`.${key}`) || domain === key) {
			return brand;
		}
	}
	const parts = domain.split(".");
	const main = parts.length >= 2 ? parts[parts.length - 2] : parts[0];
	return main ? main.charAt(0).toUpperCase() + main.slice(1) : "Curated";
}

export function inferCategory(input: {
	title?: string;
	brand?: string;
	rawCategory?: string;
	description?: string;
	domain?: string;
}): string {
	const corpus = [
		input.rawCategory,
		input.title,
		input.brand,
		input.description,
		input.domain,
	]
		.filter(Boolean)
		.join(" ")
		.toLowerCase();

	if (
		/\b(speaker|audio|headphone|earbud|kef|sonos|amp|dac|turntable|subwoofer|hifi|hi-fi)\b/.test(
			corpus,
		)
	) {
		return "Audio";
	}
	if (
		/\b(shoe|sneaker|clog|boot|air force|jordan|allbirds|apparel|jacket|hoodie|shirt|runner|footwear)\b/.test(
			corpus,
		)
	) {
		return "Footwear & Apparel";
	}
	if (
		/\b(lego|trophy|collectible|figurine|art|vinyl|book|edition|set)\b/.test(
			corpus,
		)
	) {
		return "Collectibles";
	}
	if (
		/\b(watch|iphone|macbook|ipad|pixel|galaxy|laptop|monitor|camera|keyboard|mouse|gpu|console|smartwatch|apple|samsung|google)\b/.test(
			corpus,
		)
	) {
		return "Tech";
	}
	if (
		/\b(bottle|tumbler|owala|mug|chair|desk|lamp|sofa|espresso|coffee|kitchen|home)\b/.test(
			corpus,
		)
	) {
		return "Home & Carry";
	}
	return "Curated";
}

function parseNumericPrice(val: unknown): number | null {
	if (typeof val === "number" && Number.isFinite(val) && val > 0) {
		return Math.round(val * 100) / 100;
	}
	if (typeof val === "string") {
		const cleaned = val.replace(/[^0-9.]/g, "");
		if (!cleaned) return null;
		const num = Number.parseFloat(cleaned);
		return Number.isFinite(num) && num > 0 ? Math.round(num * 100) / 100 : null;
	}
	return null;
}

function normalizeImageUrl(raw: unknown, baseUrl?: string): string {
	if (!raw) return "";
	if (Array.isArray(raw)) {
		for (const item of raw) {
			const res = normalizeImageUrl(item, baseUrl);
			if (res) return res;
		}
		return "";
	}
	if (typeof raw === "object" && raw !== null) {
		const obj = raw as Record<string, unknown>;
		return normalizeImageUrl(obj.url || obj.contentUrl || obj.src, baseUrl);
	}
	if (typeof raw === "string") {
		let str = raw.trim().replace(/\\\//g, "/");
		if (!str || str === "Unknown Image") return "";
		if (str.startsWith("//")) {
			str = `https:${str}`;
		} else if (str.startsWith("/") && baseUrl) {
			try {
				str = new URL(str, baseUrl).toString();
			} catch {
				// ignore invalid base
			}
		}
		return str;
	}
	return "";
}

function normalizeImageList(raw: unknown, baseUrl?: string): string[] {
	const results: string[] = [];
	const seen = new Set<string>();
	const add = (val: unknown) => {
		const url = normalizeImageUrl(val, baseUrl);
		if (url && !seen.has(url)) {
			seen.add(url);
			results.push(url);
		}
	};

	if (Array.isArray(raw)) {
		for (const item of raw) add(item);
	} else {
		add(raw);
	}
	return results;
}

function cleanText(val: unknown): string {
	if (typeof val !== "string") return "";
	return val
		.replace(/&nbsp;/gi, " ")
		.replace(/&amp;/gi, "&")
		.replace(/&quot;/gi, '"')
		.replace(/&#39;/gi, "'")
		.replace(/\s+/g, " ")
		.trim();
}

function extractBrandName(rawBrand: unknown, fallbackDomain: string): string {
	if (typeof rawBrand === "string" && rawBrand.trim()) {
		return cleanText(rawBrand);
	}
	if (Array.isArray(rawBrand) && rawBrand.length > 0) {
		return extractBrandName(rawBrand[0], fallbackDomain);
	}
	if (typeof rawBrand === "object" && rawBrand !== null) {
		const obj = rawBrand as Record<string, unknown>;
		if (typeof obj.name === "string" && obj.name.trim()) {
			return cleanText(obj.name);
		}
	}
	return inferBrandFromDomain(fallbackDomain);
}

interface ParsedOffer {
	price: number | null;
	highPrice: number | null;
	currency: string;
	inStock: boolean;
	url?: string;
}

function extractOfferData(rawOffers: unknown): ParsedOffer {
	const defaultOffer: ParsedOffer = {
		price: null,
		highPrice: null,
		currency: "CAD",
		inStock: true,
	};

	if (!rawOffers) return defaultOffer;

	const offersList = Array.isArray(rawOffers) ? rawOffers : [rawOffers];
	for (const offerItem of offersList) {
		if (!offerItem || typeof offerItem !== "object") continue;
		const offer = offerItem as Record<string, unknown>;

		const currency =
			(typeof offer.priceCurrency === "string" && offer.priceCurrency) || "CAD";

		let price = parseNumericPrice(offer.price ?? offer.lowPrice);
		const highPrice = parseNumericPrice(offer.highPrice);

		if (price === null && Array.isArray(offer.priceSpecification)) {
			for (const spec of offer.priceSpecification) {
				if (spec && typeof spec === "object") {
					const s = spec as Record<string, unknown>;
					price = parseNumericPrice(s.price ?? s.minPrice);
					if (price !== null) break;
				}
			}
		}

		const availabilityStr = String(offer.availability || "");
		const inStock = !/OutOfStock|SoldOut|Discontinued/i.test(availabilityStr);

		if (price !== null || highPrice !== null) {
			return {
				price,
				highPrice: highPrice && highPrice !== price ? highPrice : null,
				currency,
				inStock,
				url: typeof offer.url === "string" ? offer.url : undefined,
			};
		}
	}

	return defaultOffer;
}

/**
 * Flatten arbitrary JSON-LD blocks (handling arrays, @graph, ProductGroup, Product, BreadcrumbList)
 */
export function parseJsonLdBlocks(
	jsonBlocks: unknown[],
	pageUrl: string,
): Partial<ScrapedProductResult> {
	const domain = extractDomain(pageUrl);
	const nodes: Record<string, unknown>[] = [];

	const collectNodes = (item: unknown) => {
		if (!item) return;
		if (Array.isArray(item)) {
			for (const sub of item) collectNodes(sub);
			return;
		}
		if (typeof item === "object") {
			const obj = item as Record<string, unknown>;
			nodes.push(obj);
			if (Array.isArray(obj["@graph"])) {
				collectNodes(obj["@graph"]);
			}
		}
	};

	for (const block of jsonBlocks) {
		collectNodes(block);
	}

	const hasType = (node: Record<string, unknown>, target: string) => {
		const t = node["@type"];
		if (typeof t === "string") return t.toLowerCase() === target.toLowerCase();
		if (Array.isArray(t)) {
			return t.some(
				(x) =>
					typeof x === "string" && x.toLowerCase() === target.toLowerCase(),
			);
		}
		return false;
	};

	// Extract breadcrumb category hint if present
	let breadcrumbCategory = "";
	const breadcrumbNode = nodes.find((n) => hasType(n, "BreadcrumbList"));
	if (breadcrumbNode && Array.isArray(breadcrumbNode.itemListElement)) {
		const crumbs = breadcrumbNode.itemListElement
			.flat()
			.map((el) => {
				if (!el || typeof el !== "object") return "";
				const e = el as Record<string, unknown>;
				if (typeof e.name === "string") return e.name;
				if (e.item && typeof e.item === "object") {
					const inner = e.item as Record<string, unknown>;
					if (typeof inner.name === "string") return inner.name;
				}
				return "";
			})
			.filter(
				(name) =>
					name && !/^(home|products|shop|product details)$/i.test(name.trim()),
			);
		if (crumbs.length > 0) {
			breadcrumbCategory = crumbs.join(" ");
		}
	}

	const productGroupNode = nodes.find((n) => hasType(n, "ProductGroup"));
	const productNode = nodes.find((n) => hasType(n, "Product"));
	const orgNode = nodes.find((n) => hasType(n, "Organization"));

	const primaryNode = productGroupNode || productNode;
	if (!primaryNode) {
		const orgBrand = orgNode
			? extractBrandName(orgNode.name, domain)
			: inferBrandFromDomain(domain);
		return {
			brand: orgBrand,
			category: breadcrumbCategory
				? inferCategory({ rawCategory: breadcrumbCategory, brand: orgBrand })
				: undefined,
		};
	}

	const title = cleanText(primaryNode.name);
	const description = cleanText(primaryNode.description);
	const brand = extractBrandName(
		primaryNode.brand || primaryNode.manufacturer || orgNode?.name,
		domain,
	);
	const gallery = normalizeImageList(primaryNode.image, pageUrl);
	const sku =
		typeof primaryNode.sku === "string"
			? primaryNode.sku
			: typeof primaryNode.productGroupID === "string"
				? primaryNode.productGroupID
				: undefined;

	// Rating
	let rating: number | null = null;
	let reviewCount: number | null = null;
	if (
		primaryNode.aggregateRating &&
		typeof primaryNode.aggregateRating === "object"
	) {
		const agg = primaryNode.aggregateRating as Record<string, unknown>;
		rating = parseNumericPrice(agg.ratingValue);
		reviewCount = parseNumericPrice(agg.reviewCount ?? agg.ratingCount);
	}

	// Variants (for ProductGroup like KEF / Nike)
	const variants: ProductVariant[] = [];
	if (Array.isArray(primaryNode.hasVariant)) {
		for (let i = 0; i < primaryNode.hasVariant.length; i++) {
			const rawVar = primaryNode.hasVariant[i];
			if (!rawVar || typeof rawVar !== "object") continue;
			const v = rawVar as Record<string, unknown>;
			// Skip bare URL pointers without name or offers
			if (!v.name && !v.offers) continue;

			const offerData = extractOfferData(v.offers);
			const varImage = normalizeImageUrl(v.image, pageUrl);
			if (varImage && !gallery.includes(varImage)) {
				gallery.push(varImage);
			}

			const color =
				typeof v.color === "string" ? cleanText(v.color) : undefined;
			const size = typeof v.size === "string" ? cleanText(v.size) : undefined;
			const rawVarName = cleanText(v.name);

			// Build a concise variant label
			let displayLabel = rawVarName || `Option ${i + 1}`;
			if (title && displayLabel.startsWith(title)) {
				const stripped = displayLabel
					.slice(title.length)
					.replace(/^[\s\-–—·]+/, "")
					.trim();
				if (stripped) displayLabel = stripped;
			}
			if (size && color && !displayLabel.includes(size)) {
				displayLabel = `${color} · Size ${size}`;
			} else if (
				size &&
				displayLabel === rawVarName &&
				rawVarName.length > 36
			) {
				displayLabel = color ? `${color} · Size ${size}` : `Size ${size}`;
			}

			variants.push({
				id: String(v.sku || v.mpn || v["@id"] || `variant-${i}`),
				name: displayLabel,
				color,
				size,
				price: offerData.price,
				currency: offerData.currency,
				image: varImage || gallery[0] || undefined,
				sku: typeof v.sku === "string" ? v.sku : String(v.mpn || ""),
				url: offerData.url || (typeof v.url === "string" ? v.url : undefined),
				inStock: offerData.inStock,
			});
		}
	}

	const directOffer = extractOfferData(primaryNode.offers);
	const firstVariantWithPrice = variants.find((v) => v.price !== null);
	const resolvedPrice =
		directOffer.price ?? firstVariantWithPrice?.price ?? null;
	const resolvedCurrency =
		directOffer.price !== null
			? directOffer.currency
			: firstVariantWithPrice?.currency || directOffer.currency || "CAD";
	const resolvedImage = gallery[0] || firstVariantWithPrice?.image || "";

	const rawCategory =
		typeof primaryNode.category === "string"
			? primaryNode.category
			: breadcrumbCategory;

	return {
		title: title || undefined,
		brand,
		description: description || undefined,
		image: resolvedImage || undefined,
		gallery,
		price: resolvedPrice,
		highPrice: directOffer.highPrice,
		currency: resolvedCurrency,
		category: inferCategory({
			title,
			brand,
			rawCategory,
			description,
			domain,
		}),
		sku,
		inStock: directOffer.inStock,
		rating,
		reviewCount,
		variants,
		selectedVariantId: variants[0]?.id,
	};
}

/**
 * Extract JSON-LD, OpenGraph, and fallback price metadata from raw HTML string
 */
export function parseHtmlMetadata(
	html: string,
	pageUrl: string,
): Partial<ScrapedProductResult> {
	const jsonBlocks: unknown[] = [];
	const ldRegex =
		/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
	let match: RegExpExecArray | null = ldRegex.exec(html);
	while (match !== null) {
		const rawJson = match[1]?.trim();
		if (rawJson) {
			try {
				jsonBlocks.push(JSON.parse(rawJson));
			} catch {
				// Some sites have trailing commas or unescaped newlines in ld+json
				try {
					const sanitized = rawJson.replace(/[\r\n\t]+/g, " ");
					jsonBlocks.push(JSON.parse(sanitized));
				} catch {
					// ignore malformed block
				}
			}
		}
		match = ldRegex.exec(html);
	}

	const ldResult = parseJsonLdBlocks(jsonBlocks, pageUrl);

	const getMetaContent = (attrName: string, attrValue: string): string => {
		const pattern1 = new RegExp(
			`<meta[^>]+${attrName}=["']${attrValue}["'][^>]+content=["']([^"']+)["']`,
			"i",
		);
		const m1 = pattern1.exec(html);
		if (m1?.[1]) return cleanText(m1[1]);

		const pattern2 = new RegExp(
			`<meta[^>]+content=["']([^"']+)["'][^>]+${attrName}=["']${attrValue}["']`,
			"i",
		);
		const m2 = pattern2.exec(html);
		if (m2?.[1]) return cleanText(m2[1]);
		return "";
	};

	const ogTitle =
		getMetaContent("property", "og:title") ||
		getMetaContent("name", "twitter:title") ||
		getMetaContent("property", "twitter:title") ||
		getMetaContent("name", "title");

	let titleTag = "";
	const titleMatch = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
	if (titleMatch?.[1]) {
		titleTag = cleanText(titleMatch[1]);
	}

	const ogImage =
		getMetaContent("property", "og:image:secure_url") ||
		getMetaContent("property", "og:image") ||
		getMetaContent("name", "twitter:image") ||
		getMetaContent("property", "twitter:image");

	const ogDescription =
		getMetaContent("property", "og:description") ||
		getMetaContent("name", "description");

	const metaPrice = parseNumericPrice(
		getMetaContent("property", "product:price:amount") ||
			getMetaContent("property", "og:price:amount") ||
			getMetaContent("name", "twitter:data1"),
	);

	const metaCurrency =
		getMetaContent("property", "product:price:currency") ||
		getMetaContent("property", "og:price:currency") ||
		"CAD";

	// Secondary regex price fallback from inline hydration state if neither JSON-LD nor meta tags had price
	let regexPrice: number | null = null;
	if (ldResult.price == null && metaPrice == null) {
		const hydrationPriceMatch =
			/"(?:price|currentPrice|salePrice|amount)"\s*:\s*"?(\d{1,5}(?:\.\d{2})?)"?/i.exec(
				html,
			);
		if (hydrationPriceMatch?.[1]) {
			const candidate = parseNumericPrice(hydrationPriceMatch[1]);
			// Guard against cent-denominated integers > 10000 unless decimal present
			if (candidate !== null && candidate < 25000) {
				regexPrice = candidate;
			}
		}
	}

	const resolvedTitle = ldResult.title || ogTitle || titleTag;
	const resolvedImage =
		ldResult.image || normalizeImageUrl(ogImage, pageUrl) || "";
	const gallery = [...(ldResult.gallery || [])];
	if (resolvedImage && !gallery.includes(resolvedImage)) {
		gallery.unshift(resolvedImage);
	}

	return {
		...ldResult,
		title: resolvedTitle || undefined,
		description: ldResult.description || ogDescription || undefined,
		image: resolvedImage || undefined,
		gallery,
		price: ldResult.price ?? metaPrice ?? regexPrice ?? null,
		currency: ldResult.currency || metaCurrency || "CAD",
	};
}

/**
 * Fast path for Shopify-based stores (e.g., KEF, Allbirds, Owala) via /products/<handle>.json
 */
async function tryShopifyProductJson(
	pageUrl: string,
): Promise<Partial<ScrapedProductResult> | null> {
	try {
		const parsed = new URL(pageUrl);
		const handleMatch = /\/products\/([^/?#]+)/i.exec(parsed.pathname);
		if (!handleMatch?.[1]) return null;

		const jsonUrl = `${parsed.origin}/products/${handleMatch[1]}.json`;
		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort(), 3500);

		const res = await fetch(jsonUrl, {
			headers: {
				"User-Agent": USER_AGENT,
				Accept: "application/json",
			},
			signal: controller.signal,
		});
		clearTimeout(timeout);

		if (!res.ok) return null;
		const data = (await res.json()) as { product?: Record<string, unknown> };
		const p = data?.product;
		if (!p || typeof p !== "object") return null;

		const domain = extractDomain(pageUrl);
		const title = cleanText(p.title);
		const brand = cleanText(p.vendor) || inferBrandFromDomain(domain);
		const rawHtmlBody = typeof p.body_html === "string" ? p.body_html : "";
		const description = cleanText(rawHtmlBody.replace(/<[^>]+>/g, " "));

		const images = Array.isArray(p.images)
			? p.images
					.map((img) =>
						img && typeof img === "object"
							? normalizeImageUrl((img as Record<string, unknown>).src, pageUrl)
							: "",
					)
					.filter(Boolean)
			: [];

		const imageById = new Map<string, string>();
		if (Array.isArray(p.images)) {
			for (const img of p.images) {
				if (img && typeof img === "object") {
					const im = img as Record<string, unknown>;
					const src = normalizeImageUrl(im.src, pageUrl);
					if (im.id && src) imageById.set(String(im.id), src);
				}
			}
		}

		const variants: ProductVariant[] = [];
		if (Array.isArray(p.variants)) {
			for (const rawVar of p.variants) {
				if (!rawVar || typeof rawVar !== "object") continue;
				const v = rawVar as Record<string, unknown>;
				const price = parseNumericPrice(v.price);
				const varImg = v.image_id
					? imageById.get(String(v.image_id))
					: undefined;
				variants.push({
					id: String(v.id || v.sku || variants.length),
					name: cleanText(v.title) || "Default",
					price,
					currency: "CAD",
					image: varImg || images[0],
					sku: typeof v.sku === "string" ? v.sku : undefined,
					inStock: v.available !== false,
				});
			}
		}

		const primaryVariant =
			variants.find((v) => v.price !== null) || variants[0];
		const rawProductType =
			typeof p.product_type === "string" ? p.product_type : "";

		return {
			title: title || undefined,
			brand,
			description: description || undefined,
			image: primaryVariant?.image || images[0] || undefined,
			gallery: images,
			price: primaryVariant?.price ?? null,
			currency: "CAD",
			category: inferCategory({
				title,
				brand,
				rawCategory: rawProductType,
				description,
				domain,
			}),
			sku: primaryVariant?.sku,
			inStock: true,
			variants:
				variants.length > 1 ||
				(variants.length === 1 && variants[0].name !== "Default Title")
					? variants
					: [],
			selectedVariantId: variants.length > 1 ? primaryVariant?.id : undefined,
			scrapeMethod: "shopify-json",
		};
	} catch {
		return null;
	}
}

async function resolveBrowserExecutablePath(): Promise<string> {
	if (process.env.CHROME_EXECUTABLE_PATH) {
		return process.env.CHROME_EXECUTABLE_PATH;
	}
	const isLocal = process.env.NODE_ENV !== "production";
	if (isLocal) {
		const fs = await import("node:fs");
		const candidates = [
			`${process.env.HOME || ""}/Library/Caches/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-mac-arm64/chrome-headless-shell`,
			"/Users/captainmk/.gemini/users/user1/Library/Caches/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-mac-arm64/chrome-headless-shell",
			"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
			"/opt/homebrew/Caskroom/google-chrome/155.0.8059.80/Google Chrome.app/Contents/MacOS/Google Chrome",
		];
		for (const candidate of candidates) {
			if (candidate && fs.existsSync(candidate)) {
				return candidate;
			}
		}
	}
	return await chromium.executablePath();
}

/**
 * Fallback headless Playwright scraper when fast HTTP is blocked or page is client-rendered
 */
async function scrapeWithPlaywright(
	pageUrl: string,
): Promise<Partial<ScrapedProductResult>> {
	const isLocal = process.env.NODE_ENV !== "production";
	const hasCustomChrome = Boolean(process.env.CHROME_EXECUTABLE_PATH);
	const executablePath = await resolveBrowserExecutablePath();

	const browser = await playwright.launch({
		args:
			isLocal || hasCustomChrome
				? [
						"--disable-blink-features=AutomationControlled",
						"--no-sandbox",
						"--disable-setuid-sandbox",
						"--disable-dev-shm-usage",
						"--disable-gpu",
					]
				: chromium.args,
		executablePath,
		headless: true,
	});

	try {
		const context = await browser.newContext({
			userAgent: USER_AGENT,
			locale: "en-CA",
			viewport: { width: 1280, height: 800 },
		});
		const page = await context.newPage();
		await page.goto(pageUrl, {
			waitUntil: "domcontentloaded",
			timeout: 15000,
		});
		// Wait briefly for client-side hydration if needed
		await page.waitForTimeout(800);

		const html = await page.content();
		const parsed = parseHtmlMetadata(html, pageUrl);

		// If price or image is still missing, query live DOM
		if (!parsed.image) {
			const domImage = await page.evaluate(() => {
				const selectors = [
					"meta[property='og:image']",
					"img#landingImage",
					"img[data-testid*='product']",
					"main img[src*='http']",
				];
				for (const sel of selectors) {
					const el = document.querySelector(sel);
					if (!el) continue;
					const src =
						el.getAttribute("content") ||
						el.getAttribute("src") ||
						(el as HTMLImageElement).currentSrc;
					if (src && src.startsWith("http")) return src;
				}
				return "";
			});
			if (domImage) {
				parsed.image = domImage;
				parsed.gallery = [domImage, ...(parsed.gallery || [])];
			}
		}

		if (parsed.price == null) {
			const domPriceText = await page.evaluate(() => {
				const selectors = [
					"[data-testid*='price']",
					"[data-automation*='price']",
					"[class*='ProductPrice']",
					"[class*='product-price']",
					"[itemprop='price']",
				];
				for (const sel of selectors) {
					const el = document.querySelector(sel);
					if (el?.textContent) {
						const m = /\$?\s*(\d{1,5}(?:,\d{3})*(?:\.\d{2})?)/.exec(
							el.textContent,
						);
						if (m?.[1]) return m[1];
					}
				}
				return "";
			});
			const domPrice = parseNumericPrice(domPriceText);
			if (domPrice !== null) {
				parsed.price = domPrice;
			}
		}

		await context.close();
		return {
			...parsed,
			scrapeMethod: "playwright",
		};
	} finally {
		await browser.close();
	}
}

/**
 * Multi-tier product scraper:
 * 1. Fast parallel HTTP fetch + Shopify JSON endpoint (~200-500ms)
 * 2. Automatic Playwright Chromium fallback only if HTTP is blocked or missing critical metadata
 */
export async function scrapeProductUrl(
	rawUrl: string,
): Promise<ScrapedProductResult> {
	const url = rawUrl.trim();
	const domain = extractDomain(url);
	const fallbackBrand = inferBrandFromDomain(domain);

	let merged: Partial<ScrapedProductResult> = {};

	// Tier 1: Run Shopify JSON check and fast HTTP HTML fetch in parallel
	const [shopifyData, httpHtmlData] = await Promise.all([
		tryShopifyProductJson(url),
		(async (): Promise<Partial<ScrapedProductResult> | null> => {
			try {
				const controller = new AbortController();
				const timeout = setTimeout(() => controller.abort(), 4500);
				const res = await fetch(url, {
					headers: {
						"User-Agent": USER_AGENT,
						Accept:
							"text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
						"Accept-Language": "en-CA,en-US;q=0.9,en;q=0.8",
					},
					signal: controller.signal,
				});
				clearTimeout(timeout);
				if (!res.ok) return null;
				const html = await res.text();
				return parseHtmlMetadata(html, url);
			} catch {
				return null;
			}
		})(),
	]);

	if (httpHtmlData) {
		merged = { ...httpHtmlData, scrapeMethod: "http-ld-json" };
	}

	if (shopifyData) {
		merged = {
			...merged,
			title: merged.title || shopifyData.title,
			brand:
				merged.brand && merged.brand !== fallbackBrand
					? merged.brand
					: shopifyData.brand,
			description: merged.description || shopifyData.description,
			image: merged.image || shopifyData.image,
			gallery:
				(merged.gallery?.length || 0) >= (shopifyData.gallery?.length || 0)
					? merged.gallery
					: shopifyData.gallery,
			price: merged.price ?? shopifyData.price,
			currency: merged.currency || shopifyData.currency || "CAD",
			category: merged.category || shopifyData.category,
			variants:
				merged.variants && merged.variants.length > 0
					? merged.variants
					: shopifyData.variants,
			selectedVariantId:
				merged.selectedVariantId || shopifyData.selectedVariantId,
			scrapeMethod: merged.price != null ? "http-ld-json" : "shopify-json",
		};
	}

	const isBlockedStatus =
		!merged.title ||
		/^(just a moment|access denied|attention required|robot or human|verify you are human)/i.test(
			merged.title,
		);

	// Tier 2: Playwright fallback if HTTP was blocked or missed title/image/price
	if (isBlockedStatus || !merged.image || merged.price == null) {
		try {
			const pwData = await scrapeWithPlaywright(url);
			merged = {
				...merged,
				title: !isBlockedStatus && merged.title ? merged.title : pwData.title,
				brand:
					merged.brand && merged.brand !== fallbackBrand
						? merged.brand
						: pwData.brand,
				description: merged.description || pwData.description,
				image: merged.image || pwData.image,
				gallery:
					(merged.gallery?.length || 0) > 0 ? merged.gallery : pwData.gallery,
				price: merged.price ?? pwData.price,
				highPrice: merged.highPrice ?? pwData.highPrice,
				currency: merged.currency || pwData.currency || "CAD",
				category: merged.category || pwData.category,
				variants:
					merged.variants && merged.variants.length > 0
						? merged.variants
						: pwData.variants,
				selectedVariantId: merged.selectedVariantId || pwData.selectedVariantId,
				scrapeMethod: "playwright",
			};
		} catch (err) {
			console.warn("Playwright fallback failed, using partial metadata:", err);
		}
	}

	const finalTitle =
		merged.title &&
		!/^(just a moment|access denied|attention required)/i.test(merged.title)
			? merged.title
			: `${fallbackBrand} Item`;

	const finalBrand = merged.brand || fallbackBrand;
	const finalCategory =
		merged.category ||
		inferCategory({
			title: finalTitle,
			brand: finalBrand,
			description: merged.description,
			domain,
		});

	return {
		url,
		domain,
		title: finalTitle,
		brand: finalBrand,
		description: merged.description,
		image: merged.image || "",
		gallery: merged.gallery || (merged.image ? [merged.image] : []),
		price: merged.price ?? null,
		highPrice: merged.highPrice ?? null,
		currency: merged.currency || "CAD",
		category: finalCategory,
		sku: merged.sku,
		inStock: merged.inStock ?? true,
		rating: merged.rating ?? null,
		reviewCount: merged.reviewCount ?? null,
		variants: merged.variants || [],
		selectedVariantId: merged.selectedVariantId,
		scrapeMethod: merged.scrapeMethod || "http-ld-json",
	};
}
