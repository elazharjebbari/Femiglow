#!/usr/bin/env python3
"""
validate-seeds.py — Go/No-Go check pour ingestion des seeds i18n FemiGlow.

Vérifie l'intégrité de tous les livrables `docs/i18n-content-2026-05/`
avant copie vers `apps/web/messages/` et seeding DB. À lancer depuis la
racine du repo :

    python3 docs/i18n-content-2026-05/scripts/validate-seeds.py

Code de sortie :
  0  → tout est OK, prêt pour ingestion
  1  → blocking issues détectées (voir output)
  2  → erreur de configuration / fichier manquant

Aucune dépendance externe (uniquement stdlib).
"""
import json
import os
import re
import sys
import csv
from pathlib import Path
from collections import defaultdict

# ----- Configuration -----
SCRIPT_DIR = Path(__file__).resolve().parent
ROOT = SCRIPT_DIR.parent  # docs/i18n-content-2026-05/
LOCALES = ('fr', 'ar', 'en')
EXPECTED_TOTAL_KEYS = 790  # cf. _meta.total_keys
EXPECTED_NAMESPACES = {'common', 'navigation', 'marketing', 'legal',
                       'errors', 'seo', 'email', 'chat', 'mock-data'}
EXPECTED_LEGAL_SLUGS = {'cgv', 'cgu', 'confidentialite', 'cookies',
                        'retours-remboursements', 'livraison',
                        'securite-produits', 'faq', 'mentions-legales'}
EXPECTED_ARTICLES_COUNT = 15

# Mots interdits (style FemiGlow)
FORBIDDEN_WORDS_FR = {'révolutionnaire', 'incroyable', 'premium', 'exclusif',
                      'VIP', 'deal', 'shop', 'flash', 'cliquez ici'}
# Caractères interdits dans le copy (emojis)
FORBIDDEN_EMOJI_RANGES = [
    (0x1F600, 0x1F64F),  # Emoticons
    (0x1F300, 0x1F5FF),  # Misc Symbols and Pictographs
    (0x1F680, 0x1F6FF),  # Transport and Map
    (0x2600, 0x26FF),    # Misc symbols (incl. ✨ ⭐)
    (0x2700, 0x27BF),    # Dingbats
]

# ----- Reporting -----
ERRORS = []
WARNINGS = []
INFO = []


def err(msg):
    ERRORS.append(msg)


def warn(msg):
    WARNINGS.append(msg)


def info(msg):
    INFO.append(msg)


def contains_emoji(text):
    """Détecte un emoji unicode dans une string."""
    if not isinstance(text, str):
        return False
    for ch in text:
        cp = ord(ch)
        for lo, hi in FORBIDDEN_EMOJI_RANGES:
            if lo <= cp <= hi:
                return ch
    return False


def walk_strings(obj, path=''):
    """Yield (json_path, value) for each string in nested dict/list."""
    if isinstance(obj, dict):
        for k, v in obj.items():
            sub = f"{path}.{k}" if path else k
            yield from walk_strings(v, sub)
    elif isinstance(obj, list):
        for i, item in enumerate(obj):
            yield from walk_strings(item, f"{path}[{i}]")
    elif isinstance(obj, str):
        yield (path, obj)


# ─────────────────────────────────────────────────────────────────────────
# CHECK 1 — Style reference + audit présents
# ─────────────────────────────────────────────────────────────────────────
def check_structure():
    info("CHECK 1 — Structure du dossier")
    must_exist = [
        '00-style-reference.md',
        '01-audit/inventory-complete.csv',
        '01-audit/audit-summary.md',
        '01-audit/extraction-log.md',
        '02-translations/messages-fr.json',
        '02-translations/messages-ar.json',
        '02-translations/messages-en.json',
        '03-seed-data/README.md',
        '03-seed-data/component-bindings-fr.csv',
        '03-seed-data/component-bindings-ar.csv',
        '03-seed-data/component-bindings-en.csv',
        '03-seed-data/mock-data-fr.json',
        '03-seed-data/mock-data-ar.json',
        '03-seed-data/mock-data-en.json',
        '04-quality/review-notes.md',
        '04-quality/glossary-applied.csv',
        '04-quality/conversion-leverage-checklist.md',
        'README.md',
    ]
    for f in must_exist:
        p = ROOT / f
        if not p.exists():
            err(f"  ❌ Fichier manquant : {f}")
        else:
            info(f"  ✓ {f}")


