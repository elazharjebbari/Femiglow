/**
 * Cover SVG par défaut « Le geste révélateur » pour la section vidéo `/kit`.
 *
 * Composition Kolenda §4.4 :
 *  - L1 fond sauge `#E8EDE3` + grain papier (feTurbulence)
 *  - L3 halo champagne `#C8A876` qui pulse (4s) — révèle l'ongle
 *  - L2 main 3/4 + ongle central lustré (radialGradient nacre)
 *  - L4 3 matières en orbite : cire (hexagone), silicate (losange),
 *       perle (cercle nacre) — reprend le transcript
 *  - L5 8 particules nacre flottantes (translateY infini, 5-10s offsets)
 *  - L7 kicker italique « LE RITUEL · 90 SECONDES »
 *
 * SVG 9:16 portrait (1080×1920), preserveAspectRatio slice → couvre le
 * conteneur sans déformer. Animations respectent `prefers-reduced-motion`
 * via les CSS du parent (motion-safe Tailwind).
 */

export const DEFAULT_KIT_VIDEO_COVER_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1920" preserveAspectRatio="xMidYMid slice" role="img" aria-labelledby="cover-title cover-desc">
<title id="cover-title">Le rituel — 90 secondes</title>
<desc id="cover-desc">Une main en plein geste de polissage, halo champagne, matières en orbite douce.</desc>
<defs>
<radialGradient id="halo" cx="50%" cy="40%" r="40%">
<stop offset="0%" stop-color="#C8A876" stop-opacity="0.55"/>
<stop offset="60%" stop-color="#C8A876" stop-opacity="0.15"/>
<stop offset="100%" stop-color="#C8A876" stop-opacity="0"/>
</radialGradient>
<radialGradient id="nail" cx="50%" cy="40%" r="60%">
<stop offset="0%" stop-color="#FBFAF6" stop-opacity="0.98"/>
<stop offset="60%" stop-color="#F2E0D0" stop-opacity="0.9"/>
<stop offset="100%" stop-color="#E8C7AE" stop-opacity="0.8"/>
</radialGradient>
<filter id="grain" x="0%" y="0%" width="100%" height="100%">
<feTurbulence type="fractalNoise" baseFrequency="0.95" numOctaves="2" seed="3"/>
<feColorMatrix values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.06 0"/>
</filter>
</defs>
<rect width="1080" height="1920" fill="#E8EDE3"/>
<circle cx="540" cy="760" r="380" fill="url(#halo)">
<animate attributeName="opacity" values="0.4;1;0.4" dur="4s" repeatCount="indefinite"/>
</circle>
<g stroke="#1a1a1a" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round" opacity="0.85">
<path d="M380 1100 Q420 900 540 880 Q620 900 640 1000"/>
<path d="M620 1000 Q660 880 720 920 Q740 950 720 1050"/>
<path d="M720 1050 Q780 990 820 1080"/>
<path d="M380 1100 Q360 1300 500 1500 Q700 1620 820 1480 Q860 1300 820 1080"/>
</g>
<ellipse cx="540" cy="830" rx="48" ry="65" fill="url(#nail)" stroke="#1a1a1a" stroke-width="1.5"/>
<ellipse cx="535" cy="805" rx="18" ry="28" fill="#FBFAF6" opacity="0.75"/>
<g opacity="0.55">
<polygon points="280,420 320,440 320,480 280,500 240,480 240,440" fill="#1a1a1a"/>
<text x="200" y="555" font-family="Cormorant Garamond, Cormorant, serif" font-style="italic" font-size="24" fill="#1a1a1a" opacity="0.7">cire d'abeille</text>
<polygon points="800,440 830,470 800,510 770,470" fill="#1a1a1a"/>
<text x="700" y="565" font-family="Cormorant Garamond, Cormorant, serif" font-style="italic" font-size="24" fill="#1a1a1a" opacity="0.7">silicate</text>
<circle cx="850" cy="1280" r="22" fill="#FBFAF6" stroke="#1a1a1a" stroke-width="1.2"/>
<text x="740" y="1340" font-family="Cormorant Garamond, Cormorant, serif" font-style="italic" font-size="24" fill="#1a1a1a" opacity="0.7">poudre de perle</text>
</g>
<g fill="#FBFAF6">
<circle cx="450" cy="680" r="3" opacity="0.85">
<animateTransform attributeName="transform" type="translate" values="0,0;0,-18;0,0" dur="6s" repeatCount="indefinite" begin="0s"/>
</circle>
<circle cx="630" cy="700" r="2.5" opacity="0.8">
<animateTransform attributeName="transform" type="translate" values="0,0;0,-14;0,0" dur="7s" repeatCount="indefinite" begin="1s"/>
</circle>
<circle cx="500" cy="620" r="2" opacity="0.75">
<animateTransform attributeName="transform" type="translate" values="0,0;0,-22;0,0" dur="8s" repeatCount="indefinite" begin="2s"/>
</circle>
<circle cx="580" cy="950" r="2.5" opacity="0.7">
<animateTransform attributeName="transform" type="translate" values="0,0;0,-12;0,0" dur="5s" repeatCount="indefinite" begin="0.5s"/>
</circle>
<circle cx="700" cy="800" r="2" opacity="0.75">
<animateTransform attributeName="transform" type="translate" values="0,0;0,-16;0,0" dur="9s" repeatCount="indefinite" begin="2.5s"/>
</circle>
<circle cx="400" cy="780" r="2.5" opacity="0.7">
<animateTransform attributeName="transform" type="translate" values="0,0;0,-20;0,0" dur="6.5s" repeatCount="indefinite" begin="1.5s"/>
</circle>
<circle cx="660" cy="600" r="2" opacity="0.75">
<animateTransform attributeName="transform" type="translate" values="0,0;0,-15;0,0" dur="7.5s" repeatCount="indefinite" begin="3s"/>
</circle>
<circle cx="540" cy="550" r="3" opacity="0.7">
<animateTransform attributeName="transform" type="translate" values="0,0;0,-25;0,0" dur="10s" repeatCount="indefinite" begin="0.8s"/>
</circle>
</g>
<text x="60" y="1840" font-family="Cormorant Garamond, Cormorant, serif" font-style="italic" font-size="28" fill="#1a1a1a" opacity="0.6" letter-spacing="4">LE RITUEL · 90 SECONDES</text>
<rect width="1080" height="1920" filter="url(#grain)" opacity="0.4" pointer-events="none"/>
</svg>`;

export const DEFAULT_KIT_VIDEO_COVER_ARIA_LABEL =
  'Le rituel ongles, 90 secondes — main en plein geste de polissage, halo champagne, matières en orbite.';
