import "./global.css";

export const metadata = {
  title: "YVR Control Tower Tracker",
  description: "Virtual project mapping of live aircraft paths",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}