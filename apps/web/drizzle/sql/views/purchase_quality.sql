-- v_purchase_quality
--
-- Vue d'observabilité pour la qualité des events Purchase envoyés à Meta
-- (et autres pixels). Permet de reproduire en direct le pourcentage
-- affiché par Meta Events Manager (« % Purchase value/currency valid »)
-- sans attendre le cycle de reporting Meta (7-30 jours).
--
-- Critères de validité (alignés Meta CAPI):
--   - value présent ET strictement > 0
--   - currency présent ET match /^[A-Z]{3}$/ (ISO 4217 3-letter code)
--
-- Source: tracking_events_log (jsonb `payload` contient les params event).
-- Couvre les events 'purchase' (client) ET 'purchase_server' (Stripe webhook).
--
-- Usage:
--   psql $DATABASE_URL -c "SELECT * FROM v_purchase_quality WHERE day > NOW() - INTERVAL '7 days';"
--
-- cf. docs/meta-quality-audit-2026-05/01-design-conception.md §4.2

CREATE OR REPLACE VIEW v_purchase_quality AS
SELECT
  DATE(received_at) AS day,
  event_name,
  COUNT(*) AS total,
  COUNT(*) FILTER (
    WHERE payload ? 'value'
      AND (payload->>'value')::numeric > 0
      AND payload ? 'currency'
      AND payload->>'currency' ~ '^[A-Z]{3}$'
  ) AS valid,
  ROUND(
    100.0 * COUNT(*) FILTER (
      WHERE payload ? 'value'
        AND (payload->>'value')::numeric > 0
        AND payload ? 'currency'
        AND payload->>'currency' ~ '^[A-Z]{3}$'
    ) / NULLIF(COUNT(*), 0),
    1
  ) AS quality_pct
FROM tracking_events_log
WHERE event_name IN ('purchase', 'purchase_server')
GROUP BY DATE(received_at), event_name
ORDER BY day DESC, event_name;
