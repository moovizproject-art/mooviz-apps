import { httpsCallable } from 'firebase/functions';
import { functions } from './firebase';

interface SendEmailParams {
  to: string[] | 'all';
  subject: string;
  htmlBody: string;
  sendPush?: boolean;
}

interface SendEmailResult {
  sent: number;
  errors: number;
  pushSent?: number;
  message: string;
}

const sendBulkEmailFn = httpsCallable<SendEmailParams, SendEmailResult>(
  functions,
  'sendBulkEmail',
);

export async function sendEmail(params: SendEmailParams): Promise<SendEmailResult> {
  const result = await sendBulkEmailFn(params);
  return result.data;
}
