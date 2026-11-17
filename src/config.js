const fs = require("node:fs/promises");
const path = require("node:path");
const { getGitRoot } = require("./utils/git");

const CONFIG_FILE = ".gitgoodrc.json";
const DEFAULT_CONFIG = {
  maxFileSize: 5,
  protectedBranches: ["main", "master", "production", "develop"],
};

function getConfigPath(root) {
  return path.join(root, CONFIG_FILE);
}

function validateConfig(config, configPath) {
  if (config === null || typeof config !== "object" || Array.isArray(config)) {
    throw new Error(`Invalid configuration in ${configPath}: expected a JSON object.`);
  }

  if (
    config.maxFileSize !== undefined &&
    (typeof config.maxFileSize !== "number" ||
      !Number.isFinite(config.maxFileSize) ||
      config.maxFileSize <= 0)
  ) {
    throw new Error(
      `Invalid configuration in ${configPath}: maxFileSize must be a positive number.`
    );
  }

  if (
    config.protectedBranches !== undefined &&
    (!Array.isArray(config.protectedBranches) ||
      config.protectedBranches.some(
        (branch) => typeof branch !== "string" || branch.trim() === ""
      ))
  ) {
    throw new Error(
      `Invalid configuration in ${configPath}: protectedBranches must be an array of non-empty strings.`
    );
  }
}

async function loadConfig(directory = process.cwd()) {
  const root = await getGitRoot(directory);
  const configPath = getConfigPath(root);

  try {
    const contents = await fs.readFile(configPath, "utf8");
    let config;

    try {
      config = JSON.parse(contents);
    } catch {
      throw new Error(`Invalid configuration in ${configPath}: expected valid JSON.`);
    }

    validateConfig(config, configPath);
    return {
      maxFileSize: config.maxFileSize ?? DEFAULT_CONFIG.maxFileSize,
      protectedBranches: [
        ...(config.protectedBranches ?? DEFAULT_CONFIG.protectedBranches),
      ],
    };
  } catch (error) {
    if (error.code === "ENOENT") {
      return {
        maxFileSize: DEFAULT_CONFIG.maxFileSize,
        protectedBranches: [...DEFAULT_CONFIG.protectedBranches],
      };
    }

    throw error;
  }
}

async function initConfig(directory = process.cwd()) {
  const root = await getGitRoot(directory);
  const configPath = getConfigPath(root);
  const contents = `${JSON.stringify(DEFAULT_CONFIG, null, 2)}\n`;

  try {
    await fs.writeFile(configPath, contents, { encoding: "utf8", flag: "wx" });
    return { created: true, path: configPath };
  } catch (error) {
    if (error.code === "EEXIST") {
      return { created: false, path: configPath };
    }

    throw new Error(`Unable to create configuration at ${configPath}: ${error.message}`, {
      cause: error,
    });
  }
}

module.exports = {
  CONFIG_FILE,
  DEFAULT_CONFIG,
  initConfig,
  loadConfig,
};
