import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { isTruthy } from '../utils/env';

export interface MailMessage {
  to: string;
  subject: string;
  text?: string;
  html?: string;
}

interface MailConfig {
  host: string;
  port: number;
  secure: boolean;
  user?: string;
  pass?: string;
  from: string;
  useStub?: boolean;
}

const resolveMailConfig = (): MailConfig => {
  const allowStub = isTruthy(process.env.SMTP_ALLOW_STUB, false) || process.env.NODE_ENV === 'test';
  const host = String(process.env.SMTP_HOST ?? '').trim();
  const portRaw = Number(process.env.SMTP_PORT ?? 0);
  const port = Number.isFinite(portRaw) && portRaw > 0 ? portRaw : 587;
  const secure = isTruthy(process.env.SMTP_SECURE, false);
  const user = String(process.env.SMTP_USER ?? '').trim();
  const pass = String(process.env.SMTP_PASS ?? '').trim();
  const from = String(process.env.SMTP_FROM ?? '').trim();
  if ((!host || !from) && allowStub) {
    return {
      host: '',
      port: 0,
      secure: false,
      from: from || 'HookCode <no-reply@localhost>',
      useStub: true
    };
  }
  if (!host || !from) {
    throw new Error('SMTP_HOST and SMTP_FROM are required to send mail');
  }
  return { host, port, secure, user: user || undefined, pass: pass || undefined, from };
};

const resolveTransporter = (): Transporter => {
  const config = resolveMailConfig();
  if (config.useStub) {
    return nodemailer.createTransport({
      streamTransport: true,
      buffer: true,
      newline: 'unix'
    });
  }
  const auth = config.user && config.pass ? { user: config.user, pass: config.pass } : undefined;
  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth
  });
};

let cachedTransport: Transporter | null = null;

export const sendMail = async (message: MailMessage): Promise<void> => {
  // Use a cached transport to avoid re-creating SMTP connections. docs/en/developer/plans/multiuserauth20260226/task_plan.md multiuserauth20260226
  if (!cachedTransport) {
    cachedTransport = resolveTransporter();
  }
  const config = resolveMailConfig();
  await cachedTransport.sendMail({
    from: config.from,
    to: message.to,
    subject: message.subject,
    text: message.text,
    html: message.html
  });
};
