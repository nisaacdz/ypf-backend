-- Audit I10 — shop.order_payments only had its PK index. Both FK columns are
-- hot:
--   * order_id      → joined by GET /shop/orders/by-ref (success page poll)
--                     and GET /shop/orders/admin (Day 5 admin surface).
--   * transaction_id → used by the Paystack webhook to locate the order from
--                      a transaction. Without an index, webhook delivery
--                      scans the whole table — fine at zero rows, painful at
--                      ~10k.
-- Idempotent: CREATE INDEX IF NOT EXISTS handles fresh-install + re-run.

CREATE INDEX IF NOT EXISTS order_payments_order_id_idx
  ON shop.order_payments(order_id);

CREATE INDEX IF NOT EXISTS order_payments_transaction_id_idx
  ON shop.order_payments(transaction_id);
