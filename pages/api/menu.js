import menu from "@/lib/menu";
import { TOKEN_REQUIRED } from "@/lib/meja";

export default function handler(req, res) {
  res.setHeader("cache-control", "no-store");
  // tokenRequired dipakai halaman tamu untuk tahu apakah URL tanpa ?t= harus
  // ditolak lebih awal (QR lama / nomor meja yang diketik manual).
  res.status(200).json({ ...menu, tokenRequired: TOKEN_REQUIRED });
}
