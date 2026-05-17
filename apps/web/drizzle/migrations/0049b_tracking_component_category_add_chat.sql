-- @no-transaction:true
-- Add 'chat' to tracking_component_category enum for chat widget tracking
ALTER TYPE tracking_component_category ADD VALUE IF NOT EXISTS 'chat' BEFORE 'admin';
