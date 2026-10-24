import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "PokerLab · The practice room",
  description: "Local-first Texas Hold’em training. Practice with play chips.",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <a className="skip-link" href="#main-content">
          Skip to main content
        </a>
        {children}
      </body>
    </html>
  );
}
