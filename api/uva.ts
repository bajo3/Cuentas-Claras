// Vercel Edge Function — GET /api/uva
// Proxies BCRA (Banco Central de la República Argentina) UVA value
// to avoid browser CORS restrictions.
//
// BCRA API v3.0 estadísticas:
//   GET /estadisticas/v3.0/variables/{idVariable}/{fechaDesde}/{fechaHasta}
//   idVariable 31 = "UVA - Unidad de Valor Adquisitivo"
//   Date format: YYYY-MM-DD  ← with dashes
//
// Response: { ok: true, value: number, date: "YYYY-MM-DD", source: "BCRA" }
//        or { ok: false, error: string }

export const config = { runtime: 'edge' }

export default async function handler(): Promise<Response> {
  const corsHeaders = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  }
  const cacheHeaders = {
    ...corsHeaders,
    'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200',
  }

  try {
    // Request last 7 days to cover weekends + holidays when BCRA doesn't publish
    const today = new Date()
    const isoDate = (d: Date) => d.toISOString().slice(0, 10) // YYYY-MM-DD — keep dashes!
    const from = isoDate(new Date(today.getTime() - 7 * 86_400_000))
    const to = isoDate(today)

    // Variable 31 = UVA (Unidad de Valor Adquisitivo)
    const url = `https://api.bcra.gob.ar/estadisticas/v3.0/variables/31/${from}/${to}`

    const res = await fetch(url, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'CuentasClaras/1.0',
      },
    })

    if (!res.ok) {
      return new Response(
        JSON.stringify({ ok: false, error: `BCRA API responded ${res.status}`, url }),
        { status: 502, headers: corsHeaders },
      )
    }

    const data = (await res.json()) as {
      results?: Array<{ fecha: string; valor: number }>
    }

    const results = data.results
    if (!results?.length) {
      return new Response(
        JSON.stringify({ ok: false, error: 'No UVA data in range', from, to }),
        { status: 404, headers: corsHeaders },
      )
    }

    const last = results[results.length - 1]
    return new Response(
      JSON.stringify({
        ok: true,
        value: last.valor,
        date: last.fecha,
        source: 'BCRA',
      }),
      { status: 200, headers: cacheHeaders },
    )
  } catch (err) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: err instanceof Error ? err.message : 'Unknown error',
      }),
      { status: 500, headers: corsHeaders },
    )
  }
}
