'use client'

import '@xyflow/react/dist/style.css'

import { Handle, Position, ReactFlow, MiniMap, Background } from '@xyflow/react'

const StartNode = ({ id, position, data }) => {
    return (
        <div className="bg-green-500 text-white p-2 rounded-md">
            {data.label}
            <Handle type="target" position={Position.Left} />
            <Handle type="source" position={Position.Right} />
        </div>
    )
}

const endNode = ({ id, position, data }) => {
    return (
        <div className="bg-red-500 text-white p-2 rounded-md">
            {data.label}
            <Handle type="target" position={Position.Left} />
            <Handle type="source" position={Position.Right} />
        </div>
    )
}

const nodeTypes = {
    start: StartNode,
    end: endNode,
}

export const Flow = () => {
    return (
        <div className="h-full">
            <ReactFlow
                nodes={[
                    { id: 'n1', type: 'start', position: { x: 0, y: 0 }, data: { label: 'Node 1' } },
                    { id: 'n2', type: 'end', position: { x: 0, y: 100 }, data: { label: 'Node 2' } },
                ]}
                edges={[{ id: 'n1-n2', source: 'n1', target: 'n2' }]}
                nodeTypes={nodeTypes}
            >
                <MiniMap />
                <Background />
            </ReactFlow>
        </div>
    )
}
