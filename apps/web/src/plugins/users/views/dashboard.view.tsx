import { defineView } from '@bitakit/core';
import { InviteDemo } from '../components/invite-demo';

export default defineView({ slot: 'dashboard.content', component: InviteDemo, order: 10 });
