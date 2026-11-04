import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
	title: "Wishlist — Personal Object Index",
	description:
		"Self-hosted dark-mode universal wishlist and curated object gallery.",
	icons: {
		icon: [
			{ url: "/icon.svg", type: "image/svg+xml" },
			{ url: "/favicon.ico", sizes: "32x32" },
		],
		apple: "/apple-icon.png",
	},
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="en" className="dark">
			<body className="antialiased selection:bg-amber-500/25 selection:text-amber-200">
				{children}
			</body>
		</html>
	);
}
