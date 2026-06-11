import { detectIntent } from './src/lib/chat/services/intent';

const cases = [
  // Frustration
  ["frustration: inadmissible", "C'est inadmissible !"],
  ["frustration: scandale", "C'est un scandale"],
  ["frustration: énervée", "Je suis énervée"],
  ["frustration: marre", "J'en ai marre"],
  ["frustration: personne ne répond", "Personne ne répond"],
  ["frustration: décevant", "C'est décevant"],
  ["frustration: pas content", "Je suis pas content"],
  ["frustration: nul", "C'est vraiment nul"],
  // Should NOT be frustration (sanity)
  ["misc: poli", "Bonjour, je voudrais des informations"],
  ["greeting", "Salam !"],
  ["pricing simple", "C'est combien le kit ?"],
];
for (const [label, c] of cases) {
  const i = detectIntent(c);
  console.log(label.padEnd(35), '→', i);
}
