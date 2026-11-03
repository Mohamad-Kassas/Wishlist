export function extractDomainClient(rawUrl: string): string {
	try {
		const parsed = new URL(rawUrl);
		return parsed.hostname.replace(/^www\./i, "").toLowerCase();
	} catch {
		return "unknown";
	}
}

export function formatCurrency(
	amount: number | null | undefined,
	currency = "CAD",
	highPrice?: number | null,
): string {
	if (amount === null || amount === undefined || !Number.isFinite(amount)) {
		return "Price TBD";
	}

	const formatter = new Intl.NumberFormat("en-CA", {
		style: "currency",
		currency: currency || "CAD",
		minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
		maximumFractionDigits: 2,
	});

	const base = formatter.format(amount);
	if (
		highPrice !== null &&
		highPrice !== undefined &&
		Number.isFinite(highPrice) &&
		highPrice > amount
	) {
		const high = formatter.format(highPrice);
		return `${base} – ${high}`;
	}

	return base;
}

export function formatExactCurrency(
	amount: number | null | undefined,
	currency = "CAD",
): string {
	if (amount === null || amount === undefined || !Number.isFinite(amount)) {
		return "$0.00";
	}
	return new Intl.NumberFormat("en-CA", {
		style: "currency",
		currency: currency || "CAD",
		minimumFractionDigits: 2,
		maximumFractionDigits: 2,
	}).format(amount);
}
