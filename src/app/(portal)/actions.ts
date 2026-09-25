'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { type ActionResult, optStr, rupeesToPaise, runAction, str } from '@/lib/actions';
import { api } from '@/lib/api';

/**
 * Every change the admin site can make. Each one calls the API (which checks the role, writes the audit
 * log and applies the two-person rule) and returns a simple-English result for the form.
 */

const done = (message: string, path?: string) => {
  if (path) revalidatePath(path);
  return { message };
};

// ── Doctors ───────────────────────────────────────────────────────────────────────────────────────────

export async function createDoctor(_: ActionResult, f: FormData): Promise<ActionResult<{ doctorId: string; loginId: string; oneTimePassword: string }>> {
  return runAction(f, async () => {
    const hospitals = f.getAll('hospitalId').map(String).filter(Boolean);
    const primary = str(f, 'primaryHospital') || hospitals[0];
    const documents = ['degree', 'registration', 'id_proof']
      .map((kind) => ({ kind, key: str(f, `doc_${kind}`) }))
      .filter((d) => d.key);
    const body = {
      name: str(f, 'name'),
      gender: str(f, 'gender'),
      phone: `+91${str(f, 'phone').replace(/\D/g, '').slice(-10)}`,
      email: optStr(f, 'email'),
      typeId: str(f, 'typeId'),
      degrees: str(f, 'degrees'),
      regCouncil: str(f, 'regCouncil'),
      regNo: str(f, 'regNo'),
      regYear: optStr(f, 'regYear') ? Number(str(f, 'regYear')) : undefined,
      yearsExperience: optStr(f, 'years') ? Number(str(f, 'years')) : undefined,
      languages: str(f, 'languages').split(',').map((s) => s.trim()).filter(Boolean),
      about: optStr(f, 'about'),
      feePaise: rupeesToPaise(str(f, 'fee')),
      hospitals: hospitals.map((h) => ({ hospitalId: h, isPrimary: h === primary })),
      documents,
      photoUploadKey: optStr(f, 'photoKey'),
    };
    const r = await api<{ doctorId: string; loginId: string; oneTimePassword: string }>('POST', '/v1/admin/doctors', { body, idempotent: true });
    revalidatePath('/doctors');
    return { message: 'Doctor created.', data: r };
  });
}

/** Upload link for a wizard document (the browser then PUTs the file straight to storage). */
export async function documentUploadUrl(contentType: string): Promise<{ key: string; url: string; headers: Record<string, string> } | { error: string }> {
  try {
    return await api('POST', '/v1/admin/uploads/document-url', { body: { contentType } });
  } catch (err) {
    return { error: (err as Error).message };
  }
}

export async function updateDoctor(_: ActionResult, f: FormData): Promise<ActionResult> {
  return runAction(f, async () => {
    const id = str(f, 'id');
    const locked = {
      name: optStr(f, 'l_name'),
      typeId: optStr(f, 'l_typeId'),
      degrees: optStr(f, 'l_degrees'),
      regCouncil: optStr(f, 'l_regCouncil'),
      regNo: optStr(f, 'l_regNo'),
    };
    const hasLocked = Object.values(locked).some(Boolean);
    const r = await api<{ lockedChanged?: boolean }>('PATCH', `/v1/admin/doctors/${id}`, {
      body: {
        gender: optStr(f, 'gender'),
        yearsExperience: optStr(f, 'years') ? Number(str(f, 'years')) : undefined,
        languages: optStr(f, 'languages')?.split(',').map((s) => s.trim()).filter(Boolean),
        about: f.has('about') ? str(f, 'about') : undefined,
        feePaise: optStr(f, 'fee') ? rupeesToPaise(str(f, 'fee')) : undefined,
        locked: hasLocked ? locked : undefined,
        reason: optStr(f, 'reason'),
      },
    });
    revalidatePath(`/doctors/${id}`);
    return { message: r.lockedChanged ? 'Saved, including the registered details (recorded in the audit log).' : 'Saved.' };
  });
}

