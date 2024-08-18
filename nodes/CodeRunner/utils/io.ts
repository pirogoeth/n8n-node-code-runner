import { Buffer } from 'buffer';
import { Readable } from 'stream';

export function bufferFromReadable(readable: Readable): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    readable.on('data', (chunk) => {
      chunks.push(Buffer.from(chunk));
    });
    readable.on('end', () => {
      resolve(Buffer.concat(chunks));
    });
    readable.on('error', reject);
  });
}