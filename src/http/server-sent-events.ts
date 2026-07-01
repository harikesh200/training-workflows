import type { Response } from "express";

const heartbeatIntervalMs = 15_000;

/**
 * Opens and manages a Server-Sent Events response.
 */
export function createServerSentEventStream(res: Response) {
    function isClosed(): boolean {
        return res.destroyed || res.writableEnded;
    }

    function writeComment(comment: string): void {
        if (!isClosed()) {
            res.write(`: ${comment}\n\n`);
        }
    }

    res.status(200).set({
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
    });
    res.flushHeaders();
    writeComment("connected");

    const heartbeatTimer = setInterval(
        () => writeComment("keep-alive"),
        heartbeatIntervalMs,
    );
    heartbeatTimer.unref();

    return {
        send(event: string, payload: unknown): void {
            if (!isClosed()) {
                res.write(
                    `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`,
                );
            }
        },

        close(): void {
            clearInterval(heartbeatTimer);
            if (!isClosed()) {
                res.end();
            }
        },
    };
}
