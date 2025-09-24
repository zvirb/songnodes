
import React from 'react';
import { Menu, MenuItem } from '@mui/material';

interface ContextMenuProps {
  x: number;
  y: number;
  isOpen: boolean;
  onClose: () => void;
  items: {
    label: string;
    action: () => void;
  }[];
}

const ContextMenu: React.FC<ContextMenuProps> = ({ x, y, isOpen, onClose, items }) => {
  return (
    <Menu
      open={isOpen}
      onClose={onClose}
      anchorReference="anchorPosition"
      anchorPosition={{ top: y, left: x }}
    >
      {items.map((item, index) => (
        <MenuItem key={index} onClick={item.action}>
          {item.label}
        </MenuItem>
      ))}
    </Menu>
  );
};

export default ContextMenu;
