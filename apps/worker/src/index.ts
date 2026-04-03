import { startReminderJob } from './jobs/reminders.js';
import { startRecalculationJob } from './jobs/recalculate.js';

console.log('Creditflow worker started');
startReminderJob();
startRecalculationJob();
