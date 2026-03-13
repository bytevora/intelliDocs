"use client";

import { useState, useCallback } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Collaboration from "@tiptap/extension-collaboration";
import CollaborationCursor from "@tiptap/extension-collaboration-cursor";
import { VisualBlock } from "./extensions/visual-block";
import { CollaborationHistory } from "./extensions/collaboration-history";
import { VisualSuggestions } from "./visual-suggestions";
import { GenerateVisualMenu } from "./generate-visual-menu";
import { CategoriesPanel } from "@/components/visuals/categories-panel";
import { Toolbar } from "./toolbar";
import { Skeleton } from "@/components/ui/skeleton";
import * as Y from "yjs";
import { SocketIOProvider } from "@/lib/collaboration/socket-io-provider";

interface TiptapEditorBaseProps {
  editable?: boolean;
  showCategoriesPanel?: boolean;
  onCloseCategoriesPanel?: () => void;
}

interface StandaloneProps extends TiptapEditorBaseProps {
  content: object;
  onUpdate: (json: object) => void;
  ydoc?: undefined;
  provider?: undefined;
}

interface CollaborativeProps extends TiptapEditorBaseProps {
  ydoc: Y.Doc;
  provider: SocketIOProvider;
  content?: undefined;
  onUpdate?: undefined;
}

type TiptapEditorProps = StandaloneProps | CollaborativeProps;

export function TiptapEditor(props: TiptapEditorProps) {
  const { editable = true, showCategoriesPanel = false, onCloseCategoriesPanel } = props;
  const [localPanelOpen, setLocalPanelOpen] = useState(false);
  const panelOpen = showCategoriesPanel || localPanelOpen;

  const handleOpenPanel = useCallback(() => setLocalPanelOpen(true), []);
  const handleClosePanel = useCallback(() => {
    setLocalPanelOpen(false);
    onCloseCategoriesPanel?.();
  }, [onCloseCategoriesPanel]);
  const isCollaborative = !!props.ydoc && !!props.provider;

  const extensions = isCollaborative
    ? [
        StarterKit.configure({ undoRedo: false }),
        Placeholder.configure({ placeholder: "Start writing..." }),
        VisualBlock,
        Collaboration.configure({
          document: props.ydoc!,
          field: "default",
        }),
        CollaborationCursor.configure({
          provider: props.provider!,
          user: props.provider!.awareness.getLocalState()?.user ?? {
            name: "Anonymous",
            color: "#958DF1",
          },
        }),
        CollaborationHistory,
      ]
    : [
        StarterKit,
        Placeholder.configure({ placeholder: "Start writing..." }),
        VisualBlock,
      ];

  const editor = useEditor(
    {
      immediatelyRender: false,
      editable,
      extensions,
      ...(isCollaborative
        ? {}
        : {
            content: props.content,
            onUpdate: ({ editor }) => {
              props.onUpdate?.(editor.getJSON());
            },
          }),
      editorProps: {
        attributes: {
          class: "max-w-none focus:outline-none min-h-[500px] notranslate",
          translate: "no",
        },
      },
    },
    isCollaborative ? [props.provider] : undefined
  );

  if (!editor) {
    return (
      <div className="space-y-4 py-4">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-2/3" />
      </div>
    );
  }

  return (
    <div className="relative">
      {editable && (
        <BubbleMenu
          editor={editor}
          className="shadow-xl rounded-lg border bg-background overflow-hidden flex items-center"
          shouldShow={({ editor: e }) => {
            // Hide bubble menu when selection is inside a visual block
            if (e.isActive("visualBlock")) return false;
            // Only show when there's a text selection
            const { from, to } = e.state.selection;
            return from !== to;
          }}
        >
          <Toolbar editor={editor} />
        </BubbleMenu>
      )}
      <div className="px-1 relative">
        <EditorContent editor={editor} />
        {editable && <GenerateVisualMenu editor={editor} onOpenPanel={handleOpenPanel} />}
        {editable && <VisualSuggestions editor={editor} />}
      </div>
      {editable && (
        <CategoriesPanel
          editor={editor}
          open={panelOpen}
          onClose={handleClosePanel}
        />
      )}
    </div>
  );
}
