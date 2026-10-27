import { snapshot } from "@/lib/store";

export default function handler(req, res) {
  res.setHeader("cache-control", "no-store");
  res.status(200).json(snapshot());
}
