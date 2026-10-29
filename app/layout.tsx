import type {Metadata} from 'next';
import './globals.css';
export const metadata:Metadata={title:'快乐老家',description:'六个座位，分享状态、心情和眼前的生活。'};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="zh-CN"><head><link rel="preload" href="/fonts/happy-home.ttf" as="font" type="font/ttf" crossOrigin="anonymous"/></head><body>{children}</body></html>}
