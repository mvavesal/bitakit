/** Only the invitation landing route is accepted by this login continuation. */
export function authReturnPath(value: unknown) {
  if (
    typeof value !== 'string' ||
    !value.startsWith('/') ||
    value.startsWith('//') ||
    value.includes('\\')
  )
    return '/dashboard';
  try {
    const url = new URL(value, 'https://local.invalid');
    if (url.origin !== 'https://local.invalid' || url.pathname !== '/organizations')
      return '/dashboard';
    const invitation = url.searchParams.get('invitation');
    return invitation
      ? `/organizations?invitation=${encodeURIComponent(invitation)}`
      : '/organizations';
  } catch {
    return '/dashboard';
  }
}
