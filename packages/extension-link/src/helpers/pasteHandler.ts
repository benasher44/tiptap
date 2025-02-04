import { Editor } from '@tiptap/core'
import { Mark, MarkType } from '@tiptap/pm/model'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { find } from 'linkifyjs'

type PasteHandlerOptions = {
  editor: Editor
  type: MarkType
  linkOnPaste?: boolean
}

export function pasteHandler(options: PasteHandlerOptions): Plugin {
  return new Plugin({
    key: new PluginKey('handlePasteLink'),
    props: {
      handlePaste: (view, event, slice) => {
        const { state } = view
        const { selection } = state

        const pastedLinkMarks: Mark[] = []

        slice.content.forEach(node => {
          node.marks.forEach(mark => {
            if (mark.type.name === options.type.name) {
              pastedLinkMarks.push(mark)
            }
          })
        })

        const hasPastedLink = pastedLinkMarks.length > 0

        let textContent = ''

        slice.content.forEach(node => {
          textContent += node.textContent
        })

        const link = find(textContent).find(item => item.isLink && item.value === textContent)

        if (!selection.empty && options.linkOnPaste) {
          const pastedLink = hasPastedLink ? pastedLinkMarks[0].attrs.href : link?.href || null

          if (pastedLink) {
            options.editor.commands.setMark(options.type, {
              href: pastedLink,
            })
            return true
          }
        }

        if (slice.content.firstChild?.type.name === 'text' && slice.content.firstChild?.marks.some(mark => mark.type.name === options.type.name)) {
          return false
        }

        if (link && selection.empty) {
          options.editor.commands.insertContent(`<a href="${link.href}">${link.href}</a>`)
          return true
        }

        const { tr } = state
        let deleteOnly = false

        if (!selection.empty) {
          deleteOnly = true
          tr.delete(selection.from, selection.to)
        }

        let currentPos = selection.from

        slice.content.forEach(node => {
          const fragmentLinks = find(node.textContent)

          tr.insert(currentPos - 1, node)

          if (fragmentLinks.length > 0) {
            deleteOnly = false

            fragmentLinks.forEach(fragmentLink => {
              const linkStart = currentPos + fragmentLink.start
              const linkEnd = currentPos + fragmentLink.end

              const hasMark = tr.doc.rangeHasMark(linkStart, linkEnd, options.type)

              if (!hasMark) {
                tr.addMark(linkStart, linkEnd, options.type.create({ href: fragmentLink.href }))
              }
            })

          }
          currentPos += node.nodeSize
        })

        if (tr.docChanged && !deleteOnly) {
          options.editor.view.dispatch(tr)
          return true
        }

        return false
      },
    },
  })
}
