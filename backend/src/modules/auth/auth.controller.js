// src/modules/auth/auth.controller.js
// Thin controllers — parse request, call service, send response.

import * as authService  from './auth.service.js';
import { toSessionDTO, toUserDTO } from './auth.mapper.js';
import { asyncHandler }  from '../../lib/asyncHandler.js';

export const loginController = asyncHandler(async (req, res) => {
  const { user, accessToken } = await authService.login(req.body, res);
  res.status(200).json({ data: toSessionDTO(user, accessToken) });
});

export const refreshController = asyncHandler(async (req, res) => {
  const { user, accessToken } = await authService.refresh(req.cookies?.[authService.REFRESH_COOKIE], res);
  res.status(200).json({ data: toSessionDTO(user, accessToken) });
});

export const logoutController = asyncHandler(async (req, res) => {
  await authService.logout(req.cookies?.[authService.REFRESH_COOKIE]);
  res.clearCookie(authService.REFRESH_COOKIE, { ...authService.REFRESH_COOKIE_OPTIONS, maxAge: undefined });
  res.status(200).json({ data: { message: 'Logged out successfully' } });
});

export const getMeController = asyncHandler(async (req, res) => {
  const user = await authService.getMe(req.user.id);
  res.status(200).json({ data: toUserDTO(user) });
});

export const changePasswordController = asyncHandler(async (req, res) => {
  await authService.changePassword(req.user.id, req.body);
  res.status(200).json({ data: { message: 'Password changed successfully' } });
});

export const forgotPasswordController = asyncHandler(async (req, res) => {
  const result = await authService.forgotPassword(req.body);
  res.status(200).json({ data: result });
});

export const resetPasswordController = asyncHandler(async (req, res) => {
  await authService.resetPassword(req.body);
  res.status(200).json({ data: { message: 'Password reset successfully. Please log in.' } });
});
