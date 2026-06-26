import OpenAI from "openai";
import { UpstreamError } from "../http/errors";

/**
 * Aggregated workflow evidence supplied to the report-generation model.
 *
 * Counts based on detected issues describe maintenance findings. Counts based
 * on summary rows describe vendor-matched rows and may include duplicates when
 * multiple vendors match the same part.
 */
export type ReportSummaryInput = {
    /** Number of maintenance findings emitted by log analysis. */
    readonly detectedIssueCount: number;
    /** Number of rows written to the tabular summary CSV. */
    readonly summaryRowCount: number;
    /** Earliest-to-latest timestamp range from the analyzed log findings. */
    readonly timeRangeSummary: string;
    /** Top severity counts based on maintenance findings. */
    readonly severitySummary: string;
    /** Top machine counts based on maintenance findings. */
    readonly machineIssueSummary: string;
    /** Top error-code counts based on maintenance findings. */
    readonly errorCodeSummary: string;
    /** Top recommended-part counts based on maintenance findings. */
    readonly partDemandSummary: string;
    /** Top vendor cost totals based on matched summary rows. */
    readonly vendorCostSummary: string;
    /** Email and purchase-order status counts from the final summary rows. */
    readonly emailStatusSummary: string;
};

/**
 * Report-generation service boundary used by the workflow runner.
 */
export type ReportService = ReturnType<typeof createOpenAiReportService>;

/**
 * System-level reporting contract for the LLM.
 *
 * Keep durable behavior here and request-specific facts in the model input so
 * the prompt stays auditable and does not mix policy with generated evidence.
 */
const reportInstructions = [
    "Role: You are a manufacturing operations analyst preparing the final maintenance workflow report for a plant head.",
    "Goal: Convert the provided workflow evidence into a concise leadership report that identifies operational risk, procurement impact, and immediate follow-up actions.",
    "Evidence rules: Use only the provided evidence. Do not invent machines, vendors, causes, costs, purchase orders, email outcomes, or timestamps. If evidence is missing, state that directly.",
    "Interpretation rules: Detected issue rows are maintenance findings. Tabular summary rows are vendor-matched reporting rows and may duplicate a finding when multiple vendors match one part. Treat no_po_generated as procurement not initiated, not as an email delivery failure.",
    "Risk rules: Prioritize high severity, repeated machine or error-code patterns, high-cost vendors, and parts with repeated demand. Do not classify Unknown severity or Unknown part as critical unless the evidence includes a real error code supporting it.",
    "Output rules: Write plain text with no markdown heading symbols and no asterisks. Use the exact section titles requested by the prompt. Keep the report under 450 words. Be direct, specific, and suitable for forwarding to plant leadership.",
].join("\n");

/**
 * Creates the OpenAI-backed report service used to turn workflow aggregates
 * into the final plant-head text summary.
 */
export function createOpenAiReportService(options: {
    readonly apiKey: string;
    readonly model: string;
}) {
    const client = new OpenAI({ apiKey: options.apiKey });

    return {
        async generateSummary(input: ReportSummaryInput): Promise<string> {
            try {
                const response = await client.responses.create({
                    model: options.model,
                    instructions: reportInstructions,
                    input:
                        "Create the final maintenance workflow report from these authoritative facts.\n\n" +
                        "Required section titles, in order:\n" +
                        "Executive Summary\n" +
                        "Critical Issues\n" +
                        "Cost and Procurement Impact\n" +
                        "Email and PO Status\n" +
                        "Recommended Actions\n\n" +
                        "Facts:\n" +
                        `- Detected issue rows: ${input.detectedIssueCount}\n` +
                        `- Tabular summary rows: ${input.summaryRowCount}\n` +
                        `- Log time range: ${input.timeRangeSummary}\n` +
                        `- Errors by severity: ${input.severitySummary}\n` +
                        `- Top machines by issue count: ${input.machineIssueSummary}\n` +
                        `- Top error codes by issue count: ${input.errorCodeSummary}\n` +
                        `- Top parts by demand count: ${input.partDemandSummary}\n` +
                        `- Total matched parts cost by vendor in Indian Rupees: ${input.vendorCostSummary}\n` +
                        `- Email and PO status counts: ${input.emailStatusSummary}\n\n` +
                        "Write 1-3 concise sentences under each section title. In Recommended Actions, assign actions to maintenance, procurement, or plant operations where the evidence supports it. If a section has no supporting facts, write: No supporting evidence was available.",
                    temperature: 0.2,
                });

                const outputText = response.output_text.trim();
                if (outputText.length === 0) {
                    throw new UpstreamError("OpenAI returned an empty report");
                }
                return outputText;
            } catch (err) {
                if (err instanceof UpstreamError) {
                    throw err;
                }
                throw new UpstreamError("OpenAI report generation failed");
            }
        },
    };
}
