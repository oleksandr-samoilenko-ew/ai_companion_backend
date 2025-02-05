import * as functions from 'firebase-functions';
import { app } from './server';

// Export the Express app as a Firebase Cloud Function
export const app = functions.https.onRequest(app);
