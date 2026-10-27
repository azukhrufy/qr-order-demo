import { setOrderStatus } from "@/lib/store";

export default function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "METHOD_NOT_ALLOWED" });
  }

  const body = req.body && typeof req.body === "object" ? req.body : {};
  const order = setOrderStatus(String(body.id || ""), String(body.status || ""));
  if (!order) {
    return res.status(404).json({ error: "NOT_FOUND_OR_BAD_STATUS" });
  }
  return res.status(200).json(order);
}
