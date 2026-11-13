CREATE SCHEMA IF NOT EXISTS game;
REVOKE ALL ON SCHEMA game FROM PUBLIC;
REVOKE ALL ON SCHEMA game FROM anon, authenticated;

-- Server-only bridge for the game's raw SQL layer. Values are inlined as quoted
-- literals by the server before the call; only service_role may execute it.
CREATE OR REPLACE FUNCTION public.game_exec_sql(q text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = game, public, extensions
AS $fn$
DECLARE
  r record;
  out_rows jsonb := '[]'::jsonb;
  obj jsonb;
  n bigint := 0;
BEGIN
  BEGIN
    FOR r IN EXECUTE q LOOP
      SELECT COALESCE(jsonb_object_agg(e.key,
        CASE
          WHEN jsonb_typeof(e.value) = 'number'
           AND (e.value::text ~ '\.[0-9]*0$' OR length(regexp_replace(e.value::text, '[^0-9]', '', 'g')) > 15)
          THEN to_jsonb(e.value::text)
          ELSE e.value
        END), '{}'::jsonb)
      INTO obj
      FROM jsonb_each(to_jsonb(r)) e;
      out_rows := out_rows || jsonb_build_array(obj);
      n := n + 1;
    END LOOP;
  EXCEPTION WHEN invalid_cursor_definition THEN
    EXECUTE q;
    GET DIAGNOSTICS n = ROW_COUNT;
    out_rows := '[]'::jsonb;
  END;
  RETURN jsonb_build_object('rows', out_rows, 'rowCount', n);
END;
$fn$;

REVOKE ALL ON FUNCTION public.game_exec_sql(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.game_exec_sql(text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.game_exec_sql(text) TO service_role;