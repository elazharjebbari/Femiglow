import sharp from 'sharp';

const SIZE = 32;
const HASH_SIZE = 8;

function dct1D(input: Float64Array): Float64Array {
  const N = input.length;
  const out = new Float64Array(N);
  for (let k = 0; k < N; k += 1) {
    let sum = 0;
    for (let n = 0; n < N; n += 1) {
      sum += (input[n] ?? 0) * Math.cos((Math.PI / N) * (n + 0.5) * k);
    }
    out[k] = sum;
  }
  return out;
}

function dct2D(matrix: Float64Array[]): Float64Array[] {
  const rows = matrix.map((row) => dct1D(row));
  const cols: Float64Array[] = [];
  for (let i = 0; i < SIZE; i += 1) cols.push(new Float64Array(SIZE));
  for (let r = 0; r < SIZE; r += 1) {
    for (let c = 0; c < SIZE; c += 1) {
      cols[c]![r] = rows[r]![c] ?? 0;
    }
  }
  const colsDct = cols.map((col) => dct1D(col));
  const out: Float64Array[] = [];
  for (let i = 0; i < SIZE; i += 1) out.push(new Float64Array(SIZE));
  for (let r = 0; r < SIZE; r += 1) {
    for (let c = 0; c < SIZE; c += 1) {
      out[r]![c] = colsDct[c]![r] ?? 0;
    }
  }
  return out;
}

export async function computePhash(buffer: Buffer): Promise<string> {
  const { data } = await sharp(buffer)
    .greyscale()
    .resize(SIZE, SIZE, { fit: 'fill' })
    .raw()
    .toBuffer({ resolveWithObject: true });

  const matrix: Float64Array[] = [];
  for (let r = 0; r < SIZE; r += 1) {
    const row = new Float64Array(SIZE);
    for (let c = 0; c < SIZE; c += 1) {
      row[c] = data[r * SIZE + c] ?? 0;
    }
    matrix.push(row);
  }

  const dct = dct2D(matrix);

  const samples: number[] = [];
  for (let r = 0; r < HASH_SIZE; r += 1) {
    for (let c = 0; c < HASH_SIZE; c += 1) {
      if (r === 0 && c === 0) continue;
      samples.push(dct[r]![c] ?? 0);
    }
  }
  const sorted = [...samples].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)] ?? 0;

  const bits: number[] = [];
  for (let r = 0; r < HASH_SIZE; r += 1) {
    for (let c = 0; c < HASH_SIZE; c += 1) {
      if (r === 0 && c === 0) {
        bits.push(0);
        continue;
      }
      bits.push((dct[r]![c] ?? 0) > median ? 1 : 0);
    }
  }
  let hex = '';
  for (let i = 0; i < bits.length; i += 4) {
    const nibble = (bits[i]! << 3) | (bits[i + 1]! << 2) | (bits[i + 2]! << 1) | bits[i + 3]!;
    hex += nibble.toString(16);
  }
  return hex;
}

export function hammingDistance(a: string, b: string): number {
  if (a.length !== b.length) return Math.max(a.length, b.length) * 4;
  let dist = 0;
  for (let i = 0; i < a.length; i += 1) {
    const va = parseInt(a[i] ?? '0', 16);
    const vb = parseInt(b[i] ?? '0', 16);
    let xor = va ^ vb;
    while (xor) {
      dist += xor & 1;
      xor >>= 1;
    }
  }
  return dist;
}
