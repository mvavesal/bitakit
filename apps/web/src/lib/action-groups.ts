/** Action groups this application renders. A group only names related actions; components decide where it appears. */
export const actionGroups = {
  navigation: 'navigation.main',
  preferences: 'account.preferences',
  account: 'account.commands',
  member: 'organization.member.menu',
  invitation: 'organization.invitation.menu',
} as const;
