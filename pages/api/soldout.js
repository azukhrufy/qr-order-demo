import { setSoldout } from "@/lib/store";

export default function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "METHOD_NOT_ALLOWED" });
  }

  const body = req.body && typeof req.body === "object" ? req.body : {};
  const id = String(body.id || "");
  if (!id) {
    return res.status(400).json({ error: "MISSING_ID" });
  }

  const soldout = setSoldout(id, Boolean(body.value));
  return res.status(200).json({ soldout });
}
