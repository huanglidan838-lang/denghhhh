import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: "PORTFOLIO 2026 · 邓海玲",
  description: "走进邓海玲明媚清新的莫兰蒂 3D 桌面空间，在海景阳光、摄影墙与相机之间抽取设计作品卡牌。",
  openGraph: {
    title: "PORTFOLIO 2026 · 邓海玲",
    description: "走进海景阳光照亮的莫兰蒂 3D 创意桌面，抽取并展开邓海玲的个人设计作品。",
    type: "website",
    locale: "zh_CN",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "邓海玲 2026 作品集明媚莫兰蒂 3D 摄影桌面" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "PORTFOLIO 2026 · 邓海玲",
    description: "走进海景阳光照亮的莫兰蒂 3D 创意桌面，抽取并展开邓海玲的个人设计作品。",
    images: ["/og.png"],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-CN"><head><link rel="preload" href="/fonts/portfolio-headline.ttf" as="font" type="font/ttf" crossOrigin="anonymous" /><link rel="preload" href="/fonts/xiangjiao-kuanmaoshualinggan.ttf" as="font" type="font/ttf" crossOrigin="anonymous" /></head><body>{children}</body></html>;
}
