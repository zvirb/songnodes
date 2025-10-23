/**
 * SongNodes Component Library - Central Export
 *
 * Frictionless UI/UX Component System
 * Version: 1.0.0
 *
 * Design Principles:
 * - WCAG 2.2 AA Compliant
 * - Cognitive Load Reduction
 * - Mental Model Alignment
 * - Progressive Disclosure
 * - Consistent Behavior
 *
 * Usage:
 * import { Button, Modal, Input } from '@/components/ui';
 */

// Core Interactive Components
export { Button, buttonVariants, type ButtonProps } from './Button';
export {
  Modal,
  ModalPortal,
  ModalOverlay,
  ModalTrigger,
  ModalClose,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  ModalTitle,
  ModalDescription,
  type ModalContentProps,
} from './Modal';

// Form Components
export { Input, inputVariants, type InputProps } from './Input';
export {
  Select,
  SelectGroup,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectLabel,
  SelectItem,
  SelectSeparator,
  SelectScrollUpButton,
  SelectScrollDownButton,
} from './Select';

// Feedback Components
export { Toaster, toast, useToast, type ToastConfig } from './Toast';
export { Skeleton, skeletonVariants, type SkeletonProps } from './Skeleton';

// Layout Components
export {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  cardVariants,
  type CardProps,
} from './Card';

// Status Components
export { Badge, badgeVariants, type BadgeProps } from './Badge';

// Utility Functions
export { cn } from '../../lib/utils';
