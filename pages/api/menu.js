import menu from "@/lib/menu";

export default function handler(req, res) {
  res.setHeader("cache-control", "no-store");
  res.status(200).json(menu);
}
