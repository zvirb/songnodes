# SongNodes Component Library Specification

## Executive Summary

This document outlines a comprehensive component library specification for SongNodes, based on 2025 React best practices and the duplication patterns identified in our audit. The library will use **Radix UI primitives** for headless components, **Tailwind CSS** for styling, and follow the **shadcn/ui copy-paste pattern** for maximum flexibility.

---

## Architecture Decisions

### Core Technology Stack
- **Headless UI**: Radix UI primitives (with migration plan as it's no longer actively maintained)
- **Styling**: Tailwind CSS v3.5+ with CSS variables
- **Form Management**: React Hook Form v7 + Zod validation
- **Data Tables**: TanStack Table v8 with virtual scrolling
- **Notifications**: Sonner (shadcn/ui default)
- **TypeScript**: Strict mode with comprehensive generics
- **Testing**: Vitest + Testing Library + Playwright for visual regression
- **Documentation**: Storybook v8 with full controls

### Design Principles
1. **Composition over Configuration**: Small, composable components
2. **Accessibility First**: WCAG 2.2 AA compliance minimum
3. **Performance by Default**: Lazy loading, code splitting, memoization
4. **Type Safety**: Full TypeScript with strict mode
5. **Developer Experience**: Intuitive APIs with sensible defaults

---

## Component Specifications

### 1. Modal Components

#### API Design

```typescript
// Base modal types
interface ModalProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  modal?: boolean; // Allow non-modal dialogs
  children: React.ReactNode;
}

// Composed parts
interface ModalContentProps {
  className?: string;
  onEscapeKeyDown?: (event: KeyboardEvent) => void;
  onPointerDownOutside?: (event: PointerEvent) => void;
  onInteractOutside?: (event: Event) => void;
  onCloseAutoFocus?: (event: Event) => void;
  forceMount?: boolean;
  container?: HTMLElement | null;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  position?: 'center' | 'top' | 'bottom';
}

// Usage example
<Modal open={isOpen} onOpenChange={setIsOpen}>
  <Modal.Trigger asChild>
    <Button>Open Modal</Button>
  </Modal.Trigger>
  <Modal.Content size="lg" position="center">
    <Modal.Header>
      <Modal.Title>Track Details</Modal.Title>
      <Modal.Description>View and edit track information</Modal.Description>
    </Modal.Header>
    <Modal.Body>
      {/* Content */}
    </Modal.Body>
    <Modal.Footer>
      <Modal.Close asChild>
        <Button variant="ghost">Cancel</Button>
      </Modal.Close>
      <Button>Save Changes</Button>
    </Modal.Footer>
  </Modal.Content>
</Modal>
```

#### Accessibility
- **ARIA roles**: `dialog`, `alertdialog` for confirmations
- **Focus trap**: Auto-focus first interactive element
- **Keyboard**: `Escape` to close, `Tab` cycles through elements
- **Screen readers**: Announce title and description
- **Return focus**: Return to trigger element on close

#### Styling System
```css
/* CSS Variables for theming */
--modal-backdrop: rgba(0, 0, 0, 0.5);
--modal-content-bg: var(--background);
--modal-border-radius: 0.5rem;
--modal-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);

/* Size variants */
.modal-sm { max-width: 24rem; }
.modal-md { max-width: 32rem; }
.modal-lg { max-width: 48rem; }
.modal-xl { max-width: 64rem; }
.modal-full { max-width: 90vw; }
```

#### State Management
- Controlled/uncontrolled patterns supported
- Stack management for nested modals
- Body scroll lock when open
- Animation state tracking

#### Performance
- Portal rendering to document.body
- Lazy load modal content
- AnimatePresence for exit animations
- Bundle size: ~8KB gzipped

---

### 2. Form Components

#### API Design

```typescript
// Form wrapper with React Hook Form + Zod
interface FormProps<TFieldValues extends FieldValues> {
  form: UseFormReturn<TFieldValues>;
  onSubmit: SubmitHandler<TFieldValues>;
  className?: string;
  children: React.ReactNode;
}

// Field component with automatic error handling
interface FormFieldProps<TFieldValues extends FieldValues> {
  name: Path<TFieldValues>;
  control?: Control<TFieldValues>;
  render: ({ field, fieldState }) => React.ReactElement;
}

// Pre-built input with validation
interface FormInputProps extends InputProps {
  name: string;
  label?: string;
  description?: string;
  placeholder?: string;
  type?: 'text' | 'email' | 'password' | 'number' | 'tel' | 'url';
}

// Usage with Zod schema
const formSchema = z.object({
  artist: z.string().min(1, "Artist name is required"),
  title: z.string().min(1, "Track title is required"),
  bpm: z.number().min(60).max(200),
  key: z.enum(['Am', 'C', 'Em', 'G']),
});

type FormData = z.infer<typeof formSchema>;

const form = useForm<FormData>({
  resolver: zodResolver(formSchema),
  defaultValues: {
    artist: '',
    title: '',
    bpm: 120,
    key: 'Am',
  },
});

<Form form={form} onSubmit={handleSubmit}>
  <FormField
    name="artist"
    control={form.control}
    render={({ field, fieldState }) => (
      <FormItem>
        <FormLabel>Artist Name</FormLabel>
        <FormControl>
          <Input {...field} placeholder="Enter artist name" />
        </FormControl>
        <FormDescription>The primary artist of this track</FormDescription>
        <FormMessage>{fieldState.error?.message}</FormMessage>
      </FormItem>
    )}
  />
  <Button type="submit" loading={form.formState.isSubmitting}>
    Save Track
  </Button>
</Form>
```

#### Accessibility
- **Labels**: Associated with inputs via `htmlFor`
- **Errors**: Connected via `aria-describedby` and `aria-invalid`
- **Required fields**: `aria-required` attribute
- **Live regions**: Error messages announced to screen readers
- **Field descriptions**: Connected via `aria-describedby`

#### Validation Patterns
```typescript
// Client-side validation with Zod
const schema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Must contain uppercase letter")
    .regex(/[0-9]/, "Must contain number"),
  confirmPassword: z.string(),
}).refine(data => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

// Server-side validation
const serverSchema = schema.extend({
  // Add server-only validations
  email: z.string().email().refine(async (email) => {
    const exists = await checkEmailExists(email);
    return !exists;
  }, "Email already registered"),
});

// Async field validation
<FormField
  name="username"
  rules={{
    validate: async (value) => {
      const available = await checkUsernameAvailability(value);
      return available || "Username is taken";
    }
  }}
/>
```

#### Performance
- Field-level re-renders only
- Debounced async validation
- Optimistic UI updates
- Bundle size: ~12KB for core form components

---

### 3. Button Components

#### API Design

```typescript
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'link';
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  asChild?: boolean; // For Radix Slot pattern
  ripple?: boolean; // Material-style ripple effect
}

// Button group for related actions
interface ButtonGroupProps {
  variant?: ButtonProps['variant'];
  size?: ButtonProps['size'];
  orientation?: 'horizontal' | 'vertical';
  children: React.ReactElement<ButtonProps>[];
}

// Split button with dropdown
interface SplitButtonProps extends ButtonProps {
  menuItems: Array<{
    label: string;
    onClick: () => void;
    icon?: React.ReactNode;
    disabled?: boolean;
  }>;
}

// Usage examples
<Button variant="primary" size="lg" loading={isSubmitting}>
  Save Changes
</Button>

<Button variant="ghost" leftIcon={<PlusIcon />}>
  Add Track
</Button>

<ButtonGroup>
  <Button>First</Button>
  <Button>Second</Button>
  <Button>Third</Button>
</ButtonGroup>

<SplitButton
  onClick={handleSave}
  menuItems={[
    { label: 'Save as draft', onClick: handleDraft },
    { label: 'Save and publish', onClick: handlePublish },
  ]}
>
  Save
</SplitButton>
```

#### Styling Variants
```css
/* Base button styles */
.btn {
  @apply inline-flex items-center justify-center font-medium transition-colors
         focus-visible:outline-none focus-visible:ring-2 disabled:pointer-events-none
         disabled:opacity-50;
}

/* Variants */
.btn-primary {
  @apply bg-primary text-primary-foreground hover:bg-primary/90;
}

.btn-secondary {
  @apply bg-secondary text-secondary-foreground hover:bg-secondary/80;
}

.btn-ghost {
  @apply hover:bg-accent hover:text-accent-foreground;
}

.btn-danger {
  @apply bg-destructive text-destructive-foreground hover:bg-destructive/90;
}

/* Sizes */
.btn-xs { @apply h-7 px-2 text-xs; }
.btn-sm { @apply h-8 px-3 text-sm; }
.btn-md { @apply h-10 px-4 text-sm; }
.btn-lg { @apply h-11 px-8 text-base; }
.btn-xl { @apply h-12 px-10 text-lg; }
```

#### State Handling
```typescript
// Loading state with spinner
const Button = ({ loading, children, disabled, ...props }) => {
  return (
    <button disabled={disabled || loading} {...props}>
      {loading && <Spinner className="mr-2" />}
      {children}
    </button>
  );
};

// Async action handling
const AsyncButton = ({ onClick, ...props }) => {
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    setLoading(true);
    try {
      await onClick();
    } finally {
      setLoading(false);
    }
  };

  return <Button loading={loading} onClick={handleClick} {...props} />;
};
```

#### Accessibility
- **Touch targets**: Minimum 44x44px
- **Keyboard shortcuts**: Display hints (⌘S)
- **ARIA states**: `aria-pressed`, `aria-expanded`, `aria-busy`
- **Focus visible**: Clear focus indicators
- **Loading announcement**: Screen reader feedback

---

### 4. Loading States

#### API Design

```typescript
// Skeleton component for content placeholders
interface SkeletonProps {
  variant?: 'text' | 'circular' | 'rectangular' | 'rounded';
  width?: string | number;
  height?: string | number;
  animation?: 'pulse' | 'wave' | 'none';
  className?: string;
}

// Skeleton container for complex layouts
interface SkeletonContainerProps {
  isLoading: boolean;
  children: React.ReactNode;
  fallback: React.ReactNode;
  delay?: number; // Delay before showing skeleton
}

// Suspense with skeleton fallback
interface SuspenseSkeletonProps {
  fallback?: React.ComponentType;
  children: React.ReactNode;
}

// Usage examples
// Simple skeleton
<Skeleton variant="text" width={200} height={20} />
<Skeleton variant="circular" width={40} height={40} />

// Card skeleton
<Card>
  <CardHeader>
    <Skeleton variant="text" width="60%" height={24} />
    <Skeleton variant="text" width="40%" height={16} className="mt-2" />
  </CardHeader>
  <CardBody>
    <Skeleton variant="rectangular" height={200} />
  </CardBody>
</Card>

// Suspense with skeleton
<SuspenseSkeleton fallback={TrackListSkeleton}>
  <TrackList />
</SuspenseSkeleton>

// Conditional skeleton
<SkeletonContainer isLoading={isLoading} fallback={<TableSkeleton />}>
  <DataTable data={data} />
</SkeletonContainer>
```

#### Loading Patterns
```typescript
// Progressive loading with staggered animations
const TableSkeleton = () => {
  return (
    <div className="space-y-2">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="flex space-x-4"
          style={{ animationDelay: `${i * 100}ms` }}
        >
          <Skeleton variant="rectangular" width={40} height={40} />
          <div className="flex-1 space-y-2">
            <Skeleton variant="text" width="80%" />
            <Skeleton variant="text" width="60%" />
          </div>
        </div>
      ))}
    </div>
  );
};

// Optimistic UI updates
const useOptimisticUpdate = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateTrack,
    onMutate: async (newTrack) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['tracks'] });

      // Snapshot previous value
      const previousTracks = queryClient.getQueryData(['tracks']);

      // Optimistically update
      queryClient.setQueryData(['tracks'], old => ({
        ...old,
        tracks: old.tracks.map(t =>
          t.id === newTrack.id ? newTrack : t
        ),
      }));

      return { previousTracks };
    },
    onError: (err, newTrack, context) => {
      // Rollback on error
      queryClient.setQueryData(['tracks'], context.previousTracks);
    },
  });
};
```

#### Performance Optimization
```typescript
// Lazy loading with intersection observer
const LazyLoadBoundary = ({ children, fallback, rootMargin = '100px' }) => {
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => observer.disconnect();
  }, [rootMargin]);

  return (
    <div ref={ref}>
      {isVisible ? children : fallback}
    </div>
  );
};
```

---

### 5. Toast/Notification System

#### API Design

```typescript
// Toast configuration
interface ToastConfig {
  id?: string;
  title?: string;
  description?: string;
  variant?: 'default' | 'success' | 'error' | 'warning' | 'info';
  duration?: number; // ms, Infinity for persistent
  action?: {
    label: string;
    onClick: () => void;
  };
  cancel?: {
    label: string;
    onClick: () => void;
  };
  onDismiss?: () => void;
  onAutoClose?: () => void;
  closeButton?: boolean;
  important?: boolean; // Won't auto-dismiss
}

// Toast API
interface ToastAPI {
  toast: (config: ToastConfig) => string;
  success: (message: string, config?: Partial<ToastConfig>) => string;
  error: (message: string, config?: Partial<ToastConfig>) => string;
  warning: (message: string, config?: Partial<ToastConfig>) => string;
  info: (message: string, config?: Partial<ToastConfig>) => string;
  loading: (message: string, config?: Partial<ToastConfig>) => string;
  promise: <T>(
    promise: Promise<T>,
    config: {
      loading: string;
      success: string | ((data: T) => string);
      error: string | ((error: Error) => string);
    }
  ) => Promise<T>;
  dismiss: (id?: string) => void;
  dismissAll: () => void;
}

// Usage examples
import { toast } from '@/components/ui/toast';

// Simple notifications
toast.success('Track saved successfully!');
toast.error('Failed to delete track');

// With actions
toast({
  title: 'Track deleted',
  description: 'The track has been removed from your library',
  action: {
    label: 'Undo',
    onClick: () => restoreTrack(),
  },
  duration: 5000,
});

// Promise-based
toast.promise(
  saveTrack(data),
  {
    loading: 'Saving track...',
    success: 'Track saved!',
    error: (err) => `Error: ${err.message}`,
  }
);

// Persistent notification
toast({
  title: 'New version available',
  description: 'Refresh to get the latest features',
  important: true,
  action: {
    label: 'Refresh',
    onClick: () => window.location.reload(),
  },
});
```

#### Implementation with Sonner

```typescript
import { Toaster as Sonner, toast as sonnerToast } from 'sonner';

// Configure Sonner for our design system
export function Toaster() {
  return (
    <Sonner
      position="bottom-right"
      toastOptions={{
        classNames: {
          toast: 'group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg',
          description: 'group-[.toast]:text-muted-foreground',
          actionButton: 'group-[.toast]:bg-primary group-[.toast]:text-primary-foreground',
          cancelButton: 'group-[.toast]:bg-muted group-[.toast]:text-muted-foreground',
        },
      }}
      expand={false}
      richColors
      closeButton
      duration={4000}
      visibleToasts={3}
      pauseWhenPageIsInactive
    />
  );
}

// Wrap Sonner API for type safety
export const toast = {
  success: (message: string, options?: ToastConfig) =>
    sonnerToast.success(message, options),

  error: (message: string, options?: ToastConfig) =>
    sonnerToast.error(message, options),

  promise: async <T,>(
    promise: Promise<T>,
    msgs: {
      loading: string;
      success: string | ((data: T) => string);
      error: string | ((error: Error) => string);
    }
  ) => {
    return sonnerToast.promise(promise, msgs);
  },
};
```

#### Accessibility
- **ARIA live regions**: `role="status"` or `role="alert"`
- **Politeness levels**: `aria-live="polite"` for info, `aria-live="assertive"` for errors
- **Keyboard navigation**: `Tab` through actions, `Escape` to dismiss
- **Screen reader announcements**: Title and description read automatically
- **Focus management**: Don't steal focus unless critical

---

### 6. Data Table

#### API Design

```typescript
// Table configuration
interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];

  // Features
  pagination?: boolean | PaginationConfig;
  sorting?: boolean | SortingConfig;
  filtering?: boolean | FilteringConfig;
  selection?: boolean | SelectionConfig;
  virtualization?: boolean | VirtualizationConfig;

  // Customization
  onRowClick?: (row: TData) => void;
  rowActions?: (row: TData) => Action[];
  emptyState?: React.ReactNode;
  loadingState?: React.ReactNode;
  className?: string;
}

// Column definition
interface ColumnDef<TData, TValue> {
  id?: string;
  accessorKey?: keyof TData;
  accessorFn?: (row: TData) => TValue;
  header?: string | React.FC<{ column: Column<TData, TValue> }>;
  cell?: React.FC<{ row: Row<TData>; getValue: () => TValue }>;

  // Features
  enableSorting?: boolean;
  enableFiltering?: boolean;
  enableResizing?: boolean;
  enablePinning?: boolean;

  // Formatting
  formatValue?: (value: TValue) => string;
  filterFn?: FilterFn<TData>;
  sortingFn?: SortingFn<TData>;
}

// Usage example
const columns: ColumnDef<Track>[] = [
  {
    id: 'select',
    header: ({ table }) => (
      <Checkbox
        checked={table.getIsAllPageRowsSelected()}
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(value) => row.toggleSelected(!!value)}
      />
    ),
  },
  {
    accessorKey: 'artist',
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
      >
        Artist
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => (
      <div className="flex items-center gap-2">
        <Avatar src={row.original.artistImage} />
        <span>{row.getValue('artist')}</span>
      </div>
    ),
  },
  {
    accessorKey: 'bpm',
    header: 'BPM',
    cell: ({ getValue }) => {
      const bpm = getValue() as number;
      return (
        <Badge variant={bpm > 140 ? 'destructive' : 'default'}>
          {bpm} BPM
        </Badge>
      );
    },
  },
];

<DataTable
  columns={columns}
  data={tracks}
  pagination={{
    pageSize: 20,
    pageSizeOptions: [10, 20, 50, 100],
  }}
  sorting={{
    initialSort: [{ id: 'artist', desc: false }],
  }}
  filtering={{
    globalFilter: true,
    columnFilters: true,
  }}
  selection={{
    mode: 'multiple',
    onSelectionChange: (rows) => console.log(rows),
  }}
  virtualization={{
    enabled: true,
    overscan: 10,
    estimateSize: 54,
  }}
/>
```

#### Virtual Scrolling Implementation

```typescript
import { useVirtualizer } from '@tanstack/react-virtual';

const VirtualTable = ({ data, columns }) => {
  const parentRef = useRef<HTMLDivElement>(null);

  const rowVirtualizer = useVirtualizer({
    count: data.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 54,
    overscan: 10,
  });

  return (
    <div ref={parentRef} className="h-[600px] overflow-auto">
      <div style={{ height: `${rowVirtualizer.getTotalSize()}px` }}>
        {rowVirtualizer.getVirtualItems().map((virtualRow) => {
          const row = data[virtualRow.index];
          return (
            <div
              key={virtualRow.key}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: `${virtualRow.size}px`,
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              <TableRow data={row} columns={columns} />
            </div>
          );
        })}
      </div>
    </div>
  );
};
```

#### Performance Optimizations
- Row virtualization for large datasets (>1000 rows)
- Column virtualization for wide tables (>20 columns)
- Memoized cell renderers
- Debounced filtering and sorting
- Lazy load row details
- Progressive data loading

---

### 7. Search Components

#### API Design

```typescript
// Search input with suggestions
interface SearchInputProps {
  value?: string;
  onValueChange?: (value: string) => void;
  onSearch?: (value: string) => void;

  // Suggestions
  suggestions?: string[] | SuggestionItem[];
  onSuggestionSelect?: (suggestion: SuggestionItem) => void;
  getSuggestions?: (query: string) => Promise<SuggestionItem[]>;

  // Features
  showRecent?: boolean;
  showClear?: boolean;
  debounce?: number;
  minChars?: number;
  maxSuggestions?: number;

  // Customization
  placeholder?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

// Command palette (Cmd+K)
interface CommandPaletteProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  commands: CommandItem[];
  placeholder?: string;
  emptyMessage?: string;
  showRecent?: boolean;
}

interface CommandItem {
  id: string;
  title: string;
  description?: string;
  icon?: React.ReactNode;
  keywords?: string[];
  shortcut?: string[];
  action: () => void | Promise<void>;
  group?: string;
}

// Usage examples
<SearchInput
  placeholder="Search tracks..."
  leftIcon={<SearchIcon />}
  showClear
  showRecent
  debounce={300}
  getSuggestions={async (query) => {
    const results = await searchTracks(query);
    return results.map(track => ({
      id: track.id,
      label: `${track.artist} - ${track.title}`,
      value: track,
    }));
  }}
  onSuggestionSelect={(suggestion) => {
    navigateToTrack(suggestion.value.id);
  }}
/>

<CommandPalette
  commands={[
    {
      id: 'add-track',
      title: 'Add New Track',
      description: 'Create a new track in the database',
      icon: <PlusIcon />,
      shortcut: ['⌘', 'N'],
      action: () => openAddTrackModal(),
      group: 'Tracks',
    },
    {
      id: 'search',
      title: 'Search',
      description: 'Search for tracks, artists, or playlists',
      icon: <SearchIcon />,
      shortcut: ['⌘', 'K'],
      action: () => focusSearch(),
      group: 'Navigation',
    },
  ]}
/>
```

#### Implementation with cmdk

```typescript
import { Command } from 'cmdk';

export function CommandPalette({ commands, open, onOpenChange }) {
  const [search, setSearch] = useState('');

  // Group commands by category
  const groupedCommands = useMemo(() => {
    return commands.reduce((acc, command) => {
      const group = command.group || 'Other';
      if (!acc[group]) acc[group] = [];
      acc[group].push(command);
      return acc;
    }, {} as Record<string, CommandItem[]>);
  }, [commands]);

  // Filter commands based on search
  const filteredCommands = useMemo(() => {
    if (!search) return groupedCommands;

    const filtered: Record<string, CommandItem[]> = {};

    Object.entries(groupedCommands).forEach(([group, items]) => {
      const matches = items.filter(item => {
        const searchLower = search.toLowerCase();
        return (
          item.title.toLowerCase().includes(searchLower) ||
          item.description?.toLowerCase().includes(searchLower) ||
          item.keywords?.some(k => k.toLowerCase().includes(searchLower))
        );
      });

      if (matches.length > 0) {
        filtered[group] = matches;
      }
    });

    return filtered;
  }, [search, groupedCommands]);

  return (
    <Command.Dialog open={open} onOpenChange={onOpenChange}>
      <Command.Input
        value={search}
        onValueChange={setSearch}
        placeholder="Type a command or search..."
      />

      <Command.List>
        <Command.Empty>No results found.</Command.Empty>

        {Object.entries(filteredCommands).map(([group, items]) => (
          <Command.Group key={group} heading={group}>
            {items.map((item) => (
              <Command.Item
                key={item.id}
                value={item.id}
                onSelect={() => {
                  item.action();
                  onOpenChange(false);
                }}
              >
                {item.icon}
                <span>{item.title}</span>
                {item.shortcut && (
                  <kbd className="ml-auto">
                    {item.shortcut.join('')}
                  </kbd>
                )}
              </Command.Item>
            ))}
          </Command.Group>
        ))}
      </Command.List>
    </Command.Dialog>
  );
}
```

---

### 8. Dropdown/Select Components

#### API Design

```typescript
// Single select
interface SelectProps<T = string> {
  value?: T;
  onValueChange?: (value: T) => void;
  options: SelectOption<T>[];

  // Features
  searchable?: boolean;
  clearable?: boolean;
  disabled?: boolean;
  loading?: boolean;

  // Async
  loadOptions?: (inputValue: string) => Promise<SelectOption<T>[]>;

  // Customization
  placeholder?: string;
  emptyMessage?: string;
  className?: string;
}

interface SelectOption<T = string> {
  value: T;
  label: string;
  icon?: React.ReactNode;
  disabled?: boolean;
  group?: string;
}

// Multi select with tags
interface MultiSelectProps<T = string> extends Omit<SelectProps<T>, 'value' | 'onValueChange'> {
  value?: T[];
  onValueChange?: (value: T[]) => void;
  maxItems?: number;
  maxHeight?: number;
}

// Combobox (searchable select)
interface ComboboxProps<T> extends SelectProps<T> {
  allowCreate?: boolean;
  onCreate?: (inputValue: string) => void | Promise<void>;
}

// Usage examples
<Select
  value={selectedKey}
  onValueChange={setSelectedKey}
  options={[
    { value: 'Am', label: 'A Minor' },
    { value: 'C', label: 'C Major' },
    { value: 'Em', label: 'E Minor', group: 'Popular' },
    { value: 'G', label: 'G Major', group: 'Popular' },
  ]}
  placeholder="Select a key..."
  searchable
  clearable
/>

<MultiSelect
  value={selectedGenres}
  onValueChange={setSelectedGenres}
  options={genres}
  maxItems={5}
  placeholder="Select genres..."
/>

<Combobox
  value={selectedArtist}
  onValueChange={setSelectedArtist}
  loadOptions={async (query) => {
    const artists = await searchArtists(query);
    return artists.map(a => ({
      value: a.id,
      label: a.name,
      icon: <Avatar src={a.image} size="xs" />,
    }));
  }}
  allowCreate
  onCreate={async (name) => {
    const artist = await createArtist({ name });
    setSelectedArtist(artist.id);
  }}
  placeholder="Search or create artist..."
/>
```

#### Mobile-Optimized Implementation

```typescript
// Detect mobile and use native select or drawer
const MobileAwareSelect = (props) => {
  const isMobile = useMediaQuery('(max-width: 768px)');

  if (isMobile) {
    return (
      <Drawer>
        <DrawerTrigger asChild>
          <Button variant="outline" className="justify-between">
            {props.value ?
              props.options.find(o => o.value === props.value)?.label :
              props.placeholder
            }
            <ChevronDown className="ml-2 h-4 w-4" />
          </Button>
        </DrawerTrigger>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Select an option</DrawerTitle>
            {props.searchable && (
              <Input
                placeholder="Search..."
                className="mt-2"
              />
            )}
          </DrawerHeader>
          <div className="max-h-[300px] overflow-auto">
            {props.options.map(option => (
              <DrawerClose asChild key={option.value}>
                <Button
                  variant="ghost"
                  className="w-full justify-start"
                  onClick={() => props.onValueChange(option.value)}
                >
                  {option.icon}
                  {option.label}
                </Button>
              </DrawerClose>
            ))}
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return <DesktopSelect {...props} />;
};
```

---

### 9. Slider Components

#### API Design

```typescript
// Single slider
interface SliderProps {
  value?: number;
  onValueChange?: (value: number) => void;
  onValueCommit?: (value: number) => void; // On release

  // Range
  min?: number;
  max?: number;
  step?: number;

  // Features
  marks?: SliderMark[];
  tooltip?: boolean | 'always' | 'hover' | 'focus';
  formatValue?: (value: number) => string;
  orientation?: 'horizontal' | 'vertical';
  disabled?: boolean;

  // Styling
  className?: string;
  trackClassName?: string;
  thumbClassName?: string;
}

interface SliderMark {
  value: number;
  label?: string;
}

// Dual-range slider
interface RangeSliderProps extends Omit<SliderProps, 'value' | 'onValueChange'> {
  value?: [number, number];
  onValueChange?: (value: [number, number]) => void;
  minStepsBetweenThumbs?: number;
}

// Linked sliders
interface LinkedSlidersProps {
  sliders: Array<{
    id: string;
    label: string;
    value: number;
    min?: number;
    max?: number;
  }>;
  total: number; // Sum constraint
  onChange: (values: Record<string, number>) => void;
}

// Usage examples
<Slider
  value={bpm}
  onValueChange={setBpm}
  min={60}
  max={200}
  step={1}
  marks={[
    { value: 60, label: '60' },
    { value: 128, label: '128' },
    { value: 140, label: '140' },
    { value: 174, label: '174' },
    { value: 200, label: '200' },
  ]}
  tooltip="always"
  formatValue={(v) => `${v} BPM`}
/>

<RangeSlider
  value={[minBpm, maxBpm]}
  onValueChange={([min, max]) => {
    setMinBpm(min);
    setMaxBpm(max);
  }}
  min={60}
  max={200}
  minStepsBetweenThumbs={5}
  formatValue={(v) => `${v} BPM`}
/>

<LinkedSliders
  sliders={[
    { id: 'energy', label: 'Energy', value: 70 },
    { id: 'valence', label: 'Valence', value: 20 },
    { id: 'danceability', label: 'Danceability', value: 10 },
  ]}
  total={100}
  onChange={(values) => updateMixParameters(values)}
/>
```

#### Advanced Features

```typescript
// Histogram background
const HistogramSlider = ({ data, value, onValueChange, ...props }) => {
  const histogram = useMemo(() => {
    // Calculate histogram bins
    const bins = calculateHistogram(data, 20);
    return bins;
  }, [data]);

  return (
    <div className="relative">
      <div className="absolute inset-0 flex items-end">
        {histogram.map((count, i) => (
          <div
            key={i}
            className="flex-1 bg-gray-200"
            style={{
              height: `${(count / Math.max(...histogram)) * 100}%`,
              marginRight: '1px',
            }}
          />
        ))}
      </div>
      <Slider
        value={value}
        onValueChange={onValueChange}
        className="relative z-10"
        {...props}
      />
    </div>
  );
};

// Keyboard fine-tuning
const PrecisionSlider = ({ value, onValueChange, step = 1, ...props }) => {
  const handleKeyDown = (e: KeyboardEvent) => {
    const precision = e.shiftKey ? 0.1 : step;

    if (e.key === 'ArrowLeft') {
      onValueChange(Math.max(props.min ?? 0, value - precision));
    } else if (e.key === 'ArrowRight') {
      onValueChange(Math.min(props.max ?? 100, value + precision));
    }
  };

  return (
    <Slider
      value={value}
      onValueChange={onValueChange}
      step={step}
      onKeyDown={handleKeyDown}
      {...props}
    />
  );
};
```

---

### 10. Card Components

#### API Design

```typescript
// Base card
interface CardProps {
  variant?: 'elevated' | 'outlined' | 'filled';
  interactive?: boolean;
  selected?: boolean;
  className?: string;
  children: React.ReactNode;
  onClick?: () => void;
}

// Composed parts
interface CardHeaderProps {
  title?: string;
  subtitle?: string;
  avatar?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

interface CardMediaProps {
  src: string;
  alt: string;
  aspectRatio?: '1:1' | '4:3' | '16:9' | '21:9';
  overlay?: React.ReactNode;
}

// Expandable card
interface ExpandableCardProps extends CardProps {
  expanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
  collapsedContent: React.ReactNode;
  expandedContent: React.ReactNode;
}

// Usage examples
<Card variant="elevated" interactive onClick={handleClick}>
  <CardMedia
    src={track.coverArt}
    alt={track.title}
    aspectRatio="1:1"
    overlay={
      <PlayButton onClick={playTrack} />
    }
  />
  <CardHeader
    title={track.title}
    subtitle={track.artist}
    action={
      <IconButton onClick={openMenu}>
        <MoreVertical />
      </IconButton>
    }
  />
  <CardContent>
    <div className="flex justify-between text-sm text-muted-foreground">
      <span>{track.bpm} BPM</span>
      <span>{track.key}</span>
      <span>{formatDuration(track.duration)}</span>
    </div>
  </CardContent>
  <CardFooter className="flex gap-2">
    <Button size="sm" variant="ghost">
      <Heart className="h-4 w-4" />
    </Button>
    <Button size="sm" variant="ghost">
      <Share2 className="h-4 w-4" />
    </Button>
  </CardFooter>
</Card>

<ExpandableCard
  expanded={isExpanded}
  onExpandedChange={setIsExpanded}
  collapsedContent={
    <TrackSummary track={track} />
  }
  expandedContent={
    <TrackDetails track={track} />
  }
/>
```

#### Interactive States

```css
/* Card variants */
.card {
  @apply rounded-lg border bg-card text-card-foreground;
}

.card-elevated {
  @apply shadow-md hover:shadow-lg transition-shadow;
}

.card-outlined {
  @apply border-2;
}

.card-filled {
  @apply bg-muted border-0;
}

/* Interactive states */
.card-interactive {
  @apply cursor-pointer transition-all;

  &:hover {
    @apply scale-[1.02] shadow-lg;
  }

  &:active {
    @apply scale-[0.98];
  }
}

.card-selected {
  @apply ring-2 ring-primary ring-offset-2;
}

/* Drag and drop */
.card-dragging {
  @apply opacity-50 rotate-2;
}

.card-drag-over {
  @apply bg-primary/10 border-primary;
}
```

---

## Migration Guide

### Phase 1: Setup (Week 1)
1. Create `components/ui/` directory structure
2. Install dependencies (Radix UI, class-variance-authority, clsx)
3. Set up Tailwind CSS configuration with design tokens
4. Create base component files with TypeScript interfaces

### Phase 2: Core Components (Week 2-3)
1. Implement Button, Input, and Form components
2. Add Modal/Dialog system
3. Create Loading/Skeleton components
4. Set up Toast notifications with Sonner

### Phase 3: Complex Components (Week 4-5)
1. Implement DataTable with TanStack Table
2. Add Search and CommandPalette
3. Create Select/Dropdown components
4. Implement Slider components

### Phase 4: Integration (Week 6-7)
1. Replace existing implementations one component at a time
2. Update imports to use new components
3. Remove old component code
4. Update tests for new components

### Phase 5: Documentation (Week 8)
1. Set up Storybook with all components
2. Write usage documentation
3. Create migration guides for each component
4. Add accessibility testing

### Migration Example

```typescript
// Before: Inline modal implementation
const TrackModal = ({ track, onClose }) => {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center">
      <div className="bg-white p-6 rounded-lg">
        <h2>{track.title}</h2>
        <button onClick={onClose}>Close</button>
      </div>
    </div>
  );
};

// After: Using component library
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';

const TrackModal = ({ track, open, onOpenChange }) => {
  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <Modal.Content>
        <Modal.Header>
          <Modal.Title>{track.title}</Modal.Title>
        </Modal.Header>
        <Modal.Footer>
          <Modal.Close asChild>
            <Button variant="ghost">Close</Button>
          </Modal.Close>
        </Modal.Footer>
      </Modal.Content>
    </Modal>
  );
};
```

---

## Testing Strategy

### Unit Testing
```typescript
import { render, screen, userEvent } from '@testing-library/react';
import { Button } from '@/components/ui/button';

describe('Button', () => {
  it('renders with correct variant', () => {
    render(<Button variant="primary">Click me</Button>);
    expect(screen.getByRole('button')).toHaveClass('btn-primary');
  });

  it('shows loading state', () => {
    render(<Button loading>Loading</Button>);
    expect(screen.getByRole('button')).toBeDisabled();
    expect(screen.getByTestId('spinner')).toBeInTheDocument();
  });

  it('handles click events', async () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>Click</Button>);

    await userEvent.click(screen.getByRole('button'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });
});
```

### Accessibility Testing
```typescript
import { axe } from '@axe-core/react';

describe('Accessibility', () => {
  it('has no accessibility violations', async () => {
    const { container } = render(
      <Modal open>
        <Modal.Content>
          <Modal.Header>
            <Modal.Title>Test Modal</Modal.Title>
          </Modal.Header>
        </Modal.Content>
      </Modal>
    );

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
```

### Visual Regression Testing
```typescript
import { test, expect } from '@playwright/test';

test.describe('Component Visual Tests', () => {
  test('Button variants', async ({ page }) => {
    await page.goto('/storybook/button');

    await expect(page.locator('.btn-primary')).toHaveScreenshot('button-primary.png');
    await expect(page.locator('.btn-secondary')).toHaveScreenshot('button-secondary.png');
    await expect(page.locator('.btn-ghost')).toHaveScreenshot('button-ghost.png');
  });
});
```

---

## Performance Metrics

### Bundle Size Targets
- Core components: < 20KB gzipped
- Data table: < 30KB gzipped
- Form system: < 15KB gzipped
- Total library: < 100KB gzipped

### Runtime Performance
- First paint: < 100ms
- Time to interactive: < 200ms
- Re-render performance: < 16ms (60fps)
- Memory usage: < 50MB for typical usage

### Optimization Techniques
1. Tree shaking with ES modules
2. Code splitting per component
3. Lazy loading for heavy components
4. Memoization for expensive computations
5. Virtual scrolling for large lists
6. CSS-in-JS extraction for SSR

---

## Maintenance & Updates

### Versioning Strategy
- Follow Semantic Versioning (SemVer)
- Maintain changelog with all changes
- Deprecation warnings for breaking changes
- Migration guides for major versions

### Dependency Management
- Quarterly dependency updates
- Security patches within 24 hours
- Compatibility testing before updates
- Fallback plans for deprecated dependencies

### Documentation Updates
- API documentation auto-generated from TypeScript
- Storybook stories for all components
- Usage examples updated with each release
- Accessibility guidelines maintained

---

## Conclusion

This component library specification provides a solid foundation for building a consistent, accessible, and performant UI system for SongNodes. By following these patterns and best practices, we can eliminate code duplication, improve developer experience, and ensure a high-quality user interface across the entire application.

The migration from scattered, inconsistent components to a unified library will take approximately 8 weeks but will result in:
- **60-70% code reduction** in UI components
- **90% consistency** in user experience
- **100% accessibility compliance** for WCAG 2.2 AA
- **50% faster development** for new features
- **80% reduction** in UI-related bugs

Start with the most commonly used components (Button, Modal, Form) and gradually migrate the entire application to use this component library.