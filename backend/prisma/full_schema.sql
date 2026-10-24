-- CreateEnum
CREATE TYPE "Role" AS ENUM ('SUPER_ADMIN', 'ADMIN', 'ACCOUNTANT', 'STAFF');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('UNPAID', 'PARTIAL', 'PAID');

-- CreateEnum
CREATE TYPE "InvoiceLifecycle" AS ENUM ('ACTIVE', 'PARTIALLY_REFUNDED', 'REFUNDED', 'VOIDED');

-- CreateEnum
CREATE TYPE "AppointmentStatus" AS ENUM ('PENDING', 'CONFIRMED', 'CHECKED_IN', 'IN_SERVICE', 'COMPLETED', 'CANCELLED', 'NO_SHOW');

-- CreateEnum
CREATE TYPE "BillingStatus" AS ENUM ('UNBILLED', 'BILLED');

-- CreateEnum
CREATE TYPE "DrawerStatus" AS ENUM ('OPEN', 'SETTLEMENT_PENDING', 'SETTLED');

-- CreateEnum
CREATE TYPE "MovementDirection" AS ENUM ('IN', 'OUT');

-- CreateEnum
CREATE TYPE "DrawerMovementType" AS ENUM ('OPENING_FLOAT', 'CASH_SALE', 'CASH_TIP', 'DUES_COLLECTION', 'CASH_REFUND', 'EXPENSE', 'EXPENSE_REVERSAL', 'PAYROLL_PAYOUT', 'SALARY_ADVANCE', 'COMMISSION_PAYOUT', 'TIP_PAYOUT', 'SUPPLIER_PAYMENT', 'SUPPLIER_REFUND', 'TRANSFER_IN', 'TRANSFER_OUT', 'SETTLEMENT_OUT', 'SETTLEMENT_IN', 'VARIANCE_ADJUSTMENT', 'ADJUSTMENT', 'REVERSAL');

-- CreateEnum
CREATE TYPE "AccountMovementType" AS ENUM ('OPENING_FLOAT', 'CASH_SALE', 'CASH_TIP', 'DUES_COLLECTION', 'CASH_REFUND', 'EXPENSE', 'EXPENSE_REVERSAL', 'PAYROLL_PAYOUT', 'SALARY_ADVANCE', 'COMMISSION_PAYOUT', 'TIP_PAYOUT', 'SUPPLIER_PAYMENT', 'SUPPLIER_REFUND', 'TRANSFER_IN', 'TRANSFER_OUT', 'SETTLEMENT_OUT', 'SETTLEMENT_IN', 'VARIANCE_ADJUSTMENT', 'ADJUSTMENT', 'REVERSAL');

-- CreateEnum
CREATE TYPE "PaymentAccountType" AS ENUM ('BANK', 'EASYPAISA', 'JAZZCASH', 'OTHER');

-- CreateEnum
CREATE TYPE "TaxTreatment" AS ENUM ('BRANCH_DEFAULT', 'SPECIFIC_RULE', 'EXEMPT');

-- CreateEnum
CREATE TYPE "ItemType" AS ENUM ('RETAIL_PRODUCT', 'SALON_CONSUMABLE', 'BOTH');

-- CreateEnum
CREATE TYPE "BatchStatus" AS ENUM ('VALID', 'QUARANTINED');

-- CreateEnum
CREATE TYPE "StockMovementType" AS ENUM ('OPENING_STOCK', 'PURCHASE_IN', 'SALES_RETURN_IN', 'SUPPLIER_REFUND_RESTOCK', 'POS_RETURN_IN', 'POSITIVE_ADJUSTMENT', 'BRANCH_TRANSFER_IN', 'POS_SALE_OUT', 'SALON_CONSUMPTION_OUT', 'SUPPLIER_RETURN_OUT', 'EXPIRED_OUT', 'DAMAGED_OUT', 'INTERNAL_USE_OUT', 'PROMOTIONAL_OUT', 'NEGATIVE_ADJUSTMENT', 'BRANCH_TRANSFER_OUT');

-- CreateEnum
CREATE TYPE "SupplierLedgerType" AS ENUM ('OPENING_BALANCE', 'PURCHASE_CREDIT', 'PURCHASE_BILL', 'SUPPLIER_PAYMENT', 'PURCHASE_RETURN', 'SUPPLIER_REFUND', 'APPROVED_ADJUSTMENT');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'ONLINE_ACCOUNT');

-- CreateEnum
CREATE TYPE "PurchasePaymentStatus" AS ENUM ('UNPAID', 'PARTIAL', 'PAID');

-- CreateEnum
CREATE TYPE "ExpenseStatus" AS ENUM ('DRAFT', 'POSTED', 'REVERSED');

-- CreateEnum
CREATE TYPE "ExpensePaymentMethod" AS ENUM ('CASH', 'ONLINE_ACCOUNT');

-- CreateEnum
CREATE TYPE "SettlementStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('PRESENT', 'ABSENT', 'LATE', 'HALF_DAY', 'PAID_LEAVE', 'UNPAID_LEAVE', 'HOLIDAY', 'MISSING_PUNCH', 'OFF_DAY');

-- CreateEnum
CREATE TYPE "AttendanceSource" AS ENUM ('MANUAL', 'IMPORT', 'BIOMETRIC');

-- CreateEnum
CREATE TYPE "PunchType" AS ENUM ('IN', 'OUT');

-- CreateEnum
CREATE TYPE "LeaveType" AS ENUM ('PAID', 'UNPAID');

