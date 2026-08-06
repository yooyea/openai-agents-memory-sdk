-- Schema evolution is applied idempotently by app/api/_lib.ts::ensureSchema.
-- Keeping this migration as a marker avoids duplicate-index failures on
-- databases that were initialized by earlier runtime schema bootstrapping.
SELECT 1;
