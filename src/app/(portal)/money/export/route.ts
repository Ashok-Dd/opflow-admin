import { api, ApiError } from '@/lib/api';

/** CSV download for finance, fetched from the API with the admin's own session. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const kind = url.searchParams.get('kind') ?? '';
  const from = url.searchParams.get('from') ?? '';
  const to = url.searchParams.get('to') ?? '';
  if (!['payments', 'refunds', 'transfers', 'payouts'].includes(kind) || !/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    return new Response('Bad request', { status: 400 });
  }
  try {
    const csv = await api<string>('GET', `/v1/admin/exports/${kind}.csv`, { query: { from, to } });
    return new Response(csv, {
      headers: {
        'content-type': 'text/csv; charset=utf-8',
        'content-disposition': `attachment; filename="opflow-${kind}-${from}-to-${to}.csv"`,
        'cache-control': 'no-store',
      },
    });
  } catch (err) {
    return new Response(err instanceof ApiError ? err.message : 'Could not make the file.', { status: err instanceof ApiError ? err.status : 500 });
  }
}
