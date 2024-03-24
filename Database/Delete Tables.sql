DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'svg')
        LOOP
            EXECUTE 'DROP TABLE IF EXISTS svg.' || quote_ident(r.tablename) || ' CASCADE';
        END LOOP;
END $$;
