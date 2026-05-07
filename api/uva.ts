// Vercel Serverless Function — GET /api/uva
//
// Fuentes (en orden de prioridad):
//   1. ArgentinaDatos  — https://argentinadatos.com/v1/finanzas/indices/uva
//   2. BCRA            — https://api.bcra.gob.ar/estadisticas/v3.0/variables/31/{from}/{to}
//
// Timeouts:
//   - 3 s por fuente (AbortController individual)
//   - 6.5 s total del handler (Promise.race contra timer de cierre)
//   Vercel tiene 10 s de invocación; el total nunca lo supera.
//
// Siempre devuelve HTTP 200 con JSON. Nunca 502/504.

type UvaEntry = { fecha: string; valor: number }

const SOURCE_TIMEOUT_MS = 3_000
const HANDLER_TIMEOUT_MS = 6_500

const COMMON_HEADERS = {
  Accept: 'application/json',
  'User-Agent': 'Mozilla/5.0 (compatible; CuentasClaras/1.0)',
}

const RESPONSE_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200',
}

/** fetch con timeout individual por AbortController */
async function fetchWithTimeout(url: string, ms: number): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), ms)
  try {
    return await fetch(url, { headers: COMMON_HEADERS, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

const isoDate = (d: Date) => d.toISOString().slice(0, 10)

// ── Source 1: ArgentinaDatos ──────────────────────────────────────────────────
async function fromArgentinaDatos(): Promise<UvaEntry | null> {
  try {
    const res = await fetchWithTimeout(
      'https://argentinadatos.com/v1/finanzas/indices/uva',
      SOURCE_TIMEOUT_MS,
    )
    if (!res.ok) return null
    const data = (await res.json()) as unknown
    if (!Array.isArray(data) || data.length === 0) return null
    const last = data[data.length - 1] as Record<string, unknown>
    if (!last || typeof last.fecha !== 'string' || typeof last.valor !== 'number') return null
    return { fecha: last.fecha, valor: last.valor }
  } catch {
    return null
  }
}

// ── Source 2: BCRA fallback ───────────────────────────────────────────────────
async function fromBcra(): Promise<UvaEntry | null> {
  try {
    const today = new Date()
    const from = isoDate(new Date(today.getTime() - 7 * 86_400_000))
    const to = isoDate(today)
    const res = await fetchWithTimeout(
      `https://api.bcra.gob.ar/estadisticas/v3.0/variables/31/${from}/${to}`,
      SOURCE_TIMEOUT_MS,
    )
    if (!res.ok) return null
    const data = (await res.json()) as { results?: unknown[] }
    const results = data.results
    if (!Array.isArray(results) || results.length === 0) return null
    const last = results[results.length - 1] as Record<string, unknown>
    if (!last || typeof last.fecha !== 'string' || typeof last.valor !== 'number') return null
    return { fecha: last.fecha, valor: last.valor }
  } catch {
    return null
  }
}

// ── Fallback response ─────────────────────────────────────────────────────────
const fallbackResponse = () =>
  new Response(
    JSON.stringify({
      ok: false,
      error: 'No se pudo obtener UVA automáticamente',
      source: 'ArgentinaDatos/BCRA',
    }),
    { status: 200, headers: RESPONSE_HEADERS },
  )

// ── Handler ───────────────────────────────────────────────────────────────────
async function resolve(): Promise<Response> {
  // 1. ArgentinaDatos (3 s max)
  const ad = await fromArgentinaDatos()
  if (ad) {
    return new Response(
      JSON.stringify({ ok: true, value: ad.valor, date: ad.fecha, source: 'ArgentinaDatos' }),
      { status: 200, headers: RESPONSE_HEADERS },
    )
  }

  // 2. BCRA fallback (3 s max)
  const bcra = await fromBcra()
  if (bcra) {
    return new Response(
      JSON.stringify({ ok: true, value: bcra.valor, date: bcra.fecha, source: 'BCRA' }),
      { status: 200, headers: RESPONSE_HEADERS },
    )
  }

  // 3. Ambas fallaron → respuesta controlada
  return fallbackResponse()
}

export default async function handler(): Promise<Response> {
  try {
    // Master timeout: si resolve() no termina en HANDLER_TIMEOUT_MS,
    // devolvemos la respuesta de fallback directamente.
    const timeoutPromise = new Promise<Response>((res) =>
      setTimeout(() => res(fallbackResponse()), HANDLER_TIMEOUT_MS),
    )
    return await Promise.race([resolve(), timeoutPromise])
  } catch (err) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: err instanceof Error ? err.message : 'Error inesperado',
        source: 'ArgentinaDatos/BCRA',
      }),
      { status: 200, headers: RESPONSE_HEADERS },
    )
  }
}
