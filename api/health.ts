// Vercel Node.js Serverless Function — GET /api/health
// Diagnostic endpoint — always responds immediately with no external calls.
// If this hangs, the issue is Vercel project config, not the UVA logic.

/* eslint-disable @typescript-eslint/no-explicit-any */

export default function handler(_req: any, res: any): void {
  res.setHeader('Content-Type', 'application/json')
  res.statusCode = 200
  res.end(
    JSON.stringify({
      ok: true,
      service: 'api',
      time: new Date().toISOString(),
    }),
  )
}
