import { persistenceInfo, snapshot } from "@/lib/store";
import { TOKEN_REQUIRED } from "@/lib/meja";

/** GET /api/health — dipakai probe & untuk memastikan persistence benar-benar menulis. */
export default function handler(req, res) {
  const state = snapshot();
  res.setHeader("cache-control", "no-store");
  res.status(200).json({
    ok: true,
    tokenRequired: TOKEN_REQUIRED,
    persistence: persistenceInfo(),
    counts: {
      orders: state.orders.length,
      soldout: state.soldout.length,
      calls: state.calls.length
    }
  });
}
