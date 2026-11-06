// Build beside the live output, then replace it only after generation succeeds.
import { lstatSync, mkdtempSync, renameSync, rmSync } from "node:fs";
import { resolve, dirname, basename, join } from "node:path";

function statOrMissing(path) {
  try { return lstatSync(path); }
  catch (error) { if (error.code === "ENOENT") return null; throw error; }
}

export function replaceOutput(destination, generate) {
  const target = resolve(destination);
  const previous = statOrMissing(target);
  if (previous && (!previous.isDirectory() || previous.isSymbolicLink())) {
    throw new Error("Build output must be a regular directory, not a file or symlink");
  }
  // The workspace is a sibling so both renames stay on the same filesystem.
  const workspace = mkdtempSync(join(dirname(target), `.${basename(target)}-build-`));
  const staged = join(workspace, "next");
  const backup = join(workspace, "previous");
  let movedPrevious = false;
  let committed = false;
  try {
    generate(staged);
    if (previous) {
      renameSync(target, backup);
      movedPrevious = true;
    }
    try {
      renameSync(staged, target);
      committed = true;
    } catch (error) {
      if (movedPrevious) {
        try { renameSync(backup, target); movedPrevious = false; }
        catch (rollbackError) {
          throw new AggregateError([error, rollbackError], `Output replacement and rollback failed; previous output retained at ${backup}`);
        }
      }
      throw error;
    }
  } finally {
    // Never delete the only surviving previous output if rollback failed.
    if (!movedPrevious || committed) rmSync(workspace, { recursive: true, force: true });
  }
}