export async function doctorCommand(_: ActionResult, f: FormData): Promise<ActionResult<{ loginId?: string; oneTimePassword?: string }>> {
  return runAction(f, async () => {
    const id = str(f, 'id');
    const cmd = str(f, 'cmd');
    const allowed = ['verify', 'needs-correction', 'suspend', 'reactivate', 'reset-password', 'unlock', 'sign-out-everywhere'];
    if (!allowed.includes(cmd)) throw new Error('Unknown command');
    const body: Record<string, string | undefined> = {};
    if (['verify', 'suspend', 'reset-password'].includes(cmd)) body.reason = str(f, 'reason');
    if (cmd === 'needs-correction') body.note = str(f, 'reason');
    const r = await api<{ loginId?: string; oneTimePassword?: string; status?: string }>('POST', `/v1/admin/doctors/${id}/${cmd}`, { body });
    revalidatePath(`/doctors/${id}`);
    const messages: Record<string, string> = {
      verify: 'Verified. Patients can find this doctor now.',
      'needs-correction': 'Marked as needing correction.',
      suspend: 'Suspended. Hidden from patients; every future booking is being refunded in full.',
      reactivate: 'The doctor is active again.',
      'reset-password': 'New one-time password made and sent by SMS.',
      unlock: 'Login unlocked.',
      'sign-out-everywhere': 'Signed out on every phone.',
    };
    const message = r.oneTimePassword
      ? `New one-time password for ${r.loginId}: ${r.oneTimePassword} — also sent by SMS. It is shown only now.`
      : messages[cmd];
    return { message, data: r.oneTimePassword ? { loginId: r.loginId, oneTimePassword: r.oneTimePassword } : undefined };
  });
}

export async function reviewDocument(_: ActionResult, f: FormData): Promise<ActionResult> {
  return runAction(f, async () => {
    const id = str(f, 'id');
    await api('POST', `/v1/admin/doctors/${id}/documents/${str(f, 'docId')}/review`, { body: { status: str(f, 'status'), note: optStr(f, 'note') } });
    return done(str(f, 'status') === 'approved' ? 'Document approved.' : 'Document rejected.', `/doctors/${id}`);
  });
}

export async function openDocument(doctorId: string, docId: string): Promise<{ url: string } | { error: string }> {
  try {
    return await api('GET', `/v1/admin/doctors/${doctorId}/documents/${docId}/url`);
  } catch (err) {
    return { error: (err as Error).message };
  }
}

export async function linkHospital(_: ActionResult, f: FormData): Promise<ActionResult> {
  return runAction(f, async () => {
    const id = str(f, 'id');
    await api('POST', `/v1/admin/doctors/${id}/hospitals`, {
      body: { hospitalId: str(f, 'hospitalId'), isPrimary: f.get('isPrimary') === 'on', feePaiseOverride: optStr(f, 'fee') ? rupeesToPaise(str(f, 'fee')) : null },
    });
    return done('Hospital linked.', `/doctors/${id}`);
  });
}

export async function unlinkHospital(_: ActionResult, f: FormData): Promise<ActionResult> {
  return runAction(f, async () => {
    const id = str(f, 'id');
    const r = await api<{ sessionsWithBookings: unknown[] }>('DELETE', `/v1/admin/doctors/${id}/hospitals/${str(f, 'hospitalId')}`);
    return done(
      r.sessionsWithBookings.length ? `Unlinked. ${r.sessionsWithBookings.length} upcoming OPD(s) there still have booked patients: cancel or move them.` : 'Unlinked.',
      `/doctors/${id}`,
    );
  });
}

export async function savePayout(_: ActionResult, f: FormData): Promise<ActionResult> {
  return runAction(f, async () => {
    const id = str(f, 'id');
    const r = await api<{ status: string; bankLast4: string }>('POST', `/v1/admin/doctors/${id}/payout-account`, {
      body: {
        holderName: str(f, 'holderName'),
        accountNumber: str(f, 'accountNumber'),
        accountNumberAgain: str(f, 'accountNumberAgain'),
        ifsc: str(f, 'ifsc').toUpperCase(),
        pan: str(f, 'pan').toUpperCase(),
        email: str(f, 'email'),
        address: { street: str(f, 'street'), city: str(f, 'city'), state: str(f, 'state'), pin: str(f, 'pin') },
      },
    });
    return done(`Payout account saved (…${r.bankLast4}, ${r.status}).`, `/doctors/${id}`);
  });
}

