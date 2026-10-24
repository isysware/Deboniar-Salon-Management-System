// src/modules/auth/auth.routes.js
// Auth router — public + protected endpoints.

import { Router }          from 'express';
import { authenticate }    from '../../middleware/authenticate.js';
import { validate }        from '../../middleware/validate.js';
import {
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
} from './auth.schema.js';
import {
  loginController,
  refreshController,
  logoutController,
  getMeController,
  changePasswordController,
  forgotPasswordController,
  resetPasswordController,
} from './auth.controller.js';

const router = Router();

// ── Public routes ─────────────────────────────────────────────────────────────
router.post('/login',          validate(loginSchema),          loginController);
router.post('/refresh',                                        refreshController);
router.post('/logout',                                         logoutController);
router.post('/forgot-password', validate(forgotPasswordSchema), forgotPasswordController);
router.post('/reset-password',  validate(resetPasswordSchema),  resetPasswordController);

// ── Protected routes ──────────────────────────────────────────────────────────
router.get( '/me',              authenticate,                  getMeController);
router.post('/change-password', authenticate, validate(changePasswordSchema), changePasswordController);

export default router;
