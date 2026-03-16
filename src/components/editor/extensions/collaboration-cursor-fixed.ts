import { Extension } from "@tiptap/react";
import { yCursorPlugin, defaultSelectionBuilder } from "@tiptap/y-tiptap";

/**
 * Custom CollaborationCursor extension that uses @tiptap/y-tiptap instead of
 * y-prosemirror, so it shares the same ySyncPluginKey as @tiptap/extension-collaboration.
 */
export const CollaborationCursorFixed = Extension.create<{
  provider: any;
  user: Record<string, any>;
  render: (user: Record<string, any>) => HTMLElement;
}>({
  name: "collaborationCursor",

  addOptions() {
    return {
      provider: null,
      user: { name: null, color: null },
      render: (user: Record<string, any>) => {
        const cursor = document.createElement("span");
        cursor.classList.add("collaboration-cursor__caret");
        cursor.setAttribute("style", `border-color: ${user.color}`);

        const label = document.createElement("div");
        label.classList.add("collaboration-cursor__label");
        label.setAttribute("style", `background-color: ${user.color}`);
        label.insertBefore(document.createTextNode(user.name), null);
        cursor.insertBefore(label, null);

        return cursor;
      },
    };
  },

  addProseMirrorPlugins() {
    const { provider, user, render } = this.options;

    provider.awareness.setLocalStateField("user", user);

    return [
      yCursorPlugin(provider.awareness, {
        cursorBuilder: render,
        selectionBuilder: defaultSelectionBuilder,
      }),
    ];
  },
});
