import { MindmapNode } from "@/types";

export interface MindmapTemplate {
  id: string;
  name: string;
  description: string;
  structure: MindmapNode;
}

export const HORIZONTAL_MINDMAP_TEMPLATES: MindmapTemplate[] = [
  {
    id: "classic-tree",
    name: "Classic Tree",
    description: "Root on left, branches spreading right in a standard tree",
    structure: {
      label: "Topic",
      children: [
        {
          label: "Branch 1",
          children: [
            { label: "Sub-topic A" },
            { label: "Sub-topic B" },
          ],
        },
        {
          label: "Branch 2",
          children: [
            { label: "Sub-topic C" },
            { label: "Sub-topic D" },
          ],
        },
        {
          label: "Branch 3",
          children: [
            { label: "Sub-topic E" },
            { label: "Sub-topic F" },
          ],
        },
      ],
    },
  },
  {
    id: "wide-spread",
    name: "Wide Spread",
    description: "Root centered-left, many short branches fanning out",
    structure: {
      label: "Topic",
      children: [
        { label: "Branch 1", children: [{ label: "Detail" }] },
        { label: "Branch 2", children: [{ label: "Detail" }] },
        { label: "Branch 3", children: [{ label: "Detail" }] },
        { label: "Branch 4", children: [{ label: "Detail" }] },
        { label: "Branch 5", children: [{ label: "Detail" }] },
        { label: "Branch 6", children: [{ label: "Detail" }] },
      ],
    },
  },
  {
    id: "deep-hierarchy",
    name: "Deep Hierarchy",
    description: "Fewer branches but deeper nesting (3-4 levels)",
    structure: {
      label: "Topic",
      children: [
        {
          label: "Branch 1",
          children: [
            {
              label: "Level 2",
              children: [
                { label: "Level 3a" },
                { label: "Level 3b" },
              ],
            },
          ],
        },
        {
          label: "Branch 2",
          children: [
            {
              label: "Level 2",
              children: [
                {
                  label: "Level 3",
                  children: [{ label: "Level 4" }],
                },
              ],
            },
          ],
        },
      ],
    },
  },
  {
    id: "balanced",
    name: "Balanced",
    description: "Symmetrical branch distribution",
    structure: {
      label: "Topic",
      children: [
        {
          label: "Branch 1",
          children: [
            { label: "Item A" },
            { label: "Item B" },
            { label: "Item C" },
          ],
        },
        {
          label: "Branch 2",
          children: [
            { label: "Item D" },
            { label: "Item E" },
            { label: "Item F" },
          ],
        },
        {
          label: "Branch 3",
          children: [
            { label: "Item G" },
            { label: "Item H" },
            { label: "Item I" },
          ],
        },
      ],
    },
  },
  {
    id: "compact",
    name: "Compact",
    description: "Tightly packed nodes, minimal spacing",
    structure: {
      label: "Topic",
      children: [
        {
          label: "A",
          children: [{ label: "A1" }, { label: "A2" }],
        },
        {
          label: "B",
          children: [{ label: "B1" }, { label: "B2" }],
        },
        {
          label: "C",
          children: [{ label: "C1" }],
        },
        {
          label: "D",
          children: [{ label: "D1" }],
        },
      ],
    },
  },
  {
    id: "flowing",
    name: "Flowing",
    description: "Organic layout with fewer nodes and more spacing",
    structure: {
      label: "Topic",
      children: [
        {
          label: "Theme 1",
          children: [{ label: "Idea A" }],
        },
        {
          label: "Theme 2",
          children: [
            { label: "Idea B" },
            { label: "Idea C" },
          ],
        },
        {
          label: "Theme 3",
          children: [{ label: "Idea D" }],
        },
      ],
    },
  },
];

