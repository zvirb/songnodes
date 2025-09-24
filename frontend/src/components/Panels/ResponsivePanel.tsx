import React, { useEffect, useState, useRef } from 'react';
import { useResponsiveLayout } from '@hooks/useResponsiveLayout';
import { useDrag } from '@use-gesture/react';
import { motion, useSpring, useTransform } from 'framer-motion';

interface ResponsivePanelProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

const DesktopPanel: React.FC<ResponsivePanelProps> = ({ isOpen, onClose, title, children }) => {
  const [width, setWidth] = useState(350);

  const bindResizer = useDrag(({ down, movement: [mx] }) => {
    if (down) {
      const newWidth = width - mx;
      if (newWidth > 280 && newWidth < 800) {
        setWidth(newWidth);
      }
    }
  }, { axis: 'x' });

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      style={{ position: 'fixed', top: 0, right: 0, width: `${width}px`, height: '100%', backgroundColor: '#1e293b', color: 'white', borderLeft: '1px solid #3b82f6', zIndex: 1001, display: 'flex' }}
    >
      <div
        {...bindResizer()}
        style={{
          width: '10px',
          height: '100%',
          cursor: 'ew-resize',
          position: 'absolute',
          left: '-5px',
          top: 0,
        }}
      />
      <div style={{ padding: '1rem', flex: 1, overflowY: 'auto' }}>
        <button onClick={onClose} style={{ float: 'right' }}>X</button>
        <h2 style={{ paddingTop: '2rem', fontWeight: 'bold' }}>{title}</h2>
        <div>{children}</div>
      </div>
    </motion.div>
  );
};

const MobilePanel: React.FC<ResponsivePanelProps> = ({ isOpen, onClose, title, children }) => {
  const { height: windowHeight } = useResponsiveLayout();
  const panelHeight = windowHeight * 0.9; // 90% of screen height

  const y = useSpring(isOpen ? 0 : panelHeight, { stiffness: 400, damping: 40 });

  useEffect(() => {
    y.set(isOpen ? 0 : panelHeight);
  }, [isOpen, y, panelHeight]);

  const bind = useDrag(
    ({ last, movement: [, my], velocity: [, vy], direction: [, dy] }) => {
      if (last) {
        if (my > panelHeight * 0.5 || (vy > 0.5 && dy > 0)) {
          onClose();
        } else {
          y.start(0);
        }
      } else {
        y.start(my, { immediate: true });
      }
    },
    { from: () => [0, y.get()], bounds: { top: 0 }, rubberband: true }
  );

  const bgOpacity = useTransform(y, [0, panelHeight], [0.4, 0]);

  return (
    <>
      <motion.div 
        style={{ position: 'fixed', inset: 0, backgroundColor: 'black', opacity: bgOpacity, zIndex: 1000 }}
        onClick={onClose}
        animate={{ pointerEvents: isOpen ? 'auto' : 'none' }}
      />
      <motion.div
        {...bind()}
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          height: panelHeight,
          backgroundColor: '#1e293b',
          color: 'white',
          borderTopLeftRadius: '1rem',
          borderTopRightRadius: '1rem',
          zIndex: 1001,
          touchAction: 'none',
          y: y,
        }}
      >
        <div style={{ height: '4rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: '3rem', height: '0.25rem', backgroundColor: 'gray', borderRadius: '2px' }} />
        </div>
        <div style={{ padding: '0 1rem 1rem 1rem', height: 'calc(100% - 4rem)', overflowY: 'auto' }}>
          <h2>{title}</h2>
          <div>{children}</div>
        </div>
      </motion.div>
    </>
  );
};

export const ResponsivePanel: React.FC<ResponsivePanelProps> = (props) => {
  const { isMobile } = useResponsiveLayout();

  if (isMobile) {
    return <MobilePanel {...props} />;
  }

  return <DesktopPanel {...props} />;
};
