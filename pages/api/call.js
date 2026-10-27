import { addCall, store } from "@/lib/store";
import { normalizeTable, TOKEN_REQUIRED, verifyTableToken } from "@/lib/meja";

// Panggil pelayan / minta bill: satu permintaan per meja per 45 detik.
// Tanpa ini, tombolnya jadi alat iseng yang bikin staf bolak-balik.
const CALL_COOLDOWN_MS = 45 * 1000;

export default function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "METHOD_NOT_ALLOWED" });
  }

  const body = req.body && typeof req.body === "object" ? req.body : {};
  const table = normalizeTable(body.table || "12");

  if (TOKEN_REQUIRED && !verifyTableToken(table, body.token)) {
    return res.status(403).json({
      error: "MEJA_TIDAK_VALID",
      message: "QR meja tidak dikenali. Silakan scan ulang QR di meja Anda."
    });
  }

  const now = Date.now();
  const recent = store.calls.find((c) => c.table === table && now - c.createdAt < CALL_COOLDOWN_MS);
  if (recent) {
    const retryAfter = Math.max(1, Math.ceil((recent.createdAt + CALL_COOLDOWN_MS - now) / 1000));
    return res.status(429).json({
      error: "SUDAH_DIPANGGIL",
      retryAfter,
      message: `Permintaan untuk meja ${table} sudah masuk. Tunggu ${retryAfter} detik.`
    });
  }

  const call = addCall(table, body.type);
  return res.status(201).json(call);
}
