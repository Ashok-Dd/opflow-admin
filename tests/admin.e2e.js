// Drives the real admin site in headless Chrome: setup → sign in (TOTP) → add a doctor with the wizard →
// verify the doctor → every page loads without errors. Screenshots in ./shots. OPflow has ONE admin.
const puppeteer = require('puppeteer-core');
const fs = require('fs');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

// Usage (see admin/README.md): API on :3000 against a THROWAWAY Postgres, admin site on :3002, two setup links
// from `npm run admin:create` saved in setupA.txt, then: node tests/admin.e2e.js
const SITE = process.env.SITE ?? 'http://localhost:3002';
const API = process.env.API ?? 'http://localhost:3000';
const PSQL = process.env.PSQL ?? 'C:/Program Files/PostgreSQL/17/bin/psql.exe';
const DB = process.env.PGDB_ARGS ? process.env.PGDB_ARGS.split(' ') : ['-h', 'localhost', '-p', '5499', '-U', 'postgres', '-d', 'opflow_test'];
const chrome = process.env.CHROME ?? ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((p) => fs.existsSync(p));
fs.mkdirSync('shots', { recursive: true });

function b32(s) {
  const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = 0, val = 0; const out = [];
  for (const c of s.replace(/\s/g, '').toUpperCase()) { val = (val << 5) | A.indexOf(c); bits += 5; if (bits >= 8) { out.push((val >>> (bits - 8)) & 255); bits -= 8; } }
  return Buffer.from(out);
}
function totp(secret) {
  const c = Buffer.alloc(8); c.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000)));
  const h = crypto.createHmac('sha1', b32(secret)).update(c).digest();
  const o = h[h.length - 1] & 15;
  return String((h.readUInt32BE(o) & 0x7fffffff) % 1e6).padStart(6, '0');
}
const sql = (q) => execFileSync(PSQL, [...DB, '-Atqc', q]).toString().trim();
// Each code works once; the test signs in several times within 30 s, so it clears "last used".
const freshCode = (email, secret) => { sql(`update admin_users set totp_last_step = null where email = '${email}'`); return totp(secret); };

