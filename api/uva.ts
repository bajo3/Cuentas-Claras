// Vercel Serverless Function — GET /api/uva
// Proxies BCRA (Banco Central de la República Argentina) UVA value
// to avoid browser CORS restrictions.
//
// BCRA API v3.0 estadísticas:
//   GET /estadisticas/v3.0/variables/{idVariable}/{fechaDesde}/{fechaHasta}
//   idVariable 31 = "UVA - Unidad de Valor Adquisitivo"
//   Date format: YYYY-MM-DD  ← with dashes
//
// Response: { ok: true, value: number, date: "YYYY-MM-DD", source: "BCRA" }
//        or { ok: false, error: string, source: "BCRA" }
//
// Note: always returns HTTP 200 so clients always get JSON (never Vercel 502).

export default async function handler(): Promise<Response> {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200',
  }

  const ok = (payload: object) => new Response(JSON.stringify(payload), { status: 200, headers })

  try {
    // Request last 7 days to cover weekends + holidays when BCRA doesn't publish
    const today = new Date()
    const isoDate = (d: Date) => d.toISOString().slice(0, 10) // YYYY-MM-DD — keep dashes!
    const from = isoDate(new Date(today.getTime() - 7 * 86_400_000))
    const to = isoDate(today)

    // Variable 31 = UVA (Unidad de Valor Adquisitivo)
    const url = `https://api.bcra.gob.ar/estadisticas/v3.0/variables/31/${from}/${to}`

    let res: Response
    try {
      res = await fetch(url, {
        headers: {
          Accept: 'application/json',
          'User-Agent': 'Mozilla/5.0 (compatible; CuentasClaras/1.0)',
        },
        // 8-second timeout so we don't hang the serverless invocation
        signal: AbortSignal.timeout(8000),
      })
    } catch (fetchErr) {
      const msg = fetchErr instanceof Error ? fetchErr.message : 'fetch failed'
      return ok({ ok: false, error: `BCRA unreachable: ${msg}`, source: 'BCRA' })
    }

    if (!res.ok) {
      return ok({ ok: false, error: `BCRA responded ${res.status}`, source: 'BCRA' })
    }

    let data: { results?: Array<{ fecha: string; valor: number }> }
    try {
      data = (await res.json()) as { results?: Array<{ fecha: string; valor: number }> }
    } catch {
      return ok({ ok: false, error: 'BCRA response is not valid JSON', source: 'BCRA' })
    }

    const results = data.results
    if (!results?.length) {
      return ok({ ok: false, error: 'No UVA data in range', source: 'BCRA' })
    }

    const last = results[results.length - 1]
    return ok({ ok: true, value: last.valor, date: last.fecha, source: 'BCRA' })
  } catch (err) {
    return ok({
      ok: false,
      error: err instanceof Error ? err.message : 'Unknown error',
      source: 'BCRA',
    })
  }
}
