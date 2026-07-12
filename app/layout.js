import "./globals.css";

export const metadata = {
  title: "Bitsotron Kanban",
  description: "Sleek glassmorphic Kanban Board with Neon DB Integration",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