export const RIGHT_MINDMAP_TEMPLATES: MindmapTemplate[] = [
  {
    id: "r-classic-tree",
    name: "Classic Tree",
    description: "Root on left, branches spreading right in a standard tree",
    structure: {
      label: "Topic",
      children: [
        {
          label: "Branch 1",
          children: [
            { label: "Sub-topic A" },
            { label: "Sub-topic B" },
          ],
        },
        {
          label: "Branch 2",
          children: [
            { label: "Sub-topic C" },
            { label: "Sub-topic D" },
          ],
        },
        {
          label: "Branch 3",
          children: [
            { label: "Sub-topic E" },
            { label: "Sub-topic F" },
          ],
        },
      ],
    },
  },
  {
    id: "r-wide-spread",
    name: "Wide Spread",
    description: "Root on left, many short branches fanning right",
    structure: {
      label: "Topic",
      children: [
        { label: "Branch 1", children: [{ label: "Detail" }] },
        { label: "Branch 2", children: [{ label: "Detail" }] },
        { label: "Branch 3", children: [{ label: "Detail" }] },
        { label: "Branch 4", children: [{ label: "Detail" }] },
        { label: "Branch 5", children: [{ label: "Detail" }] },
        { label: "Branch 6", children: [{ label: "Detail" }] },
      ],
    },
  },
  {
    id: "r-deep-hierarchy",
    name: "Deep Hierarchy",
    description: "Fewer branches but deeper nesting (3-4 levels) going right",
    structure: {
      label: "Topic",
      children: [
        {
          label: "Branch 1",
          children: [
            {
              label: "Level 2",
              children: [
                { label: "Level 3a" },
                { label: "Level 3b" },
              ],
            },
          ],
        },
        {
          label: "Branch 2",
          children: [
            {
              label: "Level 2",
              children: [
                {
                  label: "Level 3",
                  children: [{ label: "Level 4" }],
                },
              ],
            },
          ],
        },
      ],
    },
  },
  {
    id: "r-balanced",
    name: "Balanced",
    description: "Symmetrical branch distribution going right",
    structure: {
      label: "Topic",
      children: [
        {
          label: "Branch 1",
          children: [
            { label: "Item A" },
            { label: "Item B" },
            { label: "Item C" },
          ],
        },
        {
          label: "Branch 2",
          children: [
            { label: "Item D" },
            { label: "Item E" },
            { label: "Item F" },
          ],
        },
        {
          label: "Branch 3",
          children: [
            { label: "Item G" },
            { label: "Item H" },
            { label: "Item I" },
          ],
        },
      ],
    },
  },
  {
    id: "r-compact",
    name: "Compact",
    description: "Tightly packed nodes going right, minimal spacing",
    structure: {
      label: "Topic",
      children: [
        {
          label: "A",
          children: [{ label: "A1" }, { label: "A2" }],
        },
        {
          label: "B",
          children: [{ label: "B1" }, { label: "B2" }],
        },
        {
          label: "C",
          children: [{ label: "C1" }],
        },
        {
          label: "D",
          children: [{ label: "D1" }],
        },
      ],
    },
  },
  {
    id: "r-flowing",
    name: "Flowing",
    description: "Organic layout flowing right with fewer nodes and more spacing",
    structure: {
      label: "Topic",
      children: [
        {
          label: "Theme 1",
          children: [{ label: "Idea A" }],
        },
        {
          label: "Theme 2",
          children: [
            { label: "Idea B" },
            { label: "Idea C" },
          ],
        },
        {
          label: "Theme 3",
          children: [{ label: "Idea D" }],
        },
      ],
    },
  },
];

export const LEFT_MINDMAP_TEMPLATES: MindmapTemplate[] = [
  {
    id: "l-classic-tree",
    name: "Classic Tree",
    description: "Root on right, branches spreading left in a standard tree",
    structure: {
      label: "Topic",
      children: [
        {
          label: "Branch 1",
          children: [
            { label: "Sub-topic A" },
            { label: "Sub-topic B" },
          ],
        },
        {
          label: "Branch 2",
          children: [
            { label: "Sub-topic C" },
            { label: "Sub-topic D" },
          ],
        },
        {
          label: "Branch 3",
          children: [
            { label: "Sub-topic E" },
            { label: "Sub-topic F" },
          ],
        },
      ],
    },
  },
  {
    id: "l-wide-spread",
    name: "Wide Spread",
    description: "Root on right, many short branches fanning left",
    structure: {
      label: "Topic",
      children: [
        { label: "Branch 1", children: [{ label: "Detail" }] },
        { label: "Branch 2", children: [{ label: "Detail" }] },
        { label: "Branch 3", children: [{ label: "Detail" }] },
        { label: "Branch 4", children: [{ label: "Detail" }] },
        { label: "Branch 5", children: [{ label: "Detail" }] },
        { label: "Branch 6", children: [{ label: "Detail" }] },
      ],
    },
  },
  {
    id: "l-deep-hierarchy",
    name: "Deep Hierarchy",
    description: "Fewer branches but deeper nesting (3-4 levels) going left",
    structure: {
      label: "Topic",
      children: [
        {
          label: "Branch 1",
          children: [
            {
              label: "Level 2",
              children: [
                { label: "Level 3a" },
                { label: "Level 3b" },
              ],
            },
          ],
        },
        {
          label: "Branch 2",
          children: [
            {
              label: "Level 2",
              children: [
                {
                  label: "Level 3",
                  children: [{ label: "Level 4" }],
                },
              ],
            },
          ],
        },
      ],
    },
  },
  {
    id: "l-balanced",
    name: "Balanced",
    description: "Symmetrical branch distribution going left",
    structure: {
      label: "Topic",
      children: [
        {
          label: "Branch 1",
          children: [
            { label: "Item A" },
            { label: "Item B" },
            { label: "Item C" },
          ],
        },
        {
          label: "Branch 2",
          children: [
            { label: "Item D" },
            { label: "Item E" },
            { label: "Item F" },
          ],
        },
        {
          label: "Branch 3",
          children: [
            { label: "Item G" },
            { label: "Item H" },
            { label: "Item I" },
          ],
        },
      ],
    },
  },
  {
    id: "l-compact",
    name: "Compact",
    description: "Tightly packed nodes going left, minimal spacing",
    structure: {
      label: "Topic",
      children: [
        {
          label: "A",
          children: [{ label: "A1" }, { label: "A2" }],
        },
        {
          label: "B",
          children: [{ label: "B1" }, { label: "B2" }],
        },
        {
          label: "C",
          children: [{ label: "C1" }],
        },
        {
          label: "D",
          children: [{ label: "D1" }],
        },
      ],
    },
  },
  {
    id: "l-flowing",
    name: "Flowing",
    description: "Organic layout flowing left with fewer nodes and more spacing",
    structure: {
      label: "Topic",
      children: [
        {
          label: "Theme 1",
          children: [{ label: "Idea A" }],
        },
        {
          label: "Theme 2",
          children: [
            { label: "Idea B" },
            { label: "Idea C" },
          ],
        },
        {
          label: "Theme 3",
          children: [{ label: "Idea D" }],
        },
      ],
    },
  },
];

