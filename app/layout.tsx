import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/Providers";
import { Analytics } from "@vercel/analytics/next";

export const metadata: Metadata = {
    title: "SerBisU Admin",
    description: "Admin panel for SerBisU platform",
    icons: {
        icon: "/favicon.ico",
    },
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en" className="no-scrollbar">
            <body
                className="antialiased font-sans no-scrollbar"
            >
                <Providers>
                    {children}
                </Providers>
                <Analytics />
            </body>
        </html>
    );
}
