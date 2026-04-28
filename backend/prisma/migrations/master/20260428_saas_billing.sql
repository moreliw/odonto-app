-- SaaS billing expansion (master database)
-- Safe/idempotent migration for PostgreSQL 16+

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SubscriptionStatus') THEN
    BEGIN
      ALTER TYPE "SubscriptionStatus" ADD VALUE IF NOT EXISTS 'PENDING';
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PaymentProvider') THEN
    CREATE TYPE "PaymentProvider" AS ENUM ('STRIPE');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SignupIntentStatus') THEN
    CREATE TYPE "SignupIntentStatus" AS ENUM ('PENDING', 'PROCESSING', 'PROVISIONED', 'FAILED', 'EXPIRED', 'CANCELED');
  END IF;
END $$;

ALTER TABLE "Subscription"
  ADD COLUMN IF NOT EXISTS "provider" "PaymentProvider",
  ADD COLUMN IF NOT EXISTS "providerCustomerId" TEXT,
  ADD COLUMN IF NOT EXISTS "providerSubscriptionId" TEXT,
  ADD COLUMN IF NOT EXISTS "activatedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "lastPaymentAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "currentPeriodEnd" TIMESTAMP(3);

ALTER TABLE "Subscription"
  ALTER COLUMN "status" SET DEFAULT 'PENDING';

CREATE UNIQUE INDEX IF NOT EXISTS "Subscription_providerSubscriptionId_key" ON "Subscription" ("providerSubscriptionId");

CREATE TABLE IF NOT EXISTS "SignupIntent" (
  "id" TEXT NOT NULL,
  "clinicName" TEXT NOT NULL,
  "clinicSlug" TEXT NOT NULL,
  "requestedSubdomain" TEXT NOT NULL,
  "adminName" TEXT,
  "adminEmail" TEXT NOT NULL,
  "adminPasswordHash" TEXT NOT NULL,
  "plan" "Plan" NOT NULL,
  "priceCents" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'BRL',
  "provider" "PaymentProvider" NOT NULL DEFAULT 'STRIPE',
  "status" "SignupIntentStatus" NOT NULL DEFAULT 'PENDING',
  "providerSessionId" TEXT,
  "providerCustomerId" TEXT,
  "providerSubscriptionId" TEXT,
  "checkoutUrl" TEXT,
  "checkoutExpiresAt" TIMESTAMP(3),
  "paidAt" TIMESTAMP(3),
  "activatedAt" TIMESTAMP(3),
  "failedReason" TEXT,
  "metadata" JSONB,
  "tenantId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SignupIntent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "PaymentEvent" (
  "id" TEXT NOT NULL,
  "provider" "PaymentProvider" NOT NULL DEFAULT 'STRIPE',
  "externalEventId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "livemode" BOOLEAN NOT NULL DEFAULT false,
  "status" TEXT NOT NULL DEFAULT 'RECEIVED',
  "payload" JSONB NOT NULL,
  "error" TEXT,
  "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processedAt" TIMESTAMP(3),
  "tenantId" TEXT,
  "signupIntentId" TEXT,
  CONSTRAINT "PaymentEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "SignupIntent_providerSessionId_key" ON "SignupIntent" ("providerSessionId");
CREATE UNIQUE INDEX IF NOT EXISTS "PaymentEvent_externalEventId_key" ON "PaymentEvent" ("externalEventId");

CREATE INDEX IF NOT EXISTS "SignupIntent_adminEmail_idx" ON "SignupIntent" ("adminEmail");
CREATE INDEX IF NOT EXISTS "SignupIntent_clinicSlug_idx" ON "SignupIntent" ("clinicSlug");
CREATE INDEX IF NOT EXISTS "SignupIntent_requestedSubdomain_idx" ON "SignupIntent" ("requestedSubdomain");
CREATE INDEX IF NOT EXISTS "PaymentEvent_type_idx" ON "PaymentEvent" ("type");
CREATE INDEX IF NOT EXISTS "PaymentEvent_tenantId_idx" ON "PaymentEvent" ("tenantId");
CREATE INDEX IF NOT EXISTS "PaymentEvent_signupIntentId_idx" ON "PaymentEvent" ("signupIntentId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'SignupIntent_tenantId_fkey'
      AND table_name = 'SignupIntent'
  ) THEN
    ALTER TABLE "SignupIntent"
      ADD CONSTRAINT "SignupIntent_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'PaymentEvent_tenantId_fkey'
      AND table_name = 'PaymentEvent'
  ) THEN
    ALTER TABLE "PaymentEvent"
      ADD CONSTRAINT "PaymentEvent_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'PaymentEvent_signupIntentId_fkey'
      AND table_name = 'PaymentEvent'
  ) THEN
    ALTER TABLE "PaymentEvent"
      ADD CONSTRAINT "PaymentEvent_signupIntentId_fkey"
      FOREIGN KEY ("signupIntentId") REFERENCES "SignupIntent"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
