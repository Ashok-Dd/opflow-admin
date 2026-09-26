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
      photoUploadKey: optStr(f, 'photoKey'),
    };
    const r = await api<{ doctorId: string; loginId: string; oneTimePassword: string }>('POST', '/v1/admin/doctors', { body, idempotent: true });
    revalidatePath('/doctors');
    return { message: 'Doctor created.', data: r };
  });
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

// ── Money ────────────────────────────────────────────────────────────────────────────────

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

// ── Emergency ───────────────────────────────────────────────────────────────────────

export async function emergencyOff(_: ActionResult, f: FormData): Promise<ActionResult> {
  return runAction(f, async () => {
    await api('POST', `/v1/admin/emergency/${str(f, 'doctorId')}/off`, { body: { reason: str(f, 'reason') } });
    return done('Turned off. The doctor is told.', '/emergency');
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
