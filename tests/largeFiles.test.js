import { afterEach, beforeEach, describe, expect, it } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { simpleGit } from "simple-git";
import { scanLargeFiles } from "../src/scanners/largeFiles.js";

describe("Large file detector", () => {
  let temporaryDirectory;
  let git;

  beforeEach(async () => {
    temporaryDirectory = await fs.mkdtemp(path.join(os.tmpdir(), "git-good-large-files-"));
    git = simpleGit(temporaryDirectory);
    await git.init();
    await git.addConfig("user.name", "Git Good Test");
    await git.addConfig("user.email", "git-good-test@example.com");
    await git.checkoutLocalBranch("main");
  });

  afterEach(async () => {
    await fs.rm(temporaryDirectory, { recursive: true, force: true });
  });

  async function writeFile(fileName, size) {
    await fs.writeFile(path.join(temporaryDirectory, fileName), Buffer.alloc(size, "a"));
  }

  async function stageFile(fileName) {
    await git.add(fileName);
  }

  it("detects a staged file larger than 5 MB", async () => {
    const size = 5 * 1024 * 1024 + 1;
    await writeFile("large.bin", size);
    await stageFile("large.bin");

    const result = await scanLargeFiles(temporaryDirectory);

    expect(result).toEqual({
      hasLargeFiles: true,
      findings: [
        {
          file: "large.bin",
          size,
          sizeFormatted: "5.00 MB",
          limit: 5 * 1024 * 1024,
        },
      ],
    });
  });

  it("ignores staged files smaller than the threshold", async () => {
    await writeFile("small.bin", 1024);
    await stageFile("small.bin");

    await expect(scanLargeFiles(temporaryDirectory)).resolves.toEqual({
      hasLargeFiles: false,
      findings: [],
    });
  });

  it("supports a custom maximum size", async () => {
    await writeFile("custom.bin", 2048);
    await stageFile("custom.bin");

    const result = await scanLargeFiles(temporaryDirectory, { maxSize: 1024 });

    expect(result.findings[0]).toMatchObject({
      file: "custom.bin",
      size: 2048,
      sizeFormatted: "2.00 KB",
      limit: 1024,
    });
  });

  it("ignores unstaged-only files", async () => {
    await writeFile("unstaged.bin", 5 * 1024 * 1024 + 1);

    await expect(scanLargeFiles(temporaryDirectory)).resolves.toEqual({
      hasLargeFiles: false,
      findings: [],
    });
  });

  it("checks staged content rather than the working-tree content", async () => {
    await writeFile("changing.bin", 5 * 1024 * 1024 + 1);
    await stageFile("changing.bin");
    await writeFile("changing.bin", 10);

    const result = await scanLargeFiles(temporaryDirectory);

    expect(result.findings[0]).toMatchObject({
      file: "changing.bin",
      size: 5 * 1024 * 1024 + 1,
    });
  });

  it("ignores deleted files", async () => {
    await writeFile("deleted.bin", 5 * 1024 * 1024 + 1);
    await stageFile("deleted.bin");
    await git.commit("Add large file");
    await fs.rm(path.join(temporaryDirectory, "deleted.bin"));
    await stageFile("deleted.bin");

    await expect(scanLargeFiles(temporaryDirectory)).resolves.toEqual({
      hasLargeFiles: false,
      findings: [],
    });
  });

  it("returns the exact staged size and formatted size", async () => {
    const size = 6 * 1024 * 1024;
    await writeFile("exact.bin", size);
    await stageFile("exact.bin");

    const result = await scanLargeFiles(temporaryDirectory);

    expect(result.findings[0]).toMatchObject({
      file: "exact.bin",
      size,
      sizeFormatted: "6.00 MB",
      limit: 5 * 1024 * 1024,
    });
  });

  it("reports invalid Git directories clearly", async () => {
    const nonGitDirectory = await fs.mkdtemp(path.join(os.tmpdir(), "not-a-git-repo-"));

    await expect(scanLargeFiles(nonGitDirectory)).rejects.toThrow(
      "find the Git repository root"
    );

    await fs.rm(nonGitDirectory, { recursive: true, force: true });
  });
});
