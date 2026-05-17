import { createContext } from 'react';
export const GraphCtx = createContext({ connectedNodeIds: new Set(), hasSelection: false });
