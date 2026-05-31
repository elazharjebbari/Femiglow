#!/usr/bin/env python3
"""
audit-rtl-classes.py — Audit des classes Tailwind physiques (LTR-only)
dans les composants `apps/web/src/components/`.

Output : CSV avec chaque occurrence à migrer vers logical properties.

Usage (depuis la racine du repo) :
    python3 docs/i18n-strategy-2026-05/scripts/audit-rtl-classes.py \
      > docs/i18n-strategy-2026-05/phase-4-rtl-audit.csv

Aucune dépendance externe (stdlib only).
"""
from __future__ import annotations

import csv
import os
import re
import sys
from pathlib import Path
from typing import Iterator

# Patterns à détecter : (regex, suggested replacement, name)
PATTERNS: list[tuple[re.Pattern[str], str, str]] = [
    (re.compile(r'\bml-(\d+(?:\.\d+)?|\[[^\]]+\]|auto|px)\b'), r'ms-\1', 'ml->ms'),
    (re.compile(r'\bmr-(\d+(?:\.\d+)?|\[[^\]]+\]|auto|px)\b'), r'me-\1', 'mr->me'),
    (re.compile(r'\bpl-(\d+(?:\.\d+)?|\[[^\]]+\]|px)\b'), r'ps-\1', 'pl->ps'),
    (re.compile(r'\bpr-(\d+(?:\.\d+)?|\[[^\]]+\]|px)\b'), r'pe-\1', 'pr->pe'),
    (re.compile(r'\btext-left\b'), 'text-start', 'text-left->text-start'),
    (re.compile(r'\btext-right\b'), 'text-end', 'text-right->text-end'),
    (re.compile(r'\bleft-(\d+(?:\.\d+)?|\[[^\]]+\]|auto|full|px|1/2|1/3|2/3|1/4|3/4)\b'),
     r'start-\1', 'left->start'),
    (re.compile(r'\bright-(\d+(?:\.\d+)?|\[[^\]]+\]|auto|full|px|1/2|1/3|2/3|1/4|3/4)\b'),
     r'end-\1', 'right->end'),
    (re.compile(r'\brounded-l-(\w+|none)\b'), r'rounded-s-\1', 'rounded-l->rounded-s'),
    (re.compile(r'\brounded-r-(\w+|none)\b'), r'rounded-e-\1', 'rounded-r->rounded-e'),
    (re.compile(r'\bborder-l-(\d+|none)\b'), r'border-s-\1', 'border-l->border-s'),
    (re.compile(r'\bborder-r-(\d+|none)\b'), r'border-e-\1', 'border-r->border-e'),
    (re.compile(r'\bfloat-left\b'), 'float-start', 'float-left->float-start'),
    (re.compile(r'\bfloat-right\b'), 'float-end', 'float-right->float-end'),
]

# Répertoires à scanner (composants publics — admin out of scope cf. ADR-008)
SCAN_DIRS = [
    'apps/web/src/components',
    'apps/web/src/app/[locale]',
    'apps/web/src/app/(marketing)',
]

# Exclure les dossiers admin/test
EXCLUDE_PATTERNS = ['/admin/', '__tests__', '.test.', '.spec.']

# Priority : routes [locale] = P0, marketing legacy = P1, autres = P2
def priority_for(path: str) -> str:
    if '/app/[locale]/' in path:
        return 'P0'
    if '/(marketing)/' in path:
        return 'P1'
    if '/components/' in path:
        return 'P0'  # Components peuvent être partagés entre [locale] et marketing
    return 'P2'


def scan_file(path: Path) -> Iterator[dict[str, str]]:
    """Yield each match as a dict ready for CSV writer."""
    try:
        content = path.read_text(encoding='utf-8')
    except (UnicodeDecodeError, OSError):
        return
    rel_path = str(path.relative_to(Path.cwd()))
    for line_no, line in enumerate(content.splitlines(), 1):
        for regex, _, name in PATTERNS:
            for match in regex.finditer(line):
                yield {
                    'file': rel_path,
                    'line': str(line_no),
                    'class_physical': match.group(0),
                    'rule': name,
                    'priority': priority_for(rel_path),
                    'context': line.strip()[:200],
                }


def main():
    root = Path.cwd()
    matches: list[dict[str, str]] = []

    for scan_dir in SCAN_DIRS:
        dir_path = root / scan_dir
        if not dir_path.exists():
            continue
        for path in dir_path.rglob('*.tsx'):
            path_str = str(path)
            if any(ex in path_str for ex in EXCLUDE_PATTERNS):
                continue
            for match in scan_file(path):
                matches.append(match)

    writer = csv.DictWriter(
        sys.stdout,
        fieldnames=['file', 'line', 'class_physical', 'rule', 'priority', 'context'],
    )
    writer.writeheader()
    for m in matches:
        writer.writerow(m)

    # Stats sur stderr (pas de pollution du CSV stdout)
    by_rule: dict[str, int] = {}
    by_priority: dict[str, int] = {}
    for m in matches:
        by_rule[m['rule']] = by_rule.get(m['rule'], 0) + 1
        by_priority[m['priority']] = by_priority.get(m['priority'], 0) + 1

    print('', file=sys.stderr)
    print('=== AUDIT RTL — STATISTIQUES ===', file=sys.stderr)
    print(f'Total occurrences : {len(matches)}', file=sys.stderr)
    print('Par règle :', file=sys.stderr)
    for rule, count in sorted(by_rule.items(), key=lambda x: -x[1]):
        print(f'  {rule:40s} {count:>4}', file=sys.stderr)
    print('Par priorité :', file=sys.stderr)
    for prio in ('P0', 'P1', 'P2'):
        print(f'  {prio} : {by_priority.get(prio, 0)}', file=sys.stderr)


if __name__ == '__main__':
    main()
