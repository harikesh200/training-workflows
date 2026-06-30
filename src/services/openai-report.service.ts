import OpenAI from "openai";
import { UpstreamError } from "../http/errors";

/**
 * Bounded workflow evidence supplied to the report-generation model.
 */
export type ReportSummaryInput = {
    readonly findingCount: number;
    readonly unmatchedFindingCount: number;
    readonly analysisPeriod: string;
    readonly severityProfile: string;
    readonly recurringMachines: string;
    readonly recurringErrorCodes: string;
    readonly requiredParts: string;
    readonly vendorCostExposure: string;
    readonly purchaseOrderDelivery: string;
};

/**
 * Report-generation service boundary used by the workflow runner.
 */
export type ReportService = ReturnType<typeof createOpenAiReportService>;

const reportInstructions = [
    "You are the plant maintenance manager writing an executive brief for the plant head.",
    "Write a polished management report, not a metric dump. Use the figures as supporting evidence inside a clear narrative.",
    "Explain what deserves attention, why it matters operationally, what procurement or delivery issues exist, and what management should do next.",
    "Be decisive but evidence-based. Do not invent downtime, production loss, safety incidents, root causes, stock levels, or delivery impact.",
    "Avoid generic phrases such as significant operational risk, streamline the process, or monitor closely unless you state the exact issue and action.",
    "Use a formal, concise tone suitable for forwarding unchanged to senior management.",
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
                const response = await client.responses.create(
                    {
                        model: options.model,
                        instructions: reportInstructions,
                        input: [
                            "Prepare a 350-500 word executive brief from the evidence below.",
                            "",
                            "Use this exact document structure:",
                            "PLANT MAINTENANCE EXECUTIVE BRIEF",
                            "Reporting Period: <period>",
                            "",
                            "Executive Overview",
                            "Two short paragraphs that explain the overall maintenance position and the main management concern. Synthesize the evidence; do not list every figure.",
                            "",
                            "Maintenance Assessment",
                            "A concise narrative connecting the severity profile, recurring machines, recurring error codes, and required parts. Identify the two or three priorities that deserve action.",
                            "",
                            "Procurement and Delivery Position",
                            "A concise narrative covering vendor cost concentration, unmatched findings, purchase-order coverage, and delivery exceptions. Distinguish vendor-level email outcomes from maintenance findings.",
                            "",
                            "Management Actions",
                            "Give three to five numbered actions. Each action must name one owner: Maintenance, Procurement, or Plant Operations. State the action and the evidence that makes it necessary.",
                            "",
                            "Management Conclusion",
                            "Close with one short paragraph stating the immediate management focus.",
                            "",
                            "Workflow evidence:",
                            JSON.stringify(input, null, 2),
                        ].join("\n"),
                        temperature: 0.3,
                    },
                    { signal: AbortSignal.timeout(60_000) },
                );

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
