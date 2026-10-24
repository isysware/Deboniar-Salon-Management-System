// src/app.js
// Express application — middleware stack + route mounting.
// No listen() here; that belongs in server.js (testability).

import express        from 'express';
import helmet         from 'helmet';
import cors           from 'cors';
import morgan         from 'morgan';
import cookieParser   from 'cookie-parser';
import { env }        from './config/env.js';
import apiRouter      from './routes.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';

const app = express();

// ── Security ──────────────────────────────────────────────────────────────────
app.use(helmet());

const configuredOrigins = (env.corsOrigin || 'http://localhost:3000')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (
      configuredOrigins.includes(origin) ||
      configuredOrigins.includes('*') ||
      origin.endsWith('.vercel.app') ||
      origin.includes('localhost') ||
      origin.includes('127.0.0.1')
    ) {
      return callback(null, true);
    }
    return callback(new Error(`CORS blocked for origin: ${origin}`));
  },
  credentials: true, // Required for the httpOnly refresh cookie
  methods:     ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key'],
}));

// ── Body parsing ──────────────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ── Logging ───────────────────────────────────────────────────────────────────
if (env.nodeEnv !== 'test') app.use(morgan(env.isDev ? 'dev' : 'combined'));

// ── Health & Root ─────────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'SalonOS API Server is running', timestamp: new Date().toISOString() });
});

// ── API routes ────────────────────────────────────────────────────────────────
app.use('/api/v1', apiRouter);

// ── Error handling ────────────────────────────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

export default app;
