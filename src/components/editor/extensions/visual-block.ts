import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { VisualBlockView } from "./visual-block-view";

export const VisualBlock = Node.create({
  name: "visualBlock",
  group: "block",
  atom: true,
  draggable: false,

  addAttributes() {
    return {
      visualId: {
        default: null,
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-visual-block]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes({ "data-visual-block": "" }, HTMLAttributes)];
  },

  addNodeView() {
    return ReactNodeViewRenderer(VisualBlockView, {
      // Prevent ProseMirror from intercepting pointer/mouse/drag/wheel events
      // inside the visual block. This allows our custom drag, pan, and zoom
      // handlers to work without ProseMirror stealing events.
      stopEvent: ({ event }) => {
        const type = event.type;
        // When a contentEditable element inside the visual has focus,
        // stop keyboard events from reaching ProseMirror — otherwise
        // ProseMirror replaces the atom node with the typed character.
        if (type.startsWith("key")) {
          const target = event.target as Element | null;
          if (target?.closest?.("[contenteditable]") || target?.tagName === "INPUT" || target?.tagName === "TEXTAREA") return true;
          return false;
        }
        // Stop all pointer, mouse, touch, drag, and wheel events from reaching ProseMirror
        if (
          type.startsWith("pointer") ||
          type.startsWith("mouse") ||
          type.startsWith("touch") ||
          type.startsWith("drag") ||
          type === "wheel" ||
          type === "drop" ||
          type === "selectstart"
        ) {
          return true;
        }
        return false;
      },
    });
  },
});
