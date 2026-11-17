const STANDARD_TYPES = [
  "feat",
  "fix",
  "docs",
  "style",
  "refactor",
  "perf",
  "test",
  "build",
  "ci",
  "chore",
  "revert",
];

const VAGUE_MESSAGES = new Set([
  "update stuff",
  "changes",
  "fixed things",
  "misc",
  "work in progress",
]);

function getResult(message, errors) {
  return {
    valid: errors.length === 0,
    message,
    errors,
  };
}

function checkCommitMessage(message, options = {}) {
  if (typeof message !== "string" || message.trim() === "") {
    return getResult(message, ["Commit message must not be empty."]);
  }

  const firstLine = message.split(/\r?\n/, 1)[0].trim();
  const normalizedMessage = firstLine.toLowerCase();
  const allowedTypes = options.allowedTypes ?? STANDARD_TYPES;
  const errors = [];

  if (!Array.isArray(allowedTypes) || allowedTypes.length === 0) {
    return getResult(message, ["At least one allowed commit type is required."]);
  }

  const match = firstLine.match(
    /^([a-z][a-z0-9-]*)(?:\(([^()\r\n]+)\))?!?:\s*(.*)$/i
  );

  if (!match) {
    errors.push(
      "Commit message must follow the format: type(optional-scope): description."
    );
  } else {
    const [, type, , description] = match;

    if (!allowedTypes.includes(type)) {
      errors.push(`Unsupported commit type "${type}".`);
    }

    if (description.trim() === "") {
      errors.push("Commit message description must not be empty.");
    } else if (VAGUE_MESSAGES.has(description.trim().toLowerCase())) {
      errors.push("Commit message description is too vague.");
    }
  }

  if (VAGUE_MESSAGES.has(normalizedMessage)) {
    errors.push("Commit message is too vague.");
  }

  return getResult(message, errors);
}

module.exports = {
  checkCommitMessage,
};
