/** Formatting for the admin site. Every date and time is India time. */

export type Role = 'super' | 'ops' | 'finance' | 'support' | 'content';
export interface Money {
  paise: number;
  display: string;
}

const tz = { timeZone: 'Asia/Kolkata' } as const;

export function dateTime(v: string | Date | null | undefined): string {
  if (!v) return '—';
  const d = new Date(v);
  return d.toLocaleString('en-IN', { ...tz, day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
}

export function day(v: string | Date | null | undefined): string {
  if (!v) return '—';
  const d = typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(`${v}T00:00:00+05:30`) : new Date(v);
  return d.toLocaleDateString('en-IN', { ...tz, weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

export function time(v: string | Date | null | undefined): string {
  if (!v) return '—';
  return new Date(v).toLocaleTimeString('en-IN', { ...tz, hour: 'numeric', minute: '2-digit' });
}

export function ago(v: string | Date | null | undefined): string {
  if (!v) return '—';
  const s = Math.round((Date.now() - new Date(v).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return `${Math.round(s / 86400)} days ago`;
}

/** The hour now in India (0–23). */
export const istHour = (): number => Number(new Date(Date.now() + 330 * 60_000).toISOString().slice(11, 13));

export const todayIst = (): string => new Date(Date.now() + 330 * 60_000).toISOString().slice(0, 10);

const inr = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 });
export function rupees(paise: number | string | null | undefined): string {
  if (paise === null || paise === undefined) return '—';
  return `₹${inr.format(Number(paise) / 100)}`;
}

/** Status word → stamp colour. */
export function tone(status: string | null | undefined): 'ok' | 'warn' | 'bad' | 'plain' | 'live' {
  switch (status) {
    case 'confirmed': case 'completed': case 'verified': case 'active': case 'approved': case 'processed': case 'released':
    case 'captured': case 'published': case 'answered': case 'done': case 'finished':
      return 'ok';
    case 'running': case 'available_now': case 'available_till': case 'with_doctor':
      return 'live';
    case 'pending': case 'pending_payment': case 'needs_correction': case 'on_hold': case 'in_review': case 'open': case 'paused':
    case 'waiting': case 'scheduled': case 'created': case 'authorized': case 'draft': case 'needs_attention':
      return 'warn';
    case 'cancelled_by_provider': case 'rejected': case 'failed': case 'suspended': case 'expired': case 'no_show': case 'reversed':
    case 'did_not_come': case 'cancelled': case 'deleted':
      return 'bad';
    default:
      return 'plain';
  }
}

export const words = (s: string | null | undefined): string => (s ?? '—').replace(/_/g, ' ');

/** What each admin role may open (the API is the real authority; this only hides menu items). */
export const CAN: Record<string, Role[]> = {
  doctors: ['super', 'ops', 'support', 'finance'],
  addDoctor: ['super', 'ops'],
  hospitals: ['super', 'ops', 'finance', 'support', 'content'],
  editHospitals: ['super', 'ops'],
  bookings: ['super', 'ops', 'finance', 'support'],
  money: ['super', 'finance'],
  patients: ['super', 'ops', 'support'],
  content: ['super', 'content'],
  support: ['super', 'ops', 'finance', 'support'],
  admins: ['super'],
  approve: ['super', 'ops', 'finance'],
};

export const can = (role: Role | undefined, what: keyof typeof CAN): boolean => !!role && CAN[what]!.includes(role);