// ── Hospitals ─────────────────────────────────────────────────────────────────────────────────────────

function hospitalBody(f: FormData) {
  return {
    name: str(f, 'name'),
    address: str(f, 'address'),
    area: str(f, 'area'),
    city: str(f, 'city'),
    pin: str(f, 'pin'),
    lat: Number(str(f, 'lat')),
    lng: Number(str(f, 'lng')),
    phone: str(f, 'phone'),
    opdTimingsText: optStr(f, 'opdTimingsText') ?? null,
    hasEmergency: f.get('hasEmergency') === 'on',
    departments: f.getAll('departments').map(String),
  };
}

export async function createHospital(_: ActionResult, f: FormData): Promise<ActionResult> {
  let id = '';
  const r = await runAction(f, async () => {
    id = (await api<{ id: string }>('POST', '/v1/admin/hospitals', { body: hospitalBody(f) })).id;
  });
  if (r?.ok) redirect(`/hospitals/${id}`);
  return r;
}

export async function updateHospital(_: ActionResult, f: FormData): Promise<ActionResult> {
  return runAction(f, async () => {
    const id = str(f, 'id');
    await api('PATCH', `/v1/admin/hospitals/${id}`, { body: { ...hospitalBody(f), status: str(f, 'status') || undefined } });
    return done('Hospital saved.', `/hospitals/${id}`);
  });
}

export async function geocode(address: string): Promise<{ address: string; lat: number; lng: number }[] | { error: string }> {
  try {
    return await api('POST', '/v1/admin/hospitals/geocode', { body: { address } });
  } catch (err) {
    return { error: (err as Error).message };
  }
}

// ── Bookings and money ────────────────────────────────────────────────────────────────────────────────

export async function bookingCommand(_: ActionResult, f: FormData): Promise<ActionResult> {
  return runAction(f, async () => {
    const id = str(f, 'id');
    const cmd = str(f, 'cmd');
    if (cmd === 'refund') {
      await api('POST', `/v1/admin/bookings/${id}/refund`, { body: { amountPaise: rupeesToPaise(str(f, 'amount')), reason: str(f, 'reason') }, idempotent: true });
      return done('Refund started. The patient is told.', `/bookings/${id}`);
    }
    if (cmd === 'move' || cmd === 'cancel') {
      await api('POST', `/v1/admin/bookings/${id}/${cmd}`, { body: { reason: str(f, 'reason') } });
      return done(cmd === 'move' ? 'Moved. The patient will pick a new time.' : 'Cancelled with full money back.', `/bookings/${id}`);
    }
    if (cmd === 'resend-receipt') {
      await api('POST', `/v1/admin/bookings/${id}/resend-receipt`);
      return done('Receipt message sent.');
    }
    throw new Error('Unknown command');
  });
}

export async function refundCommand(_: ActionResult, f: FormData): Promise<ActionResult> {
  return runAction(f, async () => {
    const id = str(f, 'id');
    if (str(f, 'cmd') === 'mark-paid') {
      await api('POST', `/v1/admin/refunds/${id}/mark-paid`, { body: { utr: str(f, 'utr') } });
      return done('Marked as paid by bank transfer.', '/money');
    }
    await api('POST', `/v1/admin/refunds/${id}/retry`);
    return done('Retry started.', '/money');
  });
}

// ── Patients ──────────────────────────────────────────────────────────────────────────────────────────