# ─────────────────────────────────────────────────────────────────────────
# CHECK 2 — messages-*.json : validité, parité, voix
# ─────────────────────────────────────────────────────────────────────────
def check_messages_files():
    info("\nCHECK 2 — messages-*.json (validité, parité, voix)")
    messages = {}
    for loc in LOCALES:
        path = ROOT / '02-translations' / f'messages-{loc}.json'
        try:
            with open(path) as f:
                messages[loc] = json.load(f)
            info(f"  ✓ {loc}: JSON valide")
        except json.JSONDecodeError as e:
            err(f"  ❌ {loc}: JSON invalide — {e}")
            return

    # Parité top-level namespaces
    namespaces = {loc: set(d.keys()) - {'_meta'} for loc, d in messages.items()}
    for loc in LOCALES:
        missing = EXPECTED_NAMESPACES - namespaces[loc]
        extra = namespaces[loc] - EXPECTED_NAMESPACES - {'_meta'}
        if missing:
            err(f"  ❌ {loc}: namespaces manquants {missing}")
        if extra:
            warn(f"  ⚠ {loc}: namespaces inattendus {extra}")
    if namespaces['fr'] == namespaces['ar'] == namespaces['en']:
        info(f"  ✓ Parité namespaces FR/AR/EN OK ({len(namespaces['fr'])})")

    # _meta.total_keys
    for loc in LOCALES:
        meta = messages[loc].get('_meta', {})
        tk = meta.get('total_keys')
        if tk != EXPECTED_TOTAL_KEYS:
            warn(f"  ⚠ {loc}: _meta.total_keys = {tk}, attendu {EXPECTED_TOTAL_KEYS}")
        else:
            info(f"  ✓ {loc}: _meta.total_keys = {EXPECTED_TOTAL_KEYS}")

    # Emojis dans les valeurs
    for loc in LOCALES:
        emoji_count = 0
        for path, v in walk_strings(messages[loc]):
            if not path.startswith('_meta'):
                ch = contains_emoji(v)
                if ch:
                    emoji_count += 1
                    if emoji_count <= 3:
                        err(f"  ❌ {loc}: emoji '{ch}' (U+{ord(ch):04X}) dans {path}")
        if emoji_count == 0:
            info(f"  ✓ {loc}: 0 emoji")
        elif emoji_count > 3:
            err(f"     +{emoji_count - 3} emojis additionnels (truncated)")

    # "!" marketing (heuristique : "!" suivi d'espace ou fin de chaîne, hors URL/regex/etc.)
    for loc in LOCALES:
        bang_count = 0
        for path, v in walk_strings(messages[loc]):
            if path.startswith('_meta'):
                continue
            # Détecter "!" final ou dans phrase, mais pas "https://" etc.
            if re.search(r'(?<![/\\\\:])\s*!\s*(?:$|\s)', v):
                bang_count += 1
                if bang_count <= 3:
                    warn(f"  ⚠ {loc}: \"!\" potentiel marketing dans {path}: {v[:80]}")
        if bang_count == 0:
            info(f"  ✓ {loc}: 0 \"!\" marketing")

    # Mots interdits (FR uniquement)
    forbidden_count = 0
    for path, v in walk_strings(messages['fr']):
        if path.startswith('_meta') or path.startswith('chat'):
            continue
        lower = v.lower()
        for word in FORBIDDEN_WORDS_FR:
            if word.lower() in lower:
                # Ignore si dans un contexte légitime (FAQ négation, etc.)
                if 'pas ' + word.lower() in lower or 'non-' + word.lower() in lower:
                    continue
                forbidden_count += 1
                if forbidden_count <= 3:
                    warn(f"  ⚠ FR: mot interdit '{word}' dans {path}")
                break
    if forbidden_count == 0:
        info(f"  ✓ FR: 0 mot interdit détecté")

    # AR : sanity check verbe féminin (au moins quelques impératifs féminins)
    ar_count = 0
    fem_imperatives = ['اكتشفي', 'اختاري', 'أنشئي', 'استلمي', 'تابعي', 'اقرئي',
                       'اكتبي', 'حضّري', 'ضعي', 'أعيدي']
    for path, v in walk_strings(messages['ar']):
        if path.startswith('_meta'):
            continue
        for imp in fem_imperatives:
            if imp in v:
                ar_count += 1
                break
    if ar_count >= 20:
        info(f"  ✓ AR: {ar_count} impératifs féminins détectés (adresse féminine OK)")
    else:
        warn(f"  ⚠ AR: seulement {ar_count} impératifs féminins (attendu ≥ 20)")


