import { https } from 'firebase-functions';
import { app } from './server';

// Export the cloud function
export const api = https.onRequest(app);
