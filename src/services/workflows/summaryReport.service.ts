import { writeFile } from "node:fs/promises";
import path from "node:path";
import type { ReportService } from "../openai-report.service";
import { writeCsv } from "../../utils/csvFiles";
import type {
    Agent1OutputRow,
    ErrorPartVendorRow,
    SummaryRow,
} from "../../types/workflows.domain";
import type { WorkflowArtifact } from "../../types/workflows.types";

/**
 * Builds both summary artifacts for a completed workflow.
 *
 * The tabular report is the source-of-record CSV. The text report is generated
 * from bounded aggregates so the model summarizes evidence instead of seeing
 * raw workflow rows.
 */
export async function runSummaryReport(input: {
    readonly artifactsDir: string;
    readonly reportService: ReportService;
    readonly workflowId: string;
    readonly agent1Rows: readonly Agent1OutputRow[];
    readonly errorPartVendorRows: readonly ErrorPartVendorRow[];
    readonly emailStatus: Readonly<Record<string, string>>;
}): Promise<{
    readonly tabularSummaryPath: string;
    readonly textSummaryPath: string;
    readonly tabularArtifact: WorkflowArtifact;
    readonly textArtifact: WorkflowArtifact;
}> {
    const summaryRows = buildSummaryRows(
        input.agent1Rows,
        input.errorPartVendorRows,
        input.emailStatus,
    );
    summaryRows.sort(compareSummaryRows);

    const tabularSummaryPath = path.join(
        input.artifactsDir,
        input.workflowId,
        "tabular_summary_report.csv",
    );
    await writeCsv(tabularSummaryPath, summaryRows);

    const severitySummary = summarizeCounts(
        input.agent1Rows.map((row) => row.severity),
    );
    const machineIssueSummary = summarizeCounts(
        input.agent1Rows.map(
            (row) => `${row.machine_name} (${row.machine_id})`,
        ),
    );
    const errorCodeSummary = summarizeCounts(
        input.agent1Rows.map((row) => row.error_code),
    );
    const partDemandSummary = summarizeCounts(
        input.agent1Rows.map((row) => row.part_name),
    );
    const vendorCostSummary = summarizeVendorCosts(summaryRows);
    const emailStatusSummary = summarizeCounts(
        summaryRows.map((row) => row.vendor_email_status),
    );
    const report = await input.reportService.generateSummary({
        detectedIssueCount: input.agent1Rows.length,
        summaryRowCount: summaryRows.length,
        timeRangeSummary: summarizeTimeRange(input.agent1Rows),
        severitySummary,
        machineIssueSummary,
        errorCodeSummary,
        partDemandSummary,
        vendorCostSummary,
        emailStatusSummary,
    });

    const textSummaryPath = path.join(
        input.artifactsDir,
        input.workflowId,
        "text_summary_report.txt",
    );
    await writeFile(textSummaryPath, report, "utf8");

    return {
        tabularSummaryPath,
        textSummaryPath,
        tabularArtifact: {
            name: "tabular-summary",
            path: tabularSummaryPath,
            contentType: "text/csv",
        },
        textArtifact: {
            name: "text-summary",
            path: textSummaryPath,
            contentType: "text/plain",
        },
    };
}

/**
 * Expands maintenance findings into report rows by attaching every matching
 * vendor option for the recommended part.
 */
function buildSummaryRows(
    agent1Rows: readonly Agent1OutputRow[],
    errorPartVendorRows: readonly ErrorPartVendorRow[],
    emailStatus: Readonly<Record<string, string>>,
): SummaryRow[] {
    const rows: SummaryRow[] = [];
    for (const agentRow of agent1Rows) {
        const matches = errorPartVendorRows.filter((candidate) =>
            sameAgentRow(candidate, agentRow),
        );
        if (matches.length === 0) {
            rows.push({
                ...agentRow,
                vendor: "",
                price: "",
                delivery_time: "",
                vendor_email_status: "no_po_generated",
            });
            continue;
        }

        for (const match of matches) {
            rows.push({
                ...agentRow,
                vendor: match.vendor,
                price: String(match.price),
                delivery_time: match.delivery_time,
                vendor_email_status:
                    emailStatus[match.vendor] ?? "no_po_generated",
            });
        }
    }
    return rows;
}

/**
 * Matches a vendor row back to the exact maintenance finding that produced it.
 */
function sameAgentRow(left: Agent1OutputRow, right: Agent1OutputRow): boolean {
    return (
        left.timestamp === right.timestamp &&
        left.machine_id === right.machine_id &&
        left.machine_name === right.machine_name &&
        left.error_code === right.error_code &&
        left.severity === right.severity &&
        left.part_name === right.part_name
    );
}

/**
 * Provides stable CSV ordering for deterministic artifacts.
 */
function compareSummaryRows(left: SummaryRow, right: SummaryRow): number {
    return (
        left.timestamp.localeCompare(right.timestamp) ||
        left.machine_id.localeCompare(right.machine_id) ||
        left.error_code.localeCompare(right.error_code) ||
        left.part_name.localeCompare(right.part_name)
    );
}

/**
 * Returns the top five occurrence counts as a compact prompt-safe string.
 */
function summarizeCounts(values: readonly string[]): string {
    const counts = new Map<string, number>();
    for (const value of values) {
        const normalizedValue = value.trim();
        if (normalizedValue.length === 0) {
            continue;
        }
        counts.set(normalizedValue, (counts.get(normalizedValue) ?? 0) + 1);
    }
    return (
        Array.from(counts.entries())
            .sort(
                ([leftValue, leftCount], [rightValue, rightCount]) =>
                    rightCount - leftCount ||
                    leftValue.localeCompare(rightValue),
            )
            .slice(0, 5)
            .map(([value, count]) => `${value}: ${count} occurrences`)
            .join(", ") || "None"
    );
}

/**
 * Returns the top five vendor totals from matched part prices.
 */
function summarizeVendorCosts(rows: readonly SummaryRow[]): string {
    const costs = new Map<string, number>();
    for (const row of rows) {
        if (row.vendor.length === 0 || row.price.length === 0) {
            continue;
        }
        const price = Number(row.price);
        if (!Number.isFinite(price)) {
            continue;
        }
        costs.set(row.vendor, (costs.get(row.vendor) ?? 0) + price);
    }
    return (
        Array.from(costs.entries())
            .sort(
                ([leftVendor, leftAmount], [rightVendor, rightAmount]) =>
                    rightAmount - leftAmount ||
                    leftVendor.localeCompare(rightVendor),
            )
            .slice(0, 5)
            .map(([vendor, amount]) => `${vendor}: ${amount.toFixed(2)}`)
            .join(", ") || "None"
    );
}

/**
 * Returns the analyzed log timestamp range used in the text report.
 */
function summarizeTimeRange(rows: readonly Agent1OutputRow[]): string {
    const timestamps = rows
        .map((row) => row.timestamp.trim())
        .filter((timestamp) => timestamp.length > 0)
        .sort((left, right) => left.localeCompare(right));
    const firstTimestamp = timestamps[0];
    const lastTimestamp = timestamps[timestamps.length - 1];
    if (!firstTimestamp || !lastTimestamp) {
        return "Not available";
    }
    if (firstTimestamp === lastTimestamp) {
        return firstTimestamp;
    }
    return `${firstTimestamp} to ${lastTimestamp}`;
}
