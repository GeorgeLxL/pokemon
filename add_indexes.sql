-- Run this once against your pokemon_final database
-- These indexes match the WHERE/JOIN columns hit on every query

ALTER TABLE events
  ADD INDEX IF NOT EXISTS idx_date_league (event_date_date, event_league_int),
  ADD INDEX IF NOT EXISTS idx_prefecture (event_prefecture);

ALTER TABLE decks
  ADD INDEX IF NOT EXISTS idx_event_rank (event_holding_id, rank_int);

ALTER TABLE cards
  ADD INDEX IF NOT EXISTS idx_deck_name (deck_ID_var, name_var(100));
