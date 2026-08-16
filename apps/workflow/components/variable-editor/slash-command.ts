import { Extension } from '@tiptap/core'
import Suggestion, { SuggestionOptions } from '@tiptap/suggestion'

export interface SlashCommandItem {
    type: 'node' | 'variable'
}

export interface SlashCommandOptions {
    suggestion: Omit<SuggestionOptions<SlashCommandItem>, 'editor'>
}

export const SlashCommand = Extension.create<SlashCommandOptions>({
    name: 'slashCommand',

    addOptions() {
        return {
            suggestion: {
                char: '/',
                command: ({ editor, range, props }) => {
                    console.log('🚀 ~ editor, range, props:', editor, range, props)
                    editor.commands.insertContentAt(range, props.item.type)
                },
            },
        }
    },

    // pm
    addProseMirrorPlugins() {
        return [
            Suggestion({
                editor: this.editor,
                ...this.options.suggestion,
                items: this.options.suggestion.items,
                render: () => {
                    return {
                        onStart: ({ editor, range }) => {
                            console.log('🚀 ~ editor, range:', editor, range)
                        },
                        onEnd: ({ editor, range }) => {
                            console.log('🚀 ~ editor, range:', editor, range)
                        },
                    }
                },
            }),
        ]
    },
})
