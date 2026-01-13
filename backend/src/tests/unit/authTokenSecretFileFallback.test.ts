export {};

import fs from 'fs';
import os from 'os';
import path from 'path';

describe('auth token secret file fallback', () => {
  test('persists and reuses secret across module reload', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hookcode-auth-secret-'));
    const secretFile = path.join(dir, 'secret.txt');

    const prevSecret = process.env.AUTH_TOKEN_SECRET;
    const prevFile = process.env.HOOKCODE_AUTH_TOKEN_SECRET_FILE;
    const prevNodeEnv = process.env.NODE_ENV;

    delete process.env.AUTH_TOKEN_SECRET;
    process.env.HOOKCODE_AUTH_TOKEN_SECRET_FILE = secretFile;
    process.env.NODE_ENV = 'development';

    try {
      jest.resetModules();
      const { getAuthTokenSecret: getAuthTokenSecret1 } = await import('../../auth/authService');
      const secret1 = getAuthTokenSecret1();
      expect(secret1).toBeTruthy();

      expect(fs.existsSync(secretFile)).toBe(true);
      expect(fs.readFileSync(secretFile, 'utf8').trim()).toBe(secret1);

      jest.resetModules();
      const { getAuthTokenSecret: getAuthTokenSecret2 } = await import('../../auth/authService');
      const secret2 = getAuthTokenSecret2();
      expect(secret2).toBe(secret1);
    } finally {
      if (prevSecret === undefined) delete process.env.AUTH_TOKEN_SECRET;
      else process.env.AUTH_TOKEN_SECRET = prevSecret;

      if (prevFile === undefined) delete process.env.HOOKCODE_AUTH_TOKEN_SECRET_FILE;
      else process.env.HOOKCODE_AUTH_TOKEN_SECRET_FILE = prevFile;

      if (prevNodeEnv === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = prevNodeEnv;
    }
  });
});

