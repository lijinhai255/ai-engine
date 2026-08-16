import { describe, expect, it } from 'vitest'

import type { ExecutionLogEntry } from '../../types'
import { DefaultExecutionLogger } from '../execution-logger'

describe('DefaultExecutionLogger security', () => {
    it('does not retain prompt, input, output, or resolved variable bodies', () => {
        const entries: ExecutionLogEntry[] = []
        const logger = new DefaultExecutionLogger('exec-1', false, entry => entries.push(entry))

        logger.info('Workflow execution started', { inputs: { content: 'private workflow input' } })
        logger.nodeStart('llm-1', 'llm', { userPrompt: 'private prompt', model: 'glm-test' })
        logger.variableResolve('${start.content}', 'private original', 'private resolved value')
        logger.llmRequest('llm-1', {
            model: 'glm-test',
            messages: [{ role: 'user', content: 'private prompt body' }],
        })
        logger.llmResponse('llm-1', { content: 'private model output', tokens: 5, duration: 10 })
        logger.nodeEnd('llm-1', {
            success: true,
            outputs: { output: 'private node output', tokens: 5 },
            duration: 10,
        })

        const serialized = JSON.stringify(entries)
        expect(serialized).not.toContain('private workflow input')
        expect(serialized).not.toContain('private prompt')
        expect(serialized).not.toContain('private original')
        expect(serialized).not.toContain('private resolved value')
        expect(serialized).not.toContain('private model output')
        expect(serialized).not.toContain('private node output')
        expect(serialized).toContain('glm-test')
        expect(serialized).toContain('"tokens":5')
    })
})
