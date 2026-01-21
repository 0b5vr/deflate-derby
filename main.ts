#!/usr/bin/env -S deno run --allow-read --allow-write --allow-run

import { encodeBase64Url } from 'jsr:@std/encoding';
import { resolve } from 'jsr:@std/path';
import { compress as xBrotliCompress } from 'https://deno.land/x/brotli@0.1.7/mod.ts';

// == options ======================================================================================
const ZOPFLI_ITER = 100;
const BROTLI_QUALITY = 11; // 0-11

const FILES = [
  'char5x5.png',
  'wow.ogg',
  'wow.pulsejet',
  'loss.svg',
  'suzanne.glb',
  'scene1.bin',
];

// == functions ====================================================================================
async function zopfliCompress(
  data: Uint8Array,
): Promise<Uint8Array> {
  const tempInput = await Deno.makeTempFile();

  try {
    await Deno.writeFile(tempInput, data);

    const command = new Deno.Command('zopfli', {
      args: ['--zlib', '-c', `--i${ZOPFLI_ITER}`, tempInput],
      stdout: 'piped',
    });

    return (await command.output()).stdout;
  } finally {
    await Deno.remove(tempInput).catch(() => {});
  }
}

function brotliCompress(
  data: Uint8Array,
): Uint8Array {
  // quality: 0-11
  return xBrotliCompress(data, data.byteLength, BROTLI_QUALITY);
}

let promiseWrite: Promise<unknown> = Promise.resolve();
function write(str: string) {
  promiseWrite = promiseWrite.then(() => {
    const encoder = new TextEncoder();
    const data = encoder.encode(str);
    return Deno.stdout.write(data);
  });
  return promiseWrite;
}

// == main =========================================================================================
const columns = [
  'raw',
  'deflate',
  'base64 + deflate',
  'deflate + base64 + deflate',
  'brotli',
  'base64 + brotli',
  'brotli + base64 + brotli',
];

const results = new Map<string, Map<string, number>>();

for (const filename of FILES) {
  const result = new Map<string, number>();

  const filePath = resolve(Deno.cwd(), 'files', filename);
  const file = await Deno.readFile(filePath);
  write(`Processing ${filename} `);
  result.set('raw', file.length);

  // base64
  const fileBase64Str = encodeBase64Url(file);
  const fileBase64 = new TextEncoder().encode(fileBase64Str);

  // deflate
  const deflated = await zopfliCompress(file);
  result.set('deflate', deflated.length);
  write('.');

  // base64 + deflate
  const base64Deflate = await zopfliCompress(fileBase64);
  result.set('base64 + deflate', base64Deflate.length);
  write('.');

  // deflate + base64 + deflate
  const deflateBase64Str = encodeBase64Url(deflated);
  const deflateBase64 = new TextEncoder().encode(deflateBase64Str);

  const deflateBase64Deflate = await zopfliCompress(deflateBase64);
  result.set('deflate + base64 + deflate', deflateBase64Deflate.length);
  write('.');

  // brotli
  const brotli = brotliCompress(file);
  result.set('brotli', brotli.length);
  write('.');

  // base64 + brotli
  const base64Brotli = brotliCompress(fileBase64);
  result.set('base64 + brotli', base64Brotli.length);
  write('.');

  // brotli + base64 + brotli
  const brotliBase64Str = encodeBase64Url(brotli);
  const brotliBase64 = new TextEncoder().encode(brotliBase64Str);

  const brotliBase64Brotli = brotliCompress(brotliBase64);
  result.set('brotli + base64 + brotli', brotliBase64Brotli.length);
  write('.');

  results.set(filename, result);
  write('\n');
}

await promiseWrite;

// == Create HTML report ===========================================================================
const csvArray: string[][] = [];

csvArray.push(['filename', ...columns]);

for (const [filename, result] of results) {
  const row: string[] = [];
  row.push(filename);
  for (const column of columns) {
    row.push(result.get(column)?.toString() ?? '');
  }
  csvArray.push(row);
}

const csvLines = csvArray.map((row) => row.join(',')).join('\n');
await Deno.writeTextFile('report.csv', csvLines);

console.log('Report saved to report.csv');
