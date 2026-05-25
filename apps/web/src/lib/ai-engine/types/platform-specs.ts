export interface PlatformSpec {
  width: number;
  height: number;
  aspectRatio: string;
  maxDurationSeconds?: number;
  codec?: string;
  maxFileSizeMb: number;
}

export const PLATFORM_SPECS = {
  instagram: {
    feed: {
      width: 1080,
      height: 1080,
      aspectRatio: '1:1',
      maxFileSizeMb: 30,
    },
    feed_portrait: {
      width: 1080,
      height: 1350,
      aspectRatio: '4:5',
      maxFileSizeMb: 30,
    },
    story: {
      width: 1080,
      height: 1920,
      aspectRatio: '9:16',
      maxDurationSeconds: 60,
      codec: 'h264',
      maxFileSizeMb: 250,
    },
    reel: {
      width: 1080,
      height: 1920,
      aspectRatio: '9:16',
      maxDurationSeconds: 90,
      codec: 'h264',
      maxFileSizeMb: 250,
    },
    carousel: {
      width: 1080,
      height: 1080,
      aspectRatio: '1:1',
      maxFileSizeMb: 30,
    },
  },
  facebook: {
    feed: {
      width: 1200,
      height: 1200,
      aspectRatio: '1:1',
      maxFileSizeMb: 30,
    },
    feed_landscape: {
      width: 1200,
      height: 630,
      aspectRatio: '1.91:1',
      maxFileSizeMb: 30,
    },
    story: {
      width: 1080,
      height: 1920,
      aspectRatio: '9:16',
      maxDurationSeconds: 120,
      codec: 'h264',
      maxFileSizeMb: 250,
    },
    reel: {
      width: 1080,
      height: 1920,
      aspectRatio: '9:16',
      maxDurationSeconds: 90,
      codec: 'h264',
      maxFileSizeMb: 250,
    },
  },
  tiktok: {
    video: {
      width: 1080,
      height: 1920,
      aspectRatio: '9:16',
      maxDurationSeconds: 600,
      codec: 'h264',
      maxFileSizeMb: 287,
    },
  },
  pinterest: {
    pin: {
      width: 1000,
      height: 1500,
      aspectRatio: '2:3',
      maxFileSizeMb: 20,
    },
  },
  youtube: {
    shorts: {
      width: 1080,
      height: 1920,
      aspectRatio: '9:16',
      maxDurationSeconds: 60,
      codec: 'h264',
      maxFileSizeMb: 256,
    },
  },
  linkedin: {
    post: {
      width: 1200,
      height: 1200,
      aspectRatio: '1:1',
      maxFileSizeMb: 10,
    },
    article: {
      width: 1200,
      height: 627,
      aspectRatio: '1.91:1',
      maxFileSizeMb: 10,
    },
  },
} as const satisfies Record<string, Record<string, PlatformSpec>>;

export type PlatformName = keyof typeof PLATFORM_SPECS;
export type FormatName<P extends PlatformName> = keyof (typeof PLATFORM_SPECS)[P];
