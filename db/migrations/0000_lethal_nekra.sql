-- Custom SQL migration file, put your code below! --
CREATE OR REPLACE FUNCTION generate_public_id(prefix text, len int)
RETURNS text AS $$
SELECT prefix || string_agg(
    substr(
        'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', 
        floor(random() * 36 + 1)::integer, 
        1
    ),
    ''
)
FROM generate_series(1, len);
$$ LANGUAGE sql VOLATILE;