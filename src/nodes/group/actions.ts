import { createContext } from "react";

/** Provided by the canvas the group sits on; its card and panel only know the node id. */
export const GroupActionsContext = createContext<{ onOpen: (id: string) => void }>({ onOpen: () => {} });
