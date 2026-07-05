/*
  # Add scraped_pages table for structured page extraction

  1. Purpose
  Stores the result of scraping ("true extraction") a data source's URL. Each URL
  data source has at most one latest scrape result. The scrape-source edge
  function fetches the page, parses its DOM, and extracts structured records
  (page title/description, headings, links, and detected wildfire incidents with
  acreage/containment), storing them here.

  2. New Tables
  - `scraped_pages`
    - `id` (uuid, primary key)
    - `data_source_id` (uuid, unique, FK -> data_sources.id, cascade delete)
    - `title` (text) — page <title>
    - `description` (text) — meta description
    - `item_count` (int) — number of structured incidents detected
    - `data` (jsonb) — full structured extraction
      { title, description, headings[], links[], incidents[], excerpt }
    - `status` (text) — 'ok' | 'error'
    - `error` (text) — failure detail when status = 'error'
    - `scraped_at` (timestamptz, default now())

  3. Security
  - RLS enabled. No-auth app: anon + authenticated may read.
  - Writes are performed only by the scrape-source edge function using the
    service role (bypasses RLS), so no anon write policy is added.
*/

CREATE TABLE IF NOT EXISTS scraped_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  data_source_id uuid NOT NULL UNIQUE REFERENCES data_sources(id) ON DELETE CASCADE,
  title text,
  description text,
  item_count integer NOT NULL DEFAULT 0,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'ok' CHECK (status IN ('ok', 'error')),
  error text,
  scraped_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS scraped_pages_source_idx ON scraped_pages(data_source_id);

ALTER TABLE scraped_pages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_scraped_pages" ON scraped_pages;
CREATE POLICY "anon_select_scraped_pages" ON scraped_pages FOR SELECT
  TO anon, authenticated USING (true);
