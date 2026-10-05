import { defineSlot } from '@bitakit/core';
import { z } from 'zod';

/** The menu owner supplies the row context; contributors retain their own Action input. */
export const memberMenuSlot = defineSlot({
  id: 'organizations.member.menu',
  accepts: 'actions',
  payload: z.object({ organizationId: z.string(), memberId: z.string() }),
});

declare module '@bitakit/core' {
  interface SlotMap {
    'organizations.member.menu': typeof memberMenuSlot;
  }
}

const organizationContext = z.object({ organizationId: z.string().nullable() });
const invitationContext = organizationContext.extend({ invitationId: z.string() });
/** Placement contracts for the remaining first-party organization surfaces. */
export const organizationSlots = {
  memberMenu: memberMenuSlot,
  toolbar: defineSlot({
    id: 'organizations.toolbar',
    accepts: 'actions',
    payload: organizationContext,
  }),
  members: defineSlot({
    id: 'organizations.members',
    accepts: 'actions',
    payload: organizationContext,
  }),
  management: defineSlot({
    id: 'organizations.management',
    accepts: 'actions',
    payload: organizationContext,
  }),
  danger: defineSlot({
    id: 'organizations.danger',
    accepts: 'actions',
    payload: organizationContext,
  }),
  organization: defineSlot({
    id: 'organizations.organization',
    accepts: 'actions',
    payload: organizationContext,
  }),
  invitation: defineSlot({
    id: 'organizations.invitation',
    accepts: 'actions',
    payload: invitationContext,
  }),
  incoming: defineSlot({
    id: 'organizations.incoming',
    accepts: 'actions',
    payload: invitationContext,
  }),
} as const;
declare module '@bitakit/core' {
  interface SlotMap {
    'organizations.toolbar': typeof organizationSlots.toolbar;
    'organizations.members': typeof organizationSlots.members;
    'organizations.management': typeof organizationSlots.management;
    'organizations.danger': typeof organizationSlots.danger;
    'organizations.organization': typeof organizationSlots.organization;
    'organizations.invitation': typeof organizationSlots.invitation;
    'organizations.incoming': typeof organizationSlots.incoming;
  }
}
export type OrganizationActionSlot =
  (typeof organizationSlots)[keyof typeof organizationSlots]['id'];
