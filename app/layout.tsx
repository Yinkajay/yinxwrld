import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import AppShell from "@/app/components/app-shell";
import { WorkspaceProvider } from "@/app/hooks/use-workspace";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "yinxwrld | Your personal workspace",
  description: "A quiet space to plan your days and keep creative ideas moving.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <WorkspaceProvider><AppShell>{children}</AppShell></WorkspaceProvider>
      </body>
    </html>
  );
}
