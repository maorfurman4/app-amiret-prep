/** Accept local paths only, including when URL parsing normalizes slashes. */
export function safeRedirectPath(value: string | null): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || /[\\\u0000-\u001f\u007f]/.test(value)) return '/';
  try {
    const url = new URL(value, 'https://local.invalid');
    if (url.origin !== 'https://local.invalid') return '/';
    return `${url.pathname}${url.search}${url.hash}`;
  } catch { return '/'; }
}
