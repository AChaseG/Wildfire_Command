/*
  # Add search-query data sources

  1. Purpose
  Adds a third data source kind, 'search', alongside 'url' and 'kml'. A search
  source stores a keyword / boolean query that is run against a web search
  engine (Azure Bing Web Search); the top results are then scraped and their
  structured data stored in scraped_pages, keyed by the source id.

  2. Modified Table
  - `data_sources`
    - `search_query` (text, nullable) — the keyword / boolean query to search for
    - `source_kind` CHECK constraint widened to include 'search'

  3. Notes
  - Idempotent and non-destructive: only adds a nullable column and widens an
    existing CHECK constraint. No data is dropped or altered.
  - The `url` column stays NOT NULL; search rows store a human-openable Bing
    search URL there so the source card link still works.
*/

ALTER TABLE data_sources
  ADD COLUMN IF NOT EXISTS search_query text;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'data_sources_source_kind_check'
  ) THEN
    ALTER TABLE data_sources DROP CONSTRAINT data_sources_source_kind_check;
  END IF;
  ALTER TABLE data_sources
    ADD CONSTRAINT data_sources_source_kind_check
    CHECK (source_kind IN ('url', 'kml', 'search'));
END $$;
