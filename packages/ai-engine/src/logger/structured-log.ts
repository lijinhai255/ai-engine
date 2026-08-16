export interface StructuredLogSink {
    info(event: string, metadata: Record<string, unknown>): void
    error(event: string, metadata: Record<string, unknown>): void
}

export function sanitizeLogText(value: string, secrets: string[] = []): string {
    let sanitized = value

    for (const secret of secrets) {
        if (secret) {
            sanitized = sanitized.split(secret).join('[REDACTED]')
        }
    }

    return sanitized.replace(/Bearer\s+\S+/gi, 'Bearer [REDACTED]')
}

export function sanitizeBaseURL(value: string): string {
    try {
        const url = new URL(value)
        url.username = ''
        url.password = ''
        url.search = ''
        url.hash = ''
        return url.toString().replace(/\/$/, '')
    } catch {
        return '[INVALID_URL]'
    }
}

export function emitStructuredLog(
    sink: StructuredLogSink,
    level: 'info' | 'error',
    event: string,
    metadata: Record<string, unknown>
): void {
    try {
        sink[level](event, metadata)
    } catch {
        // Logging is best effort and must not affect application execution.
    }
}