export async function patientCommand(_: ActionResult, f: FormData): Promise<ActionResult<{ phone?: string }>> {
  return runAction(f, async () => {
    const id = str(f, 'id');
    const cmd = str(f, 'cmd');
    if (cmd === 'reveal') {
      const r = await api<{ phone: string }>('POST', `/v1/admin/patients/${id}/reveal`, { body: { field: 'phone', reason: str(f, 'reason') } });
      return { message: `Phone: ${r.phone} (this was recorded in the audit log)`, data: { phone: r.phone } };
    }
    if (cmd === 'block' || cmd === 'unblock') {
      await api('POST', `/v1/admin/patients/${id}/block`, { body: { blocked: cmd === 'block', reason: str(f, 'reason') } });
      return done(cmd === 'block' ? 'Account blocked.' : 'Account unblocked.', `/patients/${id}`);
    }
    if (cmd === 'deletion') {
      await api('POST', `/v1/admin/patients/${id}/deletion`, { body: { reason: str(f, 'reason') } });
      return done('Account deleted (bookings kept without name or phone).', `/patients/${id}`);
    }
    throw new Error('Unknown command');
  });
}

// ── Emergency, content, support ───────────────────────────────────────────────────────────────────────

export async function emergencyOff(_: ActionResult, f: FormData): Promise<ActionResult> {
  return runAction(f, async () => {
    await api('POST', `/v1/admin/emergency/${str(f, 'doctorId')}/off`, { body: { reason: str(f, 'reason') } });
    return done('Turned off. The doctor is told.', '/emergency');
  });
}

const lines = (v: string) => v.split('\n').map((s) => s.trim()).filter(Boolean);

export async function saveFirstAid(_: ActionResult, f: FormData): Promise<ActionResult> {
  return runAction(f, async () => {
    const kind = str(f, 'kind');
    const sources = lines(str(f, 'sources')).map((l) => {
      const [title = '', year = '', url = ''] = l.split('|').map((s) => s.trim());
      return { title, year: year ? Number(year) : null, url: url || null };
    });
    await api('PUT', `/v1/admin/first-aid/${kind}`, {
      body: {
        intro: optStr(f, 'intro') ?? null,
        signs: lines(str(f, 'signs')),
        callNowIf: lines(str(f, 'callNowIf')),
        dos: lines(str(f, 'dos')),
        donts: lines(str(f, 'donts')),
        sources,
        sourceToConfirm: f.get('sourceToConfirm') === 'on',
      },
    });
    return done('Saved. The page is back "in review" until a doctor reviews and it is published again.', `/content/first-aid/${kind}`);
  });
}

export async function publishFirstAid(_: ActionResult, f: FormData): Promise<ActionResult> {
  return runAction(f, async () => {
    const kind = str(f, 'kind');
    await api('POST', `/v1/admin/first-aid/${kind}/publish`, { body: { reviewedByDoctor: str(f, 'reviewedByDoctor') } });
    return done('Published. The app shows it at its next refresh.', `/content/first-aid/${kind}`);
  });
}

export async function ticketCommand(_: ActionResult, f: FormData): Promise<ActionResult> {
  return runAction(f, async () => {
    const id = str(f, 'id');
    if (str(f, 'cmd') === 'close') {
      await api('POST', `/v1/admin/tickets/${id}/close`);
      return done('Closed.', '/support');
    }
    await api('POST', `/v1/admin/tickets/${id}/reply`, { body: { reply: str(f, 'reply') } });
    return done('Reply sent to the app.', '/support');
  });
}

// ── Settings ──────────────────────────────────────────────────────────────────────────────────────────

export async function saveRule(_: ActionResult, f: FormData): Promise<ActionResult> {
  return runAction(f, async () => {
    const raw = str(f, 'value');
    let value: unknown;
    try {
      value = JSON.parse(raw);
    } catch {
      value = raw;
    }
    await api('PUT', `/v1/admin/config/${encodeURIComponent(str(f, 'key'))}`, { body: { value, reason: str(f, 'reason') } });
    return done('Saved. Every server follows within about 15 seconds.', '/settings/rules');
  });
}

export async function killSwitch(_: ActionResult, f: FormData): Promise<ActionResult> {
  return runAction(f, async () => {
    await api('POST', `/v1/admin/config/${encodeURIComponent(str(f, 'key'))}/kill`, { body: { reason: str(f, 'reason') } });
    return done('Turned OFF. Every server follows within about 15 seconds.', '/settings/rules');
  });
}
