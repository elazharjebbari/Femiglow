-- @no-transaction:true
-- Add missing tracking_component_category enum values added by annotations/scan
ALTER TYPE tracking_component_category ADD VALUE IF NOT EXISTS 'section_video' BEFORE 'chat';
ALTER TYPE tracking_component_category ADD VALUE IF NOT EXISTS 'section_promotion' BEFORE 'section_video';
ALTER TYPE tracking_component_category ADD VALUE IF NOT EXISTS 'engagement' BEFORE 'section_content';
