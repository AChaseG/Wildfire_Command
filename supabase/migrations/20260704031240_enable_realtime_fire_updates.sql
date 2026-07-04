DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'fire_updates'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE fire_updates;
  END IF;
END $$;