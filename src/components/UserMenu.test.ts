// @vitest-environment happy-dom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { User } from '@supabase/supabase-js';

const m = vi.hoisted(() => ({
  authFetch: vi.fn(),
  push: vi.fn(),
  updateUser: vi.fn(),
  signOut: vi.fn(),
  clearGuestIdentity: vi.fn(),
  clearLocalLearningData: vi.fn(),
  profile: { display_name: 'נועה' as string | null, avatar_url: null as string | null },
  session: null as { user: unknown } | null,
}));

vi.mock('@/lib/auth-fetch', () => ({ authFetch: m.authFetch }));
vi.mock('@/lib/guest', () => ({ clearGuestIdentity: m.clearGuestIdentity }));
vi.mock('@/lib/local-learning-data', () => ({ clearLocalLearningData: m.clearLocalLearningData }));
vi.mock('@/lib/date-local', async importOriginal => ({
  ...(await importOriginal<typeof import('@/lib/date-local')>()),
  todayLocalStr: () => '2026-10-22',
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: m.push }) }));
vi.mock('next/link', async () => {
  const { createElement: h } = await import('react');
  return { default: ({ href, ...rest }: { href: string }) => h('a', { href, ...rest }) };
});
vi.mock('@/lib/supabase', () => ({
  createClient: () => ({
    auth: {
      onAuthStateChange: (cb: (event: string, session: unknown) => void) => {
        queueMicrotask(() => cb('INITIAL_SESSION', m.session));
        return { data: { subscription: { unsubscribe() {} } } };
      },
      updateUser: m.updateUser,
      signOut: m.signOut,
    },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: m.profile, error: null }) }) }) }),
  }),
}));

import { UserMenu } from './UserMenu';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const emailUser = { id: 'u1', email: 'student@example.com', app_metadata: { provider: 'email' }, user_metadata: {} } as unknown as User;
const googleUser = { ...emailUser, app_metadata: { provider: 'google' } } as unknown as User;

const ok = (body: unknown, status = 200) => Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }));

let root: Root;
let host: HTMLDivElement;

async function render(previewUser?: User) {
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  const Menu = UserMenu as (props: { previewUser?: User }) => ReturnType<typeof UserMenu>;
  await act(async () => { root.render(createElement(Menu, { previewUser })); });
  await act(async () => {});
}

async function openMenu() {
  await act(async () => { host.querySelector<HTMLButtonElement>('button[aria-haspopup="dialog"]')!.click(); });
  await act(async () => {});
  return document.getElementById('user-menu')!;
}

const panelText = () => document.getElementById('user-menu')?.textContent ?? '';
const groups = (panel: HTMLElement) => [...panel.querySelectorAll('[data-menu-group]')].map(g => g.getAttribute('data-menu-group'));
const byText = (text: string, scope: ParentNode = document) =>
  [...scope.querySelectorAll<HTMLElement>('button, a')].find(el => el.textContent?.trim() === text)!;
const click = (el: HTMLElement) => act(async () => { el.click(); });

/** Sets a controlled input's value the way a keystroke would. */
async function type(el: HTMLInputElement, value: string) {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
}
const submit = (form: HTMLFormElement) => act(async () => { form.requestSubmit(); });

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  document.documentElement.className = '';
  m.profile = { display_name: 'נועה', avatar_url: null };
  m.session = null;
  m.signOut.mockResolvedValue({ error: null });
  m.updateUser.mockResolvedValue({ error: null });
  m.clearGuestIdentity.mockResolvedValue(undefined);
  m.authFetch.mockImplementation((url: string, init: RequestInit = {}) => {
    if (url === '/api/streak') return ok({ streak: 5 });
    if (url === '/api/goals') return ok({ examDate: '2026-12-14', dailyActivityTarget: 15 });
    if (url === '/api/profile/update-name') return ok({ ok: true, displayName: JSON.parse(String(init.body)).displayName });
    if (url === '/api/profile/upload-avatar') return ok({ ok: true, avatarUrl: 'https://cdn.test/a.png?t=1' });
    if (url === '/api/account') return ok({ ok: true });
    return ok({}, 404);
  });
});

