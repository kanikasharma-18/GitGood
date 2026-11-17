import { afterEach, beforeEach, describe, expect, it } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { simpleGit } from "simple-git";
import { scanSecrets } from "../src/scanners/secrets.js";

describe("Secret scanner", () => {
  let temporaryDirectory;
  let git;

  beforeEach(async () => {
    temporaryDirectory = await fs.mkdtemp(path.join(os.tmpdir(), "git-good-secrets-"));
    git = simpleGit(temporaryDirectory);
    await git.init();
    await git.addConfig("user.name", "Git Good Test");
    await git.addConfig("user.email", "git-good-test@example.com");
    await git.checkoutLocalBranch("main");
  });

  afterEach(async () => {
    await fs.rm(temporaryDirectory, { recursive: true, force: true });
  });

  async function stageFile(fileName, content) {
    await fs.writeFile(path.join(temporaryDirectory, fileName), content);
    await git.add(fileName);
  }

  it("detects API keys without returning the key", async () => {
    const secret = "AKIA1234567890ABCDEF";
    await stageFile("config.js", `const accessKey = "${secret}";`);

    const result = await scanSecrets(temporaryDirectory);

    expect(result.hasSecrets).toBe(true);
    expect(result.findings).toEqual([
      {
        file: "config.js",
        line: 1,
        type: "api-key",
        description: "Known API key or access token format detected",
      },
    ]);
    expect(JSON.stringify(result)).not.toContain(secret);
  });

  it("detects password, secret, and token assignments", async () => {
    await stageFile(
      "config.txt",
      "password = safe-password\nsecret: safe-secret\ntoken='safe-token'\n"
    );

    const result = await scanSecrets(temporaryDirectory);

    expect(result.findings.map(({ type, line }) => ({ type, line }))).toEqual([
      { type: "credential-assignment", line: 1 },
      { type: "credential-assignment", line: 2 },
      { type: "credential-assignment", line: 3 },
    ]);
    expect(JSON.stringify(result)).not.toContain("safe-password");
    expect(JSON.stringify(result)).not.toContain("safe-secret");
    expect(JSON.stringify(result)).not.toContain("safe-token");
  });

  it("detects private key headers", async () => {
    await stageFile("key.pem", "-----BEGIN PRIVATE KEY-----\nencoded-content");

    const result = await scanSecrets(temporaryDirectory);

    expect(result.findings[0]).toMatchObject({
      file: "key.pem",
      line: 1,
      type: "private-key",
    });
  });

  it("detects staged environment files", async () => {
    await stageFile(".env.production", "APP_MODE=production");

    const result = await scanSecrets(temporaryDirectory);

    expect(result.findings[0]).toMatchObject({
      file: ".env.production",
      line: 1,
      type: "environment-file",
    });
  });

  it("ignores ordinary text and unstaged-only files", async () => {
    await stageFile("README.txt", "This is ordinary documentation.");
    await fs.writeFile(path.join(temporaryDirectory, "unstaged.txt"), "token = not-staged");

    const result = await scanSecrets(temporaryDirectory);

    expect(result).toEqual({ hasSecrets: false, findings: [] });
  });

  it("scans staged content instead of the working-tree version", async () => {
    await stageFile("config.env", "token = staged-token");
    await fs.writeFile(path.join(temporaryDirectory, "config.env"), "ordinary text");

    const result = await scanSecrets(temporaryDirectory);

    expect(result.findings[0]).toMatchObject({
      file: "config.env",
      type: "credential-assignment",
    });
    expect(JSON.stringify(result)).not.toContain("staged-token");
  });

  it("handles deleted staged files", async () => {
    await stageFile("old.env", "token = old-token");
    await git.commit("Add old file");
    await fs.rm(path.join(temporaryDirectory, "old.env"));
    await git.add("old.env");

    await expect(scanSecrets(temporaryDirectory)).resolves.toEqual({
      hasSecrets: false,
      findings: [],
    });
  });
});
