// Vercel Edge Function — GET /api/uva
// Proxies the BCRA (Banco Central) UVA value to avoid browser CORS restrictions.
// Returns: { value: number, date: string } or { error: string }

export const config = { runtime: 'edge' }

export default async function handler(): Promise<Response> {
  const headers = {
    'Content-Type': 'application/json',
    'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200',
    'Access-Control-Allow-Origin': '*',
  }

  try {
    const today = new Date()
    const fmt = (d: Date) =>
      d.toISOString().slice(0, 10).replace(/-/g, '')
    // Request a 5-day window to cover weekends/holidays when BCRA doesn't publish
    const from = fmt(new Date(today.getTime() - 5 * 86_400_000))
    const to = fmt(today)

    const url = `https://api.bcra.gob.ar/estadisticas/v3.0/variables/31/${from}/${to}`
    const res = await fetch(url, {
      headers: { Accept: 'application/json', 'User-Agent': 'CuentasClaras/1.0' },
    })

    if (!res.ok) {
      return new Response(JSON.stringify({ error: `BCRA responded ${res.status}` }), {
        status: 502,
        headers,
      })
    }

    const data = (await res.json()) as {
      results?: Array<{ fecha: string; valor: number }>
    }
    const results = data.results
    if (!results?.length) {
      return new Response(JSON.stringify({ error: 'No UVA data in range' }), {
        status: 404,
        headers,
      })
    }

    const last = results[results.length - 1]
    return new Response(JSON.stringify({ value: last.valor, date: last.fecha }), {
      status: 200,
      headers,
    })
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }),
      { status: 500, headers },
    )
  }
}
