import { randomUUID } from "node:crypto";
import { pinoHttp } from "pino-http";
import { logger } from "../logger";

/**
 * Logs HTTP requests with a shared correlation ID.
 */
export const requestLogger = pinoHttp({
    logger,
    genReqId(req, res) {
        const header = req.headers["x-request-id"];
        const requestId =
            typeof header === "string" && header ? header : randomUUID();

        res.setHeader("x-request-id", requestId);
        return requestId;
    },
    quietReqLogger: true,
    customAttributeKeys: {
        reqId: "requestId",
    },
    redact: [
        "req.headers.authorization",
        "req.headers.cookie",
        "req.body.senderPassword",
    ],
    customLogLevel(req, res, err) {
        if (err || res.statusCode >= 500) {
            return "error";
        }
        if (res.statusCode >= 400) {
            return "warn";
        }

        const path = req.url?.split("?", 1)[0];
        const isRoutineRequest =
            path === "/health" ||
            path === "/ready" ||
            (req.method === "GET" &&
                /^\/v1\/workflows\/[^/]+$/.test(path ?? ""));

        return isRoutineRequest ? "silent" : "info";
    },
    wrapSerializers: false,
    serializers: {
        req(req) {
            return {
                method: req.method,
                url: req.url,
            };
        },
        res(res) {
            return {
                statusCode: res.statusCode,
            };
        },
    },
});
