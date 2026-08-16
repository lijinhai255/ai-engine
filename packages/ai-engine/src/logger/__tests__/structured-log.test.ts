import { describe, expect, it, vi } from 'vitest'

import { emitStructuredLog, sanitizeBaseURL, sanitizeLogText, type StructuredLogSink } from '../structured-log'

describe('structured logging', () => {
    it('removes credentials, query parameters, and fragments from base URLs', () => {
        expect(sanitizeBaseURL('https://user:pass@ark.example/v3?key=secret#token')).toBe('https://ark.example/v3')
    })

    it('redacts configured secrets and bearer tokens from text', () => {
        expect(sanitizeLogText('bad key-123 Bearer abc.def-456', ['key-123'])).toBe('bad [REDACTED] Bearer [REDACTED]')
    })

    it('emits structured metadata to the selected level', () => {
        const sink: StructuredLogSink = { info: vi.fn(), error: vi.fn() }

        emitStructuredLog(sink, 'info', 'test.event', { executionId: 'exec-1' })

        expect(sink.info).toHaveBeenCalledWith('test.event', { executionId: 'exec-1' })
        expect(sink.error).not.toHaveBeenCalled()
    })

    it('does not throw when the log sink fails', () => {
        const sink: StructuredLogSink = {
            info: () => {
                throw new Error('sink unavailable')
            },
            error: vi.fn(),
        }

        expect(() => emitStructuredLog(sink, 'info', 'test.event', { executionId: 'exec-1' })).not.toThrow()
    })
})
