import child_process from 'child_process';
import fs from 'fs';
import fsPromises from 'fs/promises';
import path from 'path';
import { createHash } from 'crypto';

import {
  IExecuteFunctions,
  INodeExecutionData,
  RequestHelperFunctions,
} from "n8n-workflow";

export abstract class BaseRuntime {
  abstract getRuntime(): Promise<string|null>;
  abstract fetchRuntime(requester: RequestHelperFunctions["httpRequest"]): Promise<string>;

  abstract getRuntimeDir(): string;
  abstract getExecutablePath(): string;
  abstract getRuntimeShimSourceDir(): string;

  abstract getRuntimeArguments(codePath: string): string[];
  abstract getSpawnOptions(codePath: string, logStream: fs.WriteStream): any;

  getRuntimeCacheDir(): string {
    return path.join(this.getRuntimeDir(), 'cache');
  }

  getRuntimePackageCacheDir(): string {
    return path.join(this.getRuntimeDir(), 'packages');
  }

  getTempDir(): string {
    return path.join(process.env.CODERUNNER_DIR || process.env.TMPDIR || '/tmp', 'coderunner-n8n');
  }

  getShimCachePath(): string {
    return path.join(this.getRuntimeDir(), 'shim');
  }

  getShimScriptPath(): string {
    return path.join(this.getShimCachePath(), 'shim.js');
  }

  async writeShim(): Promise<void> {
    const shimPath = this.getShimCachePath();
    const bunShimFiles = path.join(this.getRuntimeShimSourceDir(), '*');
    try {
      await fsPromises.access(shimPath);
      await fsPromises.access(this.getShimScriptPath());
    } catch (err) {
      await fsPromises.mkdir(shimPath, { recursive: true });
      for await (const shimFile of fsPromises.glob(bunShimFiles)) {
        const stat = await fsPromises.lstat(shimFile);
        if (stat.isDirectory() || stat.isSymbolicLink()) {
          await fsPromises.cp(shimFile, path.join(shimPath, path.basename(shimFile)), {
            dereference: true,
            recursive: true,
          });
        } else if (stat.isFile()) {
          await fsPromises.copyFile(
            shimFile,
            path.join(shimPath, path.basename(shimFile)),
          );
        }
      }
    }
  };

  async getRuntimeCodeCache(nodeId: string, code: string, codeType: CodeType): Promise<string> {
    const cacheDir = this.getRuntimeCacheDir();
    const nodeCacheDir = path.join(cacheDir, nodeId);
    const codeSha = createHash('sha256').update(code).digest('hex').slice(0, 12);
    const codePath = path.join(nodeCacheDir, codeSha, 'code');

    try {
      await fsPromises.access(codePath);
    } catch (err) {
      await fsPromises.mkdir(path.dirname(codePath), { recursive: true });
      await fsPromises.writeFile(codePath, code);
    }

    await this.writeShim();

    return codePath;
  }

  async execute(that: IExecuteFunctions, codeType: CodeType, code: string, inputs: INodeExecutionData[]): Promise<INodeExecutionData[][]> {
    let runtime = await this.getRuntime();
    if (!runtime) {
      runtime = await this.fetchRuntime(that.helpers.httpRequest);
    }

    // Create node code cache and prep dependencies
    const nodeId = that.getNode().id;
    const codePath = await this.getRuntimeCodeCache(nodeId, code, codeType);

    const childLogOutputFilePath = path.join(path.dirname(codePath), `output-${that.getExecutionId()}.log`);
    const childLogOutputFile = await fsPromises.open(childLogOutputFilePath, 'wx+');
    const childLogOutput = childLogOutputFile.createWriteStream();

    // Execute the cached code w/ shim
    const runner = child_process.spawn(
      runtime,
      this.getRuntimeArguments(codePath),
      {
        cwd: path.dirname(codePath),
        serialization: 'json',
        env: {
          CODE_DIR: path.dirname(codePath),
        },
        stdio: ['pipe', childLogOutput, childLogOutput, 'pipe'],
      }
    )

    await runner.stdin!.write(JSON.stringify(inputs)+'\n');
    runner.stdin!.end();

    const childResult: Buffer = await new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      runner.stdio[3]!.on('data', (chunk) => {
        console.debug('received some data from child result pipe');
        chunks.push(Buffer.from(chunk));
      });
      runner.stdio[3]!.on('end', () => {
        console.debug('child process closed result pipe');
        resolve(Buffer.concat(chunks));
      });
      runner.stdio[3]!.on('error', reject);
    });

    const childExit: ChildOutput = await new Promise((resolve, reject) => {
      runner.on('exit', async (exitCode, signal) => {
        if (exitCode === 0) {
          return resolve(ChildOutput.success({
            result: JSON.parse(childResult.toString())
          }));
        }

        const outputLogs = await fsPromises.readFile(childLogOutputFilePath);
        console.error(`!!! coderunner/bun: child process exited with code ${exitCode} and signal ${signal}`);
        console.error('!!! coderunner/bun: ' + outputLogs.toString());
        return resolve(ChildOutput.error({
          exitCode: exitCode ?? -1,
          signal: signal ?? undefined,
          output: outputLogs.toString(),
        }));
      });
      runner.on('error', reject);
    });
    await childLogOutput.close();
    await childLogOutputFile.close();

    if (childExit.isErr()) {
      let err = childExit.unwrapErr();
      throw new Error(`Child process exited with code ${err?.exitCode} and signal ${err?.signal}`);
    }

    return [childExit.unwrap()?.result ?? []];
  }
}

export class CodeType {
  static JavaScript = new CodeType("javascript");
  static TypeScript = new CodeType("typescript");

  constructor(public readonly value: string) {
    if (value !== "javascript" && value !== "typescript") {
      throw new Error(`Unsupported code type: ${value}`);
    }
    this.value = value;
  }

  extension(): string {
    return this.value === "javascript" ? ".js" : ".ts";
  }
}

export class ChildOutput {
  // Only one of success or error should be set
  success?: {
    result: INodeExecutionData[];
  };
  error?: {
    exitCode: number;
    signal?: string;
    output: string;
  };

  static success(args: ChildOutput["success"]): ChildOutput {
    let out = new ChildOutput();
    out.success = args;

    return out;
  }

  static error(args: ChildOutput["error"]): ChildOutput {
    let out = new ChildOutput();
    out.error = args;

    return out;
  }

  isOk(): boolean {
    return this.success !== undefined;
  }

  isErr(): boolean {
    return this.error !== undefined;
  }

  unwrap(): ChildOutput["success"] {
    if (!this.isOk()) {
      throw new Error('tried to unwrap on error');
    }
    return this.success!;
  }

  unwrapErr(): ChildOutput["error"] {
    if (!this.isErr()) {
      throw new Error('tried to unwrapErr on ok');
    }
    return this.error!;
  }
}