# ─────────────────────────────────────────────────────────────────────────
# CHECK 3 — Component bindings CSV : parité 3 locales
# ─────────────────────────────────────────────────────────────────────────
def check_bindings_csv():
    info("\nCHECK 3 — Component bindings CSV")
    bindings = {}
    for loc in LOCALES:
        path = ROOT / '03-seed-data' / f'component-bindings-{loc}.csv'
        try:
            with open(path) as f:
                rows = list(csv.DictReader(f))
            bindings[loc] = rows
            info(f"  ✓ {loc}: {len(rows)} rows")
        except Exception as e:
            err(f"  ❌ {loc}: CSV illisible — {e}")
            return

    # Parité (component_slug, field_key) tuples
    sigs = {loc: {(r.get('component_slug'), r.get('field_key')) for r in bindings[loc]}
            for loc in LOCALES}
    if sigs['fr'] == sigs['ar'] == sigs['en']:
        info(f"  ✓ Parité (component_slug, field_key) FR/AR/EN OK ({len(sigs['fr'])} pairs)")
    else:
        missing_ar = sigs['fr'] - sigs['ar']
        missing_en = sigs['fr'] - sigs['en']
        if missing_ar:
            err(f"  ❌ AR manque {len(missing_ar)} pairs vs FR (ex: {list(missing_ar)[:3]})")
        if missing_en:
            err(f"  ❌ EN manque {len(missing_en)} pairs vs FR (ex: {list(missing_en)[:3]})")

    # Vérif colonnes attendues
    expected_cols = {'component_slug', 'field_key', 'locale', 'value', 'status', 'notes'}
    for loc in LOCALES:
        if not bindings[loc]:
            continue
        cols = set(bindings[loc][0].keys())
        if cols != expected_cols:
            err(f"  ❌ {loc}: colonnes inattendues {cols} (attendu {expected_cols})")


# ─────────────────────────────────────────────────────────────────────────
# CHECK 4 — Pages légales : 9 slugs × 3 locales = 27 .md avec frontmatter
# ─────────────────────────────────────────────────────────────────────────
def check_legal_pages():
    info("\nCHECK 4 — Pages légales")
    for loc in LOCALES:
        dir_ = ROOT / '03-seed-data' / f'legal-pages-{loc}'
        if not dir_.exists():
            err(f"  ❌ {loc}: dossier manquant {dir_}")
            continue
        md_files = list(dir_.glob('*.md'))
        slugs = {f.stem for f in md_files}
        missing = EXPECTED_LEGAL_SLUGS - slugs
        extra = slugs - EXPECTED_LEGAL_SLUGS
        if missing:
            err(f"  ❌ {loc}: slugs manquants {missing}")
        if extra:
            warn(f"  ⚠ {loc}: slugs supplémentaires {extra}")
        if not missing:
            info(f"  ✓ {loc}: 9 slugs présents ({len(md_files)} .md)")

        # Frontmatter valide ? (slug, locale, title, status)
        invalid_fm = 0
        for f in md_files:
            with open(f) as fh:
                content = fh.read()
            fm_match = re.match(r'^---\n(.*?)\n---', content, re.DOTALL)
            if not fm_match:
                invalid_fm += 1
                continue
            fm_text = fm_match.group(1)
            required = ['slug:', 'locale:', 'title:', 'status:']
            if not all(r in fm_text for r in required):
                invalid_fm += 1
        if invalid_fm:
            err(f"  ❌ {loc}: {invalid_fm} fichier(s) avec frontmatter incomplet")
        else:
            info(f"  ✓ {loc}: tous les frontmatter OK")

        # Body length sanity (au moins 1500 chars sauf si stub volontaire)
        short_bodies = 0
        for f in md_files:
            size = f.stat().st_size
            if size < 1500:
                short_bodies += 1
                if short_bodies <= 3:
                    warn(f"  ⚠ {loc}: {f.name} body court ({size} bytes)")
        if short_bodies == 0:
            info(f"  ✓ {loc}: tous les bodies ≥ 1500 bytes")


