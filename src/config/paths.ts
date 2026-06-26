import path from "node:path";

/**
 * Root directory used to resolve local workflow storage paths.
 */
export const workspaceRoot = process.cwd();

/**
 * Parent directory for all local workflow state.
 */
export const dataDir = path.join(workspaceRoot, "data");

/**
 * Directory for temporary per-workflow uploaded input files.
 */
export const uploadsDir = path.join(dataDir, "uploads");

/**
 * Directory for generated workflow artifacts.
 */
export const artifactsDir = path.join(dataDir, "artifacts");

/**
 * Directory for persisted workflow job JSON documents.
 */
export const jobsDir = path.join(dataDir, "jobs");
