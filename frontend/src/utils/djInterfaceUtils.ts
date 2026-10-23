/**
 * @file DJ Interface Utilities
 * @description Contains helper functions and constants for the main DJInterface component.
 */

import { GraphNode, Track } from '../types';

export { trackFromNode as transformNodeToTrack } from './trackMetadata';

/**
 * Validates if a graph node contains the minimum required data to be considered a track.
 * @param {GraphNode} node - The node to validate.
 * @returns {boolean} True if the node is a valid track node, false otherwise.
 */
export const isValidTrackNode = (node: GraphNode): boolean => {
  const hasTitle = node.title || node.metadata?.title || node.metadata?.label;
  const hasArtist = node.artist || node.metadata?.artist;
  return Boolean(hasTitle && hasArtist);
};