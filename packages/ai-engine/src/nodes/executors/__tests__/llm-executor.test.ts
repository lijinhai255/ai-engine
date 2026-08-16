import { describe, expect, it, vi } from 'vitest'

import { createExecutionContext } from '../../../core/context'
import { createExecutionLogger } from '../../../logger'
import type { ArkChatClient } from '../../../models'
import type { WorkflowDefinition } from '../../../types'
import { LLMExecutor } from '../llm-executor'

describe('LLMExecutor', () => {
    it('calls Ark with configured messages and uses provider token usage', async () => {
        const complete = vi.fn().mockResolvedValue({ content: 'Ark result', totalTokens: 42 })
        const chatClient: Pick<ArkChatClient, 'complete'> = { complete }
        const executor = new LLMExecutor(chatClient)
        const workflow: WorkflowDefinition = {
            id: 'workflow-1',
            name: 'test',
            nodes: [{ id: 'llm-1', type: 'llm', data: {} }],
            edges: [],
        }
        const context = createExecutionContext('execution-1', workflow, {})
        const logger = createExecutionLogger('execution-1')

        const result = await executor.execute(
            'llm-1',
            {
                model: 'glm-5-2-260617',
                systemPrompt: 'system',
                userPrompt: 'hello',
                assistantPrompt: 'assistant',
                temperature: 0.3,
                maxTokens: 256,
            },
            context,
            logger
        )

        expect(complete).toHaveBeenCalledWith({
            model: 'glm-5-2-260617',
            messages: [
                { role: 'system', content: 'system' },
                { role: 'user', content: 'hello' },
                { role: 'assistant', content: 'assistant' },
            ],
            temperature: 0.3,
            maxTokens: 256,
        })
        expect(result.success).toBe(true)
        expect(result.outputs).toEqual({ output: 'Ark result', tokens: 42 })
    })
})