export const VERTICAL_MINDMAP_TEMPLATES: MindmapTemplate[] = [
  {
    id: "v-classic-tree",
    name: "Classic Tree",
    description: "Root at center, branches spreading up and down in a standard tree",
    structure: {
      label: "Topic",
      children: [
        {
          label: "Branch 1",
          children: [
            { label: "Sub-topic A" },
            { label: "Sub-topic B" },
          ],
        },
        {
          label: "Branch 2",
          children: [
            { label: "Sub-topic C" },
            { label: "Sub-topic D" },
          ],
        },
        {
          label: "Branch 3",
          children: [
            { label: "Sub-topic E" },
            { label: "Sub-topic F" },
          ],
        },
      ],
    },
  },
  {
    id: "v-wide-spread",
    name: "Wide Spread",
    description: "Root centered, many short branches fanning up and down",
    structure: {
      label: "Topic",
      children: [
        { label: "Branch 1", children: [{ label: "Detail" }] },
        { label: "Branch 2", children: [{ label: "Detail" }] },
        { label: "Branch 3", children: [{ label: "Detail" }] },
        { label: "Branch 4", children: [{ label: "Detail" }] },
        { label: "Branch 5", children: [{ label: "Detail" }] },
        { label: "Branch 6", children: [{ label: "Detail" }] },
      ],
    },
  },
  {
    id: "v-deep-hierarchy",
    name: "Deep Hierarchy",
    description: "Fewer branches but deeper nesting (3-4 levels)",
    structure: {
      label: "Topic",
      children: [
        {
          label: "Branch 1",
          children: [
            {
              label: "Level 2",
              children: [
                { label: "Level 3a" },
                { label: "Level 3b" },
              ],
            },
          ],
        },
        {
          label: "Branch 2",
          children: [
            {
              label: "Level 2",
              children: [
                {
                  label: "Level 3",
                  children: [{ label: "Level 4" }],
                },
              ],
            },
          ],
        },
      ],
    },
  },
  {
    id: "v-balanced",
    name: "Balanced",
    description: "Symmetrical branch distribution up and down",
    structure: {
      label: "Topic",
      children: [
        {
          label: "Branch 1",
          children: [
            { label: "Item A" },
            { label: "Item B" },
            { label: "Item C" },
          ],
        },
        {
          label: "Branch 2",
          children: [
            { label: "Item D" },
            { label: "Item E" },
            { label: "Item F" },
          ],
        },
        {
          label: "Branch 3",
          children: [
            { label: "Item G" },
            { label: "Item H" },
            { label: "Item I" },
          ],
        },
      ],
    },
  },
  {
    id: "v-compact",
    name: "Compact",
    description: "Tightly packed nodes, minimal spacing",
    structure: {
      label: "Topic",
      children: [
        {
          label: "A",
          children: [{ label: "A1" }, { label: "A2" }],
        },
        {
          label: "B",
          children: [{ label: "B1" }, { label: "B2" }],
        },
        {
          label: "C",
          children: [{ label: "C1" }],
        },
        {
          label: "D",
          children: [{ label: "D1" }],
        },
      ],
    },
  },
  {
    id: "v-flowing",
    name: "Flowing",
    description: "Organic layout with fewer nodes and more spacing",
    structure: {
      label: "Topic",
      children: [
        {
          label: "Theme 1",
          children: [{ label: "Idea A" }],
        },
        {
          label: "Theme 2",
          children: [
            { label: "Idea B" },
            { label: "Idea C" },
          ],
        },
        {
          label: "Theme 3",
          children: [{ label: "Idea D" }],
        },
      ],
    },
  },
];
