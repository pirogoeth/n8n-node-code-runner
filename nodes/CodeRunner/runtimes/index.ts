import { BunRuntime } from './bun';
import { DenoRuntime } from './deno';
import { BaseRuntime, CodeType } from './base';

export default class Runtimes {
  static Deno(): DenoRuntime {
    return new DenoRuntime();
  }

  static Bun(): BunRuntime {
    return new BunRuntime();
  }
}

export { BaseRuntime, CodeType };