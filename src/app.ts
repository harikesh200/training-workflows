import express from "express";
import helmet from "helmet";
import cors, { type CorsOptions } from "cors";
import rateLimit from "express-rate-limit";
import { config } from "./config/env";
import { errorHandler } from "./http/error-handler";
import { requestLogger } from "./http/request-logger";
import { makeWorkflowsRouter } from "./routes/workflows.routes";
import type { WorkflowsService } from "./services/workflows.service";

/**
 * Services required to compose the Express application.
 */
export type AppDependencies = {
    readonly workflowsService: WorkflowsService;
};

function parseCorsOrigin(corsOrigin: string): CorsOptions["origin"] {
    const value = corsOrigin.trim();

    if (!value || value === "*") {
        return "*";
    }

    const origins = value
        .split(",")
        .map((origin) => origin.trim())
        .filter(Boolean);

    return origins.length === 1 ? origins[0] : origins;
}

/**
 * Builds the Express app without starting a listener.
 *
 * This is the composition boundary for HTTP middleware, health checks, routes,
 * and the terminal error handler.
 */
export function buildApp(deps: AppDependencies): express.Express {
    const app = express();

    app.disable("x-powered-by");
    app.use(helmet());
    app.use(
        cors({
            origin: parseCorsOrigin(config.CORS_ORIGIN),
            credentials: true,
        }),
    );
    app.use(express.json({ limit: "100kb" }));
    app.use(express.urlencoded({ extended: false, limit: "100kb" }));
    app.use(rateLimit({ windowMs: 60_000, limit: 100 }));
    app.use(requestLogger);

    app.get("/health", (_req, res) => {
        res.json({ data: { status: "ok" } });
    });

    app.get("/ready", (_req, res) => {
        res.json({ data: { status: "ready" } });
    });

    app.use("/v1/workflows", makeWorkflowsRouter(deps.workflowsService));
    app.use(errorHandler);

    return app;
}
