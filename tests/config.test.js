import { afterEach, beforeEach, describe, expect, it } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { simpleGit } from "simple-git";
import {
  DEFAULT_CONFIG,
  initConfig,
  loadConfig,
} from "../src/config.js";

const execFileAsync = promisify(execFile);
const cliPath = path.resolve("bin/git-good.js");

describe("GitGood configuration", () => {
  let temporaryDirectory;
  let git;

  beforeEach(async () => {
    temporaryDirectory = await fs.mkdtemp(path.join(os.tmpdir(), "git-good-config-"));
    git = simpleGit(temporaryDirectory);
    await git.init();
    await git.addConfig("user.name", "Git Good Test");
    await git.addConfig("user.email", "git-good-test@example.com");
    await git.branch(["-M", "main"]);
  });

  afterEach(async () => {
    await fs.rm(temporaryDirectory, { recursive: true, force: true });
  });

  it("uses defaults when no configuration exists", async () => {
    await expect(loadConfig(temporaryDirectory)).resolves.toEqual(DEFAULT_CONFIG);
  });

  it("protects all default branch names", async () => {
    expect(DEFAULT_CONFIG.protectedBranches).toEqual([
      "main",
      "master",
      "production",
      "develop",
    ]);
  });

  it("loads custom configuration", async () => {
    await fs.writeFile(
      path.join(temporaryDirectory, ".gitgoodrc.json"),
      JSON.stringify({
        maxFileSize: 10,
        protectedBranches: ["release", "stable"],
      })
    );

    await expect(loadConfig(temporaryDirectory)).resolves.toEqual({
      maxFileSize: 10,
      protectedBranches: ["release", "stable"],
    });
  });

  it("uses defaults for omitted configuration options", async () => {
    await fs.writeFile(
      path.join(temporaryDirectory, ".gitgoodrc.json"),
      JSON.stringify({ maxFileSize: 10 })
    );

    await expect(loadConfig(temporaryDirectory)).resolves.toEqual({
      maxFileSize: 10,
      protectedBranches: DEFAULT_CONFIG.protectedBranches,
    });
  });

  it.each([
    ["not-json", "expected valid JSON"],
    [JSON.stringify({ maxFileSize: 0, protectedBranches: ["main"] }), "maxFileSize"],
    [JSON.stringify({ maxFileSize: 5, protectedBranches: "main" }), "protectedBranches"],
  ])("rejects invalid configuration (%s)", async (contents, errorText) => {
    await fs.writeFile(path.join(temporaryDirectory, ".gitgoodrc.json"), contents);

    await expect(loadConfig(temporaryDirectory)).rejects.toThrow(errorText);
  });

  it("creates a formatted default configuration", async () => {
    const result = await initConfig(temporaryDirectory);
    const configPath = path.join(await fs.realpath(temporaryDirectory), ".gitgoodrc.json");

    expect(result).toEqual({ created: true, path: configPath });
    await expect(fs.readFile(configPath, "utf8")).resolves.toBe(
      `${JSON.stringify(DEFAULT_CONFIG, null, 2)}\n`
    );
  });

  it("does not overwrite an existing configuration", async () => {
    const configPath = path.join(temporaryDirectory, ".gitgoodrc.json");
    await fs.writeFile(configPath, '{"maxFileSize":10,"protectedBranches":["release"]}');

    await expect(initConfig(temporaryDirectory)).resolves.toEqual({
      created: false,
      path: path.join(await fs.realpath(temporaryDirectory), ".gitgoodrc.json"),
    });
    await expect(fs.readFile(configPath, "utf8")).resolves.toBe(
      '{"maxFileSize":10,"protectedBranches":["release"]}'
    );
  });

  it("runs git-good init from the repository root", async () => {
    const result = await execFileAsync(process.execPath, [cliPath, "init"], {
      cwd: temporaryDirectory,
    });

    expect(result.stdout).toContain("Created");
    await expect(fs.access(path.join(temporaryDirectory, ".gitgoodrc.json"))).resolves.toBeUndefined();
  });
});
