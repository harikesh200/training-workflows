import * as z from "zod";

/**
 * Persisted lifecycle status for a workflow job.
 */
export const workflowStatusSchema = z.enum([
    "queued",
    "running",
    "succeeded",
    "failed",
]);

/**
 * Fine-grained execution step used for progress reporting.
 */
export const workflowStepSchema = z.enum([
    "queued",
    "uploads_saved",
    "log_analysis",
    "purchase_orders",
    "vendor_emails",
    "summary_report",
    "plant_head_email",
    "completed",
    "failed",
]);

/**
 * Downloadable artifact metadata stored on a workflow job.
 */
export const workflowArtifactSchema = z.object({
    name: z.string().min(1),
    path: z.string().min(1),
    contentType: z.string().min(1),
});

/**
 * Persisted workflow job schema used to validate repository reads.
 */
export const workflowJobSchema = z.object({
    id: z.string().min(1),
    status: workflowStatusSchema,
    currentStep: workflowStepSchema,
    progress: z.number().int().min(0).max(100),
    senderEmail: z.email(),
    vendorEmailList: z.array(z.email()),
    resolvedVendorEmails: z.record(z.string(), z.email()),
    plantHeadEmail: z.email(),
    uploadPaths: z.object({
        machineLogs: z.string().min(1),
        errorManual: z.string().min(1),
        vendorCatalog: z.string().min(1),
    }),
    artifacts: z.array(workflowArtifactSchema),
    error: z.string().nullable(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
    completedAt: z.iso.datetime().nullable(),
});

/**
 * Persisted lifecycle status for a workflow job.
 */
export type WorkflowStatus = z.infer<typeof workflowStatusSchema>;

/**
 * Fine-grained execution step used for progress reporting.
 */
export type WorkflowStep = z.infer<typeof workflowStepSchema>;

/**
 * Downloadable artifact metadata stored on a workflow job.
 */
export type WorkflowArtifact = z.infer<typeof workflowArtifactSchema>;

/**
 * Persisted workflow job state.
 */
export type WorkflowJob = z.infer<typeof workflowJobSchema>;

/**
 * Required multipart files for workflow creation.
 */
export type UploadedWorkflowFiles = {
    readonly machineLogs: Express.Multer.File;
    readonly errorManual: Express.Multer.File;
    readonly vendorCatalog: Express.Multer.File;
};

/**
 * Runtime-only secrets needed by the background workflow runner.
 */
export type RuntimeWorkflowSecrets = {
    readonly senderPassword: string;
};
