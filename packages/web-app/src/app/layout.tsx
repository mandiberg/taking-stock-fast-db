import type { Metadata } from "next";
import { Crimson_Pro, Source_Code_Pro } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { ChatLayoutWrapper } from "@/components/layout/chat-layout-wrapper";

const crimsonPro = Crimson_Pro({
  variable: "--font-serif",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const sourceCodePro = Source_Code_Pro({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "Taking Stock - Data Explorer",
  description: "Quantitative analysis of stock photography",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${crimsonPro.variable} ${sourceCodePro.variable} antialiased`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <ChatLayoutWrapper>{children}</ChatLayoutWrapper>
        </ThemeProvider>
      </body>
    </html>
  );
}
