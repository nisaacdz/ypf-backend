CREATE EXTENSION IF NOT EXISTS citext;

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