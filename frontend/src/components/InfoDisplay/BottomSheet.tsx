import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
  snapPoints?: number[]; // Percentages of screen height
  initialSnap?: number; // Index of snapPoints
  allowSwipeDown?: boolean;
  showHandle?: boolean;
  backdrop?: boolean;
}

export const BottomSheet: React.FC<BottomSheetProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  className = '',
  snapPoints = [25, 50, 85],
  initialSnap = 1,
  allowSwipeDown = true,
  showHandle = true,
  backdrop = true
}) => {
  const sheetRef = useRef<HTMLDivElement>(null);
  const [currentSnap, setCurrentSnap] = useState(initialSnap);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartY, setDragStartY] = useState(0);
  const [sheetStartY, setSheetStartY] = useState(0);
  const [velocity, setVelocity] = useState(0);
  const lastMoveTime = useRef(0);
  const lastMoveY = useRef(0);

  const currentHeight = snapPoints[currentSnap];

  // Handle touch/mouse events for dragging
  const handleStart = (clientY: number) => {
    if (!allowSwipeDown) return;

    setIsDragging(true);
    setDragStartY(clientY);
    setSheetStartY(window.innerHeight * (1 - currentHeight / 100));
    lastMoveTime.current = Date.now();
    lastMoveY.current = clientY;
    setVelocity(0);
  };

  const handleMove = (clientY: number) => {
    if (!isDragging || !allowSwipeDown) return;

    const deltaY = clientY - dragStartY;
    const newY = Math.max(0, sheetStartY + deltaY);
    const maxY = window.innerHeight * 0.9; // Don't allow dragging below 10% of screen

    // Calculate velocity for momentum-based snapping
    const now = Date.now();
    const timeDelta = now - lastMoveTime.current;
    if (timeDelta > 0) {
      const newVelocity = (clientY - lastMoveY.current) / timeDelta;
      setVelocity(newVelocity);
    }
    lastMoveTime.current = now;
    lastMoveY.current = clientY;

    if (sheetRef.current) {
      const constrainedY = Math.min(newY, maxY);
      sheetRef.current.style.transform = `translateY(${constrainedY}px)`;
    }
  };

  const handleEnd = (clientY: number) => {
    if (!isDragging || !allowSwipeDown) return;

    setIsDragging(false);

    const deltaY = clientY - dragStartY;
    const currentSheetY = sheetStartY + deltaY;
    const screenHeight = window.innerHeight;

    // Determine the closest snap point considering velocity
    let targetSnapIndex = currentSnap;

    // If dragging down with sufficient velocity or distance, close or snap to next point
    if (velocity > 0.5 || deltaY > screenHeight * 0.1) {
      if (currentSnap === 0) {
        // Close if dragging down from smallest snap point
        onClose();
        return;
      } else {
        targetSnapIndex = Math.max(0, currentSnap - 1);
      }
    }
    // If dragging up with sufficient velocity or distance, snap to next point
    else if (velocity < -0.5 || deltaY < -screenHeight * 0.1) {
      targetSnapIndex = Math.min(snapPoints.length - 1, currentSnap + 1);
    }
    // Otherwise, find the closest snap point
    else {
      const currentPercentage = ((screenHeight - currentSheetY) / screenHeight) * 100;
      let minDistance = Infinity;

      snapPoints.forEach((snapPoint, index) => {
        const distance = Math.abs(snapPoint - currentPercentage);
        if (distance < minDistance) {
          minDistance = distance;
          targetSnapIndex = index;
        }
      });
    }

    setCurrentSnap(targetSnapIndex);
  };

  // Mouse event handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    handleStart(e.clientY);
  };

  const handleMouseMove = (e: MouseEvent) => {
    handleMove(e.clientY);
  };

  const handleMouseUp = (e: MouseEvent) => {
    handleEnd(e.clientY);
  };

  // Touch event handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    handleStart(e.touches[0].clientY);
  };

  const handleTouchMove = (e: TouchEvent) => {
    e.preventDefault();
    handleMove(e.touches[0].clientY);
  };

  const handleTouchEnd = (e: TouchEvent) => {
    const touch = e.changedTouches[0];
    handleEnd(touch.clientY);
  };

  // Add global event listeners for drag operations
  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.addEventListener('touchmove', handleTouchMove, { passive: false });
      document.addEventListener('touchend', handleTouchEnd);

      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.removeEventListener('touchmove', handleTouchMove);
        document.removeEventListener('touchend', handleTouchEnd);
      };
    }
  }, [isDragging]);

  // Animate to current snap point
  useEffect(() => {
    if (sheetRef.current && !isDragging) {
      const targetY = window.innerHeight * (1 - currentHeight / 100);
      sheetRef.current.style.transform = `translateY(${targetY}px)`;
      sheetRef.current.style.transition = 'transform 0.3s ease-out';

      // Remove transition after animation completes
      const timeout = setTimeout(() => {
        if (sheetRef.current) {
          sheetRef.current.style.transition = '';
        }
      }, 300);

      return () => clearTimeout(timeout);
    }
  }, [currentSnap, currentHeight, isDragging]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const sheetElement = (
    <>
      {/* Backdrop */}
      {backdrop && (
        <div
          className={`
            fixed inset-0 bg-black transition-opacity duration-300 z-[10000]
            ${isOpen ? 'opacity-50' : 'opacity-0 pointer-events-none'}
          `}
          onClick={onClose}
        />
      )}

      {/* Bottom Sheet */}
      <div
        ref={sheetRef}
        className={`
          fixed bottom-0 left-0 right-0 bg-gray-900/95 backdrop-blur-md border-t border-gray-600/80
          rounded-t-xl shadow-2xl z-[10001] transition-transform duration-300 ease-out
          ${className}
        `}
        style={{
          height: `${currentHeight}vh`,
          transform: `translateY(${window.innerHeight * (1 - currentHeight / 100)}px)`
        }}
      >
        {/* Handle */}
        {showHandle && (
          <div
            className="flex justify-center py-3 cursor-grab active:cursor-grabbing"
            onMouseDown={handleMouseDown}
            onTouchStart={handleTouchStart}
          >
            <div className="w-8 h-1 bg-gray-500 rounded-full" />
          </div>
        )}

        {/* Header */}
        {(title || subtitle) && (
          <div className="px-4 pb-3 border-b border-gray-700/50">
            {title && (
              <h2 className="text-white font-semibold text-lg">{title}</h2>
            )}
            {subtitle && (
              <p className="text-gray-400 text-sm mt-1">{subtitle}</p>
            )}
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-4 py-4">
          {children}
        </div>

        {/* Snap Point Indicators */}
        {snapPoints.length > 1 && (
          <div className="absolute right-4 top-1/2 transform -translate-y-1/2 flex flex-col gap-2">
            {snapPoints.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentSnap(index)}
                className={`
                  w-2 h-2 rounded-full transition-colors
                  ${index === currentSnap ? 'bg-blue-400' : 'bg-gray-600 hover:bg-gray-500'}
                `}
              />
            ))}
          </div>
        )}
      </div>
    </>
  );

  return createPortal(sheetElement, document.body);
};

