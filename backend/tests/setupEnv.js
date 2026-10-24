// tests/setupEnv.js — load the test environment before any app module is imported.
import dotenv from 'dotenv';

dotenv.config({ path: '.env.test', override: true });
if (process.env.SALONOS_TEST_DATABASE_URL) process.env.DATABASE_URL = process.env.SALONOS_TEST_DATABASE_URL;
process.env.DIRECT_URL = process.env.DATABASE_URL;
