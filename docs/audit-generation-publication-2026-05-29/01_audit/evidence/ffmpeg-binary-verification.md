# Contre-vérification indépendante — ffmpeg / lavfi (auditeur principal)

> Objet : réfuter ou confirmer la cause racine avancée par l'agent d'audit pour **BUG-012 / BUG-013**
> (« voix-off / musique / vidéo mock cassées car `lavfi` indisponible dans le process staging »).

## Méthode

Application du principe directeur : ne pas faire confiance à la conclusion d'un agent sans l'exercer soi-même. On identifie le **binaire réellement utilisé par l'app**, puis on exécute **la commande réelle des nœuds**.

## Faits établis

1. **Binaire utilisé par l'app** : les nœuds (`generate-video.ts:4`, `generate-voiceover.ts:4`, `generate-music.ts:4`, `compose.ts:4`, `transcode-export.ts:4`) importent `ffmpeg-static` et font `ffmpeg.setFfmpegPath(ffmpegPath)`.
   - Chemin résolu : `/var/www/femiglow-staging/node_modules/.pnpm/ffmpeg-static@5.3.0/node_modules/ffmpeg-static/ffmpeg` (existe).

2. **`lavfi` est supporté par ce binaire** :
   ```
   $ <ffmpeg-static> -hide_banner -demuxers | grep -i lavfi
    D d lavfi           Libavfilter virtual input device
   ```

3. **La commande réelle des nœuds fonctionne** (anullsrc lavfi → AAC, comme `generate-voiceover.ts:45-47`) :
   ```
   $ <ffmpeg-static> -f lavfi -i anullsrc=r=44100:cl=mono -t 0.2 -c:a aac /tmp/vo-test.m4a -y
   ... exit=0  ->  /tmp/vo-test.m4a (901 bytes, valide)
   ```
   Idem avec le `/usr/bin/ffmpeg` système (exit 0).

4. Les nœuds **n'utilisent aucune opération dépendante de `ffprobe`** (`.ffprobe()/.screenshots()` absents) ; `ffprobe-static` n'est pas installé, mais `/usr/bin/ffprobe` est présent — sans impact ici.

## Verdict

> **Cause racine « lavfi indisponible » : RÉFUTÉE.** `lavfi` fonctionne sur le binaire exact de l'app comme sur le système. La commande des nœuds produit un fichier valide.

**Conséquences sur le registre :**
- **BUG-012** et **BUG-013** sont **ramenés à `minor`** avec mention `cause racine réfutée` : le symptôme éventuel n'a pas pu être reproduit au niveau ffmpeg.
- L'impact opérateur réel de la voix-off/musique/montage est **gouverné par [BUG-004]** (ces nœuds sont **inatteignables** depuis le flux create), qui reste un **blocker** confirmé indépendamment (le bridge A→B n'invoque jamais ces nœuds).
- **Réserve** : la contre-vérification a été faite en exécutant le binaire directement (utilisateur root). Le process Next.js sous PM2 tourne potentiellement sous un autre utilisateur ; **si** le graphe A est un jour câblé au flux opérateur, re-vérifier l'exécution du nœud sous l'utilisateur runtime réel (permissions d'exécution du binaire, `cwd`, répertoire de sortie).
