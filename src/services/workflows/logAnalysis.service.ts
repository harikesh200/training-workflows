import path from "node:path";
import * as z from "zod";
import { parseErrorManual } from "./errorManualParser.service";
import { readCsvRows, writeCsv } from "../../utils/csvFiles";
import type { Agent1OutputRow } from "../../types/workflows.domain";
import type { WorkflowArtifact } from "../../types/workflows.types";
import { cleanPartName } from "../../utils/workflowUtils";

const machineLogRowSchema = z.object({
    timestamp: z.string().trim(),
    machine_id: z.string().trim().min(1),
    machine_name: z.string().trim().min(1),
    error_code: z.string().trim(),
});

/**
 * Analyzes machine logs against the parsed error manual and writes the
 * `agent1-output` artifact.
 */
export async function runLogAnalysis(input: {
    readonly artifactsDir: string;
    readonly errorManualPath: string;
    readonly machineLogsPath: string;
    readonly workflowId: string;
}): Promise<{
    readonly rows: readonly Agent1OutputRow[];
    readonly artifact: WorkflowArtifact;
}> {
    const manual = await parseErrorManual(input.errorManualPath);
    const logs = await readCsvRows(input.machineLogsPath, machineLogRowSchema);
    const rows: Agent1OutputRow[] = [];

    for (const logRow of logs) {
        const errorCode = logRow.error_code;
        if (errorCode.length === 0 || errorCode === "None") {
            continue;
        }

        const manualEntry = manual.get(errorCode);
        const severity = manualEntry?.severity ?? "Unknown";
        const parts = manualEntry?.recommendedParts ?? [];

        if (parts.length === 0) {
            rows.push({
                timestamp: logRow.timestamp,
                machine_id: logRow.machine_id,
                machine_name: logRow.machine_name,
                error_code: errorCode,
                severity,
                part_name: "Unknown",
            });
            continue;
        }

        for (const part of parts) {
            rows.push({
                timestamp: logRow.timestamp,
                machine_id: logRow.machine_id,
                machine_name: logRow.machine_name,
                error_code: errorCode,
                severity,
                part_name: cleanPartName(part),
            });
        }
    }

    const outputPath = path.join(
        input.artifactsDir,
        input.workflowId,
        "agent1_output.csv",
    );
    await writeCsv(outputPath, rows);
    return {
        rows,
        artifact: {
            name: "agent1-output",
            path: outputPath,
            contentType: "text/csv",
        },
    };
}
