import {
  IExecuteFunctions,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
} from 'n8n-workflow';

import Runtimes, { CodeType } from './runtimes';

export class CodeRunner implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'CodeRunner',
    name: 'codeRunner',
    icon: 'file:icon.svg',
    group: ['transform'],
    version: 1,
    description: 'Run arbitrary code in Deno or Bun',
    defaults: {
      name: 'CodeRunner',
      color: '#772244',
    },
    inputs: ['main'],
    outputs: ['main'],
    parameterPane: 'wide',
    properties: [
      {
        displayName: 'Runtime',
        name: 'runtime',
        type: 'options',
        options: [
          {
            name: 'Deno',
            value: 'deno',
          },
          {
            name: 'Bun',
            value: 'bun',
          },
        ],
        default: 'deno',
        description: 'The runtime to use for running the code',
      },
      {
        displayName: 'Code Type',
        name: 'codeType',
        type: 'options',
        options: [
          {
            name: 'JavaScript',
            value: 'javascript',
          },
          {
            name: 'TypeScript',
            value: 'typescript',
          },
        ],
        default: 'typescript',
        description: 'The type of code to run',
      },
      {
        displayName: 'Code',
        name: 'code',
        type: 'string',
        typeOptions: {
          editor: 'codeNodeEditor',
          editorLanguage: 'javaScript',
        },
        default: '',
        description: 'The code to run',
        noDataExpression: true,
      }
    ],
  };

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const runtimeType = this.getNodeParameter('runtime', 0) as string;
    const codeType = new CodeType(this.getNodeParameter('codeType', 0) as string);
    const code = this.getNodeParameter('code', 0) as string;

    let runtime;
    switch (runtimeType) {
      case 'bun':
        runtime = Runtimes.Bun();
        break;
      case 'deno':
        runtime = Runtimes.Deno();
        break;
      default:
        throw new Error(`Unsupported runtime: ${runtime}`);
    }

    return await runtime.execute(this, codeType, code, this.getInputData());
  }
}