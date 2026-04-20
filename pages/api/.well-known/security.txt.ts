import type { NextApiRequest, NextApiResponse } from "next";

export default function handler(_req: NextApiRequest, res: NextApiResponse) {
  const base =
    process.env.NEXT_PUBLIC_BASE_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://armani-katehano.vercel.app");

  const expires = new Date();
  expires.setFullYear(expires.getFullYear() + 1);

  const body = [
    `Contact: mailto:webmaster@armani-katehano.com`,
    `Expires: ${expires.toISOString().replace(/\.\d{3}Z$/, ".000Z")}`,
    `Preferred-Languages: en`,
    `Policy: ${base}/SECURITY.md`,
    `Scope: ${base}/`,
  ].join("\n");

  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=86400");
  res.status(200).send(body);
}
