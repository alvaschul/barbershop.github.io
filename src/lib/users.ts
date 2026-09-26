export function shouldLogoutAfterToggle(isSessionUser: boolean, wasActive: boolean): boolean {
  return isSessionUser && wasActive
}
