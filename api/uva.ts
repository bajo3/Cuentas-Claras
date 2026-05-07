// Vercel Serverless Function — GET /api/uva
//
// Fuentes (en orden de prioridad):
//   1. ArgentinaDatos  — https://argentinadatos.com/v1/finanzas/indices/uva
//      Devuelve: [{ fecha: "YYYY-MM-DD", valor: number }, ...]
//   2. BCRA            — https://api.bcra.gob.ar/estadisticas/v3.0/variables/31/{from}/{to}
//      Devuelve: { results: [{ fecha, valor }] }
//
// Siempre devuelve HTTP 200 con JSON para que el cliente nunca reciba 502 de Vercel.

type UvaEntry = { fecha: string; valor: number }

const TIMEOUT_MS = 8_000

async function safeFetch(url: string): Promise<Response> {
  return fetch(url, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'Mozilla/5.0 (compatible; CuentasClaras/1.0)',
    },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })
}

const isoDate = (d: Date) => d.toISOString().slice(0, 10)

// ── Source 1: ArgentinaDatos ─────────────────────────────────────────────────
async function fromArgentinaDatos(): Promise<UvaEntry | null> {
  try {
    const res = await safeFetch('https://argentinadatos.com/v1/finanzas/indices/uva')
    if (!res.ok) return null
    const data = (await res.json()) as UvaEntry[]
    if (!Array.isArray(data) || data.length === 0) return null
    const last = data[data.length - 1]
    if (!last.fecha || typeof last.valor !== 'number') return null
    return last
  } catch {
    return null
  }
}

// ── Source 2: BCRA ───────────────────────────────────────────────────────────
async function fromBcra(): Promise<UvaEntry | null> {
  try {
    const today = new Date()
    const from = isoDate(new Date(today.getTime() - 7 * 86_400_000))
    const to = isoDate(today)
    const url = `https://api.bcra.gob.ar/estadisticas/v3.0/variables/31/${from}/${to}`
    const res = await safeFetch(url)
    if (!res.ok) return null
    const data = (await res.json()) as { results?: UvaEntry[] }
    const results = data.results
    if (!Array.isArray(results) || results.length === 0) return null
    const last = results[results.length - 1]
    if (!last.fecha || typeof last.valor !== 'number') return null
    return last
  } catch {
    return null
  }
}

// ── Handler ──────────────────────────────────────────────────────────────────
export default async function handler(): Promise<Response> {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200',
  }

  try {
    // 1. ArgentinaDatos
    const ad = await fromArgentinaDatos()
    if (ad) {
      return new Response(
        JSON.stringify({ ok: true, value: ad.valor, date: ad.fecha, source: 'ArgentinaDatos' }),
        { status: 200, headers },
      )
    }

    // 2. BCRA fallback
    const bcra = await fromBcra()
    if (bcra) {
      return new Response(
        JSON.stringify({ ok: true, value: bcra.valor, date: bcra.fecha, source: 'BCRA' }),
        { status: 200, headers },
      )
    }

    // 3. Ambas fuentes fallaron
    return new Response(
      JSON.stringify({
        ok: false,
        error: 'No se pudo obtener UVA automáticamente',
        source: 'ArgentinaDatos/BCRA',
      }),
      { status: 200, headers },
    )
  } catch (err) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: err instanceof Error ? err.message : 'Error inesperado',
        source: 'ArgentinaDatos/BCRA',
      }),
      { status: 200, headers },
    )
  }
}
