import type { NextApiRequest, NextApiResponse } from "next";
import { DEVELOPER_NAME, DEVELOPER_PORTFOLIO, SITE_NAME } from "@/domain/shared/constants";
import { securityHeaders } from "@/server/security/edge";

const body = `/* TEAM */
Developer: ${DEVELOPER_NAME}
Site: ${DEVELOPER_PORTFOLIO}

/* SITE */
Name: ${SITE_NAME} Basketball
Language: TypeScript / Next.js
`.trimStart();

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  Object.entries(securityHeaders()).forEach(([k, v]) => res.setHeader(k, v));

  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.status(200).send(body);
}
