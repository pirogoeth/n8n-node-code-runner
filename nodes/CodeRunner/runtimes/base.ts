import path from "path";

import {
  IExecuteFunctions,
  INodeExecutionData,
  RequestHelperFunctions,
} from "n8n-workflow";

export interface BaseRuntime {
  getRuntime(): Promise<path.ParsedPath|null>;
  fetchRuntime(requester: RequestHelperFunctions["httpRequest"]): Promise<path.ParsedPath>;
  execute(that: IExecuteFunctions, codeType: CodeType, code: string, inputs: INodeExecutionData[]): Promise<INodeExecutionData[][]>;
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