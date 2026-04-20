import type { NextApiRequest, NextApiResponse } from "next";

type Handler = (req: NextApiRequest, res: NextApiResponse) => unknown;

export function methodRouter(
  handlers: Partial<Record<"GET" | "POST" | "PUT" | "DELETE" | "PATCH", Handler>>,
): Handler {
  return (req, res) => {
    const h = handlers[req.method as keyof typeof handlers];
    if (!h) return res.status(405).json({ error: "Method not allowed" });
    return h(req, res);
  };
}
