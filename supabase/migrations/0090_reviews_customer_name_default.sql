-- 0085 made reviews anonymous and the client stopped sending customer_name,
-- but the column stayed NOT NULL with no default — every review INSERT failed
-- (23502) while RatingScreen still showed "thanks", so jobs never reached
-- `completed`. Default it to '' (the value 0085 already backfilled).
alter table public.reviews alter column customer_name set default '';
