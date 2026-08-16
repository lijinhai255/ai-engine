/*
 *   Copyright (c) 2026 妙码学院 @Heyi
 *   All rights reserved.
 *   妙码学院官方出品，作者 @Heyi，供学员学习使用，可用作练习，可用作美化简历，不可开源。
 */

import { ArkChatClient, type ArkChatMessage } from '../../models'
import type { ExecutionContext, ExecutionLogger, LLMNodeConfig, NodeExecutionResult, OutputVariableSchema } from '../../types'
import { BaseNodeExecutor } from '../base-executor'

/**
 * LLM 节点执行器
 * 使用方舟 OpenAI 兼容接口调用大语言模型
 */
export class LLMExecutor extends BaseNodeExecutor<LLMNodeConfig> {
    readonly type = 'llm' as const

    constructor(private readonly chatClient: Pick<ArkChatClient, 'complete'> = new ArkChatClient()) {
        super()
    }

    protected async doExecute(
        nodeId: string,
        config: LLMNodeConfig,
        context: ExecutionContext,
        logger: ExecutionLogger
    ): Promise<NodeExecutionResult> {
        // 解析配置中的变量
        const resolvedConfig = this.resolveConfigVariables(config, context, logger)

        // 构建消息
        const messages: ArkChatMessage[] = []

        if (resolvedConfig.systemPrompt) {
            messages.push({ role: 'system', content: resolvedConfig.systemPrompt })
        }

        if (resolvedConfig.userPrompt) {
            messages.push({ role: 'user', content: resolvedConfig.userPrompt })
        }

        if (resolvedConfig.assistantPrompt) {
            messages.push({ role: 'assistant', content: resolvedConfig.assistantPrompt })
        }

        // 记录请求
        logger.llmRequest(nodeId, {
            model: resolvedConfig.model,
            messages,
            temperature: resolvedConfig.temperature,
            maxTokens: resolvedConfig.maxTokens,
        })

        const startTime = Date.now()

        const response = await this.chatClient.complete({
            model: resolvedConfig.model,
            temperature: resolvedConfig.temperature ?? 0.7,
            maxTokens: resolvedConfig.maxTokens,
            messages,
        })

        const duration = Date.now() - startTime
        const content = response.content

        const tokens = response.totalTokens ?? this.estimateTokens(content)

        // 记录响应
        logger.llmResponse(nodeId, {
            content,
            tokens,
            duration,
        })

        return {
            success: true,
            outputs: {
                output: content,
                tokens,
            },
            duration,
        }
    }

    private estimateTokens(text: string): number {
        // 简单估算：中文约1.5字符/token，英文约4字符/token
        const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length
        const otherChars = text.length - chineseChars
        return Math.ceil(chineseChars / 1.5 + otherChars / 4)
    }

    override validate(config: LLMNodeConfig): { valid: boolean; errors?: string[] } {
        const errors: string[] = []

        if (!config.model) {
            errors.push('Model is required')
        }

        if (!config.userPrompt && !config.systemPrompt) {
            errors.push('At least one prompt (user or system) is required')
        }

        return {
            valid: errors.length === 0,
            errors: errors.length > 0 ? errors : undefined,
        }
    }

    override getOutputSchema(): OutputVariableSchema[] {
        return [
            { name: 'output', type: 'string', description: 'LLM 生成的文本内容' },
            { name: 'tokens', type: 'number', description: '消耗的 token 数量' },
        ]
    }
}
