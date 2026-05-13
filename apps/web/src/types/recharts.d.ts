/**
 * Type stub minimal pour `recharts` — à supprimer une fois la dépendance
 * réellement installée (`npm i recharts`).
 *
 * Justification : la dépendance est listée dans `package.json` mais n'a pas
 * encore été installée dans cet environnement. Ce fichier permet de garder
 * `tsc --noEmit` vert pendant le développement de M1.
 *
 * Les types réels de Recharts seront ré-exportés depuis `node_modules/recharts/types/index.d.ts`
 * et écraseront cette déclaration ambiante dès l'installation.
 */
/* eslint-disable */
declare module 'recharts' {
  export const ResponsiveContainer: any;
  export const ComposedChart: any;
  export const LineChart: any;
  export const AreaChart: any;
  export const BarChart: any;
  export const PieChart: any;
  export const Line: any;
  export const Area: any;
  export const Bar: any;
  export const Pie: any;
  export const XAxis: any;
  export const YAxis: any;
  export const CartesianGrid: any;
  export const Tooltip: any;
  export const Legend: any;
  export const Cell: any;
  export const ReferenceLine: any;
  export const Sankey: any;
  export const Layer: any;
  export const Rectangle: any;
}
