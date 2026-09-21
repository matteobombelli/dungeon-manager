import { createContext, memo, useContext } from "react";
import type { NodeProps } from "@xyflow/react";
import { ExternalLink, Trash2 } from "lucide-react";
import type { NodeOutline } from "../../shared/graph";
import { BaseCard } from "../nodes/BaseCard";
import { NodePreview } from "../nodes/NodePreview";
import { IconButton } from "../components/IconButton";
import type { SceneNode } from "./CampaignGraph";

// Callbacks live in context rather than node data so the nodes stay serialisable for autosave.
export interface SceneActions {
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
}

export const SceneActionsContext = createContext<SceneActions>({ onOpen: () => {}, onDelete: () => {} });

/** Each scene's node outlines by scene id; a scene without an entry is empty. */
export const ScenePreviewsContext = createContext<Record<string, NodeOutline[]>>({});

const NONE: NodeOutline[] = [];

// Memoised so a drag or rename of one scene does not re-render every other card.
export const SceneNodeCard = memo(function SceneNodeCard({ id, data, selected }: NodeProps<SceneNode>) {
  const { onOpen, onDelete } = useContext(SceneActionsContext);
  const nodes = useContext(ScenePreviewsContext)[id] ?? NONE;
  return (
    <BaseCard
      title={data.name}
      shape="frame"
      tone="scene"
      selected={selected}
      connectable
      actions={
        <>
          <IconButton
            icon={ExternalLink}
            label="Open"
            onClick={(e) => {
              e.stopPropagation();
              onOpen(id);
            }}
          />
          <IconButton
            icon={Trash2}
            label="Delete"
            danger
            onClick={(e) => {
              e.stopPropagation();
              onDelete(id);
            }}
          />
        </>
      }
    >
      <NodePreview nodes={nodes} />
    </BaseCard>
  );
});
