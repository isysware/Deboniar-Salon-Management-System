// tests/helpers.js — shared helpers for API tests.
import request from 'supertest';
import app from '../src/app.js';

export const ACCOUNTS = {
  super:      { identifier: 'superadmin@isysware.com',         password: 'Super@Salon2026',   portal: 'SUPER_ADMIN' },
  admin:      { identifier: 'admin.gulberg@isysware.com',      password: 'Admin@Gulberg2026', portal: 'ADMIN' },
  adminKhi:   { identifier: 'admin.clifton@isysware.com',      password: 'Admin@Clifton2026', portal: 'ADMIN' },
  accountant: { identifier: 'accountant.gulberg@isysware.com', password: 'Accountant@2026',   portal: 'ACCOUNTANT' },
  staff:      { identifier: 'zara.stylist@isysware.com',       password: 'Staff@Zara2026',    portal: 'STAFF' },
};

const tokens = {};

/** Log in once per account and cache the access token. */
export const tokenFor = async (who) => {
  if (!tokens[who]) {
    let res = await request(app).post('/api/v1/auth/login').send(ACCOUNTS[who]);
    if (res.status !== 200) {
      res = await request(app).post('/api/v1/auth/login').send({ ...ACCOUNTS[who], password: 'admin123' });
    }
    if (res.status !== 200 && who === 'admin') {
      res = await request(app).post('/api/v1/auth/login').send({ identifier: 'huzaifawarsi2006@gmail.com', password: 'admin123', portal: 'ADMIN' });
    }
    if (res.status !== 200) throw new Error(`login ${who} failed: ${res.status} ${JSON.stringify(res.body)}`);
    tokens[who] = res.body.data.token;
  }
  return tokens[who];
};

const send = async (who, method, path, body, headers = {}) => {
  let req = request(app)[method](`/api/v1${path}`).set('Authorization', `Bearer ${await tokenFor(who)}`);
  for (const [k, v] of Object.entries(headers)) req = req.set(k, v);
  return body === undefined ? req : req.send(body);
};

/**
 * Authenticated calls, e.g. `await as('admin').post('/users', body)`.
 * Pass headers as the 3rd argument (e.g. { 'Idempotency-Key': 'k1' }).
 */
export const as = (who) => ({
  get:    (path, headers)       => send(who, 'get', path, undefined, headers),
  post:   (path, body, headers) => send(who, 'post', path, body ?? {}, headers),
  put:    (path, body, headers) => send(who, 'put', path, body ?? {}, headers),
  patch:  (path, body, headers) => send(who, 'patch', path, body ?? {}, headers),
  delete: (path, headers)       => send(who, 'delete', path, undefined, headers),
});

export const api = () => request(app);
export { app };
