export interface TrackModule {
  name: string;
  global: string;
  spare?: Array<string> | string;
}

export type PresetDomain = "auto" | "jsdelivr" | "unpkg" | false;

export interface CDNPluginOptions {
  isProduction?: boolean;
  modules?: Array<TrackModule>;
  preset?: PresetDomain;
}
