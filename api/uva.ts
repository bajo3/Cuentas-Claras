// TEMP_TEST — no external calls, validates that Vercel routes /api/uva correctly.
// Replace with real ArgentinaDatos logic once routing is confirmed working.

/* eslint-disable @typescript-eslint/no-explicit-any */

export default function handler(_req: any, res: any): void {
  res.setHeader('Content-Type', 'application/json')
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.statusCode = 200
  res.end(
    JSON.stringify({
      ok: true,
      date: new Date().toISOString().slice(0, 10),
      value: 1927.34,
      source: 'TEMP_TEST',
    }),
  )
}