// Specialized bottom sheet for track information
export const TrackBottomSheet: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  node: any;
}> = ({ isOpen, onClose, node }) => {
  if (!node) return null;

  const metadata = node.metadata || {};

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title={metadata.title || node.title || node.label || 'Unknown Track'}
      subtitle={metadata.artist || node.artist || 'Unknown Artist'}
      snapPoints={[30, 60, 85]}
      initialSnap={1}
    >
      <div className="space-y-4">
        {/* Quick Actions */}
        <div className="flex gap-2 overflow-x-auto pb-2">
          <button className="flex-shrink-0 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-full text-sm font-medium transition-colors">
            Play
          </button>
          <button className="flex-shrink-0 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-full text-sm font-medium transition-colors">
            Add to Route
          </button>
          <button className="flex-shrink-0 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-full text-sm font-medium transition-colors">
            Mark as Played
          </button>
          <button className="flex-shrink-0 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-full text-sm font-medium transition-colors">
            Share
          </button>
        </div>

        {/* Track Information */}
        <div className="space-y-3">
          <h3 className="text-white font-medium">Track Details</h3>
          <div className="grid grid-cols-2 gap-3 text-sm">
            {metadata.album && (
              <div>
                <span className="text-gray-500">Album</span>
                <p className="text-gray-300 break-words">{metadata.album}</p>
              </div>
            )}
            {metadata.genre && (
              <div>
                <span className="text-gray-500">Genre</span>
                <p className="text-gray-300">{metadata.genre}</p>
              </div>
            )}
            {metadata.bpm && (
              <div>
                <span className="text-gray-500">BPM</span>
                <p className="text-gray-300">{metadata.bpm}</p>
              </div>
            )}
            {metadata.key && (
              <div>
                <span className="text-gray-500">Key</span>
                <p className="text-gray-300">{metadata.key}</p>
              </div>
            )}
          </div>
        </div>

        {/* Connected Tracks */}
        <div className="space-y-3">
          <h3 className="text-white font-medium">Similar Tracks</h3>
          <div className="space-y-2">
            {/* This would be populated with actual connected tracks */}
            {[1, 2, 3].map((_, index) => (
              <div key={index} className="p-3 bg-gray-800/50 rounded-lg">
                <div className="font-medium text-white text-sm">Similar Track {index + 1}</div>
                <div className="text-gray-400 text-xs mt-1">Artist Name</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </BottomSheet>
  );
};