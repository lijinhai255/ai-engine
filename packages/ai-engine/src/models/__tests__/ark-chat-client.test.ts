import { afterEach, describe, expect, it, vi } from 'vitest'

import { ArkChatClient } from '../ark-chat-client'

// cspell:ignore unstub
describe('ArkChatClient', () => {
    afterEach(() => {
        vi.unstubAllEnvs()
    })

    it('constructs without credentials and reports missing credentials on request', async () => {
        vi.stubEnv('ARK_API_KEY', '')
        const client = new ArkChatClient()

        await expect(
            client.complete({
                model: 'glm-test',
                messages: [{ role: 'user', content: 'hello' }],
            })
        ).rejects.toThrow('ARK_API_KEY is required')
    })
})
