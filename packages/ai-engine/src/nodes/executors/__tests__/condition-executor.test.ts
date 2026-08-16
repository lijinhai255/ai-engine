import { describe, expect, it, vi } from 'vitest'

import { createExecutionContext } from '../../../core/context'
import { createExecutionLogger } from '../../../logger'
import type { ArkChatClient } from '../../../models'
import type { WorkflowDefinition } from '../../../types'
import { ConditionExecutor } from '../condition-executor'

describe('ConditionExecutor', () => {
    it('uses Ark to classify upstream text and selects the matching branch', async () => {
        const complete = vi.fn().mockResolvedValue({
            content: '{"intent":"查询订单","confidence":0.95}',
            totalTokens: 20,
        })
        const chatClient: Pick<ArkChatClient, 'complete'> = { complete }
        const executor = new ConditionExecutor(chatClient)
        const workflow: WorkflowDefinition = {
            id: 'workflow-1',
            name: 'test',
            nodes: [
                { id: 'start-1', type: 'start', data: {} },
                { id: 'condition-1', type: 'condition', data: {} },
            ],
            edges: [{ id: 'edge-1', source: 'start-1', target: 'condition-1' }],
        }
        const context = createExecutionContext('execution-1', workflow, {})
        context.variables.setNodeOutputs('start-1', { output: '我要查询订单' })
        const logger = createExecutionLogger('execution-1')

        const result = await executor.execute(
            'condition-1',
            {
                model: 'glm-5-2-260617',
                intents: [
                    { name: '查询订单', description: '查询订单状态' },
                    { name: '其他', description: '其他问题' },
                ],
            },
            context,
            logger
        )

        expect(complete).toHaveBeenCalledWith({
            model: 'glm-5-2-260617',
            messages: [
                expect.objectContaining({ role: 'system', content: expect.stringContaining('查询订单') }),
                expect.objectContaining({ role: 'user', content: expect.stringContaining('我要查询订单') }),
            ],
            temperature: 0,
        })
        expect(result.success).toBe(true)
        expect(result.outputs).toEqual({ matchedIntent: '查询订单', confidence: 0.95 })
        expect(result.matchedBranch).toBe('intent-0')
    })
})
