-- Multi-agency tenant isolation (Milestone 3.4a): add Organization + nullable
-- organizationId across all tenant tables, backfill existing rows into a default org.

CREATE TABLE "Organization" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");

INSERT INTO "Organization" ("id","name","slug","createdAt")
VALUES ('org_default','Tomania Agency','tomania', CURRENT_TIMESTAMP);

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['User','Company','Lead','Call','Response','Score','Recommendation','PartnerReferral','Task','AuditLog','LearningEvent','Package','PartnerService','ScoringWeight','QualificationThreshold','QualificationQuestion','PromptTemplate','FollowUpCadence']
  LOOP
    EXECUTE format('ALTER TABLE %I ADD COLUMN "organizationId" TEXT', t);
    EXECUTE format('UPDATE %I SET "organizationId" = %L', t, 'org_default');
  END LOOP;
END $$;

DROP INDEX IF EXISTS "Package_name_key";
DROP INDEX IF EXISTS "ScoringWeight_key_key";
DROP INDEX IF EXISTS "QualificationThreshold_key_key";
DROP INDEX IF EXISTS "QualificationQuestion_key_key";
DROP INDEX IF EXISTS "PromptTemplate_name_version_key";
DROP INDEX IF EXISTS "FollowUpCadence_outcome_key";

CREATE UNIQUE INDEX "Package_organizationId_name_key" ON "Package"("organizationId","name");
CREATE UNIQUE INDEX "ScoringWeight_organizationId_key_key" ON "ScoringWeight"("organizationId","key");
CREATE UNIQUE INDEX "QualificationThreshold_organizationId_key_key" ON "QualificationThreshold"("organizationId","key");
CREATE UNIQUE INDEX "QualificationQuestion_organizationId_key_key" ON "QualificationQuestion"("organizationId","key");
CREATE UNIQUE INDEX "PromptTemplate_organizationId_name_version_key" ON "PromptTemplate"("organizationId","name","version");
CREATE UNIQUE INDEX "FollowUpCadence_organizationId_outcome_key" ON "FollowUpCadence"("organizationId","outcome");

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['User','Company','Lead','Call','Response','Score','Recommendation','PartnerReferral','Task','AuditLog','LearningEvent','Package','PartnerService','ScoringWeight','QualificationThreshold','QualificationQuestion','PromptTemplate','FollowUpCadence']
  LOOP
    EXECUTE format('ALTER TABLE %I ADD CONSTRAINT %I FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE', t, t||'_organizationId_fkey');
  END LOOP;
END $$;
