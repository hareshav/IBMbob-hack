import { createContext } from 'react';

/**
 * Selection + Bob-mode context broadcast to every node and edge.
 *
 *   selectedNodeId         : id of the currently selected node (click)
 *   connectedNodeIds       : 1-hop neighbours of the selected node
 *   hasSelection           : convenience flag (selectedNodeId !== null)
 *
 *   hoveredNodeId          : id of the currently hovered node (only meaningful when bobModeActive)
 *   hoverConnectedNodeIds  : 1-hop neighbours of the hovered node
 *
 *   bobModeActive          : true after the user clicks "Ask Bob AI". Enables
 *                            the MIRE-style hover glow (calm blue pulse on the
 *                            hovered node + its neighbourhood, with everything
 *                            else dimmed) and the Simulate Change action.
 *
 * FlowEdge and ApiNode read this to decide their visual state per-render.
 */
export const GraphCtx = createContext({
  selectedNodeId: null,
  connectedNodeIds: new Set(),
  hasSelection: false,
  hoveredNodeId: null,
  hoverConnectedNodeIds: new Set(),
  bobModeActive: false,
});
