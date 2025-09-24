import React, { useState, useRef, useEffect, useCallback } from 'react';
import classNames from 'classnames';
import { useResponsiveLayout } from '../Layout/ResponsiveLayoutProvider';

interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  snapPoints?: number[]; // Heights as percentages (0-100)
  initialSnapPoint?: number;
}

export const BottomSheet: React.FC<BottomSheetProps> = ({
  isOpen,
  onClose,
  title,
  children,
  snapPoints = [25, 50, 85],
  initialSnapPoint = 1,
}) => {
  const { deviceType, viewport } = useResponsiveLayout();
  const [currentSnapIndex, setCurrentSnapIndex] = useState(initialSnapPoint);
  const [isDragging, setIsDragging] = useState(false);
  const [startY, setStartY] = useState(0);
  const [currentY, setCurrentY] = useState(0);
  const sheetRef = useRef<HTMLDivElement>(null);

  // Only render on mobile/tablet
  if (deviceType === 'desktop') return null;
  if (!isOpen) return null;

  const currentHeight = snapPoints[currentSnapIndex] || snapPoints[0];
  const translateY = 100 - currentHeight;

  // Handle drag start
  const handleDragStart = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    setIsDragging(true);
    setStartY(clientY);
    setCurrentY(clientY);
  }, []);

  // Handle drag move
  const handleDragMove = useCallback((e: TouchEvent | MouseEvent) => {
    if (!isDragging) return;

    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    setCurrentY(clientY);
  }, [isDragging]);

  // Handle drag end
  const handleDragEnd = useCallback(() => {
    if (!isDragging) return;

    const deltaY = currentY - startY;
    const threshold = 50; // pixels
    const velocity = Math.abs(deltaY);

    // Determine snap direction
    if (deltaY > threshold || velocity > 100) {
      // Dragging down - go to lower snap point
      if (currentSnapIndex > 0) {
        setCurrentSnapIndex(currentSnapIndex - 1);
      } else {
        onClose(); // Close if at lowest point
      }
    } else if (deltaY < -threshold) {
      // Dragging up - go to higher snap point
      if (currentSnapIndex < snapPoints.length - 1) {
        setCurrentSnapIndex(currentSnapIndex + 1);
      }
    }

    setIsDragging(false);
    setStartY(0);
    setCurrentY(0);
  }, [isDragging, startY, currentY, currentSnapIndex, snapPoints.length, onClose]);

  // Set up global event listeners for drag
  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleDragMove);
      window.addEventListener('mouseup', handleDragEnd);
      window.addEventListener('touchmove', handleDragMove, { passive: false });
      window.addEventListener('touchend', handleDragEnd);

      return () => {
        window.removeEventListener('mousemove', handleDragMove);
        window.removeEventListener('mouseup', handleDragEnd);
        window.removeEventListener('touchmove', handleDragMove);
        window.removeEventListener('touchend', handleDragEnd);
      };
    }
  }, [isDragging, handleDragMove, handleDragEnd]);

  // Calculate drag offset
  const dragOffset = isDragging ? ((currentY - startY) / viewport.height) * 100 : 0;
  const finalTranslateY = Math.max(0, Math.min(100, translateY + dragOffset));

  return (
    <>
      {/* Backdrop */}
      <div
        className={classNames(
          'fixed inset-0 bg-black transition-opacity duration-300 z-[1100]',
          isOpen ? 'bg-opacity-50' : 'bg-opacity-0 pointer-events-none'
        )}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Bottom Sheet */}
      <div
        ref={sheetRef}
        className={classNames(
          'fixed bottom-0 left-0 right-0 z-[1200]',
          'bg-gray-900 rounded-t-2xl',
          'shadow-2xl border-t border-gray-700',
          'transition-transform duration-300 ease-out',
          isDragging && 'transition-none'
        )}
        style={{
          transform: `translateY(${finalTranslateY}%)`,
          maxHeight: '90vh',
        }}
        role="dialog"
        aria-modal="true"
        aria-label={title || 'Bottom sheet'}
      >
        {/* Drag Handle */}
        <div
          className="flex items-center justify-center py-3 cursor-grab active:cursor-grabbing"
          onMouseDown={handleDragStart}
          onTouchStart={handleDragStart}
        >
          <div className="w-12 h-1 bg-gray-600 rounded-full" />
        </div>

        {/* Header */}
        {title && (
          <div className="flex items-center justify-between px-4 pb-3 border-b border-gray-800">
            <h3 className="text-lg font-semibold text-white">{title}</h3>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-white transition-colors"
              aria-label="Close bottom sheet"
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        )}

        {/* Content */}
        <div
          className="overflow-y-auto overscroll-contain px-4 py-4"
          style={{
            maxHeight: `${currentHeight}vh`,
          }}
        >
          {children}
        </div>
      </div>
    </>
  );
};