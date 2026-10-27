import "./globals.css";

export const metadata = {
  title: "QR Order Demo — pesan dari meja",
  description: "Demo alur pesan dari meja: tamu scan QR, pesanan masuk ke layar staf, ketersediaan menu real-time."
};

export default function RootLayout({ children }) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
