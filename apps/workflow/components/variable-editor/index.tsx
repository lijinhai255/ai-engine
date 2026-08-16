'use client'

import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'

import { SlashCommand } from './slash-command'

export const VariableEditor = () => {
    const editor = useEditor({
        extensions: [StarterKit, SlashCommand],
        immediatelyRender: false,
    })
    return (
        <div className="h-full bg-amber-400">
            <EditorContent editor={editor} />
        </div>
    )
}
