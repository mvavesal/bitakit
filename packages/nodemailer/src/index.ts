import { createTransport } from 'nodemailer';
import { definePlugin, defineService } from '@bitakit/core';
import { emailService } from '@bitakit/email';
import { createMailService } from './service.js';
export type SMTPConfig = {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password: string;
  from: string;
};
export function nodemailerPlugin(config: SMTPConfig) {
  if (typeof window !== 'undefined') throw new Error('The Nodemailer plugin is server-only.');
  if (
    !config.host ||
    !Number.isInteger(config.port) ||
    config.port < 1 ||
    config.port > 65535 ||
    !config.user ||
    !config.password
  )
    throw new Error('SMTP configuration is incomplete.');
  if (/[\r\n]/.test(config.from) || !/[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+/.test(config.from))
    throw new Error('SMTP sender must include an email address.');
  return definePlugin({
    id: 'nodemailer',
    services: [
      defineService(
        ({ onStop }) => {
          const service = createMailService(
            createTransport({
              host: config.host,
              port: config.port,
              secure: config.secure,
              requireTLS: !config.secure,
              auth: { user: config.user, pass: config.password },
              logger: false,
              debug: false,
              connectionTimeout: 12000,
              greetingTimeout: 12000,
              socketTimeout: 15000,
            }),
            config.from,
          );
          onStop(() => {
            if ('dispose' in service && typeof service.dispose === 'function') service.dispose();
          });
          return service;
        },
        { provides: emailService },
      ),
    ],
  });
}
