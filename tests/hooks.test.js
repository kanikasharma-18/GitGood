import { afterEach, beforeEach, describe, expect, it } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { simpleGit } from "simple-git";
import { BACKUP_NAME, HOOK_MARKER } from "../src/hooks.js";

const execFileAsync = promisify(execFile);
const cliPath = path.resolve("bin/git-good.js");

describe("GitGood hooks", () => {
  let temporaryDirectory;
  let hooksDirectory;

  beforeEach(async () => {
    temporaryDirectory = await fs.mkdtemp(path.join(os.tmpdir(), "git-good-hooks-"));
    const git = simpleGit(temporaryDirectory);
    await git.init();
    await git.addConfig("user.name", "Git Good Test");
    await git.addConfig("user.email", "git-good-test@example.com");
    hooksDirectory = path.join(await fs.realpath(temporaryDirectory), ".git", "hooks");
  });

  afterEach(async () => {
    await fs.rm(temporaryDirectory, { recursive: true, force: true });
  });

  async function runHooks(command, directory = temporaryDirectory) {
    try {
      return await execFileAsync(process.execPath, [cliPath, "hooks", command], {
        cwd: directory,
      });
    } catch (error) {
      return error;
    }
  }

  it("installs the pre-commit hook", async () => {
    const result = await runHooks("install");
    const hook = await fs.readFile(path.join(hooksDirectory, "pre-commit"), "utf8");

    expect(result.code ?? 0).toBe(0);
    expect(result.stdout).toContain("installed successfully");
    expect(hook).toContain(HOOK_MARKER);
    expect(hook).toContain("bin/git-good.js");
  });

  it("makes repeated installation idempotent", async () => {
    await runHooks("install");
    const hookPath = path.join(hooksDirectory, "pre-commit");
    const firstHook = await fs.readFile(hookPath, "utf8");

    const result = await runHooks("install");

    expect(result.code ?? 0).toBe(0);
    expect(result.stdout).toContain("already installed");
    await expect(fs.readFile(hookPath, "utf8")).resolves.toBe(firstHook);
  });

  it("backs up an existing hook and restores it on uninstall", async () => {
    const originalHook = "#!/bin/sh\necho original hook\n";
    await fs.writeFile(path.join(hooksDirectory, "pre-commit"), originalHook, {
      mode: 0o755,
    });

    await runHooks("install");

    await expect(
      fs.readFile(path.join(hooksDirectory, BACKUP_NAME), "utf8")
    ).resolves.toBe(originalHook);
    await expect(
      fs.readFile(path.join(hooksDirectory, "pre-commit"), "utf8")
    ).resolves.toContain(HOOK_MARKER);

    const result = await runHooks("uninstall");

    expect(result.code ?? 0).toBe(0);
    expect(result.stdout).toContain("original hook restored");
    await expect(
      fs.readFile(path.join(hooksDirectory, "pre-commit"), "utf8")
    ).resolves.toBe(originalHook);
    await expect(fs.access(path.join(hooksDirectory, BACKUP_NAME))).rejects.toThrow();
  });

  it("removes the managed hook without an original hook", async () => {
    await runHooks("install");

    const result = await runHooks("uninstall");

    expect(result.code ?? 0).toBe(0);
    await expect(fs.access(path.join(hooksDirectory, "pre-commit"))).rejects.toThrow();
  });

  it("makes repeated uninstallation idempotent", async () => {
    const result = await runHooks("uninstall");

    expect(result.code ?? 0).toBe(0);
    expect(result.stdout).toContain("not installed");
  });

  it("reports invalid repositories clearly", async () => {
    const nonGitDirectory = await fs.mkdtemp(path.join(os.tmpdir(), "not-a-git-repo-"));
    const result = await runHooks("install", nonGitDirectory);

    expect(result.code).toBe(1);
    expect(result.stderr).toContain("Unable to install GitGood hooks");

    await fs.rm(nonGitDirectory, { recursive: true, force: true });
  });
});
