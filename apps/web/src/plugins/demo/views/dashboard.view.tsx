import { defineView } from '@bitakit/core';
import { DemoDashboard } from '../components/demo-dashboard';

export default defineView({ slot: 'dashboard.content', component: DemoDashboard });
