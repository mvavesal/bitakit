ALTER TABLE "session" ADD COLUMN "activeTeamId" TEXT;
ALTER TABLE "invitation" ADD COLUMN "teamId" TEXT;
CREATE TABLE "team" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "memberCount" INTEGER NOT NULL DEFAULT 0,
  "organizationId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL,
  "updatedAt" TIMESTAMP(3),
  CONSTRAINT "team_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "team_organizationId_idx" ON "team"("organizationId");
CREATE TABLE "teamMember" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "teamId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "membershipKey" TEXT,
  "createdAt" TIMESTAMP(3),
  CONSTRAINT "teamMember_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "team"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "teamMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "teamMember_membershipKey_key" ON "teamMember"("membershipKey");
CREATE INDEX "teamMember_teamId_idx" ON "teamMember"("teamId");
CREATE INDEX "teamMember_userId_idx" ON "teamMember"("userId");
CREATE TABLE "apikey" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "configId" TEXT NOT NULL DEFAULT 'default',
  "name" TEXT, "start" TEXT, "referenceId" TEXT NOT NULL, "prefix" TEXT,
  "key" TEXT NOT NULL,
  "refillInterval" INTEGER, "refillAmount" INTEGER, "lastRefillAt" TIMESTAMP(3),
  "enabled" BOOLEAN DEFAULT true, "rateLimitEnabled" BOOLEAN DEFAULT true,
  "rateLimitTimeWindow" INTEGER DEFAULT 86400000, "rateLimitMax" INTEGER DEFAULT 10,
  "requestCount" INTEGER DEFAULT 0, "remaining" INTEGER,
  "lastRequest" TIMESTAMP(3), "expiresAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL, "updatedAt" TIMESTAMP(3) NOT NULL,
  "permissions" TEXT, "metadata" TEXT
);
CREATE INDEX "apikey_configId_idx" ON "apikey"("configId");
CREATE INDEX "apikey_referenceId_idx" ON "apikey"("referenceId");
CREATE INDEX "apikey_key_idx" ON "apikey"("key");
-- These are privileged Better Auth tables, never Supabase public CRUD resources.
ALTER TABLE "team" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "teamMember" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "apikey" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "team", "teamMember", "apikey" FROM anon, authenticated;
