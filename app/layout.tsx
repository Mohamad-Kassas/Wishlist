import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
	title: "Fantasy Gallery — Personal Object Wishlist",
	description:
		"Self-hosted dark-mode universal wishlist and curated object gallery.",
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
