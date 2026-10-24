# SalonOS — Device Integration Architecture & Implementation Plan

This document outlines the end-to-end architecture and implementation roadmap for hardware device integrations in **SalonOS (iSysware)**.

---

## Overview & Scope
Salon operations rely on physical hardware across branches:
1. **Biometric Attendance Terminals** (ZKTeco, Hikvision, Realand, BioTime): Automated employee check-in/out mapped to employee codes.
2. **Thermal Receipt POS Printers** (Epson TM-T88/TM-T20, Star Micronics, Xprinter, ESC/POS network/USB): Instant customer invoices, receipt cuts, and drawer triggers.
3. **Barcode / QR Scanners** (Honeywell, Zebra, Netum, Datalogic): Rapid retail inventory lookup and POS item addition.
4. **Card Payment / EFTPOS Terminals** (Pax, Ingenico, Verifone, Sunmi): Credit/debit card swipe and transaction confirmation.
5. **Cash Drawers** (RJ11 / RJ12 via receipt printer kick or USB trigger): Automated drawer kick on cash settlements.

---

## 10-Step Implementation Roadmap

| Step | Component | Description | Status |
|:---|:---|:---|:---:|
| **Step 1** | **Database Schema (Prisma)** | Defined `DeviceType`, `DeviceConnectionType`, `DeviceStatus`, `Device`, and `DeviceLog` models with relations to `Branch`. | ✅ **Completed** |
| **Step 2** | **Migration & Prisma Client** | Generated migration `20261019060553_device_integration`, applied to PostgreSQL, and re-generated `@prisma/client`. | ✅ **Completed** |
| **Step 3** | **Zod Validation Schemas** | Created `backend/src/modules/devices/device.schema.js` with schemas for creation, updates, TCP ping, and sync filters. | ✅ **Completed** |
| **Step 4** | **Backend Service Layer** | Created `backend/src/modules/devices/device.service.js` with CRUD, socket ping testing (`net.Socket`), punch sync, and audit logging. | ✅ **Completed** |
| **Step 5** | **Backend Controllers & Routes** | Created `device.controller.js` and `device.routes.js` with authentication and role-based guards (`SUPER_ADMIN`, `ADMIN`). | ✅ **Completed** |
| **Step 6** | **Central Express Mounting** | Mounted `deviceRoutes` under `/api/v1/devices` in `backend/src/routes.js` preserving all existing routes intact. | ✅ **Completed** |
| **Step 7** | **Frontend Service Contract & Types** | Created `types/devices.ts`, re-exported in `types/salon.ts`, updated `salonService.ts`, `httpSalonService.ts`, and `mockSalonService.ts`. | ✅ **Completed** |
| **Step 8** | **Device Integration UI & Modals** | Created `DeviceIntegrationView.tsx` with 4 KPI cards, filter bar, data table, Add/Edit modal, Test Ping modal, and Logs drawer. | ✅ **Completed** |
| **Step 9** | **Branch Settings & Navigation Wiring** | Added "Hardware & Devices" tab to `BranchSettingsPage.tsx`, `/admin/devices` route in `AppRouter.tsx`, and sidebar navigation. | ✅ **Completed** |
| **Step 10** | **Automated Tests & Verification** | Created `tests/33-device-integration.test.js` (10/10 tests passed) and verified frontend production build (0 TypeScript errors). | ✅ **Completed** |

---

## Technical Specifications & Details

### 1. Database Schema & Migration
- **Tables Created**:
  - `Device`: `(id, branchId, name, deviceType, brand, model, serialNumber, connectionType, ipAddress, port, macAddress, baudRate, communicationKey, status, isActive, lastPingAt, lastSyncAt, lastSyncStatus, config, createdAt, updatedAt)`
  - `DeviceLog`: `(id, deviceId, branchId, eventType, status, message, payload, createdAt)`
- **Enums**:
  - `DeviceType`: `BIOMETRIC_ATTENDANCE`, `POS_PRINTER`, `BARCODE_SCANNER`, `PAYMENT_TERMINAL`, `CASH_DRAWER`
  - `DeviceConnectionType`: `ETHERNET_LAN`, `WIFI`, `USB`, `SERIAL_COM`, `BLUETOOTH`, `CLOUD_API`
  - `DeviceStatus`: `ONLINE`, `OFFLINE`, `SYNCING`, `ERROR`

### 2. Backend API Surface (`/api/v1/devices`)
- `GET /api/v1/devices?branchId=...&deviceType=...&status=...`: List branch devices
- `GET /api/v1/devices/:id`: Retrieve single device with branch and logs
- `POST /api/v1/devices`: Register new hardware device
- `PUT /api/v1/devices/:id`: Update hardware parameters & settings
- `POST /api/v1/devices/:id/toggle`: Toggle active/inactive state
- `DELETE /api/v1/devices/:id`: Remove device
- `POST /api/v1/devices/:id/test-connection`: Execute live TCP socket ping / latency handshake
- `POST /api/v1/devices/:id/sync`: Synchronize punch log buffer & employee profiles
- `GET /api/v1/devices/:id/logs`: Fetch recent diagnostic and heartbeat logs

### 3. Frontend UI Integration
- Accessible directly in **Branch Settings** (`/admin/branch-settings`) under the **"Hardware & Devices"** tab.
- Also accessible via dedicated admin navigation menu: **Administration → System & Branch Settings → Hardware & Device Integration** (`/admin/devices`).
- Smart presets:
  - Selecting `BIOMETRIC_ATTENDANCE` auto-populates ZKTeco defaults (Port: 4370, CommKey: 0).
  - Selecting `POS_PRINTER` auto-populates ESC/POS defaults (Port: 9100, 80mm paper size, auto-cut option).
  - Direct ping tool displays latency in milliseconds (ms) with troubleshooting checklist.
