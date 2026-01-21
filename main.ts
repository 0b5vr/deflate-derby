import * as fs from 'fs';
import zopfli from 'node-zopfli';
import { resolve } from 'path';
import { promisify } from 'util';
import * as zlib from 'zlib';

(async () => {
  const filePath = resolve(process.cwd(), process.argv[2]);
  const file = await fs.promises.readFile(filePath);

  console.info(`raw: ${file.length}`);

  const fileBase64Str = file.toString('base64url');
  const fileBase64 = Buffer.from(fileBase64Str);

  // deflate
  const deflate = zopfli.zlibSync(file, {
    numiterations: 100,
    blocksplitting: true,
  });
  console.info(`deflate: ${deflate.length}`);

  // base64 + deflate
  const base64Deflate = zopfli.zlibSync(fileBase64, {
    numiterations: 300,
    blocksplitting: true,
  });
  console.info(`base64 + deflate: ${base64Deflate.length}`);

  // deflate + base64 + deflate
  const deflateBase64Str = deflate.toString('base64url');
  const deflateBase64 = Buffer.from(deflateBase64Str);

  const deflateBase64Deflate = zopfli.zlibSync(deflateBase64, {
    numiterations: 300,
    blocksplitting: true,
  });
  console.info(`deflate + base64 + deflate: ${deflateBase64Deflate.length}`);

  // brotli
  const brotli = await promisify(zlib.brotliCompress)(file, {
    params: {
      [zlib.constants.BROTLI_PARAM_QUALITY]: zlib.constants.BROTLI_MAX_QUALITY,
    },
  });
  console.info(`brotli: ${brotli.length}`);

  // base64 + brotli
  const base64Brotli = await promisify(zlib.brotliCompress)(fileBase64, {
    params: {
      [zlib.constants.BROTLI_PARAM_QUALITY]: zlib.constants.BROTLI_MAX_QUALITY,
    },
  });
  console.info(`base64 + brotli: ${base64Brotli.length}`);

  // brotli + base64 + brotli
  const brotliBase64Str = brotli.toString('base64url');
  const brotliBase64 = Buffer.from(brotliBase64Str);

  const brotliBase64Brotli = await promisify(zlib.brotliCompress)(
    brotliBase64,
    {
      params: {
        [zlib.constants.BROTLI_PARAM_QUALITY]:
          zlib.constants.BROTLI_MAX_QUALITY,
      },
    },
  );
  console.info(`brotli + base64 + brotli: ${brotliBase64Brotli.length}`);
})();
