'use client';

import { forwardRef, type ForwardedRef } from 'react';
import type {
  GraphDescriptor,
  GraphFolderColor,
  GraphFolderNode,
  GraphTagItem,
} from '@/lib/tracking/gtm/viz/descriptor';

const FOLDER_COLORS: Record<GraphFolderColor, { bg: string; border: string; title: string }> = {
  ciel: { bg: '#E1ECF1', border: '#7AA8C0', title: '#2D4F60' },
  creme: { bg: '#FBF8F1', border: '#E5DCC4', title: '#7A6940' },
  'sauge-clair': { bg: '#E9F2E8', border: '#A8C4A6', title: '#3F5B41' },
  petale: { bg: '#FBE9E8', border: '#E2B6B2', title: '#9B4D45' },
  champagne: { bg: '#F4EAD5', border: '#D4B98C', title: '#7A6940' },
  sable: { bg: '#F2EBDD', border: '#D9CDB8', title: '#6B6041' },
  sauge: { bg: '#DEEADC', border: '#A8C4A6', title: '#2F4D31' },
  stone: { bg: '#F2F1ED', border: '#D6D3CA', title: '#4A4844' },
  'sauge-profond': { bg: '#CFE0CC', border: '#688665', title: '#1F3520' },
};

const COLS = {
  folderHeader: 32,
  rowHeight: 40,
  folderGap: 16,
  tagWidth: 360,
  triggerWidth: 220,
  paddingX: 24,
  paddingY: 24,
};

interface Props {
  descriptor: GraphDescriptor;
  /** Mode "fullHeight" supprime le scroll vertical et étale toute la hauteur. */
  fullHeight?: boolean;
}

function FolderCard({
  folder,
  yOffset,
}: {
  folder: GraphFolderNode;
  yOffset: number;
}) {
  const colors = FOLDER_COLORS[folder.color];
  const headerH = COLS.folderHeader;
  const rowH = COLS.rowHeight;
  const folderH = headerH + folder.items.length * rowH + 12;
  return (
    <g transform={`translate(${COLS.paddingX} ${yOffset})`}>
      <rect
        width={COLS.tagWidth + COLS.triggerWidth + 80}
        height={folderH}
        rx={10}
        ry={10}
        fill={colors.bg}
        stroke={colors.border}
        strokeWidth={1}
      />
      <text
        x={14}
        y={22}
        fontSize={12}
        fontWeight={600}
        fill={colors.title}
        style={{ textTransform: 'uppercase', letterSpacing: '0.06em' }}
      >
        {folder.name}
      </text>
      <text
        x={COLS.tagWidth + COLS.triggerWidth + 80 - 14}
        y={22}
        fontSize={11}
        fontWeight={500}
        fill={colors.title}
        opacity={0.7}
        textAnchor="end"
      >
        {folder.items.length} tag{folder.items.length > 1 ? 's' : ''}
      </text>

      {folder.items.map((item, i) => (
        <FolderRow
          key={item.name}
          item={item}
          y={headerH + i * rowH + 4}
          colors={colors}
        />
      ))}
    </g>
  );
}

function FolderRow({
  item,
  y,
  colors,
}: {
  item: GraphTagItem;
  y: number;
  colors: { bg: string; border: string; title: string };
}) {
  return (
    <g transform={`translate(0 ${y})`}>
      {/* Trigger pastilles à gauche */}
      <g transform={`translate(${14} 0)`}>
        {item.triggers.slice(0, 2).map((trig, i) => (
          <g key={trig.name} transform={`translate(0 ${i * 14})`}>
            <rect
              width={COLS.triggerWidth - 12}
              height={20}
              rx={10}
              ry={10}
              fill="white"
              stroke={colors.border}
              strokeWidth={0.75}
            />
            <text x={10} y={14} fontSize={10} fontFamily="monospace" fill={colors.title}>
              {trig.name.length > 30 ? trig.name.slice(0, 28) + '…' : trig.name}
            </text>
          </g>
        ))}
        {item.triggers.length > 2 ? (
          <text x={6} y={42} fontSize={9} fill={colors.title} opacity={0.6}>
            +{item.triggers.length - 2} autre(s)
          </text>
        ) : null}
      </g>

      {/* Connector */}
      <path
        d={`M ${COLS.triggerWidth + 8} 14 L ${COLS.triggerWidth + 24} 14`}
        stroke={colors.border}
        strokeWidth={1.25}
        strokeDasharray="0"
        fill="none"
      />

      {/* Tag card à droite */}
      <g transform={`translate(${COLS.triggerWidth + 28} 0)`}>
        <rect
          width={COLS.tagWidth + 28}
          height={28}
          rx={6}
          ry={6}
          fill="white"
          stroke={colors.title}
          strokeOpacity={0.4}
          strokeWidth={1}
        />
        <text x={12} y={18} fontSize={11} fontWeight={500} fill="#2C2A28">
          {item.name.length > 60 ? item.name.slice(0, 58) + '…' : item.name}
        </text>
        {item.setupTags.length > 0 ? (
          <text x={COLS.tagWidth + 28 - 12} y={18} fontSize={9} fill="#7A6940" textAnchor="end">
            ↘ setup
          </text>
        ) : null}
      </g>
    </g>
  );
}

export const GtmGraphCanvas = forwardRef(function GtmGraphCanvas(
  { descriptor, fullHeight }: Props,
  ref: ForwardedRef<SVGSVGElement>,
) {
  // Hauteur dynamique selon les folders.
  const totalH =
    COLS.paddingY * 2 +
    descriptor.folders.reduce(
      (acc, f) => acc + COLS.folderHeader + f.items.length * COLS.rowHeight + 12 + COLS.folderGap,
      0,
    );

  const totalW = COLS.paddingX * 2 + COLS.tagWidth + COLS.triggerWidth + 80;

  let yCursor = COLS.paddingY;

  if (descriptor.folders.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center rounded-md border border-dashed border-stone-300 bg-stone-50 text-sm text-stone-500">
        Aucun tag à visualiser pour cet environnement.
      </div>
    );
  }

  return (
    <div
      className={`overflow-auto rounded-md border border-stone-200 bg-white ${
        fullHeight ? 'h-full' : 'max-h-[70vh]'
      }`}
    >
      <svg
        ref={ref}
        xmlns="http://www.w3.org/2000/svg"
        width={totalW}
        height={totalH}
        viewBox={`0 0 ${totalW} ${totalH}`}
        role="img"
        aria-label="Visualisation du conteneur GTM"
        className="block"
      >
        <rect width={totalW} height={totalH} fill="#FBF8F1" />
        {descriptor.folders.map((folder) => {
          const folderH =
            COLS.folderHeader + folder.items.length * COLS.rowHeight + 12 + COLS.folderGap;
          const node = (
            <FolderCard key={folder.id} folder={folder} yOffset={yCursor} />
          );
          yCursor += folderH;
          return node;
        })}
      </svg>
    </div>
  );
});
