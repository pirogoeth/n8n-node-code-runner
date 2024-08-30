import * as child_process from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as process from 'process';
import { createHash } from 'crypto';

import {
  RequestHelperFunctions,
} from 'n8n-workflow';

import * as yauzl from 'yauzl-promise';

import { BaseRuntime, CodeType } from '../base';
import { WriteStream } from 'fs';

function getBunDownloadLink(os: string, arch: string): string {
  return `https://github.com/oven-sh/bun/releases/latest/download/bun-${os}-${arch}.zip`;
}

function getBunChecksumsLink(): string {
  return 'https://github.com/oven-sh/bun/releases/latest/download/SHASUMS256.txt';
}

export class BunRuntime extends BaseRuntime {
  getRuntimeDir(): string {
    return path.join(this.getTempDir(), 'bun');
  }

  getExecutablePath(): string {
    return path.join(this.getRuntimeDir(), 'bun');
  }

  getRuntimeShimSourceDir(): string {
    return path.join(__dirname, 'shim');
  }

  async getRuntimeCodeCache(nodeId: string, code: string, codeType: CodeType): Promise<string> {
    const codePath = await super.getRuntimeCodeCache(nodeId, code, codeType);

    await this.writeBunfig(
      path.dirname(codePath),
      this.getRuntimePackageCacheDir(),
      this.getShimScriptPath()
    );

    return codePath;
  }

  async writeBunfig(codeDir: string, cacheDir: string, shimPath: string) {
    const bunfigPath = path.join(codeDir, 'bunfig.toml');
    try {
      await fs.access(bunfigPath);
    } catch (err) {
      await fs.writeFile(bunfigPath, `# This file is generated by n8n-nodes-code-runner
[install.cache]
disable = false
`);
    }
  }

  getRuntimeArguments(codePath: string): string[] {
    return [
      'run',
      `--config=${path.dirname(codePath)}/bunfig.toml`,
      '--install=force',
      '--prefer-offline',
      this.getShimScriptPath(),
    ];
  }

  getSpawnOptions(codePath: string, logStream: WriteStream): child_process.SpawnOptions {
    return {
      cwd: path.dirname(codePath),
      serialization: 'json',
      env: {
        CODE_DIR: path.dirname(codePath),
      },
      stdio: ['pipe', logStream, logStream, 'pipe'],
    };
  }

  async getRuntime(): Promise<string|null> {
    const runtimeDir = this.getRuntimeDir();

    try {
      await fs.access(runtimeDir);
    } catch (err) {
      await fs.mkdir(runtimeDir, { recursive: true });
    }

    const bunBinPath = this.getExecutablePath();
    try {
      await fs.access(bunBinPath);
      return bunBinPath;
    } catch (err) {
      return null;
    }
  }

  async fetchRuntime(requester: RequestHelperFunctions["httpRequest"]): Promise<string> {
    let os;
    switch (process.platform) {
      case 'linux':
      case 'darwin':
        os = process.platform;
        break;
      case 'win32':
        os = 'windows';
      default:
        throw new Error(`Unsupported OS: ${process.platform}`);
    }
    let arch;
    switch (process.arch) {
      case 'x64':
        arch = 'x64';
        break;
      case 'arm64':
        arch = 'aarch64';
        break;
      default:
        throw new Error(`Unsupported architecture: ${process.arch}`);
    }

    const runtimeDir = this.getRuntimeDir();
    const downloadLink = getBunDownloadLink(os, arch);
    const checksumsLink = getBunChecksumsLink();
    const archiveFileName = `bun-${os}-${arch}.zip`;
    const archivePath = path.join(runtimeDir, archiveFileName);

    // Download Bun runtime archive
    let archiveResponse = await requester({
      url: downloadLink,
      encoding: 'arraybuffer',
    });
    await fs.writeFile(archivePath, archiveResponse, {
      encoding: 'binary',
    });

    // Download checksums file
    let checksumsResponse = await requester({
      url: checksumsLink,
    });
    for (const line of checksumsResponse.split('\n')) {
      if (line.endsWith(archiveFileName)) {
        const [expectedChecksum, _] = line.split(' ');
        const hash = createHash('sha256');
        hash.update(await fs.readFile(archivePath));
        const archiveChecksum = hash.digest('hex');
        if (archiveChecksum !== expectedChecksum) {
          await fs.rm(archivePath);
          throw new Error(`Checksum mismatch: ${expectedChecksum} != ${archiveChecksum}`);
        }
      }
    }

    const bunBinPath = this.getExecutablePath();

    // Extract archive
    const zip = await yauzl.open(archivePath);
    try {
      for await (const item of zip) {
        if (item.filename.endsWith("bun")) {
          await fs.writeFile(bunBinPath, await item.openReadStream());
          await fs.chmod(bunBinPath, 0o755);
        }
      }
    } finally {
      await zip.close();
    }

    await fs.mkdir(
      path.join(this.getRuntimePackageCacheDir(), '.bun-cache'),
      { recursive: true },
    );

    return bunBinPath;
  }
}
