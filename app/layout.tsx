import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'EvidenceQuorum',
  description: 'GenLayer independent-evidence quorum primitive',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          background:
            'radial-gradient(circle at top, #10231f 0%, #07110f 48%, #020706 100%)',
          color: '#e7f5ef',
          fontFamily:
            'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif',
        }}
      >
        {children}
      </body>
    </html>
  );
}
