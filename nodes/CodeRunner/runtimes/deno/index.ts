import fs from 'fs';
import path from 'path';

import {
  IHttpRequestOptions,
} from 'n8n-workflow';

import { BaseRuntime } from '../base';

function getDenoDownloadLink(os: string, arch: string): string {
  return `https://github.com/oven-sh/bun/releases/latest/download/bun-${os}-${arch}.zip`;
}

function getDenoChecksumsLink(): string {
  return 'https://github.com/oven-sh/bun/releases/latest/download/SHASUMS256.txt';
}

export class DenoRuntime extends BaseRuntime {
  getRuntimeDir(): string {
    return path.join(this.getTempDir(), 'deno');
  }

  getExecutablePath(): string {
    return path.join(this.getRuntimeDir(), 'deno');
  }

  getRuntimeShimSourceDir(): string {
    return path.join(__dirname, 'shim');
  }

  async fetchRuntime(): Promise<string> {
    const os = process.platform;
    switch (process.arch) {
      case 'x64':
        await this.fetchDeno(os, 'amd64');
        break;
      case 'arm':
        await this.fetchDeno(os, 'arm');
        break;
      case 'arm64':
        await this.fetchDeno(os, 'arm64');
        break;
      default:
        throw new Error(`Unsupported architecture: ${process.arch}`);
    }

    return "/dev/null";
  }

  async fetchDeno(os: string, arch: string) {
    const downloadLink = getDenoDownloadLink(os, arch);
    const checksumsLink = getDenoChecksumsLink();

    const options: IHttpRequestOptions = {
      method: 'GET',
      url: downloadLink,
    };
    console.log(options);

    // const response = await this.fetch(options);

    const checksumsOptions: IHttpRequestOptions = {
      method: 'GET',
      url: checksumsLink,
    };
    console.log(checksumsOptions);

    // const checksumsResponse = await this.fetch(checksumsOptions);
  }

  async getRuntime(): Promise<string|null> {
    return null;
  }

  getRuntimeArguments(codePath: string): string[] {
    return [];
  }

  getSpawnOptions(codePath: string, logStream: fs.WriteStream): any {
    return {};
  }
}
