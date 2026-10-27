import { doneCall } from "@/lib/store";

export default function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "METHOD_NOT_ALLOWED" });
  }

  const body = req.body && typeof req.body === "object" ? req.body : {};
  const call = doneCall(String(body.id || ""));
  if (!call) {
    return res.status(404).json({ error: "NOT_FOUND" });
  }
  return res.status(200).json(call);
}
