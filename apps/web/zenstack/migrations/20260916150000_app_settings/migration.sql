CREATE TABLE "app_setting" (
  "id" TEXT NOT NULL,
  "scope" TEXT NOT NULL,
  "owner" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "value" JSONB NOT NULL,
  "userId" TEXT,
  "organizationId" TEXT,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "app_setting_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "app_setting_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "app_setting_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "app_setting_owner_check" CHECK (
    ("scope" = 'user' AND "userId" IS NOT NULL AND "owner" = "userId" AND "organizationId" IS NULL) OR
    ("scope" = 'organization' AND "organizationId" IS NOT NULL AND "owner" = "organizationId" AND "userId" IS NULL) OR
    ("scope" = 'global' AND "owner" = 'global' AND "userId" IS NULL AND "organizationId" IS NULL)
  )
);
CREATE UNIQUE INDEX "app_setting_scope_owner_key_key" ON "app_setting"("scope", "owner", "key");
ALTER TABLE "app_setting" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "app_setting" FROM anon, authenticated;
