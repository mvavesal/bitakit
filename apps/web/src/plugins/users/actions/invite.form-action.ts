import { defineFormAction } from '@bitakit/core';
export default defineFormAction({
  groups: ['userManagement.dropdownMenu'],
  description: 'users.invite.description',
  requires: ['users'],
  fields: {
    email: { type: 'email', required: true },
  },
  async submit(values, { services }) {
    return services.users.invite(values);
  },
});