-- CreateEnum
CREATE TYPE "LeaveStatus" AS ENUM ('ACTIVE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "OvertimeStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CompensationType" AS ENUM ('MONTHLY_SALARY', 'DAILY_SALARY', 'MONTHLY_PLUS_COMMISSION', 'DAILY_PLUS_COMMISSION', 'COMMISSION_ONLY');

-- CreateEnum
CREATE TYPE "ProrationMethod" AS ENUM ('CALENDAR_DAYS', 'WORKING_DAYS');

-- CreateEnum
CREATE TYPE "PayrollRunStatus" AS ENUM ('DRAFT', 'FINALIZED', 'PARTIALLY_PAID', 'PAID', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CommissionRunStatus" AS ENUM ('DRAFT', 'FINALIZED', 'PARTIALLY_PAID', 'PAID', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TipStatus" AS ENUM ('UNALLOCATED', 'PARTIALLY_ALLOCATED', 'FULLY_ALLOCATED');

-- CreateEnum
CREATE TYPE "TipAllocationType" AS ENUM ('DIRECT', 'POOLED_EQUAL', 'POOLED_CUSTOM');

-- CreateEnum
CREATE TYPE "RefundType" AS ENUM ('REFUND', 'VOID');

-- CreateEnum
CREATE TYPE "RestockType" AS ENUM ('RESALABLE', 'DAMAGED', 'NONE');

-- CreateEnum
CREATE TYPE "CommissionEventType" AS ENUM ('EARN', 'REVERSAL');

-- CreateEnum
CREATE TYPE "CustomerSource" AS ENUM ('WALK_IN', 'REFERRAL', 'SOCIAL_MEDIA', 'OTHER', 'INSTAGRAM', 'FACEBOOK', 'TIKTOK', 'GOOGLE', 'WORD_OF_MOUTH', 'INFLUENCER', 'RETURNING');

-- CreateEnum
CREATE TYPE "LineType" AS ENUM ('SERVICE', 'PACKAGE', 'PRODUCT');

-- CreateEnum
CREATE TYPE "DeviceType" AS ENUM ('BIOMETRIC_ATTENDANCE', 'POS_PRINTER', 'BARCODE_SCANNER', 'PAYMENT_TERMINAL', 'CASH_DRAWER');

-- CreateEnum
CREATE TYPE "DeviceConnectionType" AS ENUM ('ETHERNET_LAN', 'WIFI', 'USB', 'SERIAL_COM', 'BLUETOOTH', 'CLOUD_API');

-- CreateEnum
CREATE TYPE "DeviceStatus" AS ENUM ('ONLINE', 'OFFLINE', 'SYNCING', 'ERROR');

-- CreateEnum
CREATE TYPE "CashHolderKind" AS ENUM ('DRAWER', 'VAULT');

-- CreateEnum
CREATE TYPE "PurchasePaymentMethod" AS ENUM ('CASH', 'ONLINE', 'CREDIT', 'PARTIAL');

-- CreateEnum
CREATE TYPE "SupplierRefundTreatment" AS ENUM ('REDUCE_PAYABLE', 'SUPPLIER_CREDIT', 'CASH_REFUND', 'ONLINE_REFUND');

-- CreateTable
CREATE TABLE "Sequence" (
    "id" TEXT NOT NULL,
    "branchCode" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "lastValue" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Sequence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IdempotencyKey" (
    "key" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "route" TEXT NOT NULL,
    "statusCode" INTEGER NOT NULL DEFAULT 200,
    "responseJson" TEXT NOT NULL,
    "requestHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IdempotencyKey_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" TEXT NOT NULL,
    "branchId" TEXT,
    "userId" TEXT NOT NULL,
    "userName" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "before" JSONB,
    "after" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemSetting" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemSetting_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "branchId" TEXT,
    "staffId" TEXT,
    "title" TEXT,
    "phone" TEXT,
    "avatarUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefreshToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PasswordResetToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Branch" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Karachi',
    "currency" TEXT NOT NULL DEFAULT 'PKR',
    "taxEnabled" BOOLEAN NOT NULL DEFAULT false,
    "taxRate" DECIMAL(6,5) NOT NULL DEFAULT 0,
    "defaultTaxRuleId" TEXT,
    "openingCashFloat" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "taxRegistrationNumber" TEXT,
    "taxAuthority" TEXT,
    "assignedAdminId" TEXT,
    "logoUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Branch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaxRule" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "rate" DECIMAL(6,5) NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isBranchDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaxRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentAccount" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "accountType" "PaymentAccountType" NOT NULL,
    "providerName" TEXT NOT NULL,
    "accountHolder" TEXT NOT NULL,
    "accountIdentifier" TEXT,
    "openingBalance" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExpenseCategory" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExpenseCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollPolicy" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "monthlyAbsenceDivisor" TEXT NOT NULL DEFAULT '30',
    "customDivisorDays" INTEGER,
    "dailyStaffPaidLeaveEligibility" BOOLEAN NOT NULL DEFAULT true,
    "nonWorkedWeeklyOffPaid" BOOLEAN NOT NULL DEFAULT false,
    "nonWorkedHolidayPaid" BOOLEAN NOT NULL DEFAULT true,
    "prorationMethod" "ProrationMethod" NOT NULL DEFAULT 'CALENDAR_DAYS',
    "updatedByUserId" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayrollPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Staff" (
    "id" TEXT NOT NULL,
    "employeeCode" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "designation" TEXT NOT NULL,
    "roleTitle" TEXT NOT NULL,
    "joiningDate" DATE NOT NULL,
    "compensationType" "CompensationType" NOT NULL,
    "baseSalary" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "dailySalaryRate" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "commissionRate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "overtimeHourlyRate" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "effectiveDate" DATE NOT NULL,
    "requiresCompensationReview" BOOLEAN NOT NULL DEFAULT false,
    "startTime" TEXT NOT NULL DEFAULT '09:00',
    "endTime" TEXT NOT NULL DEFAULT '18:00',
    "lateGraceMinutes" INTEGER NOT NULL DEFAULT 15,
    "earlyGraceMinutes" INTEGER NOT NULL DEFAULT 15,
    "isOvernightShift" BOOLEAN NOT NULL DEFAULT false,
    "allowedLeaveDays" INTEGER NOT NULL DEFAULT 12,
    "leaveAllowancePeriod" TEXT NOT NULL DEFAULT 'YEARLY',
    "lateInDeduction" JSONB NOT NULL,
    "earlyExitDeduction" JSONB NOT NULL,
    "payrollDivisor" INTEGER NOT NULL DEFAULT 30,
    "combinationPolicy" TEXT NOT NULL DEFAULT 'BOTH',
    "specialties" TEXT[],
    "avatarUrl" TEXT,
    "hasPortalAccess" BOOLEAN NOT NULL DEFAULT false,
    "exitDate" DATE,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Staff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffCompensationHistory" (
    "id" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "effectiveDate" DATE NOT NULL,
    "changedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StaffCompensationHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceCategory" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ServiceCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Service" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "durationMinutes" INTEGER NOT NULL,
    "price" DECIMAL(14,2) NOT NULL,
    "taxTreatment" "TaxTreatment" NOT NULL DEFAULT 'BRANCH_DEFAULT',
    "specificTaxRuleId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Service_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Package" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "price" DECIMAL(14,2) NOT NULL,
    "taxTreatment" "TaxTreatment" NOT NULL DEFAULT 'BRANCH_DEFAULT',
    "specificTaxRuleId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Package_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PackageComponent" (
    "id" TEXT NOT NULL,
    "packageId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "allocationPercentage" DECIMAL(5,2) NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PackageComponent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Client" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "phoneNormalized" TEXT NOT NULL,
    "email" TEXT,
    "source" "CustomerSource",
    "sourceDetails" TEXT,
    "loyaltyPoints" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Appointment" (
    "id" TEXT NOT NULL,
    "appointmentNumber" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "clientId" TEXT,
    "clientName" TEXT NOT NULL,
    "clientPhone" TEXT NOT NULL,
    "clientEmail" TEXT,
    "customerSource" "CustomerSource",
    "customerSourceDetails" TEXT,
    "date" DATE NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "price" DECIMAL(14,2) NOT NULL,
    "status" "AppointmentStatus" NOT NULL DEFAULT 'PENDING',
    "billingStatus" "BillingStatus" NOT NULL DEFAULT 'UNBILLED',
    "linkedInvoiceId" TEXT,
    "linkedInvoiceNumber" TEXT,
    "notes" TEXT,
    "createdById" TEXT,
    "createdByName" TEXT,
    "updatedById" TEXT,
    "updatedByName" TEXT,
    "confirmedById" TEXT,
    "confirmedByName" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "cancelledById" TEXT,
    "cancelledByName" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "cancelReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Appointment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppointmentItem" (
    "id" TEXT NOT NULL,
    "appointmentId" TEXT NOT NULL,
    "lineInstanceId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "type" "LineType" NOT NULL,
    "itemId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "unitPrice" DECIMAL(14,2) NOT NULL,
    "staffId" TEXT NOT NULL,
    "staffName" TEXT NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,

    CONSTRAINT "AppointmentItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppointmentPackageComponent" (
    "id" TEXT NOT NULL,
    "appointmentItemId" TEXT NOT NULL,
    "componentInstanceId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "serviceId" TEXT NOT NULL,
    "serviceCode" TEXT NOT NULL,
    "serviceName" TEXT NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "allocationPercentage" DECIMAL(5,2) NOT NULL,
    "staffId" TEXT NOT NULL,
    "staffName" TEXT NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,

    CONSTRAINT "AppointmentPackageComponent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppointmentReschedule" (
    "id" TEXT NOT NULL,
    "appointmentId" TEXT NOT NULL,
    "previousDate" DATE NOT NULL,
    "previousStartTime" TEXT NOT NULL,
    "previousEndTime" TEXT NOT NULL,
    "newDate" DATE NOT NULL,
    "newStartTime" TEXT NOT NULL,
    "newEndTime" TEXT NOT NULL,
    "reason" TEXT,
    "byUserId" TEXT NOT NULL,
    "byName" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AppointmentReschedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CashDrawer" (
    "id" TEXT NOT NULL,
    "kind" "CashHolderKind" NOT NULL DEFAULT 'DRAWER',
    "branchId" TEXT NOT NULL,
    "custodianUserId" TEXT,
    "custodianName" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "status" "DrawerStatus" NOT NULL DEFAULT 'OPEN',
    "lastCountedCash" DECIMAL(14,2),
    "lastCountedAt" TIMESTAMP(3),
    "lastVariance" DECIMAL(14,2),
    "closedAt" TIMESTAMP(3),
    "settledAt" TIMESTAMP(3),
    "successorDrawerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CashDrawer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DrawerMovement" (
    "id" TEXT NOT NULL,
    "drawerId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "type" "DrawerMovementType" NOT NULL,
    "direction" "MovementDirection" NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "sourceModule" TEXT NOT NULL,
    "sourceId" TEXT,
    "reference" TEXT,
    "description" TEXT,
    "userId" TEXT NOT NULL,
    "userName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DrawerMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccountMovement" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "type" "AccountMovementType" NOT NULL,
    "direction" "MovementDirection" NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "sourceModule" TEXT NOT NULL,
    "sourceId" TEXT,
    "reference" TEXT,
    "description" TEXT,
    "userId" TEXT NOT NULL,
    "userName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccountMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CashTransfer" (
    "id" TEXT NOT NULL,
    "transferNumber" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "fromSource" TEXT NOT NULL DEFAULT 'BRANCH_VAULT',
    "fromDrawerId" TEXT NOT NULL,
    "toDrawerId" TEXT NOT NULL,
    "toCustodianUserId" TEXT NOT NULL,
    "toCustodianName" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "notes" TEXT,
    "transferredByUserId" TEXT NOT NULL,
    "transferredByName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CashTransfer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryItem" (
    "id" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "barcode" TEXT,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT,
    "brand" TEXT,
    "imageUrl" TEXT,
    "itemType" "ItemType" NOT NULL,
    "defaultPurchaseCost" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "sellingPrice" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "purchaseUnit" TEXT NOT NULL DEFAULT 'PIECE',
    "issueUnit" TEXT NOT NULL DEFAULT 'PIECE',
    "unitConversionRatio" DECIMAL(14,4),
    "taxTreatment" "TaxTreatment" NOT NULL DEFAULT 'BRANCH_DEFAULT',
    "specificTaxRuleId" TEXT,
    "minStockLevel" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "trackBatch" BOOLEAN NOT NULL DEFAULT true,
    "trackExpiry" BOOLEAN NOT NULL DEFAULT false,
    "nearExpiryAlertDays" INTEGER NOT NULL DEFAULT 60,
    "branchAvailability" TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryBatch" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "batchNumber" TEXT NOT NULL,
    "purchaseId" TEXT,
    "purchaseNumber" TEXT,
    "supplierId" TEXT,
    "supplierName" TEXT,
    "receivedDate" DATE NOT NULL,
    "mfgDate" DATE,
    "expiryDate" DATE,
    "initialQuantity" DECIMAL(14,4) NOT NULL,
    "remainingQuantity" DECIMAL(14,4) NOT NULL,
    "unitCost" DECIMAL(14,4) NOT NULL,
    "status" "BatchStatus" NOT NULL DEFAULT 'VALID',
    "quarantinedReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockMovement" (
    "id" TEXT NOT NULL,
    "movementNumber" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "batchId" TEXT,
    "movementType" "StockMovementType" NOT NULL,
    "direction" "MovementDirection" NOT NULL,
    "quantity" DECIMAL(14,4) NOT NULL,
    "unitCost" DECIMAL(14,4) NOT NULL,
    "totalCost" DECIMAL(14,2) NOT NULL,
    "sourceReferenceType" TEXT NOT NULL,
    "sourceReferenceId" TEXT NOT NULL,
    "sourceReferenceNumber" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "notes" TEXT,
    "userId" TEXT NOT NULL,
    "userName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Supplier" (
    "id" TEXT NOT NULL,
    "supplierCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "companyName" TEXT,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "contactPerson" TEXT,
    "address" TEXT,
    "taxNumber" TEXT,
    "notes" TEXT,
    "branchId" TEXT NOT NULL,
    "openingPayable" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT NOT NULL,
    "createdByName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierLedger" (
    "id" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "entryType" "SupplierLedgerType" NOT NULL,
    "referenceType" TEXT NOT NULL,
    "referenceId" TEXT NOT NULL,
    "referenceNumber" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "debit" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "credit" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "userId" TEXT NOT NULL,
    "userName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupplierLedger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Purchase" (
    "id" TEXT NOT NULL,
    "purchaseNumber" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "supplierName" TEXT NOT NULL,
    "purchaseDate" DATE NOT NULL,
    "supplierInvoiceNumber" TEXT,
    "notes" TEXT,
    "subtotal" DECIMAL(14,2) NOT NULL,
    "discount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "netAmount" DECIMAL(14,2) NOT NULL,
    "paidAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "balanceDue" DECIMAL(14,2) NOT NULL,
    "paymentMethod" "PurchasePaymentMethod" NOT NULL,
    "paymentStatus" "PurchasePaymentStatus" NOT NULL,
    "paymentAccountId" TEXT,
    "cashDrawerId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'POSTED',
    "createdById" TEXT NOT NULL,
    "createdByName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Purchase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseLine" (
    "id" TEXT NOT NULL,
    "purchaseId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "itemId" TEXT NOT NULL,
    "itemName" TEXT NOT NULL,
    "itemSku" TEXT NOT NULL,
    "quantity" DECIMAL(14,4) NOT NULL,
    "unitPurchaseCost" DECIMAL(14,2) NOT NULL,
    "lineDiscount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "lineTotal" DECIMAL(14,2) NOT NULL,
    "landedUnitCost" DECIMAL(14,4) NOT NULL,
    "batchNumber" TEXT NOT NULL,
    "expiryDate" DATE,
    "mfgDate" DATE,
    "batchId" TEXT NOT NULL,

    CONSTRAINT "PurchaseLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierPayment" (
    "id" TEXT NOT NULL,
    "paymentNumber" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "paymentDate" DATE NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "method" TEXT NOT NULL,
    "paymentAccountId" TEXT,
    "cashDrawerId" TEXT,
    "reference" TEXT,
    "notes" TEXT,
    "paidById" TEXT NOT NULL,
    "paidByName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "allocations" JSONB NOT NULL DEFAULT '[]',
    "reversedAt" TIMESTAMP(3),
    "reversedById" TEXT,
    "reversedByName" TEXT,
    "reversalReason" TEXT,
    "reversalDate" DATE,

    CONSTRAINT "SupplierPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierReturn" (
    "id" TEXT NOT NULL,
    "returnNumber" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "purchaseId" TEXT,
    "purchaseNumber" TEXT,
    "returnDate" DATE NOT NULL,
    "totalAmount" DECIMAL(14,2) NOT NULL,
    "refundTreatment" "SupplierRefundTreatment" NOT NULL,
    "paymentAccountId" TEXT,
    "cashDrawerId" TEXT,
    "reason" TEXT NOT NULL,
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "createdByName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupplierReturn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierReturnLine" (
    "id" TEXT NOT NULL,
    "returnId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "itemName" TEXT NOT NULL,
    "itemSku" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "batchNumber" TEXT NOT NULL,
    "quantity" DECIMAL(14,4) NOT NULL,
    "unitCost" DECIMAL(14,4) NOT NULL,
    "totalCost" DECIMAL(14,2) NOT NULL,

    CONSTRAINT "SupplierReturnLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockSettlement" (
    "id" TEXT NOT NULL,
    "settlementNumber" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "countDate" DATE NOT NULL,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'POSTED',
    "createdById" TEXT NOT NULL,
    "createdByName" TEXT NOT NULL,
    "approvedById" TEXT,
    "approvedByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "postedAt" TIMESTAMP(3),

    CONSTRAINT "StockSettlement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockSettlementLine" (
    "id" TEXT NOT NULL,
    "settlementId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "itemName" TEXT NOT NULL,
    "itemSku" TEXT NOT NULL,
    "batchId" TEXT,
    "batchNumber" TEXT,
    "systemQuantity" DECIMAL(14,4) NOT NULL,
    "countedQuantity" DECIMAL(14,4) NOT NULL,
    "difference" DECIMAL(14,4) NOT NULL,
    "unitCost" DECIMAL(14,4) NOT NULL,
    "costImpact" DECIMAL(14,2) NOT NULL,
    "reason" TEXT NOT NULL,
    "notes" TEXT,

    CONSTRAINT "StockSettlementLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "appointmentId" TEXT,
    "date" DATE NOT NULL,
    "time" TEXT NOT NULL,
    "clientId" TEXT,
    "clientName" TEXT NOT NULL,
    "clientPhone" TEXT NOT NULL,
    "customerSource" "CustomerSource",
    "customerSourceDetails" TEXT,
    "staffId" TEXT,
    "staffName" TEXT,
    "subtotal" DECIMAL(14,2) NOT NULL,
    "discount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "discountType" TEXT,
    "discountValue" DECIMAL(14,2),
    "netSales" DECIMAL(14,2) NOT NULL,
    "tax" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "tip" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(14,2) NOT NULL,
    "paymentMethod" TEXT NOT NULL DEFAULT 'CASH',
    "status" "InvoiceStatus" NOT NULL DEFAULT 'UNPAID',
    "lifecycle" "InvoiceLifecycle" NOT NULL DEFAULT 'ACTIVE',
    "amountPaid" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "amountDue" DECIMAL(14,2) NOT NULL,
    "processedByUserId" TEXT NOT NULL,
    "processedByName" TEXT NOT NULL,
    "idempotencyKey" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoiceLine" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "type" "LineType" NOT NULL,
    "itemId" TEXT NOT NULL,
    "code" TEXT,
    "name" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "staffName" TEXT NOT NULL,
    "staffCommissionRate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "quantity" DECIMAL(14,4) NOT NULL,
    "unitPrice" DECIMAL(14,2) NOT NULL,
    "discountAllocated" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "netSales" DECIMAL(14,2) NOT NULL,
    "taxTreatment" "TaxTreatment" NOT NULL,
    "taxRate" DECIMAL(6,5) NOT NULL,
    "tax" DECIMAL(14,2) NOT NULL,
    "total" DECIMAL(14,2) NOT NULL,
    "cogsAmount" DECIMAL(14,2),
    "unitCostSnapshot" DECIMAL(14,4),

    CONSTRAINT "InvoiceLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoiceLineComponent" (
    "id" TEXT NOT NULL,
    "lineId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "serviceId" TEXT NOT NULL,
    "serviceCode" TEXT NOT NULL,
    "serviceName" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "staffId" TEXT NOT NULL,
    "staffName" TEXT NOT NULL,
    "allocationPercentage" DECIMAL(5,2) NOT NULL,
    "allocatedAmount" DECIMAL(14,2) NOT NULL,
    "staffCommissionRate" DECIMAL(5,2) NOT NULL DEFAULT 0,

    CONSTRAINT "InvoiceLineComponent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoiceLineBatch" (
    "id" TEXT NOT NULL,
    "lineId" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "batchNumber" TEXT NOT NULL,
    "qty" DECIMAL(14,4) NOT NULL,
    "unitCost" DECIMAL(14,4) NOT NULL,

    CONSTRAINT "InvoiceLineBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoicePayment" (
    "id" TEXT NOT NULL,
    "receiptNumber" TEXT,
    "invoiceId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "time" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "billAmountAllocated" DECIMAL(14,2) NOT NULL,
    "tipAmountAllocated" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "method" "PaymentMethod" NOT NULL,
    "paymentAccountId" TEXT,
    "paymentAccountName" TEXT,
    "drawerId" TEXT,
    "cashTendered" DECIMAL(14,2),
    "changeReturned" DECIMAL(14,2),
    "previousBalance" DECIMAL(14,2),
    "remainingBalance" DECIMAL(14,2),
    "kind" TEXT NOT NULL DEFAULT 'POS',
    "processedByUserId" TEXT NOT NULL,
    "processedByName" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reversedAt" TIMESTAMP(3),
    "reversedById" TEXT,
    "reversedByName" TEXT,
    "reversalReason" TEXT,
    "reversalDate" DATE,

    CONSTRAINT "InvoicePayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommissionEvent" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "lineId" TEXT NOT NULL,
    "componentId" TEXT,
    "type" "CommissionEventType" NOT NULL,
    "attributedNet" DECIMAL(14,2) NOT NULL,
    "rate" DECIMAL(5,2) NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "eventDate" DATE NOT NULL,
    "consumedByRunId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommissionEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoiceRefund" (
    "id" TEXT NOT NULL,
    "refundNumber" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "type" "RefundType" NOT NULL,
    "refundDate" DATE NOT NULL,
    "netReversed" DECIMAL(14,2) NOT NULL,
    "taxReversed" DECIMAL(14,2) NOT NULL,
    "tipReversed" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "cashOut" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "receivableCancelled" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "method" "PaymentMethod",
    "accountId" TEXT,
    "drawerId" TEXT,
    "reason" TEXT NOT NULL,
    "byUserId" TEXT NOT NULL,
    "byName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InvoiceRefund_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefundLine" (
    "id" TEXT NOT NULL,
    "refundId" TEXT NOT NULL,
    "lineId" TEXT NOT NULL,
    "quantity" DECIMAL(14,4) NOT NULL,
    "net" DECIMAL(14,2) NOT NULL,
    "tax" DECIMAL(14,2) NOT NULL,
    "restock" "RestockType" NOT NULL DEFAULT 'NONE',

    CONSTRAINT "RefundLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Expense" (
    "id" TEXT NOT NULL,
    "voucherNumber" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "expenseDate" DATE NOT NULL,
    "time" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "payee" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "paymentSource" TEXT NOT NULL,
    "paymentAccountId" TEXT,
    "paymentAccountName" TEXT,
    "status" "ExpenseStatus" NOT NULL DEFAULT 'DRAFT',
    "externalReference" TEXT,
    "notes" TEXT,
    "idempotencyKey" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "createdByName" TEXT NOT NULL,
    "paidByUserId" TEXT,
    "paidByName" TEXT,
    "paidFromDrawerId" TEXT,
    "isReversalRecord" BOOLEAN NOT NULL DEFAULT false,
    "reversalOfVoucherNumber" TEXT,
    "reversalVoucherNumber" TEXT,
    "reversalReason" TEXT,
    "reversedByUserId" TEXT,
    "reversedByName" TEXT,
    "reversedAt" TIMESTAMP(3),
    "receivingDrawerId" TEXT,
    "receivingCustodianUserId" TEXT,
    "receivingCustodianName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Settlement" (
    "id" TEXT NOT NULL,
    "settlementNumber" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "drawerId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "time" TEXT NOT NULL,
    "expectedCash" DECIMAL(14,2) NOT NULL,
    "countedCash" DECIMAL(14,2) NOT NULL,
    "variance" DECIMAL(14,2) NOT NULL,
    "varianceExplanation" TEXT,
    "handoverAmount" DECIMAL(14,2) NOT NULL,
    "retainedFloat" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "destinationVaultId" TEXT,
    "destinationVaultName" TEXT,
    "denominationBreakdown" JSONB,
    "submittedByUserId" TEXT NOT NULL,
    "submittedByName" TEXT NOT NULL,
    "submittedByRole" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3),
    "receivedByUserId" TEXT,
    "receivedByName" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "status" "SettlementStatus" NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT,
    "varianceAdjustmentRecordId" TEXT,
    "successorDrawerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Settlement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CashVarianceAdjustment" (
    "id" TEXT NOT NULL,
    "adjustmentNumber" TEXT NOT NULL,
    "settlementId" TEXT NOT NULL,
    "settlementNumber" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "time" TEXT NOT NULL,
    "varianceAmount" DECIMAL(14,2) NOT NULL,
    "explanation" TEXT NOT NULL,
    "approvedByUserId" TEXT NOT NULL,
    "approvedByName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CashVarianceAdjustment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttendanceRecord" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "workDate" DATE NOT NULL,
    "checkIn" TEXT NOT NULL,
    "checkOut" TEXT,
    "scheduledHours" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "workedHours" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL,
    "source" "AttendanceSource" NOT NULL DEFAULT 'MANUAL',
    "isLate" BOOLEAN NOT NULL DEFAULT false,
    "lateMinutes" INTEGER NOT NULL DEFAULT 0,
    "isEarlyExit" BOOLEAN NOT NULL DEFAULT false,
    "earlyExitMinutes" INTEGER NOT NULL DEFAULT 0,
    "isMissingPunch" BOOLEAN NOT NULL DEFAULT false,
    "isOvernightShift" BOOLEAN NOT NULL DEFAULT false,
    "rawEventRef" TEXT,
    "calculationSnapshot" JSONB,
    "notes" TEXT,
    "leaveId" TEXT,
    "isFinalized" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AttendanceRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttendancePunch" (
    "id" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "timestamp" TEXT NOT NULL,
    "source" "AttendanceSource" NOT NULL DEFAULT 'MANUAL',
    "deviceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AttendancePunch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttendanceCorrection" (
    "id" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "beforeSnapshot" JSONB NOT NULL,
    "afterSnapshot" JSONB NOT NULL,
    "reason" TEXT NOT NULL,
    "editedByUserId" TEXT NOT NULL,
    "editedByName" TEXT NOT NULL,
    "editedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AttendanceCorrection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeaveRecord" (
    "id" TEXT NOT NULL,
    "leaveNumber" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "totalDays" INTEGER NOT NULL,
    "type" "LeaveType" NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'APPROVED',
    "createdByUserId" TEXT NOT NULL,
    "createdByName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cancelledAt" TIMESTAMP(3),
    "cancelledByUserId" TEXT,
    "cancelledByName" TEXT,
    "cancellationReason" TEXT,

    CONSTRAINT "LeaveRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BranchHoliday" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "title" TEXT NOT NULL,

    CONSTRAINT "BranchHoliday_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OvertimeRecord" (
    "id" TEXT NOT NULL,
    "overtimeNumber" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "workDate" DATE NOT NULL,
    "minutes" INTEGER NOT NULL,
    "approvedMinutes" INTEGER NOT NULL DEFAULT 0,
    "hourlyRate" DECIMAL(14,2),
    "amount" DECIMAL(14,2),
    "rateMultiplier" DECIMAL(4,2) NOT NULL DEFAULT 1,
    "reason" TEXT NOT NULL,
    "notes" TEXT,
    "status" "OvertimeStatus" NOT NULL DEFAULT 'SUBMITTED',
    "enteredByUserId" TEXT NOT NULL,
    "enteredByName" TEXT NOT NULL,
    "enteredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedByUserId" TEXT,
    "approvedByName" TEXT,
    "approvedAt" TIMESTAMP(3),
    "rejectedByUserId" TEXT,
    "rejectedByName" TEXT,
    "rejectedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "cancelledByUserId" TEXT,
    "cancelledByName" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "cancellationReason" TEXT,
    "payrollRunId" TEXT,

    CONSTRAINT "OvertimeRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollRun" (
    "id" TEXT NOT NULL,
    "payrollNumber" TEXT NOT NULL DEFAULT 'DRAFT',
    "branchId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "status" "PayrollRunStatus" NOT NULL DEFAULT 'DRAFT',
    "policySnapshot" JSONB NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "generatedByUserId" TEXT NOT NULL,
    "generatedByName" TEXT NOT NULL,
    "finalizedAt" TIMESTAMP(3),
    "finalizedByUserId" TEXT,
    "finalizedByName" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "cancelledByUserId" TEXT,
    "cancelledByName" TEXT,
    "cancellationReason" TEXT,
    "notes" TEXT,

    CONSTRAINT "PayrollRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payslip" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "payslipNumber" TEXT NOT NULL DEFAULT 'DRAFT',
    "staffId" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "netPayable" DECIMAL(14,2) NOT NULL,
    "grossPayable" DECIMAL(14,2) NOT NULL,

    CONSTRAINT "Payslip_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollPayment" (
    "id" TEXT NOT NULL,
    "paymentNumber" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "payslipId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "staffName" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "commissionAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "requestKey" TEXT,
    "method" TEXT NOT NULL,
    "cashDrawerId" TEXT,
    "onlineAccountId" TEXT,
    "onlineAccountName" TEXT,
    "reference" TEXT NOT NULL DEFAULT '',
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'COMPLETED',
    "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paidByUserId" TEXT NOT NULL,
    "paidByName" TEXT NOT NULL,
    "reversedAt" TIMESTAMP(3),
    "reversedByUserId" TEXT,
    "reversedByName" TEXT,
    "reversalReason" TEXT,

    CONSTRAINT "PayrollPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffAllowance" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdByUserId" TEXT NOT NULL,
    "createdByName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffAllowance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollAdjustment" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "payrollRunId" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "createdByName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cancelledAt" TIMESTAMP(3),
    "cancelledByUserId" TEXT,
    "cancelledByName" TEXT,

    CONSTRAINT "PayrollAdjustment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalaryAdvance" (
    "id" TEXT NOT NULL,
    "advanceNumber" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "staffName" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "recoveryPerMonth" DECIMAL(14,2) NOT NULL,
    "startMonth" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "cashDrawerId" TEXT,
    "onlineAccountId" TEXT,
    "onlineAccountName" TEXT,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "issueDate" DATE NOT NULL,
    "issuedByUserId" TEXT NOT NULL,
    "issuedByName" TEXT NOT NULL,
    "reversedAt" TIMESTAMP(3),
    "reversedByUserId" TEXT,
    "reversedByName" TEXT,
    "reversalReason" TEXT,

    CONSTRAINT "SalaryAdvance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdvanceRecovery" (
    "id" TEXT NOT NULL,
    "advanceId" TEXT NOT NULL,
    "payrollRunId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdvanceRecovery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommissionRun" (
    "id" TEXT NOT NULL,
    "commissionNumber" TEXT NOT NULL DEFAULT 'DRAFT',
    "branchId" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "status" "CommissionRunStatus" NOT NULL DEFAULT 'DRAFT',
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "generatedByUserId" TEXT NOT NULL,
    "generatedByName" TEXT NOT NULL,
    "finalizedAt" TIMESTAMP(3),
    "finalizedByUserId" TEXT,
    "finalizedByName" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "cancelledByUserId" TEXT,
    "cancelledByName" TEXT,
    "cancellationReason" TEXT,

    CONSTRAINT "CommissionRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommissionStatement" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "statementNumber" TEXT NOT NULL DEFAULT 'DRAFT',
    "staffId" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "netPayable" DECIMAL(14,2) NOT NULL,
    "payrollPayslipId" TEXT,

    CONSTRAINT "CommissionStatement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommissionPayment" (
    "id" TEXT NOT NULL,
    "paymentNumber" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "statementId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "staffName" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "payrollPaymentId" TEXT,
    "requestKey" TEXT,
    "method" TEXT NOT NULL,
    "cashDrawerId" TEXT,
    "onlineAccountId" TEXT,
    "onlineAccountName" TEXT,
    "reference" TEXT NOT NULL DEFAULT '',
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'COMPLETED',
    "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paidByUserId" TEXT NOT NULL,
    "paidByName" TEXT NOT NULL,
    "reversedAt" TIMESTAMP(3),
    "reversedByUserId" TEXT,
    "reversedByName" TEXT,
    "reversalReason" TEXT,

    CONSTRAINT "CommissionPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TipReceipt" (
    "id" TEXT NOT NULL,
    "receiptNumber" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "collectionDate" DATE NOT NULL,
    "collectionTime" TEXT NOT NULL,
    "clientName" TEXT NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "paymentAccountId" TEXT,
    "paymentAccountName" TEXT,
    "cashDrawerId" TEXT,
    "collectedByUserId" TEXT NOT NULL,
    "collectedByName" TEXT NOT NULL,
    "collectedAmount" DECIMAL(14,2) NOT NULL,
    "directStaffId" TEXT,
    "directStaffName" TEXT,
    "allocatedAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "unallocatedAmount" DECIMAL(14,2) NOT NULL,
    "status" "TipStatus" NOT NULL DEFAULT 'UNALLOCATED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TipReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TipAllocation" (
    "id" TEXT NOT NULL,
    "allocationNumber" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "receiptId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "staffName" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "allocationType" "TipAllocationType" NOT NULL,
    "allocationDate" DATE NOT NULL,
    "allocationTime" TEXT NOT NULL,
    "allocatedByUserId" TEXT NOT NULL,
    "allocatedByName" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'UNPAID',
    "cancelledAt" TIMESTAMP(3),
    "cancellationDate" DATE,
    "cancelledByUserId" TEXT,
    "cancelledByName" TEXT,
    "cancelReason" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TipAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TipPayout" (
    "id" TEXT NOT NULL,
    "payoutNumber" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "allocationId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "staffName" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "method" TEXT NOT NULL,
    "cashDrawerId" TEXT,
    "onlineAccountId" TEXT,
    "onlineAccountName" TEXT,
    "payoutDate" DATE NOT NULL,
    "payoutTime" TEXT NOT NULL,
    "paidByUserId" TEXT NOT NULL,
    "paidByName" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'COMPLETED',
    "reversalReason" TEXT,
    "reversedAt" TIMESTAMP(3),
    "reversalDate" DATE,
    "reversedByUserId" TEXT,
    "reversedByName" TEXT,
    "reversalReceivingDrawerId" TEXT,
    "reference" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TipPayout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Device" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "deviceType" "DeviceType" NOT NULL,
    "brand" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "serialNumber" TEXT,
    "connectionType" "DeviceConnectionType" NOT NULL DEFAULT 'ETHERNET_LAN',
    "ipAddress" TEXT,
    "port" INTEGER,
    "macAddress" TEXT,
    "baudRate" INTEGER,
    "communicationKey" TEXT,
    "status" "DeviceStatus" NOT NULL DEFAULT 'OFFLINE',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastPingAt" TIMESTAMP(3),
    "lastSyncAt" TIMESTAMP(3),
    "lastSyncStatus" TEXT,
    "config" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Device_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeviceLog" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeviceLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Sequence_branchCode_prefix_year_key" ON "Sequence"("branchCode", "prefix", "year");

-- CreateIndex
CREATE INDEX "AuditEvent_branchId_idx" ON "AuditEvent"("branchId");

-- CreateIndex
CREATE INDEX "AuditEvent_userId_idx" ON "AuditEvent"("userId");

-- CreateIndex
CREATE INDEX "AuditEvent_entity_entityId_idx" ON "AuditEvent"("entity", "entityId");

-- CreateIndex
CREATE INDEX "AuditEvent_createdAt_idx" ON "AuditEvent"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_staffId_key" ON "User"("staffId");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE INDEX "User_branchId_idx" ON "User"("branchId");

-- CreateIndex
CREATE UNIQUE INDEX "RefreshToken_tokenHash_key" ON "RefreshToken"("tokenHash");

-- CreateIndex
CREATE INDEX "RefreshToken_userId_idx" ON "RefreshToken"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "PasswordResetToken_tokenHash_key" ON "PasswordResetToken"("tokenHash");

-- CreateIndex
CREATE INDEX "PasswordResetToken_userId_idx" ON "PasswordResetToken"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Branch_code_key" ON "Branch"("code");

-- CreateIndex
CREATE INDEX "TaxRule_branchId_idx" ON "TaxRule"("branchId");

-- CreateIndex
CREATE INDEX "PaymentAccount_branchId_idx" ON "PaymentAccount"("branchId");

-- CreateIndex
CREATE INDEX "ExpenseCategory_branchId_idx" ON "ExpenseCategory"("branchId");

-- CreateIndex
CREATE UNIQUE INDEX "ExpenseCategory_branchId_name_key" ON "ExpenseCategory"("branchId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollPolicy_branchId_key" ON "PayrollPolicy"("branchId");

-- CreateIndex
CREATE INDEX "Staff_branchId_idx" ON "Staff"("branchId");

-- CreateIndex
CREATE UNIQUE INDEX "Staff_branchId_employeeCode_key" ON "Staff"("branchId", "employeeCode");

-- CreateIndex
CREATE INDEX "StaffCompensationHistory_staffId_idx" ON "StaffCompensationHistory"("staffId");

-- CreateIndex
CREATE INDEX "ServiceCategory_branchId_idx" ON "ServiceCategory"("branchId");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceCategory_branchId_name_key" ON "ServiceCategory"("branchId", "name");

-- CreateIndex
CREATE INDEX "Service_branchId_idx" ON "Service"("branchId");

-- CreateIndex
CREATE UNIQUE INDEX "Service_branchId_code_key" ON "Service"("branchId", "code");

-- CreateIndex
CREATE INDEX "Package_branchId_idx" ON "Package"("branchId");

-- CreateIndex
CREATE UNIQUE INDEX "Package_branchId_code_key" ON "Package"("branchId", "code");

-- CreateIndex
CREATE INDEX "PackageComponent_packageId_idx" ON "PackageComponent"("packageId");

-- CreateIndex
CREATE INDEX "Client_branchId_idx" ON "Client"("branchId");

-- CreateIndex
CREATE UNIQUE INDEX "Client_branchId_phoneNormalized_key" ON "Client"("branchId", "phoneNormalized");

-- CreateIndex
CREATE UNIQUE INDEX "Appointment_appointmentNumber_key" ON "Appointment"("appointmentNumber");

-- CreateIndex
CREATE INDEX "Appointment_branchId_date_idx" ON "Appointment"("branchId", "date");

-- CreateIndex
CREATE INDEX "Appointment_branchId_status_idx" ON "Appointment"("branchId", "status");

-- CreateIndex
CREATE INDEX "Appointment_clientId_idx" ON "Appointment"("clientId");

-- CreateIndex
CREATE INDEX "AppointmentItem_appointmentId_idx" ON "AppointmentItem"("appointmentId");

-- CreateIndex
CREATE INDEX "AppointmentItem_staffId_idx" ON "AppointmentItem"("staffId");

-- CreateIndex
CREATE INDEX "AppointmentPackageComponent_appointmentItemId_idx" ON "AppointmentPackageComponent"("appointmentItemId");

-- CreateIndex
CREATE INDEX "AppointmentPackageComponent_staffId_idx" ON "AppointmentPackageComponent"("staffId");

-- CreateIndex
CREATE INDEX "AppointmentReschedule_appointmentId_idx" ON "AppointmentReschedule"("appointmentId");

-- CreateIndex
CREATE INDEX "CashDrawer_branchId_kind_idx" ON "CashDrawer"("branchId", "kind");

-- CreateIndex
CREATE INDEX "CashDrawer_custodianUserId_status_idx" ON "CashDrawer"("custodianUserId", "status");

-- CreateIndex
CREATE INDEX "DrawerMovement_drawerId_createdAt_idx" ON "DrawerMovement"("drawerId", "createdAt");

-- CreateIndex
CREATE INDEX "DrawerMovement_branchId_createdAt_idx" ON "DrawerMovement"("branchId", "createdAt");

-- CreateIndex
CREATE INDEX "DrawerMovement_sourceModule_sourceId_idx" ON "DrawerMovement"("sourceModule", "sourceId");

-- CreateIndex
CREATE INDEX "AccountMovement_accountId_createdAt_idx" ON "AccountMovement"("accountId", "createdAt");

-- CreateIndex
CREATE INDEX "AccountMovement_branchId_createdAt_idx" ON "AccountMovement"("branchId", "createdAt");

-- CreateIndex
CREATE INDEX "AccountMovement_sourceModule_sourceId_idx" ON "AccountMovement"("sourceModule", "sourceId");

-- CreateIndex
CREATE UNIQUE INDEX "CashTransfer_transferNumber_key" ON "CashTransfer"("transferNumber");

-- CreateIndex
CREATE INDEX "CashTransfer_branchId_idx" ON "CashTransfer"("branchId");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryItem_sku_key" ON "InventoryItem"("sku");

-- CreateIndex
CREATE INDEX "InventoryBatch_itemId_branchId_idx" ON "InventoryBatch"("itemId", "branchId");

-- CreateIndex
CREATE INDEX "InventoryBatch_branchId_expiryDate_idx" ON "InventoryBatch"("branchId", "expiryDate");

-- CreateIndex
CREATE UNIQUE INDEX "StockMovement_movementNumber_key" ON "StockMovement"("movementNumber");

-- CreateIndex
CREATE INDEX "StockMovement_branchId_createdAt_idx" ON "StockMovement"("branchId", "createdAt");

-- CreateIndex
CREATE INDEX "StockMovement_itemId_branchId_idx" ON "StockMovement"("itemId", "branchId");

-- CreateIndex
CREATE INDEX "StockMovement_sourceReferenceType_sourceReferenceId_idx" ON "StockMovement"("sourceReferenceType", "sourceReferenceId");

-- CreateIndex
CREATE UNIQUE INDEX "Supplier_supplierCode_key" ON "Supplier"("supplierCode");

-- CreateIndex
CREATE INDEX "Supplier_branchId_idx" ON "Supplier"("branchId");

-- CreateIndex
CREATE INDEX "SupplierLedger_supplierId_createdAt_idx" ON "SupplierLedger"("supplierId", "createdAt");

-- CreateIndex
CREATE INDEX "SupplierLedger_branchId_idx" ON "SupplierLedger"("branchId");

-- CreateIndex
CREATE UNIQUE INDEX "Purchase_purchaseNumber_key" ON "Purchase"("purchaseNumber");

-- CreateIndex
CREATE INDEX "Purchase_branchId_purchaseDate_idx" ON "Purchase"("branchId", "purchaseDate");

-- CreateIndex
CREATE INDEX "PurchaseLine_purchaseId_idx" ON "PurchaseLine"("purchaseId");

-- CreateIndex
CREATE UNIQUE INDEX "SupplierPayment_paymentNumber_key" ON "SupplierPayment"("paymentNumber");

-- CreateIndex
CREATE INDEX "SupplierPayment_supplierId_idx" ON "SupplierPayment"("supplierId");

-- CreateIndex
CREATE INDEX "SupplierPayment_branchId_idx" ON "SupplierPayment"("branchId");

-- CreateIndex
CREATE UNIQUE INDEX "SupplierReturn_returnNumber_key" ON "SupplierReturn"("returnNumber");

-- CreateIndex
CREATE INDEX "SupplierReturn_branchId_idx" ON "SupplierReturn"("branchId");

-- CreateIndex
CREATE INDEX "SupplierReturnLine_returnId_idx" ON "SupplierReturnLine"("returnId");

-- CreateIndex
CREATE UNIQUE INDEX "StockSettlement_settlementNumber_key" ON "StockSettlement"("settlementNumber");

-- CreateIndex
CREATE INDEX "StockSettlement_branchId_idx" ON "StockSettlement"("branchId");

-- CreateIndex
CREATE INDEX "StockSettlementLine_settlementId_idx" ON "StockSettlementLine"("settlementId");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_invoiceNumber_key" ON "Invoice"("invoiceNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_appointmentId_key" ON "Invoice"("appointmentId");

-- CreateIndex
CREATE INDEX "Invoice_branchId_date_idx" ON "Invoice"("branchId", "date");

-- CreateIndex
CREATE INDEX "Invoice_clientId_idx" ON "Invoice"("clientId");

-- CreateIndex
CREATE INDEX "Invoice_branchId_status_idx" ON "Invoice"("branchId", "status");

-- CreateIndex
CREATE INDEX "InvoiceLine_invoiceId_idx" ON "InvoiceLine"("invoiceId");

-- CreateIndex
CREATE INDEX "InvoiceLine_staffId_idx" ON "InvoiceLine"("staffId");

-- CreateIndex
CREATE INDEX "InvoiceLineComponent_lineId_idx" ON "InvoiceLineComponent"("lineId");

-- CreateIndex
CREATE INDEX "InvoiceLineComponent_staffId_idx" ON "InvoiceLineComponent"("staffId");

-- CreateIndex
CREATE INDEX "InvoiceLineBatch_lineId_idx" ON "InvoiceLineBatch"("lineId");

-- CreateIndex
CREATE UNIQUE INDEX "InvoicePayment_receiptNumber_key" ON "InvoicePayment"("receiptNumber");

-- CreateIndex
CREATE INDEX "InvoicePayment_invoiceId_idx" ON "InvoicePayment"("invoiceId");

-- CreateIndex
CREATE INDEX "InvoicePayment_branchId_date_idx" ON "InvoicePayment"("branchId", "date");

-- CreateIndex
CREATE INDEX "CommissionEvent_branchId_staffId_eventDate_idx" ON "CommissionEvent"("branchId", "staffId", "eventDate");

-- CreateIndex
CREATE INDEX "CommissionEvent_invoiceId_idx" ON "CommissionEvent"("invoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "InvoiceRefund_refundNumber_key" ON "InvoiceRefund"("refundNumber");

-- CreateIndex
CREATE INDEX "InvoiceRefund_invoiceId_idx" ON "InvoiceRefund"("invoiceId");

-- CreateIndex
CREATE INDEX "RefundLine_refundId_idx" ON "RefundLine"("refundId");

-- CreateIndex
CREATE UNIQUE INDEX "Expense_voucherNumber_key" ON "Expense"("voucherNumber");

-- CreateIndex
CREATE INDEX "Expense_branchId_expenseDate_idx" ON "Expense"("branchId", "expenseDate");

-- CreateIndex
CREATE INDEX "Expense_branchId_status_idx" ON "Expense"("branchId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Settlement_settlementNumber_key" ON "Settlement"("settlementNumber");

-- CreateIndex
CREATE INDEX "Settlement_branchId_status_idx" ON "Settlement"("branchId", "status");

-- CreateIndex
CREATE INDEX "Settlement_drawerId_idx" ON "Settlement"("drawerId");

-- CreateIndex
CREATE UNIQUE INDEX "CashVarianceAdjustment_adjustmentNumber_key" ON "CashVarianceAdjustment"("adjustmentNumber");

-- CreateIndex
CREATE INDEX "CashVarianceAdjustment_settlementId_idx" ON "CashVarianceAdjustment"("settlementId");

-- CreateIndex
CREATE INDEX "AttendanceRecord_branchId_workDate_idx" ON "AttendanceRecord"("branchId", "workDate");

-- CreateIndex
CREATE UNIQUE INDEX "AttendanceRecord_staffId_workDate_key" ON "AttendanceRecord"("staffId", "workDate");

-- CreateIndex
CREATE INDEX "AttendancePunch_recordId_idx" ON "AttendancePunch"("recordId");

-- CreateIndex
CREATE INDEX "AttendanceCorrection_recordId_idx" ON "AttendanceCorrection"("recordId");

-- CreateIndex
CREATE UNIQUE INDEX "LeaveRecord_leaveNumber_key" ON "LeaveRecord"("leaveNumber");

-- CreateIndex
CREATE INDEX "LeaveRecord_branchId_staffId_idx" ON "LeaveRecord"("branchId", "staffId");

-- CreateIndex
CREATE INDEX "BranchHoliday_branchId_idx" ON "BranchHoliday"("branchId");

-- CreateIndex
CREATE UNIQUE INDEX "BranchHoliday_branchId_date_key" ON "BranchHoliday"("branchId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "OvertimeRecord_overtimeNumber_key" ON "OvertimeRecord"("overtimeNumber");

-- CreateIndex
CREATE INDEX "OvertimeRecord_branchId_staffId_idx" ON "OvertimeRecord"("branchId", "staffId");

-- CreateIndex
CREATE INDEX "OvertimeRecord_branchId_workDate_idx" ON "OvertimeRecord"("branchId", "workDate");

-- CreateIndex
CREATE INDEX "PayrollRun_branchId_month_idx" ON "PayrollRun"("branchId", "month");

-- CreateIndex
CREATE INDEX "Payslip_staffId_idx" ON "Payslip"("staffId");

-- CreateIndex
CREATE UNIQUE INDEX "Payslip_runId_staffId_key" ON "Payslip"("runId", "staffId");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollPayment_paymentNumber_key" ON "PayrollPayment"("paymentNumber");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollPayment_requestKey_key" ON "PayrollPayment"("requestKey");

-- CreateIndex
CREATE INDEX "PayrollPayment_runId_idx" ON "PayrollPayment"("runId");

-- CreateIndex
CREATE INDEX "PayrollPayment_staffId_idx" ON "PayrollPayment"("staffId");

-- CreateIndex
CREATE INDEX "StaffAllowance_staffId_idx" ON "StaffAllowance"("staffId");

-- CreateIndex
CREATE INDEX "PayrollAdjustment_branchId_month_idx" ON "PayrollAdjustment"("branchId", "month");

-- CreateIndex
CREATE INDEX "PayrollAdjustment_staffId_idx" ON "PayrollAdjustment"("staffId");

-- CreateIndex
CREATE UNIQUE INDEX "SalaryAdvance_advanceNumber_key" ON "SalaryAdvance"("advanceNumber");

-- CreateIndex
CREATE INDEX "SalaryAdvance_branchId_staffId_idx" ON "SalaryAdvance"("branchId", "staffId");

-- CreateIndex
CREATE INDEX "AdvanceRecovery_advanceId_idx" ON "AdvanceRecovery"("advanceId");

-- CreateIndex
CREATE INDEX "AdvanceRecovery_payrollRunId_idx" ON "AdvanceRecovery"("payrollRunId");

-- CreateIndex
CREATE INDEX "CommissionRun_branchId_idx" ON "CommissionRun"("branchId");

-- CreateIndex
CREATE INDEX "CommissionStatement_staffId_idx" ON "CommissionStatement"("staffId");

-- CreateIndex
CREATE UNIQUE INDEX "CommissionStatement_runId_staffId_key" ON "CommissionStatement"("runId", "staffId");

-- CreateIndex
CREATE UNIQUE INDEX "CommissionPayment_paymentNumber_key" ON "CommissionPayment"("paymentNumber");

-- CreateIndex
CREATE UNIQUE INDEX "CommissionPayment_requestKey_key" ON "CommissionPayment"("requestKey");

-- CreateIndex
CREATE INDEX "CommissionPayment_runId_idx" ON "CommissionPayment"("runId");

-- CreateIndex
CREATE INDEX "CommissionPayment_staffId_idx" ON "CommissionPayment"("staffId");

-- CreateIndex
CREATE UNIQUE INDEX "TipReceipt_receiptNumber_key" ON "TipReceipt"("receiptNumber");

-- CreateIndex
CREATE UNIQUE INDEX "TipReceipt_paymentId_key" ON "TipReceipt"("paymentId");

-- CreateIndex
CREATE INDEX "TipReceipt_branchId_collectionDate_idx" ON "TipReceipt"("branchId", "collectionDate");

-- CreateIndex
CREATE INDEX "TipReceipt_invoiceId_idx" ON "TipReceipt"("invoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "TipAllocation_allocationNumber_key" ON "TipAllocation"("allocationNumber");

-- CreateIndex
CREATE INDEX "TipAllocation_receiptId_idx" ON "TipAllocation"("receiptId");

-- CreateIndex
CREATE INDEX "TipAllocation_staffId_idx" ON "TipAllocation"("staffId");

-- CreateIndex
CREATE INDEX "TipAllocation_branchId_allocationDate_idx" ON "TipAllocation"("branchId", "allocationDate");

-- CreateIndex
CREATE UNIQUE INDEX "TipPayout_payoutNumber_key" ON "TipPayout"("payoutNumber");

-- CreateIndex
CREATE INDEX "TipPayout_staffId_idx" ON "TipPayout"("staffId");

-- CreateIndex
CREATE INDEX "TipPayout_branchId_payoutDate_idx" ON "TipPayout"("branchId", "payoutDate");

-- CreateIndex
CREATE INDEX "Device_branchId_idx" ON "Device"("branchId");

-- CreateIndex
CREATE INDEX "Device_deviceType_idx" ON "Device"("deviceType");

-- CreateIndex
CREATE INDEX "Device_status_idx" ON "Device"("status");

-- CreateIndex
CREATE INDEX "DeviceLog_deviceId_idx" ON "DeviceLog"("deviceId");

-- CreateIndex
CREATE INDEX "DeviceLog_branchId_createdAt_idx" ON "DeviceLog"("branchId", "createdAt");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxRule" ADD CONSTRAINT "TaxRule_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentAccount" ADD CONSTRAINT "PaymentAccount_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Staff" ADD CONSTRAINT "Staff_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffCompensationHistory" ADD CONSTRAINT "StaffCompensationHistory_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Service" ADD CONSTRAINT "Service_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ServiceCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackageComponent" ADD CONSTRAINT "PackageComponent_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "Package"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackageComponent" ADD CONSTRAINT "PackageComponent_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppointmentItem" ADD CONSTRAINT "AppointmentItem_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppointmentPackageComponent" ADD CONSTRAINT "AppointmentPackageComponent_appointmentItemId_fkey" FOREIGN KEY ("appointmentItemId") REFERENCES "AppointmentItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppointmentReschedule" ADD CONSTRAINT "AppointmentReschedule_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DrawerMovement" ADD CONSTRAINT "DrawerMovement_drawerId_fkey" FOREIGN KEY ("drawerId") REFERENCES "CashDrawer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountMovement" ADD CONSTRAINT "AccountMovement_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "PaymentAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryBatch" ADD CONSTRAINT "InventoryBatch_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "InventoryItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "InventoryItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "InventoryBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierLedger" ADD CONSTRAINT "SupplierLedger_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseLine" ADD CONSTRAINT "PurchaseLine_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "Purchase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierPayment" ADD CONSTRAINT "SupplierPayment_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierReturn" ADD CONSTRAINT "SupplierReturn_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierReturnLine" ADD CONSTRAINT "SupplierReturnLine_returnId_fkey" FOREIGN KEY ("returnId") REFERENCES "SupplierReturn"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockSettlementLine" ADD CONSTRAINT "StockSettlementLine_settlementId_fkey" FOREIGN KEY ("settlementId") REFERENCES "StockSettlement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceLine" ADD CONSTRAINT "InvoiceLine_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceLineComponent" ADD CONSTRAINT "InvoiceLineComponent_lineId_fkey" FOREIGN KEY ("lineId") REFERENCES "InvoiceLine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceLineBatch" ADD CONSTRAINT "InvoiceLineBatch_lineId_fkey" FOREIGN KEY ("lineId") REFERENCES "InvoiceLine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoicePayment" ADD CONSTRAINT "InvoicePayment_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceRefund" ADD CONSTRAINT "InvoiceRefund_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefundLine" ADD CONSTRAINT "RefundLine_refundId_fkey" FOREIGN KEY ("refundId") REFERENCES "InvoiceRefund"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Settlement" ADD CONSTRAINT "Settlement_drawerId_fkey" FOREIGN KEY ("drawerId") REFERENCES "CashDrawer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendancePunch" ADD CONSTRAINT "AttendancePunch_recordId_fkey" FOREIGN KEY ("recordId") REFERENCES "AttendanceRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceCorrection" ADD CONSTRAINT "AttendanceCorrection_recordId_fkey" FOREIGN KEY ("recordId") REFERENCES "AttendanceRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payslip" ADD CONSTRAINT "Payslip_runId_fkey" FOREIGN KEY ("runId") REFERENCES "PayrollRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollPayment" ADD CONSTRAINT "PayrollPayment_runId_fkey" FOREIGN KEY ("runId") REFERENCES "PayrollRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollPayment" ADD CONSTRAINT "PayrollPayment_payslipId_fkey" FOREIGN KEY ("payslipId") REFERENCES "Payslip"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvanceRecovery" ADD CONSTRAINT "AdvanceRecovery_advanceId_fkey" FOREIGN KEY ("advanceId") REFERENCES "SalaryAdvance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommissionStatement" ADD CONSTRAINT "CommissionStatement_payrollPayslipId_fkey" FOREIGN KEY ("payrollPayslipId") REFERENCES "Payslip"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommissionStatement" ADD CONSTRAINT "CommissionStatement_runId_fkey" FOREIGN KEY ("runId") REFERENCES "CommissionRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommissionPayment" ADD CONSTRAINT "CommissionPayment_runId_fkey" FOREIGN KEY ("runId") REFERENCES "CommissionRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommissionPayment" ADD CONSTRAINT "CommissionPayment_statementId_fkey" FOREIGN KEY ("statementId") REFERENCES "CommissionStatement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommissionPayment" ADD CONSTRAINT "CommissionPayment_payrollPaymentId_fkey" FOREIGN KEY ("payrollPaymentId") REFERENCES "PayrollPayment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TipAllocation" ADD CONSTRAINT "TipAllocation_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "TipReceipt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TipPayout" ADD CONSTRAINT "TipPayout_allocationId_fkey" FOREIGN KEY ("allocationId") REFERENCES "TipAllocation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Device" ADD CONSTRAINT "Device_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeviceLog" ADD CONSTRAINT "DeviceLog_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE CASCADE ON UPDATE CASCADE;

