export const MIN_PASSWORD_LENGTH = 6;

export function recoveryLinkIsInvalid(hash: string) {
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  return params.has('error') || params.has('error_code');
}

export function validateNewPassword(password: string, confirmation: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `הסיסמה חייבת להכיל לפחות ${MIN_PASSWORD_LENGTH} תווים`;
  }
  if (password !== confirmation) return 'הסיסמאות אינן זהות';
  return null;
}

export function classifyPasswordUpdateError(error: { message: string; status?: number }) {
  const message = error.message.toLowerCase();
  if (message.includes('different from the old')) {
    return { invalidSession: false, message: 'הסיסמה החדשה חייבת להיות שונה מהסיסמה הנוכחית' };
  }
  if (message.includes('session') || error.status === 401) {
    return { invalidSession: true, message: null };
  }
  return { invalidSession: false, message: 'לא הצלחנו לעדכן את הסיסמה, נסה שוב' };
}
