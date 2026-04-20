import { prodError } from "@/domain/shared/format";

export function handleError(res: any, err: unknown): void {
  res.status(500).json({ error: prodError(err) });
}
