import type { Metadata } from "next";
import { Outfit } from "next/font/google";
import "./globals.css";

const outfit = Outfit({ subsets: ["latin"] });

export const metadata: Metadata = {
    title: "Syllobus | 阪大生の成績集合知",
    description: "成績スクショをアップするだけ。学部別GPA・科目の成績分布がわかる阪大生向けサービス。",
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="ja">
            <body className={outfit.className}>{children}</body>
        </html>
    );
}
