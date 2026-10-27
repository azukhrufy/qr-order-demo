import { persistenceInfo, snapshot } from "@/lib/store";
import { SECRET_SOURCE, TOKEN_REQUIRED } from "@/lib/meja";

/** GET /api/health — dipakai probe & untuk memastikan persistence benar-benar menulis. */
export default function handler(req, res) {
  const state = snapshot();
  res.setHeader("cache-control", "no-store");
  res.status(200).json({
    ok: true,
    tokenRequired: TOKEN_REQUIRED,
    // nilai secret tidak pernah dikirim — hanya asalnya
    secretSource: SECRET_SOURCE,
    persistence: persistenceInfo(),
    counts: {
      orders: state.orders.length,
      soldout: state.soldout.length,
      calls: state.calls.length
    }
  });
}
