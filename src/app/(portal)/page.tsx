import Link from 'next/link';

import { Head, LoadError, Sec } from '@/components/ui';
import { API_BASE, load } from '@/lib/api';
import { day, istHour, todayIst, type Money } from '@/lib/format';
import { me } from '@/lib/me';

export const metadata = { title: 'Today' };

interface Today {
  date: string;
  bookingsToday: number;
  bookedToday: number;
  opdsRunning: number;
  seenToday: number;
  collected: Money;
  refundsToday: number;
  doctorsPending: number;
  paymentSuccessRate: number | null;
  hourly: { hour: number; today: number; lastWeek: number }[];
}

async function health() {
  try {
    const r = await fetch(`${API_BASE}/ready`, { cache: 'no-store', signal: AbortSignal.timeout(4000) });
    return r.ok;
  } catch {
    return false;
  }
}

export default async function TodayPage() {
  const [who, t, ok] = await Promise.all([me(), load<Today>('/v1/admin/dashboard/today'), health()]);
  const hour = istHour();
  return (
    <>
      <Head kicker={day(todayIst())} title={`Good ${hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening'}, ${who.name.split(' ')[0]}`} lead="What is happening on OPflow today, India time.">
        <span className={`stamp ${ok ? 'ok' : 'bad'}`}>{ok ? 'API · database ok' : 'API not reachable'}</span>
      </Head>
      {t.error ? (
        <LoadError error={t.error} />
      ) : (
        <>
          <dl className="figures">
            <div>
              <dt>Visits today</dt>
              <dd>{t.data.bookingsToday}</dd>
              <div className="note">{t.data.seenToday} seen so far</div>
            </div>
            <div>
              <dt>OPDs running now</dt>
              <dd>{t.data.opdsRunning}</dd>
            </div>
            <div>
              <dt>Booked today</dt>
              <dd>{t.data.bookedToday}</dd>
              <div className="note">for any day</div>
            </div>
            <div>
              <dt>Money in today</dt>
              <dd className="small mono">{t.data.collected.display}</dd>
              <div className="note">{t.data.refundsToday} refund{t.data.refundsToday === 1 ? '' : 's'} started</div>
            </div>
            <div>
              <dt>Payments working</dt>
              <dd>{t.data.paymentSuccessRate === null ? '—' : `${t.data.paymentSuccessRate}%`}</dd>
              <div className="note">last 24 hours</div>
            </div>
            <div>
              <dt>Waiting for you</dt>
              <dd>{t.data.doctorsPending}</dd>
              <div className="note">
                doctor{t.data.doctorsPending === 1 ? '' : 's'} to verify · <Link href="/doctors?verification=pending">open</Link>
              </div>
            </div>
          </dl>

          <Sec title="Bookings made per hour" note="bars: today · dotted: same day last week" />
          <HourBars rows={t.data.hourly} now={hour} />
        </>
      )}
    </>
  );
}

function HourBars({ rows, now }: { rows: Today['hourly']; now: number }) {
  const max = Math.max(1, ...rows.flatMap((r) => [r.today, r.lastWeek]));
  return (
    <>
      <div className="bars" role="img" aria-label="Bookings per hour today compared with last week">
        {rows.map((r) => (
          <div key={r.hour} title={`${r.hour}:00 · today ${r.today} · last week ${r.lastWeek}`}>
            <i style={{ height: `${(r.today / max) * 100}%`, opacity: r.hour > now ? 0.25 : 1 }} />
            <s style={{ bottom: `${(r.lastWeek / max) * 100}%` }} />
          </div>
        ))}
      </div>
      <div className="bars-x">
        {rows.map((r) => (
          <span key={r.hour}>{r.hour % 3 === 0 ? r.hour : ''}</span>
        ))}
      </div>
    </>
  );
}
