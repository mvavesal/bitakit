// Next normally replaces this server-action import with a client reference.
// The lifecycle tests never sign out and must never access auth/database services.
export async function logout() {
  throw new Error('Unexpected sign-out in action lifecycle test');
}
