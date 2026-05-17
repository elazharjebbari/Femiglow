-- @no-transaction:true
-- Add inline-contact webhook event types to the chat_conversation_event enum.
ALTER TYPE chat_conversation_event_type ADD VALUE IF NOT EXISTS 'inline_contact_webhook_sent';
ALTER TYPE chat_conversation_event_type ADD VALUE IF NOT EXISTS 'inline_contact_webhook_failed';
