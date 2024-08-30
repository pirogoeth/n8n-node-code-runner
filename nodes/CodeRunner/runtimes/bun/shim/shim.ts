import * as fs from 'fs';
import * as process from 'process';

import { INodeExecutionData } from 'n8n-workflow';

import { bufferFromReadable } from './utils/io';

const RESULT_FD = 3;

// Writes a result object to the result output fd and exits cleanly
async function $result(items: INodeExecutionData|INodeExecutionData[]) {
  if (!Array.isArray(items)) {
    items = [items];
  }

  for (const item of items) {
    if (item.binary !== undefined) {
      for (const [_, binData] of Object.entries(item.binary)) {
        if (binData !== undefined) {
          binData.data = Buffer.from(binData.data).toString('base64');
        }
      }
    }
  }

  fs.write(RESULT_FD, JSON.stringify(items)+'\n', (err, written, str) => {
    if (err) {
      console.error(`Error writing to output fd: ${err}`);
      process.exit(1);
    }

    console.debug(`shim wrote ${written} bytes to output fd: ${str}`);

    fs.close(RESULT_FD, () => {
      process.exit(0);
    });
  });
}

async function $abortWithError(err: Error) {
  fs.writeSync(RESULT_FD, JSON.stringify({error: err})+'\n');
  fs.closeSync(RESULT_FD);
  process.exit(1);
}

// Read JSON data off stdin until EOF
async function shimMain() {
  let codeDir = process.env.CODE_DIR;
  if (codeDir === undefined) {
    console.error('CODE_DIR not set');
    process.exit(1);
  }

  await bufferFromReadable(process.stdin)
    .then((dataBuf: Buffer) => {
      const items = JSON.parse(dataBuf.toString());
      console.debug(`shim received items:`, items);

      //@ts-expect-error(7017)
      globalThis.$items = items;
      //@ts-expect-error(7017)
      globalThis.$result = $result;
      //@ts-expect-error(7017)
      globalThis.$abortWithError = $abortWithError;

      console.debug('shim initialized - launching user code');
    }).then(async () => {
      try {
        await import(`${codeDir}/code`);
      } catch (err) {
        console.error(`Error running code: ${err}`);
        $abortWithError(err);
      };
    });
}

try {
  shimMain();
} catch (err) {
  console.error(`Error in shim: ${err}`);
  $abortWithError(err);
}