const results = [];
const check = (name, ok, extra = '') => { results.push({ name, ok, extra }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? ' — ' + extra : ''}`); };

(async () => {
  const browser = await puppeteer.launch({ executablePath: chrome, headless: 'new', args: ['--window-size=1440,900'] });
  const pageErrors = [];
  const newPage = async () => {
    const ctx = await browser.createBrowserContext();
    const p = await ctx.newPage();
    await p.setViewport({ width: 1440, height: 900 });
    p.on('pageerror', (e) => pageErrors.push(e.message));
    p.on('console', (m) => {
      const where = m.location()?.url ?? '';
      // The removed pages are visited on purpose to check they are gone (404 expected).
      if (m.type() === 'error' && !/favicon/.test(m.text()) && !/\/(approvals|settings\/admins)$/.test(where)) pageErrors.push(m.text() + ' @ ' + where);
    });
    return p;
  };
  const clickText = async (p, text) => { await p.waitForFunction((t) => [...document.querySelectorAll('button')].some((b) => b.textContent.trim().startsWith(t) && !b.disabled), {}, text); await p.evaluate((t) => [...document.querySelectorAll('button')].find((b) => b.textContent.trim().startsWith(t) && !b.disabled).click(), text); await new Promise((r) => setTimeout(r, 150)); };
  const go = async (p, path) => { await p.goto(SITE + path, { waitUntil: 'networkidle0' }); };
  const submitAndWait = async (p, sel = 'button.btn') => { await Promise.all([p.waitForNavigation({ waitUntil: 'networkidle0' }).catch(() => null), p.click(sel)]); };

  async function setup(p, url, password) {
    await p.goto(url, { waitUntil: 'networkidle0' });
    const secret = await p.$eval('.pass .mono', (e) => e.textContent);
    await p.type('input[name=password]', password);
    await p.type('input[name=password2]', password);
    await p.type('input[name=code]', totp(secret));
    await submitAndWait(p);
    return secret;
  }
  async function signIn(p, email, password, secret) {
    await go(p, '/sign-in');
    await p.type('input[name=email]', email);
    await p.type('input[name=password]', password);
    await submitAndWait(p);
    await p.type('input[name=code]', freshCode(email, secret));
    await submitAndWait(p);
  }

  // 1. Setup links (password + authenticator)
  const a = await newPage();
  global.__page = a;
  const secretA = await setup(a, fs.readFileSync('setupA.txt', 'utf8').trim().replace('http://localhost:3002', SITE), 'Asha-admin-2026x');
  check('Setup link: admin A finishes setup', a.url().includes('/sign-in?ready=1'), a.url());
  await a.screenshot({ path: 'shots/01-sign-in-ready.png' });
  await go(a, '/'); check('No session → sent to sign-in', a.url().includes('/sign-in'));

  // 2. Wrong password, then sign in with authenticator
  await go(a, '/sign-in');
  await a.type('input[name=email]', 'asha@opflow.test'); await a.type('input[name=password]', 'wrong-password');
  await a.click('button.btn'); await a.waitForSelector('.result.bad');
  check('Wrong password shows a simple message', (await a.$eval('.result.bad', (e) => e.textContent)).includes('not right'));
  await signIn(a, 'asha@opflow.test', 'Asha-admin-2026x', secretA);
  check('Admin A signs in with authenticator code', a.url() === SITE + '/', a.url());
  await a.screenshot({ path: 'shots/02-today.png', fullPage: true });
  check('Today shows figures', !!(await a.$('.figures')));

  // 3. Add a doctor with the wizard
  await go(a, '/doctors/new');
  await a.screenshot({ path: 'shots/03-wizard-step1.png' });
  await a.type('input[name=name]', 'dr. meena rao'); await a.select('select[name=gender]', 'female');
  await a.type('input[name=phone]', '9876500011'); await a.type('input[name=email]', 'meena@opflow.test');
  await clickText(a, 'Next');
  await a.select('select[name=typeId]', 'general'); await a.type('input[name=degrees]', 'MBBS, MD (General Medicine)');
  await a.type('input[name=regCouncil]', 'APMC'); await a.type('input[name=regNo]', 'E2E' + Date.now().toString().slice(-6)); await a.type('input[name=years]', '9');
  await clickText(a, 'Next');
  await a.click('input[name=hospitalId]'); await a.type('input[name=fee]', '400'); await a.type('input[name=languages]', 'Telugu, English');
  await a.screenshot({ path: 'shots/05-wizard-hospitals.png' });
  await clickText(a, 'Next'); await clickText(a, 'Next');
  await a.type('textarea[name=about]', 'Fever, BP, sugar and all common adult problems.');
  await clickText(a, 'Create doctor');
  await a.waitForFunction(() => document.body.innerText.includes('Doctor created') || document.querySelector('.result.bad'), { timeout: 20000 });
  const created = await a.evaluate(() => document.body.innerText);
  const loginId = (created.match(/OPD-\d+/) || [])[0];
  check('Wizard: doctor created with an OPD login ID', !!loginId, loginId || created.slice(0, 300));
  await a.screenshot({ path: 'shots/06-doctor-created.png' });
  const doctorHref = await a.$eval('a.btn[href^="/doctors/"]', (e) => e.getAttribute('href'));
  const doctorId = doctorHref.split('/').pop();
  const hidden = await fetch(`${API}/v1/doctors/${doctorId}`);
  check('New doctor is hidden from patients before verification', hidden.status === 404);

  // 4. Verify the doctor (one admin: applies at once, recorded in the audit log)
  await go(a, doctorHref);
  await a.screenshot({ path: 'shots/07-doctor-page.png', fullPage: true });
  a.on('dialog', (d) => d.accept());
  for (const f of await a.$$('form')) {
    const t = await f.evaluate((e) => e.innerText);
    if (t.includes('Verify doctor')) {
      await (await f.$('input[name=reason]')).type('Council record matches the name and number');
      await (await f.$('button')).click();
      break;
    }
  }
  // After verifying, the page refreshes: the stamp turns VERIFIED (or the code box appears first).
  await a.waitForFunction(() => !!document.querySelector('.stepup') || document.querySelector('.head .stamp')?.textContent?.toLowerCase() === 'verified', { timeout: 15000 });
  if (await a.$('.stepup')) {
    await a.type('input[name=stepUpCode]', freshCode('asha@opflow.test', secretA));
    for (const f of await a.$$('form')) if ((await f.evaluate((e) => e.innerText)).includes('Confirm and')) { await (await f.$('button')).click(); break; }
    await a.waitForFunction(() => document.querySelector('.head .stamp')?.textContent?.toLowerCase() === 'verified', { timeout: 15000 });
  }
  check('Admin verifies the doctor at once', (await a.$eval('.head .stamp', (e) => e.textContent.toLowerCase())) === 'verified');
  const visible = await fetch(`${API}/v1/doctors/${doctorId}`);
  check('Doctor is now visible to patients', visible.status === 200);
  await go(a, '/approvals');
  check('No approvals page any more', (await a.evaluate(() => document.body.innerText)).includes('Page not found'));
  await go(a, '/settings/admins');
  check('No admins page any more', (await a.evaluate(() => document.body.innerText)).includes('Page not found'));

  // 5. Every page opens without errors
  const pages = ['/', '/attention', '/live', '/emergency', '/doctors', doctorHref + '?tab=hospitals', doctorHref + '?tab=money', doctorHref + '?tab=login', doctorHref + '?tab=history', '/hospitals', '/hospitals/new', '/money', '/money?tab=payouts', '/money?tab=payments', '/money?tab=reconciliation', '/settings/rules'];
  for (const path of pages) {
    await go(a, path);
    const bad = await a.evaluate(() => {
      const t = document.body.innerText;
      return t.includes('could not be shown') || t.includes('cannot be reached') || !!document.querySelector('.notice.bad');
    });
    check(`Page opens: ${path}`, !bad);
  }
  await go(a, '/hospitals');
  const hospital = await a.$eval('.register a.rowlink[href^="/hospitals/"]', (e) => e.getAttribute('href')).catch(() => null);
  if (hospital) { await go(a, hospital); check('Page opens: hospital detail', !(await a.$('.notice.bad'))); }
  await go(a, '/settings/rules'); await a.screenshot({ path: 'shots/09-rules.png', fullPage: true });
  await go(a, '/doctors'); await a.screenshot({ path: 'shots/11-doctors.png' });

  // 6. Phone width
  await a.setViewport({ width: 390, height: 844 });
  await go(a, '/doctors'); await a.screenshot({ path: 'shots/13-mobile-doctors.png', fullPage: true });
  const overflow = await a.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  check('No sideways scrolling on a phone', !overflow);
  // The menu hides behind ☰ on a phone: it slides in, and closes after picking a page.
  const menuHidden = await a.evaluate(() => document.querySelector('.index').getBoundingClientRect().right <= 0);
  check('Phone: menu is hidden until ☰ is tapped', menuHidden);
  await a.click('.burger'); await new Promise((r) => setTimeout(r, 400));
  const menuShown = await a.evaluate(() => document.querySelector('.index').getBoundingClientRect().left >= 0);
  await a.screenshot({ path: 'shots/14-mobile-menu.png' });
  check('Phone: ☰ opens the menu', menuShown);
  await a.evaluate(() => [...document.querySelectorAll('.index a')].find((x) => x.getAttribute('href') === '/hospitals').click());
  await a.waitForFunction(() => location.pathname === '/hospitals', { timeout: 10000 }).catch(() => null);
  await new Promise((r) => setTimeout(r, 500));
  const closedAfter = await a.evaluate(() => location.pathname === '/hospitals' && document.querySelector('.index').getBoundingClientRect().right <= 0);
  check('Phone: picking a page opens it and closes the menu', closedAfter);
  await a.screenshot({ path: 'shots/15-mobile-hospitals.png', fullPage: true });

  // 7. Sign out ends the session
  await a.setViewport({ width: 1440, height: 900 });
  await go(a, '/');
  await submitAndWait(a, '.who button');
  await go(a, '/doctors');
  check('Sign out ends the session', a.url().includes('/sign-in'));

  const uniqueErrors = [...new Set(pageErrors)];
  check('No browser errors', uniqueErrors.length === 0, uniqueErrors.slice(0, 5).join(' | '));
  await browser.close();
  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n${results.length - failed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
})().catch(async (e) => {
  console.error('E2E CRASH', e.message);
  if (global.__page) await global.__page.screenshot({ path: 'shots/crash.png', fullPage: true }).catch(() => null);
  process.exit(2);
});
