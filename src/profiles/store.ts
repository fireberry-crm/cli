import envPaths from "env-paths";
import path from "node:path";
import fs from "fs-extra";

export interface ProfileEntry {
  token: string;
  createdAt: string;
}

interface LegacyConfigShape {
  apiToken?: string;
  createdAt?: string;
}

interface MigratedConfigShape extends LegacyConfigShape {
  activeProfile?: string;
  profiles?: Record<string, ProfileEntry>;
}

const DEFAULT_PROFILE_ALIAS = "default";

function getConfigFilePath(): string {
  const paths = envPaths("Fireberry CLI", { suffix: "" });
  return path.join(paths.config, "config.json");
}

async function readRawConfig(): Promise<MigratedConfigShape | null> {
  const configFile = getConfigFilePath();
  if (!(await fs.pathExists(configFile))) {
    return null;
  }
  try {
    return (await fs.readJson(configFile)) as MigratedConfigShape;
  } catch {
    return null;
  }
}

async function writeRawConfig(config: MigratedConfigShape): Promise<void> {
  const configFile = getConfigFilePath();
  await fs.ensureDir(path.dirname(configFile));
  await fs.writeJson(configFile, config, { spaces: 2 });
}

function isMigrated(config: MigratedConfigShape | null): boolean {
  return Boolean(
    config &&
      typeof config.activeProfile === "string" &&
      config.profiles &&
      typeof config.profiles === "object"
  );
}

export interface ProfilesSummary {
  profiles: string[];
  activeProfile: string;
}

export async function listProfiles(): Promise<ProfilesSummary> {
  const config = await readRawConfig();
  if (isMigrated(config)) {
    return {
      profiles: Object.keys(config!.profiles ?? {}),
      activeProfile: config!.activeProfile ?? DEFAULT_PROFILE_ALIAS,
    };
  }
  if (config?.apiToken) {
    return {
      profiles: [DEFAULT_PROFILE_ALIAS],
      activeProfile: DEFAULT_PROFILE_ALIAS,
    };
  }
  return { profiles: [], activeProfile: DEFAULT_PROFILE_ALIAS };
}

export async function getActiveProfile(): Promise<string> {
  const config = await readRawConfig();
  if (isMigrated(config)) {
    return config!.activeProfile ?? DEFAULT_PROFILE_ALIAS;
  }
  return DEFAULT_PROFILE_ALIAS;
}

export async function getActiveToken(): Promise<string | null> {
  const config = await readRawConfig();
  if (!config) return null;

  if (isMigrated(config)) {
    const active = config.activeProfile ?? DEFAULT_PROFILE_ALIAS;
    const entry = config.profiles?.[active];
    if (entry?.token) return entry.token;
    return config.apiToken ?? null;
  }

  return config.apiToken ?? null;
}

export async function hasAnyProfile(): Promise<boolean> {
  const config = await readRawConfig();
  if (!config) return false;
  if (isMigrated(config)) {
    return Object.keys(config.profiles ?? {}).length > 0;
  }
  return Boolean(config.apiToken);
}

export async function switchProfile(alias: string): Promise<void> {
  const config = (await readRawConfig()) ?? {};
  if (!isMigrated(config)) {
    if (alias === DEFAULT_PROFILE_ALIAS && config.apiToken) {
      return;
    }
    throw new Error(
      `Profile "${alias}" does not exist. Available profiles: ${DEFAULT_PROFILE_ALIAS}`
    );
  }
  const entry = config.profiles?.[alias];
  if (!entry) {
    const available = Object.keys(config.profiles ?? {}).join(", ");
    throw new Error(
      `Profile "${alias}" does not exist. Available profiles: ${available}`
    );
  }
  config.activeProfile = alias;
  config.apiToken = entry.token;
  config.createdAt = entry.createdAt;
  await writeRawConfig(config);
}

export interface UpsertProfileOptions {
  setActive?: boolean;
}

export async function upsertProfile(
  alias: string,
  token: string,
  options: UpsertProfileOptions = {}
): Promise<void> {
  if (!alias || !alias.trim()) {
    throw new Error("Profile alias must be a non-empty string");
  }
  if (!token || !token.trim()) {
    throw new Error("Token must be a non-empty string");
  }

  const setActive = options.setActive ?? true;
  const now = new Date().toISOString();
  const trimmedAlias = alias.trim();
  const trimmedToken = token.trim();

  const existing = (await readRawConfig()) ?? {};
  const profiles: Record<string, ProfileEntry> = isMigrated(existing)
    ? { ...(existing.profiles ?? {}) }
    : existing.apiToken
    ? {
        [DEFAULT_PROFILE_ALIAS]: {
          token: existing.apiToken,
          createdAt: existing.createdAt ?? now,
        },
      }
    : {};

  profiles[trimmedAlias] = { token: trimmedToken, createdAt: now };

  const activeProfile = setActive
    ? trimmedAlias
    : isMigrated(existing)
    ? existing.activeProfile ?? trimmedAlias
    : trimmedAlias;

  const activeEntry = profiles[activeProfile] ?? profiles[trimmedAlias];

  const merged: MigratedConfigShape = {
    apiToken: activeEntry.token,
    createdAt: activeEntry.createdAt,
    activeProfile,
    profiles,
  };

  await writeRawConfig(merged);
}

export async function removeProfile(alias: string): Promise<void> {
  const config = await readRawConfig();
  if (!config || !isMigrated(config)) {
    throw new Error(
      `Profile "${alias}" cannot be removed: no migrated profiles exist on disk.`
    );
  }
  const profiles = { ...(config.profiles ?? {}) };
  if (!profiles[alias]) {
    throw new Error(`Profile "${alias}" does not exist.`);
  }
  if ((config.activeProfile ?? DEFAULT_PROFILE_ALIAS) === alias) {
    throw new Error(
      `Profile "${alias}" is currently active. Switch to another profile before removing it.`
    );
  }
  delete profiles[alias];
  config.profiles = profiles;
  await writeRawConfig(config);
}

export async function writeLegacyConfig(token: string): Promise<string> {
  if (!token || !token.trim()) {
    throw new Error("Token must be a non-empty string");
  }
  const trimmedToken = token.trim();
  const now = new Date().toISOString();
  const configFile = getConfigFilePath();
  await fs.ensureDir(path.dirname(configFile));

  const existing = await readRawConfig();

  if (isMigrated(existing)) {
    const profiles = { ...(existing!.profiles ?? {}) };
    const active = existing!.activeProfile ?? DEFAULT_PROFILE_ALIAS;
    profiles[DEFAULT_PROFILE_ALIAS] = {
      token: trimmedToken,
      createdAt: now,
    };
    const activeEntry = profiles[active] ?? profiles[DEFAULT_PROFILE_ALIAS];
    const merged: MigratedConfigShape = {
      apiToken: activeEntry.token,
      createdAt: activeEntry.createdAt,
      activeProfile: active,
      profiles,
    };
    await fs.writeJson(configFile, merged, { spaces: 2 });
    return configFile;
  }

  const config: MigratedConfigShape = {
    apiToken: trimmedToken,
    createdAt: now,
  };
  await fs.writeJson(configFile, config, { spaces: 2 });
  return configFile;
}

export function getConfigPath(): string {
  return getConfigFilePath();
}

export async function isLegacyOnly(): Promise<boolean> {
  const config = await readRawConfig();
  return Boolean(config && !isMigrated(config) && config.apiToken);
}
