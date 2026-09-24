CREATE TABLE IF NOT EXISTS "search_logs" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "buyer_id" uuid NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
  "keyword" text NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "search_logs_keyword_created_at_idx" ON "search_logs" ("keyword", "created_at");
