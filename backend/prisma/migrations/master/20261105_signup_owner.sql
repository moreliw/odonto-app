-- Additive migration. Existing clinics keep a NULL owner; PostgreSQL permits
-- multiple NULLs in the unique index. No existing clinic data is rewritten.
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "provisionSignupIntentId" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "Tenant_provisionSignupIntentId_key"
  ON "Tenant"("provisionSignupIntentId");
