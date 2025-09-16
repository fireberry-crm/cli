declare module "env-paths" {
  interface Paths {
    data: string;
    config: string;
    cache: string;
    log: string;
    temp: string;
  }

  interface Options {
    suffix?: string;
  }

  function envPaths(name: string, options?: Options): Paths;
  export = envPaths;
}