# ─────────────────────────────────────────────────────────────────────────
# CHECK 5 — Mock data : 15 articles avec body dans chaque locale
# ─────────────────────────────────────────────────────────────────────────
def check_mock_data():
    info("\nCHECK 5 — Mock data articles")
    for loc in LOCALES:
        path = ROOT / '03-seed-data' / f'mock-data-{loc}.json'
        try:
            with open(path) as f:
                d = json.load(f)
        except json.JSONDecodeError as e:
            err(f"  ❌ {loc}: JSON invalide — {e}")
            continue

        arts = d.get('articles', [])
        if isinstance(arts, dict):
            arts = list(arts.values())
        total = len(arts)
        with_body = sum(1 for a in arts if isinstance(a, dict) and a.get('body'))

        if total != EXPECTED_ARTICLES_COUNT:
            warn(f"  ⚠ {loc}: {total} articles (attendu {EXPECTED_ARTICLES_COUNT})")
        if with_body != EXPECTED_ARTICLES_COUNT:
            err(f"  ❌ {loc}: seulement {with_body}/{EXPECTED_ARTICLES_COUNT} articles avec body")
        else:
            info(f"  ✓ {loc}: {with_body}/{total} articles avec body")

        # Emojis dans bodies
        emoji_count = 0
        for a in arts:
            if isinstance(a, dict) and a.get('body'):
                ch = contains_emoji(a['body'])
                if ch:
                    emoji_count += 1
        if emoji_count == 0:
            info(f"  ✓ {loc}: 0 emoji dans bodies articles")
        else:
            err(f"  ❌ {loc}: {emoji_count} bodies contiennent emoji")


# ─────────────────────────────────────────────────────────────────────────
# CHECK 6 — Drifts loggés dans review-notes
# ─────────────────────────────────────────────────────────────────────────
def check_review_notes():
    info("\nCHECK 6 — Review notes (drifts loggés)")
    path = ROOT / '04-quality' / 'review-notes.md'
    if not path.exists():
        err(f"  ❌ review-notes.md manquant")
        return
    content = path.read_text()
    drifts_expected = [
        'Casablanca', 'Rabat', 'gestes', 'founder', 'Hémisphage',
        'paste', 'powder', 'enrichissements', 'Phase C', 'Phase D',
    ]
    found = sum(1 for kw in drifts_expected if kw.lower() in content.lower())
    if found >= 8:
        info(f"  ✓ review-notes couvre {found}/{len(drifts_expected)} sujets critiques")
    else:
        warn(f"  ⚠ review-notes ne couvre que {found}/{len(drifts_expected)} sujets")


# ─────────────────────────────────────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────────────────────────────────────
def main():
    print("=" * 70)
    print("FemiGlow i18n seeds — Go/No-Go validation")
    print(f"Source : {ROOT}")
    print("=" * 70)

    check_structure()
    check_messages_files()
    check_bindings_csv()
    check_legal_pages()
    check_mock_data()
    check_review_notes()

    print("\n" + "=" * 70)
    if INFO:
        print("INFO :")
        for m in INFO:
            print(m)
    if WARNINGS:
        print(f"\nWARNINGS ({len(WARNINGS)}) :")
        for m in WARNINGS:
            print(m)
    if ERRORS:
        print(f"\nERRORS ({len(ERRORS)}) :")
        for m in ERRORS:
            print(m)

    print("\n" + "=" * 70)
    if ERRORS:
        print(f"❌ {len(ERRORS)} erreur(s), {len(WARNINGS)} warning(s) — NO-GO")
        print("   Résous les ERRORS avant ingestion.")
        sys.exit(1)
    elif WARNINGS:
        print(f"⚠  {len(WARNINGS)} warning(s) — GO conditionnel")
        print("   Relis les warnings, décide go/no-go avec founder.")
        sys.exit(0)
    else:
        print("✅ Tout est OK — GO pour ingestion")
        sys.exit(0)


if __name__ == '__main__':
    main()
