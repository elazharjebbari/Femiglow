#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Outil du pack d'images hero FemiGlow (kit-hero-produit).

Toutes les commandes se lancent depuis le dossier docs/hero-media-par-angle/ :

  python3 tools/hero_pack.py validate                 # cohérence manifest <-> prompts <-> références
  python3 tools/hero_pack.py prompt --id HP-PRI-A-ALL-01 [--panel bas-apres]
                                                      # affiche le prompt final assemblé + les références dans l'ordre
  python3 tools/hero_pack.py crop  --id HP-PRI-A-ALL-01 --master generated/_work/HP-PRI-A-ALL-01/master.png [--anchor 0.4]
  python3 tools/hero_pack.py stack --id HP-SEC-DEF-ALL-01 --panels haut.png bas.png --anchors 0.5 0.3
  python3 tools/hero_pack.py place-copies             # copie les slides partagées vers les variantes (entrées type=copy)
  python3 tools/hero_pack.py status                   # ce qui est fait / manquant, dimensions vérifiées

crop/stack/place-copies/status nécessitent Pillow (pip install pillow). validate et prompt n'utilisent que la stdlib.
"""
import argparse, json, os, re, shutil, sys

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # docs/hero-media-par-angle
MANIFEST = os.path.join(HERE, "manifest.json")
GUTTER = 12
GUTTER_COLOR = (0xFB, 0xF8, 0xF1)  # crème #FBF8F1
MAX_UPSCALE = 1.5
PATH_RE = re.compile(r"^generated/kit-hero-produit/(primary|secondary)/(default|angle-[a-e]|angle-temoin)/(fr|ar|en|_all)/(\d\d)-([a-z0-9-]+)(\.mobile\.png|\.png|\.alt\.json)$")


def load():
    with open(MANIFEST, encoding="utf-8") as f:
        return json.load(f)


def by_id(m, img_id):
    for e in m["images"]:
        if e["id"] == img_id:
            return e
    sys.exit(f"id inconnu : {img_id}")


def p(rel):
    return os.path.join(HERE, rel)


def block(path, marker):
    """Retourne le bloc ```text qui suit <!-- marker --> dans un fichier markdown."""
    with open(p(path), encoding="utf-8") as f:
        t = f.read()
    m = re.search(r"<!-- " + re.escape(marker) + r" -->\s*```text\n(.*?)\n```", t, re.S)
    if not m:
        sys.exit(f"bloc {marker} introuvable dans {path}")
    return m.group(1).strip()


def ref_file(ref, img_id):
    if ref.startswith("PANEL:"):
        return f"generated/_work/{img_id}/{ref[6:]}.png"
    for name in os.listdir(p("references")):
        if name.startswith(ref + "-"):
            return "references/" + name
    return None


# ---------------------------------------------------------------- prompt
def cmd_prompt(a):
    m = load()
    e = by_id(m, a.id)
    if e["type"] == "copy":
        sys.exit(f"{a.id} est une copie de {e['copyOf']} : rien à générer.")
    lock = "PROMPT-BLOCK-FULL" if e["productLock"] == "full" else "PROMPT-BLOCK-ABSENT"
    if e["composition"] == "single":
        marker, refs = "PROMPT", e["references"]
    else:
        if not a.panel:
            keys = ", ".join(pn["key"] for pn in sorted(e["panels"], key=lambda x: x["generationOrder"]))
            sys.exit(f"{a.id} est un assemblage : préciser --panel parmi {keys} (dans cet ordre).")
        pn = next((x for x in e["panels"] if x["key"] == a.panel), None)
        if not pn:
            sys.exit(f"panneau inconnu : {a.panel}")
        marker, refs = f"PROMPT panel={a.panel}", pn["references"]
    parts = [block("prompts/_shared/style-bible.md", "PROMPT-BLOCK"),
             block("prompts/_shared/product-lock.md", lock),
             block(e["promptFile"], marker),
             block("prompts/_shared/negative.md", "PROMPT-BLOCK")]
    print("=== RÉFÉRENCES À JOINDRE (dans cet ordre = image 1, image 2, …) ===")
    for i, r in enumerate(refs, 1):
        print(f"image {i}: {ref_file(r['ref'], e['id'])}  [{r['roleLabel']}]")
    print("\n=== PROMPT FINAL ===")
    print("\n\n".join(parts))


# ---------------------------------------------------------------- images
def need_pil():
    try:
        from PIL import Image  # noqa
        return Image
    except ImportError:
        sys.exit("Pillow requis : pip install pillow")


def fit_crop(img, tw, th, anchor_y, Image):
    """Recadre img au ratio tw/th (centré en x, ancré en y), puis redimensionne en tw×th."""
    W, H = img.size
    ta = tw / th
    if W / H > ta:
        cw, ch = round(H * ta), H
        x, y = (W - cw) // 2, 0
    else:
        cw, ch = W, round(W / ta)
        x, y = 0, round(anchor_y * (H - ch))
    scale = tw / cw
    if scale > MAX_UPSCALE:
        print(f"  ATTENTION : agrandissement x{scale:.2f} (> {MAX_UPSCALE}) — régénérer plus grand ou passer par un upscaler.")
    return img.crop((x, y, x + cw, y + ch)).resize((tw, th), Image.LANCZOS)


def write_alt(e):
    path = p(e["outputs"]["alt"])
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(e["alt"], f, ensure_ascii=False, indent=2)
        f.write("\n")


def save(img, rel):
    path = p(rel)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    img.convert("RGB").save(path, "PNG", optimize=True)
    print(f"  écrit {rel} ({img.size[0]}×{img.size[1]})")


def default_anchor(e):
    return e.get("cropAnchor", 0.40)


def cmd_crop(a):
    Image = need_pil()
    m = load()
    e = by_id(m, a.id)
    if e.get("composition") != "single":
        sys.exit("crop ne s'applique qu'aux images uniques ; utiliser stack pour les assemblages.")
    src = Image.open(a.master)
    anchor = a.anchor if a.anchor is not None else default_anchor(e)
    for k in ("desktop", "mobile"):
        t = e["targets"][k]
        save(fit_crop(src, t["width"], t["height"], anchor, Image), e["outputs"][k])
    write_alt(e)


def cmd_stack(a):
    Image = need_pil()
    m = load()
    e = by_id(m, a.id)
    n = len(a.panels)
    if e.get("composition") not in ("stack2", "stack3") or n != len(e["panels"]):
        sys.exit(f"{a.id} attend {len(e.get('panels', []))} panneaux (composition {e.get('composition')}).")
    anchors = a.anchors or [0.5] * n
    if len(anchors) != n:
        sys.exit("--anchors doit avoir autant de valeurs que --panels")
    imgs = [Image.open(x).convert("RGB") for x in a.panels]
    for k in ("desktop", "mobile"):
        t = e["targets"][k]
        W, H = t["width"], t["height"]
        canvas = Image.new("RGB", (W, H), GUTTER_COLOR)
        ph = (H - GUTTER * (n - 1)) // n
        y = 0
        for i, (im, an) in enumerate(zip(imgs, anchors)):
            h = ph if i < n - 1 else H - y
            canvas.paste(fit_crop(im, W, h, an, Image), (0, y))
            y += h + GUTTER
        save(canvas, e["outputs"][k])
    write_alt(e)


def cmd_place_copies(a):
    m = load()
    idx = {e["id"]: e for e in m["images"]}
    done = missing = 0
    for e in m["images"]:
        if e["type"] != "copy":
            continue
        s = idx[e["copyOf"]]
        for k in ("desktop", "mobile", "alt"):
            src, dst = p(s["outputs"][k]), p(e["outputs"][k])
            if not os.path.exists(src):
                print(f"  manquant (source pas encore générée) : {s['outputs'][k]}")
                missing += 1
                continue
            os.makedirs(os.path.dirname(dst), exist_ok=True)
            shutil.copyfile(src, dst)
            done += 1
    print(f"copies écrites : {done} fichiers ; sources manquantes : {missing}")


def cmd_status(a):
    m = load()
    try:
        from PIL import Image
    except ImportError:
        Image = None
    ok = todo = bad = 0
    for e in m["images"]:
        states = []
        for k in ("desktop", "mobile", "alt"):
            path = p(e["outputs"][k])
            if not os.path.exists(path):
                states.append(f"{k}:manquant")
                continue
            if k != "alt" and Image:
                w, h = Image.open(path).size
                t = e["targets"][k]
                if (w, h) != (t["width"], t["height"]):
                    states.append(f"{k}:{w}×{h}≠{t['width']}×{t['height']}")
                    continue
            states.append(f"{k}:ok")
        if all(s.endswith(":ok") for s in states):
            ok += 1
        elif any("≠" in s for s in states):
            bad += 1
        else:
            todo += 1
        print(f"{e['id']:<22} {e['type']:<8} {e['priority']}  " + "  ".join(states))
    print(f"\ncomplets : {ok} · incomplets : {todo} · mauvaises dimensions : {bad} · total : {len(m['images'])}")


# ---------------------------------------------------------------- validate
def cmd_validate(a):
    m = load()
    errs, warns = [], []
    ids = [e["id"] for e in m["images"]]
    if len(ids) != len(set(ids)):
        errs.append("identifiants en double")
    idx = {e["id"]: e for e in m["images"]}
    gen = [e for e in m["images"] if e["type"] == "generate"]
    cop = [e for e in m["images"] if e["type"] == "copy"]
    # prompt files
    manifest_prompts = set()
    for e in gen:
        pf = e["promptFile"]
        manifest_prompts.add(pf)
        if not os.path.exists(p(pf)):
            errs.append(f"{e['id']} : fichier de prompt absent {pf}")
            continue
        with open(p(pf), encoding="utf-8") as f:
            t = f.read()
        if e["id"] not in t:
            errs.append(f"{e['id']} : identifiant absent de {pf}")
        markers = re.findall(r"<!-- PROMPT( panel=([a-z0-9-]+))? -->", t)
        if e["composition"] == "single":
            if len(markers) != 1:
                errs.append(f"{e['id']} : 1 bloc PROMPT attendu, {len(markers)} trouvés")
        else:
            keys = {k for _, k in markers}
            want = {pn["key"] for pn in e["panels"]}
            if keys != want:
                errs.append(f"{e['id']} : panneaux du prompt {sorted(keys)} ≠ manifest {sorted(want)}")
        # prompt path mirrors output path
        stem = e["outputs"]["desktop"][len("generated/"):-len(".png")]
        if pf != f"prompts/{stem}.md":
            errs.append(f"{e['id']} : chemin de prompt {pf} ne reflète pas la sortie {stem}")
        # references
        allrefs = list(e["references"]) + [r for pn in e.get("panels", []) for r in pn["references"]]
        for r in allrefs:
            if r["ref"].startswith("PANEL:"):
                if r["ref"][6:] not in {pn["key"] for pn in e.get("panels", [])}:
                    errs.append(f"{e['id']} : référence de panneau inconnue {r['ref']}")
            elif not ref_file(r["ref"], e["id"]):
                errs.append(f"{e['id']} : référence introuvable {r['ref']}")
        if e["productLock"] not in ("full", "absent"):
            errs.append(f"{e['id']} : productLock invalide")
    disk_prompts = set()
    for root, _, files in os.walk(p("prompts/kit-hero-produit")):
        for fn in files:
            if fn.endswith(".md"):
                disk_prompts.add(os.path.relpath(os.path.join(root, fn), HERE))
    for extra in sorted(disk_prompts - manifest_prompts):
        errs.append(f"fichier de prompt hors manifest : {extra}")
    # copies
    for e in cop:
        s = idx.get(e["copyOf"])
        if not s or s["type"] != "generate":
            errs.append(f"{e['id']} : copyOf invalide {e['copyOf']}")
        elif e["promptFile"] != s["promptFile"] or e["alt"] != s["alt"] or e["slug"] != s["slug"]:
            errs.append(f"{e['id']} : copie incohérente avec {s['id']}")
    # outputs, alt, sets
    sets = {}
    for e in m["images"]:
        for k in ("desktop", "mobile", "alt"):
            mm = PATH_RE.match(e["outputs"][k])
            if not mm:
                errs.append(f"{e['id']} : chemin de sortie hors convention 05 §4.8 : {e['outputs'][k]}")
                continue
            slot, variant, loc, nn, slug, _ = mm.groups()
            if (slot, variant, loc, nn, slug) != (e["slot"], e["variant"], e["locale"], e["position"], e["slug"]):
                errs.append(f"{e['id']} : chemin {e['outputs'][k]} incohérent avec les champs")
        if not all(e["alt"].get(l, "").strip() for l in ("fr", "ar", "en")):
            errs.append(f"{e['id']} : alt fr/ar/en incomplet")
        if e["locale"] == "_all" and not e.get("crossLocale"):
            errs.append(f"{e['id']} : _all doit être crossLocale")
        sets.setdefault((e["slot"], e["variant"], e["locale"]), []).append(e["position"])
    for (slot, variant, loc), pos in sets.items():
        exp = [f"{i:02d}" for i in range(1, len(pos) + 1)]
        if sorted(pos) != exp:
            errs.append(f"ensemble {slot}/{variant}/{loc} : positions {sorted(pos)} non contiguës")
        if slot == "primary" and len(pos) != 1:
            errs.append(f"ensemble {slot}/{variant}/{loc} : un seul fichier attendu")
        if slot == "secondary" and len(pos) > 6:
            errs.append(f"ensemble {slot}/{variant}/{loc} : plus de 6 images")
    for v in ("default", "angle-a", "angle-b", "angle-c", "angle-d", "angle-e", "angle-temoin"):
        if ("primary", v, "_all") not in sets and not any(k[0] == "primary" and k[1] == v for k in sets):
            errs.append(f"aucune image primaire pour {v}")
    for f in ("prompts/_shared/style-bible.md", "prompts/_shared/product-lock.md", "prompts/_shared/negative.md"):
        if not os.path.exists(p(f)):
            errs.append(f"fichier partagé absent : {f}")
    block("prompts/_shared/style-bible.md", "PROMPT-BLOCK")
    block("prompts/_shared/product-lock.md", "PROMPT-BLOCK-FULL")
    block("prompts/_shared/product-lock.md", "PROMPT-BLOCK-ABSENT")
    block("prompts/_shared/negative.md", "PROMPT-BLOCK")
    # summary consistency
    s = m.get("summary", {})
    if s.get("slidesToGenerate") != len(gen) or s.get("copies") != len(cop) or s.get("generationCalls") != sum(e["generations"] for e in gen):
        errs.append("summary du manifest désynchronisé")
    print(f"entrées manifest : {len(m['images'])} ({len(gen)} à générer, {len(cop)} copies)")
    print(f"appels de génération : {sum(e['generations'] for e in gen)} · fichiers image en sortie : {2*len(m['images'])} (+ {len(m['images'])} .alt.json)")
    print(f"fichiers de prompt : {len(disk_prompts)} sur disque, {len(manifest_prompts)} référencés")
    print(f"ensembles (slot/variante/langue) : {len(sets)}")
    for w in warns:
        print("AVERTISSEMENT :", w)
    if errs:
        for x in errs:
            print("ERREUR :", x)
        sys.exit(1)
    print("OK : manifest, prompts, références et chemins cohérents.")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sp = ap.add_subparsers(dest="cmd", required=True)
    sp.add_parser("validate")
    x = sp.add_parser("prompt"); x.add_argument("--id", required=True); x.add_argument("--panel")
    x = sp.add_parser("crop"); x.add_argument("--id", required=True); x.add_argument("--master", required=True); x.add_argument("--anchor", type=float)
    x = sp.add_parser("stack"); x.add_argument("--id", required=True); x.add_argument("--panels", nargs="+", required=True); x.add_argument("--anchors", nargs="+", type=float)
    sp.add_parser("place-copies")
    sp.add_parser("status")
    a = ap.parse_args()
    {"validate": cmd_validate, "prompt": cmd_prompt, "crop": cmd_crop, "stack": cmd_stack,
     "place-copies": cmd_place_copies, "status": cmd_status}[a.cmd](a)


if __name__ == "__main__":
    main()
