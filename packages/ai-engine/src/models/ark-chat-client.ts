import OpenAI from 'openai'

export interface ArkChatMessage {
    role: 'system' | 'user' | 'assistant'
    content: string
}

export interface ArkChatCompletionOptions {
    model: string
    messages: ArkChatMessage[]
    temperature?: number
    maxTokens?: number
}

export interface ArkChatCompletionResult {
    content: string
    totalTokens?: number
}

export interface ArkChatClientConfig {
    apiKey?: string
    baseURL?: string
}

export class ArkChatClient {
    constructor(private readonly config: ArkChatClientConfig = {}) {}

    async complete(options: ArkChatCompletionOptions): Promise<ArkChatCompletionResult> {
        const apiKey = this.config.apiKey ?? process.env.ARK_API_KEY
        if (!apiKey) {
            throw new Error('ARK_API_KEY is required')
        }

        const client = new OpenAI({
            apiKey,
            baseURL: this.config.baseURL ?? process.env.ARK_BASE_URL ?? 'https://ark.cn-beijing.volces.com/api/v3',
        })
        const completion = await client.chat.completions.create({
            model: options.model,
            messages: options.messages,
            temperature: options.temperature,
            max_tokens: options.maxTokens,
        })

        return {
            content: completion.choices[0]?.message.content ?? '',
            totalTokens: completion.usage?.total_tokens,
        }
    }
}