afterEach(async () => {
  await act(async () => root.unmount());
  document.body.innerHTML = '';
});

describe('UserMenu — signed in', () => {
  it('renders the grouped structure in the approved order', async () => {
    await render(emailUser);
    const panel = await openMenu();

    expect(panel.getAttribute('role')).toBe('dialog');
    expect(panel.dataset.menuState).toBe('account');
    expect(groups(panel)).toEqual(['learning', 'prefs', 'account', 'info']);

    const text = panelText();
    expect(text).toContain('נועה');
    expect(text).toContain('student@example.com');
    expect(panel.querySelector('[data-streak]')?.textContent).toContain('רצף 5 ימים');

    expect(byText('הסטטיסטיקה שלי', panel).getAttribute('href')).toBe('/stats');
    expect(byText('הציון הרשמי', panel).getAttribute('href')).toBe('/stats#official-scores');
    expect(panel.querySelector('[data-value="exam-date"]')?.textContent).toBe('14 בדצמבר 2026');
    expect(panel.querySelector('[data-goal-value]')?.textContent).toBe('15');
    expect(panel.querySelector('[role="radiogroup"]')?.textContent).toBe('בהירכהה');
    expect(panel.querySelector('[role="switch"]')?.textContent).toContain('הגיית מילים');
    for (const label of ['שם תצוגה ותמונה', 'שינוי סיסמה', 'מחיקת חשבון', 'התנתקות']) expect(byText(label, panel)).toBeTruthy();
    expect(byText('עזרה ותמיכה', panel).getAttribute('href')).toBe('/help');
    // Privacy/terms are demoted to small-print at the very bottom; both links open /privacy.
    const legal = [...panel.querySelectorAll('a[href="/privacy"]')];
    expect(legal.map(a => a.textContent)).toEqual(['תנאי שימוש', 'מדיניות פרטיות']);
    expect(byText('התנתקות', panel)).toBeTruthy();
    expect(panel.lastElementChild?.textContent).toBe('תנאי שימוש · מדיניות פרטיות');
  });

  it('offers to set a display name when there is none', async () => {
    m.profile = { display_name: null, avatar_url: null };
    await render(emailUser);
    const panel = await openMenu();
    expect(byText('הגדר שם תצוגה', panel)).toBeTruthy();
  });

  it('hides password change for a Google account', async () => {
    await render(googleUser);
    await openMenu();
    expect(panelText()).not.toContain('שינוי סיסמה');
    expect(panelText()).toContain('מחיקת חשבון');
  });

  it('closes on Escape and returns focus to the avatar', async () => {
    await render(emailUser);
    await openMenu();
    await act(async () => { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); });
    expect(document.getElementById('user-menu')).toBeNull();
    expect(document.activeElement?.getAttribute('aria-label')).toBe('החשבון שלי');
  });

  it('steps through rows with the arrow keys', async () => {
    await render(emailUser);
    const panel = await openMenu();
    await act(async () => { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' })); });
    const first = document.activeElement;
    expect(panel.contains(first)).toBe(true);
    await act(async () => { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' })); });
    expect(document.activeElement).not.toBe(first);
    expect(panel.contains(document.activeElement)).toBe(true);
  });
});

describe('UserMenu — daily goal', () => {
  it('reads the target from /api/goals and saves a change with one PUT', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    try {
      await render(emailUser);
      const panel = await openMenu();
      const more = panel.querySelector<HTMLButtonElement>('button[aria-label="יותר שאלות"]')!;
      await click(more);
      await click(more);
      expect(panel.querySelector('[data-goal-value]')?.textContent).toBe('25');
      expect(m.authFetch).not.toHaveBeenCalledWith('/api/goals', expect.objectContaining({ method: 'PUT' }));
      await act(async () => { vi.advanceTimersByTime(500); });
      const puts = m.authFetch.mock.calls.filter(([url, init]) => url === '/api/goals' && init?.method === 'PUT');
      expect(puts).toHaveLength(1);
      expect(JSON.parse(puts[0][1].body)).toEqual({ dailyActivityTarget: 25 });
    } finally {
      vi.useRealTimers();
    }
  });

  it('goes back to the saved value when the save fails', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    try {
      m.authFetch.mockImplementation((url: string, init: RequestInit = {}) => {
        if (url === '/api/goals') return init.method === 'PUT' ? ok({ error: 'x' }, 500) : ok({ examDate: null, dailyActivityTarget: 15 });
        return ok({ streak: 0 });
      });
      await render(emailUser);
      const panel = await openMenu();
      await click(panel.querySelector<HTMLButtonElement>('button[aria-label="פחות שאלות"]')!);
      expect(panel.querySelector('[data-goal-value]')?.textContent).toBe('10');
      await act(async () => { vi.advanceTimersByTime(500); });
      await act(async () => {});
      expect(panel.querySelector('[data-goal-value]')?.textContent).toBe('15');
      expect(panelText()).toContain('לא נשמר. נסה שוב');
    } finally {
      vi.useRealTimers();
    }
  });

  it('stops at the 5–50 range', async () => {
    m.authFetch.mockImplementation((url: string) => ok(url === '/api/goals' ? { examDate: null, dailyActivityTarget: 50 } : { streak: 0 }));
    await render(emailUser);
    const panel = await openMenu();
    expect(panel.querySelector<HTMLButtonElement>('button[aria-label="יותר שאלות"]')!.disabled).toBe(true);
  });
});

describe('UserMenu — guest', () => {
  it('shows a sign-in call to action and only the guest-safe groups', async () => {
    await render();
    const panel = await openMenu();

    expect(panel.dataset.menuState).toBe('guest');
    expect(groups(panel)).toEqual(['prefs', 'info']);
    expect(byText('התחברות / הרשמה', panel).getAttribute('href')).toBe('/auth/login');
    for (const hidden of ['שינוי סיסמה', 'מחיקת חשבון', 'שם תצוגה ותמונה', 'התנתקות', 'תאריך המבחן', 'הסטטיסטיקה שלי']) {
      expect(panelText()).not.toContain(hidden);
    }
    expect(m.authFetch).not.toHaveBeenCalledWith('/api/goals');
  });
});

describe('UserMenu — preferences', () => {
  it('switches the theme with the same mechanism as ThemeToggle', async () => {
    await render(emailUser);
    const panel = await openMenu();
    const [light, dark] = panel.querySelectorAll<HTMLButtonElement>('[role="radio"]');
    expect(light.getAttribute('aria-checked')).toBe('true');
    await click(dark);
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(localStorage.getItem('theme')).toBe('dark');
    expect(dark.getAttribute('aria-checked')).toBe('true');
  });

  it('turns word pronunciation off and persists it', async () => {
    await render();
    const panel = await openMenu();
    const sw = panel.querySelector<HTMLButtonElement>('[role="switch"]')!;
    expect(sw.getAttribute('aria-checked')).toBe('true');
    await click(sw);
    expect(sw.getAttribute('aria-checked')).toBe('false');
    expect(localStorage.getItem('amiret_word_audio')).toBe('off');
  });
});

describe('UserMenu — existing account flows', () => {
  it('saves the display name through /api/profile/update-name', async () => {
    await render(emailUser);
    const panel = await openMenu();
    await click(byText('שם תצוגה ותמונה', panel));
    const input = panel.querySelector<HTMLInputElement>('[data-autofocus="name"]')!;
    await type(input, 'נועה לוי');
    await submit(input.form!);
    expect(m.authFetch).toHaveBeenCalledWith('/api/profile/update-name', expect.objectContaining({
      method: 'POST', body: JSON.stringify({ displayName: 'נועה לוי' }),
    }));
    expect(panelText()).toContain('נשמר');
  });

  it('uploads a new avatar through /api/profile/upload-avatar', async () => {
    await render(emailUser);
    await openMenu();
    const file = new File([new Uint8Array([1])], 'me.png', { type: 'image/png' });
    const input = host.querySelector<HTMLInputElement>('input[type="file"]')!;
    Object.defineProperty(input, 'files', { value: [file], configurable: true });
    await act(async () => { input.dispatchEvent(new Event('change', { bubbles: true })); });
    await act(async () => {});
    const [, init] = m.authFetch.mock.calls.find(([url]) => url === '/api/profile/upload-avatar')!;
    expect(init.method).toBe('POST');
    expect((init.body as FormData).get('file')).toBeTruthy();
  });

  it('changes the password with supabase.auth.updateUser', async () => {
    await render(emailUser);
    const panel = await openMenu();
    await click(byText('שינוי סיסמה', panel));
    const [pw, pw2] = panel.querySelectorAll<HTMLInputElement>('#user-menu input[autocomplete="new-password"]');
    await type(pw, 'secret123');
    await type(pw2, 'secret123');
    await submit(pw.form!);
    expect(m.updateUser).toHaveBeenCalledWith({ password: 'secret123' });
    expect(panelText()).toContain('הסיסמה עודכנה');
  });

  it('signs out, clearing this device first', async () => {
    await render(emailUser);
    const panel = await openMenu();
    await click(byText('התנתקות', panel));
    expect(m.clearLocalLearningData).toHaveBeenCalled();
    expect(m.signOut).toHaveBeenCalled();
    expect(m.push).toHaveBeenCalledWith('/auth/login');
  });
});

describe('UserMenu — account deletion', () => {
  async function openDeleteDialog() {
    await render(emailUser);
    const panel = await openMenu();
    await click(byText('מחיקת חשבון', panel));
    const dialog = document.querySelector<HTMLElement>('[role="dialog"][aria-modal="true"]')!;
    return { dialog, confirm: byText('מחיקת החשבון לצמיתות', dialog) as HTMLButtonElement, word: dialog.querySelector<HTMLInputElement>('input')! };
  }

  it('needs the typed confirmation before the delete button arms', async () => {
    const { confirm, word } = await openDeleteDialog();
    expect(document.getElementById('user-menu')).toBeNull();
    expect(confirm.disabled).toBe(true);
    await type(word, 'מחק');
    expect(confirm.disabled).toBe(true);
    await submit(word.form!);
    expect(m.authFetch).not.toHaveBeenCalledWith('/api/account', expect.anything());
  });

  it('deletes, signs out locally and goes home once confirmed', async () => {
    const { confirm, word } = await openDeleteDialog();
    await type(word, 'מחיקה');
    expect(confirm.disabled).toBe(false);
    await submit(word.form!);
    await act(async () => {});
    expect(m.authFetch).toHaveBeenCalledWith('/api/account', expect.objectContaining({
      method: 'DELETE', body: JSON.stringify({ confirm: 'DELETE_MY_ACCOUNT' }),
    }));
    expect(m.clearLocalLearningData).toHaveBeenCalled();
    expect(m.signOut).toHaveBeenCalledWith({ scope: 'local' });
    expect(m.push).toHaveBeenCalledWith('/');
  });

  it('keeps the account signed in and shows the error when deletion fails', async () => {
    m.authFetch.mockImplementation((url: string) => (url === '/api/account' ? ok({ error: 'המחיקה נכשלה באמצע. נסה שוב.' }, 500) : ok({}, 404)));
    const { dialog, word } = await openDeleteDialog();
    await type(word, 'מחיקה');
    await submit(word.form!);
    expect(dialog.textContent).toContain('המחיקה נכשלה באמצע. נסה שוב.');
    expect(m.signOut).not.toHaveBeenCalled();
    expect(m.push).not.toHaveBeenCalled();
  });
});
