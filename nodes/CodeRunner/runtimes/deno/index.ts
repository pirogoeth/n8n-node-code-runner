import * as path from 'path';

import {
  IExecuteFunctions,
  IHttpRequestOptions,
  INodeExecutionData,
} from 'n8n-workflow';

import { BaseRuntime, CodeType } from '../base';

function getDenoDownloadLink(os: string, arch: string): string {
  return `https://github.com/oven-sh/bun/releases/latest/download/bun-${os}-${arch}.zip`;
}

function getDenoChecksumsLink(): string {
  return 'https://github.com/oven-sh/bun/releases/latest/download/SHASUMS256.txt';
}

export class DenoRuntime implements BaseRuntime {
  async getRuntime(): Promise<path.ParsedPath|null> {
    return null;
  }

  async fetchRuntime(): Promise<path.ParsedPath> {
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

    return path.parse("/dev/null");
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

  async execute(that: IExecuteFunctions, codeType: CodeType, code: string, inputs: INodeExecutionData[]): Promise<INodeExecutionData[][]> {
    return [];
  }
}
