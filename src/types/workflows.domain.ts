/**
 * Complete request payload after multipart files and workflow fields have been
 * validated at the HTTP boundary.
 */
export type CreateWorkflowInput = {
    readonly files: import("./workflows.types").UploadedWorkflowFiles;
    readonly input: {
        readonly senderEmail: string;
        readonly senderPassword: string;
        readonly vendorEmailList: readonly string[];
        readonly plantHeadEmail: string;
    };
};

/**
 * Parsed maintenance-manual definition for a machine error code.
 */
export type ErrorManualEntry = {
    readonly errorCode: string;
    readonly description: string;
    readonly possibleCauses: readonly string[];
    readonly recommendedParts: readonly string[];
    readonly severity: string;
};

/**
 * Maintenance finding produced from machine logs after joining each error code
 * to the parsed error manual.
 */
export type Agent1OutputRow = {
    readonly timestamp: string;
    readonly machine_id: string;
    readonly machine_name: string;
    readonly error_code: string;
    readonly severity: string;
    readonly part_name: string;
};

/**
 * Vendor catalog match for one maintenance finding and recommended part.
 */
export type ErrorPartVendorRow = Agent1OutputRow & {
    readonly vendor: string;
    readonly price: number;
    readonly delivery_time: string;
};

/**
 * Aggregated purchase-order line for one vendor and part.
 */
export type InvoiceLine = {
    readonly part_name: string;
    readonly quantity: number;
    readonly unit_price: number;
    readonly delivery_time: string;
    readonly subtotal: number;
    readonly total_vendor_cost: number;
};

/**
 * Final CSV row used by the plant-head summary report.
 *
 * One maintenance finding can produce multiple summary rows when multiple
 * vendors match the same recommended part.
 */
export type SummaryRow = Agent1OutputRow & {
    readonly vendor: string;
    readonly price: string;
    readonly delivery_time: string;
    readonly vendor_email_status: string;
};
