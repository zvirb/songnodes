
import React from 'react';
import { useAppSelector } from '../../store/index';

const ScreenReaderOptimization: React.FC = () => {
  const { nodes, edges } = useAppSelector(state => state.graph);

  return (
    <div className="sr-only">
      <h2>Graph Content</h2>
      <h3>Nodes</h3>
      <ul>
        {nodes.map(node => (
          <li key={node.id}>{node.title || node.id}</li>
        ))}
      </ul>
      <h3>Edges</h3>
      <ul>
        {edges.map(edge => (
          <li key={edge.id}>{`From ${edge.source} to ${edge.target}`}</li>
        ))}
      </ul>
    </div>
  );
};

export default ScreenReaderOptimization;
