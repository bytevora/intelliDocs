import { Extension } from "@tiptap/react";
import { yUndoPlugin, undoCommand, redoCommand } from "y-prosemirror";

/**
 * Adds Yjs-based undo/redo for collaborative editing.
 * Replaces the built-in ProseMirror history when using Yjs collaboration,
 * so that undo/redo respects per-user changes rather than the global document history.
 */
export const CollaborationHistory = Extension.create({
  name: "collaborationHistory",

  addProseMirrorPlugins() {
    return [yUndoPlugin()];
  },

  addKeyboardShortcuts() {
    return {
      "Mod-z": () =>
        undoCommand(this.editor.view.state, this.editor.view.dispatch),
      "Mod-Shift-z": () =>
        redoCommand(this.editor.view.state, this.editor.view.dispatch),
      "Mod-y": () =>
        redoCommand(this.editor.view.state, this.editor.view.dispatch),
    };
  },
});
