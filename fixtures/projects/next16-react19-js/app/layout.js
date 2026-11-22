import './globals.css';

export const metadata = { title: 'Next Fixture' };

export default function RootLayout({ children }) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
