-- Fix: wp_sync_log.store_id must be nullable because a single sync run
-- covers ALL active stores, not a specific one.
alter table wp_sync_log alter column store_id drop not null;
