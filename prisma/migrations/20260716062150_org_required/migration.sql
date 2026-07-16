-- Milestone 3.4b: enforce organizationId NOT NULL (all rows backfilled in 3.4a).
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['User','Company','Lead','Call','Response','Score','Recommendation','PartnerReferral','Task','AuditLog','LearningEvent','Package','PartnerService','ScoringWeight','QualificationThreshold','QualificationQuestion','PromptTemplate','FollowUpCadence']
  LOOP
    EXECUTE format('ALTER TABLE %I ALTER COLUMN "organizationId" SET NOT NULL', t);
  END LOOP;
END $$;
