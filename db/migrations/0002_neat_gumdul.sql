CREATE EXTENSION IF NOT EXISTS citext;

DROP FUNCTION IF EXISTS generate_public_id(text, int);

CREATE OR REPLACE FUNCTION generate_alphanumeric_combination(len int)
RETURNS text AS $$
SELECT string_agg(
    substr(
        'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', 
        floor(random() * 36 + 1)::integer, 
        1
    ),
    ''
)
FROM generate_series(1, len);
$$ LANGUAGE sql VOLATILE;
