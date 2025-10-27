-- accepted terms timestamp
DO $$ BEGIN
  ALTER TABLE "User"
  ADD COLUMN "termsAcceptedAt" TIMESTAMP(3);
EXCEPTION
  WHEN duplicate_column THEN NULL;
END $$;
