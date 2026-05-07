// Vercel Node.js Serverless Function — GET /api/uva
//
// Source: ArgentinaDatos — https://argentinadatos.com/v1/finanzas/indices/uva
//
// Timeout guarantees (belt + suspenders):
//   1. AbortController aborts the fetch at 2 500 ms
//   2. Promise.race resolves to fallback at 3 500 ms (in case AbortController doesn't fire)
//   Function always responds in < 4 s — well under Vercel's 10 s invocation limit.
//
// Uses res.end() (raw Node.js) — no edge-runtime Response object, no ambiguity.

/* eslint-disable @typescript-eslint/no-explicit-any */

type OkPayload = { ok: true; value: number; date: string; source: string }
type ErrPayload = { ok: false; error: string; source: string }
type Payload = OkPayload | ErrPayload

const FALLBACK: ErrPayload = {
  ok: false,
  error: 'No se pudo obtener UVA automáticamente',
  source: 'ArgentinaDatos',
}

async function fetchUvaEntry(): Promise<{ value: number; date: string } | null> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 2_500)
  try {
    const res = await fetch('https://argentinadatos.com/v1/finanzas/indices/uva', {
      signal: controller.signal,
      headers: { accept: 'application/json', 'user-agent': 'CuentasClaras/1.0' },
    })
    clearTimeout(timer)
    if (!res.ok) return null
    const data: unknown = await res.json()
    if (!Array.isArray(data) || data.length === 0) return null
    const last = data[data.length - 1] as Record<string, unknown>
    if (typeof last.fecha !== 'string' || typeof last.valor !== 'number') return null
    return { value: last.valor, date: last.fecha }
  } catch {
    clearTimeout(timer)
    return null
  }
}

export default async function handler(_req: any, res: any): Promise<void> {
  res.setHeader('Content-Type', 'application/json')
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=7200')

  const send = (payload: Payload) => {
    if (!res.headersSent) {
      res.statusCode = 200
      res.end(JSON.stringify(payload))
    }
  }

  // Hard deadline in case AbortController doesn't fire
  const deadline = new Promise<null>((resolve) => setTimeout(() => resolve(null), 3_500))

  try {
    const entry = await Promise.race([fetchUvaEntry(), deadline])
    if (entry) {
      send({ ok: true, value: entry.value, date: entry.date, source: 'ArgentinaDatos' })
    } else {
      send(FALLBACK)
    }
  } catch {
    send(FALLBACK)
  }
}
