// lib/apiMiddleware.js  ← NEW file

import { prodError } from './utils.js';

/**
 * Wraps an API handler with centralised error handling.
 * Eliminates the need for try/catch boilerplate in every handler
 * and ensures prodError is always available on every error path.
 *
 * Usage:
 *   export default withErrorHandling(async (req, res) => { ... });
 */
export function withErrorHandling(handler) {
  return async (req, res) => {
    try {
      return await handler(req, res);
    } catch (err) {
      console.error('[API ERROR]', err);
      return res.status(500).json({ error: prodError(err) });
    }
  };
}

/**
 * Compose multiple middleware wrappers cleanly.
 * e.g. compose(withErrorHandling, requireAuth)(handler)
 */
export function compose(...wrappers) {
  return (handler) => wrappers.reduceRight((h, w) => w(h), handler);
}