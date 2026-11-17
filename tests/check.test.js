import { afterEach, beforeEach, describe, expect, it } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { simpleGit } from "simple-git";

const execFileAsync = promisify(execFile);
const cliPath = path.resolve("bin/git-good.js");

describe("git-good check", () => {
  let temporaryDirectory;
  let git;

  beforeEach(async () => {
    temporaryDirectory = await fs.mkdtemp(path.join(os.tmpdir(), "git-good-check-"));
    git = simpleGit(temporaryDirectory);
    await git.init();
    await git.addConfig("user.name", "Git Good Test");
    await git.addConfig("user.email", "git-good-test@example.com");
    await git.branch(["-M", "main"]);
  });

  afterEach(async () => {
    await fs.rm(temporaryDirectory, { recursive: true, force: true });
  });

  async function stageFile(fileName, content) {
    await fs.writeFile(path.join(temporaryDirectory, fileName), content);
    await git.add(fileName);
  }

  async function runCheck(directory = temporaryDirectory) {
    try {
      return await execFileAsync(process.execPath, [cliPath, "check"], {
        cwd: directory,
      });
    } catch (error) {
      return error;
    }
  }

  it("passes clean checks and warns on a protected branch", async () => {
    await stageFile("README.md", "Useful documentation.");
    await git.commit("feat: add documentation");

    const result = await runCheck();

    expect(result.code ?? 0).toBe(0);
    expect(result.stdout).toContain("PASS Secrets");
    expect(result.stdout).toContain("PASS Large files");
    expect(result.stdout).toContain("PASS Commit message");
    expect(result.stdout).toContain("WARN Branch safety");
  });

  it("fails when secrets are staged", async () => {
    await stageFile("config.js", "const token = 'secret-value';");

    const result = await runCheck();

    expect(result.code).toBe(1);
    expect(result.stdout).toContain("FAIL Secrets");
    expect(result.stdout).not.toContain("secret-value");
  });

  it("fails when a staged file is oversized", async () => {
    await stageFile("large.bin", Buffer.alloc(5 * 1024 * 1024 + 1, "a"));

    const result = await runCheck();

    expect(result.code).toBe(1);
    expect(result.stdout).toContain("FAIL Large files");
  });

  it("fails clearly for an invalid repository", async () => {
    const nonGitDirectory = await fs.mkdtemp(path.join(os.tmpdir(), "not-a-git-repo-"));
    const result = await runCheck(nonGitDirectory);

    expect(result.code).toBe(1);
    expect(result.stdout).toContain("FAIL Secrets");
    expect(result.stdout).toContain("FAIL Branch safety");

    await fs.rm(nonGitDirectory, { recursive: true, force: true });
  });

  it("skips commit-message validation when no commit exists", async () => {
    await stageFile("README.md", "Useful documentation.");

    const result = await runCheck();

    expect(result.code ?? 0).toBe(0);
    expect(result.stdout).toContain("SKIPPED Commit message");
  });

  it("continues to support existing help output", async () => {
    const result = await execFileAsync(process.execPath, [cliPath, "--help"]);

    expect(result.stdout).toContain("Usage: git-good");
    expect(result.stdout).toContain("check");
  });
});
