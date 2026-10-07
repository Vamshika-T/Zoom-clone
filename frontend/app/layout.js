import "./globals.css";

export const metadata = {
  title: "Zoom Clone",
  description: "Video conferencing platform",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}