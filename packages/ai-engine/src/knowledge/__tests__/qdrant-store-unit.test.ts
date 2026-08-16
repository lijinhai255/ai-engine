import { describe, expect, it, vi } from 'vitest'

import { QdrantVectorStore } from '../store/qdrant-store'

// cspell:ignore Qdrant qdrant
describe('QdrantVectorStore query API', () => {
    it('queries vectors with the current SDK and maps returned points', async () => {
        const query = vi.fn().mockResolvedValue({
            points: [
                {
                    id: 'point-1',
                    score: 0.91,
                    payload: {
                        chunkId: 'chunk-1',
                        content: 'matched content',
                        chunkIndex: 2,
                        documentId: 'doc-1',
                        knowledgeBaseId: 'kb-1',
                        metadata: { source: 'test' },
                    },
                },
            ],
        })
        const store = Object.create(QdrantVectorStore.prototype) as QdrantVectorStore
        const internals = store as unknown as { client: { query: typeof query }; collectionName: string }
        internals.client = { query }
        internals.collectionName = 'chunks'

        const results = await store.search({
            vector: [0.1, 0.2],
            knowledgeBaseIds: ['kb-1'],
            topK: 3,
            threshold: 0.5,
        })

        expect(query).toHaveBeenCalledWith('chunks', {
            query: [0.1, 0.2],
            limit: 3,
            score_threshold: 0.5,
            filter: {
                must: [{ key: 'knowledgeBaseId', match: { any: ['kb-1'] } }],
            },
            with_payload: true,
            with_vector: false,
        })
        expect(results).toEqual([
            {
                chunkId: 'chunk-1',
                content: 'matched content',
                chunkIndex: 2,
                documentId: 'doc-1',
                knowledgeBaseId: 'kb-1',
                score: 0.91,
                metadata: { source: 'test' },
            },
        ])
    })
})
