import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface User {
  id: string;
  name: string;
  avatar?: string;
  color: string;
  isOnline: boolean;
  lastSeen?: number;
}

interface Session {
  id: string;
  name: string;
  owner: string;
  participants: User[];
  maxParticipants: number;
  isPublic: boolean;
  createdAt: number;
}

interface CursorPosition {
  userId: string;
  x: number;
  y: number;
  timestamp: number;
}

interface UserAction {
  id: string;
  userId: string;
  type: 'select_node' | 'hover_node' | 'zoom' | 'pan' | 'search' | 'filter';
  data: any;
  timestamp: number;
}

interface Chat {
  id: string;
  userId: string;
  message: string;
  timestamp: number;
  type: 'message' | 'system' | 'action';
}

interface CollaborationState {
  // Current session
  currentSession: Session | null;
  isConnected: boolean;
  connectionStatus: 'connecting' | 'connected' | 'disconnected' | 'error';
  
  // Users
  currentUser: User | null;
  users: User[];
  cursors: CursorPosition[];
  
  // Real-time actions
  actions: UserAction[];
  actionHistory: UserAction[];
  
  // Chat
  chatMessages: Chat[];
  unreadCount: number;
  isChatOpen: boolean;
  
  // Shared state
  sharedViewport: {
    x: number;
    y: number;
    scale: number;
    followUser?: string;
  } | null;
  
  sharedSelection: {
    userId: string;
    nodeIds: string[];
    timestamp: number;
  }[];
  
  // Session management
  availableSessions: Session[];
  sessionInvites: Array<{
    id: string;
    sessionId: string;
    fromUser: string;
    timestamp: number;
  }>;
  
  // Permissions
  permissions: {
    canEdit: boolean;
    canInvite: boolean;
    canKick: boolean;
    canChangeSettings: boolean;
  };
  
  // UI state
  showCollaborationPanel: boolean;
  showUserCursors: boolean;
  showUserActions: boolean;
  followMode: 'none' | 'presenter' | string; // user ID to follow
}

const initialState: CollaborationState = {
  currentSession: null,
  isConnected: false,
  connectionStatus: 'disconnected',
  
  currentUser: null,
  users: [],
  cursors: [],
  
  actions: [],
  actionHistory: [],
  
  chatMessages: [],
  unreadCount: 0,
  isChatOpen: false,
  
  sharedViewport: null,
  sharedSelection: [],
  
  availableSessions: [],
  sessionInvites: [],
  
  permissions: {
    canEdit: true,
    canInvite: false,
    canKick: false,
    canChangeSettings: false,
  },
  
  showCollaborationPanel: false,
  showUserCursors: true,
  showUserActions: true,
  followMode: 'none',
};

const collaborationSlice = createSlice({
  name: 'collaboration',
  initialState,
  reducers: {
    // Connection
    setConnectionStatus: (state, action: PayloadAction<CollaborationState['connectionStatus']>) => {
      state.connectionStatus = action.payload;
      state.isConnected = action.payload === 'connected';
    },
    
    // User management
    setCurrentUser: (state, action: PayloadAction<User>) => {
      state.currentUser = action.payload;
    },
    
    updateUsers: (state, action: PayloadAction<User[]>) => {
      state.users = action.payload;
    },
    
    addUser: (state, action: PayloadAction<User>) => {
      const existingIndex = state.users.findIndex(u => u.id === action.payload.id);
      if (existingIndex >= 0) {
        state.users[existingIndex] = action.payload;
      } else {
        state.users.push(action.payload);
      }
    },
    
    removeUser: (state, action: PayloadAction<string>) => {
      state.users = state.users.filter(u => u.id !== action.payload);
      state.cursors = state.cursors.filter(c => c.userId !== action.payload);
      state.sharedSelection = state.sharedSelection.filter(s => s.userId !== action.payload);
    },
    
    updateUserStatus: (state, action: PayloadAction<{ userId: string; isOnline: boolean }>) => {
      const user = state.users.find(u => u.id === action.payload.userId);
      if (user) {
        user.isOnline = action.payload.isOnline;
        if (!action.payload.isOnline) {
          user.lastSeen = Date.now();
        }
      }
    },
    
    // Cursors
    updateCursor: (state, action: PayloadAction<CursorPosition>) => {
      const existingIndex = state.cursors.findIndex(c => c.userId === action.payload.userId);
      if (existingIndex >= 0) {
        state.cursors[existingIndex] = action.payload;
      } else {
        state.cursors.push(action.payload);
      }
      
      // Remove old cursors (older than 5 seconds)
      const now = Date.now();
      state.cursors = state.cursors.filter(c => now - c.timestamp < 5000);
    },
    
    // Actions
    addAction: (state, action: PayloadAction<Omit<UserAction, 'id' | 'timestamp'>>) => {
      const userAction: UserAction = {
        ...action.payload,
        id: `action_${Date.now()}_${Math.random()}`,
        timestamp: Date.now(),
      };
      
      state.actions.push(userAction);
      
      // Keep only last 50 actions
      if (state.actions.length > 50) {
        state.actions.shift();
      }
      
      // Add to history
      state.actionHistory.push(userAction);
      if (state.actionHistory.length > 200) {
        state.actionHistory.shift();
      }
    },
    
    clearActions: (state) => {
      state.actions = [];
    },
    
    // Chat
    addChatMessage: (state, action: PayloadAction<Omit<Chat, 'id' | 'timestamp'>>) => {
      const message: Chat = {
        ...action.payload,
        id: `msg_${Date.now()}_${Math.random()}`,
        timestamp: Date.now(),
      };
      
      state.chatMessages.push(message);
      
      // Increment unread count if chat is closed
      if (!state.isChatOpen && action.payload.userId !== state.currentUser?.id) {
        state.unreadCount++;
      }
      
      // Keep only last 100 messages
      if (state.chatMessages.length > 100) {
        state.chatMessages.shift();
      }
    },
    
    setChatOpen: (state, action: PayloadAction<boolean>) => {
      state.isChatOpen = action.payload;
      if (action.payload) {
        state.unreadCount = 0;
      }
    },
    
    clearUnreadCount: (state) => {
      state.unreadCount = 0;
    },
    
    // Shared viewport
    updateSharedViewport: (state, action: PayloadAction<CollaborationState['sharedViewport']>) => {
      state.sharedViewport = action.payload;
    },
    
    // Shared selection
    updateSharedSelection: (state, action: PayloadAction<{
      userId: string;
      nodeIds: string[];
    }>) => {
      const existingIndex = state.sharedSelection.findIndex(s => s.userId === action.payload.userId);
      const selection = {
        ...action.payload,
        timestamp: Date.now(),
      };
      
      if (existingIndex >= 0) {
        state.sharedSelection[existingIndex] = selection;
      } else {
        state.sharedSelection.push(selection);
      }
      
      // Remove old selections (older than 30 seconds)
      const now = Date.now();
      state.sharedSelection = state.sharedSelection.filter(s => now - s.timestamp < 30000);
    },
    
    clearSharedSelection: (state, action: PayloadAction<string>) => {
      state.sharedSelection = state.sharedSelection.filter(s => s.userId !== action.payload);
    },
    
    // Session management
    setCurrentSession: (state, action: PayloadAction<Session | null>) => {
      state.currentSession = action.payload;
      if (action.payload) {
        // Set permissions based on role
        state.permissions = {
          canEdit: true,
          canInvite: action.payload.owner === state.currentUser?.id,
          canKick: action.payload.owner === state.currentUser?.id,
          canChangeSettings: action.payload.owner === state.currentUser?.id,
        };
      }
    },
    
    updateAvailableSessions: (state, action: PayloadAction<Session[]>) => {
      state.availableSessions = action.payload;
    },
    
    addSessionInvite: (state, action: PayloadAction<{
      sessionId: string;
      fromUser: string;
    }>) => {
      const invite = {
        id: `invite_${Date.now()}`,
        ...action.payload,
        timestamp: Date.now(),
      };
      
      state.sessionInvites.push(invite);
    },
    
    removeSessionInvite: (state, action: PayloadAction<string>) => {
      state.sessionInvites = state.sessionInvites.filter(i => i.id !== action.payload);
    },
    
    // UI state
    setCollaborationPanelOpen: (state, action: PayloadAction<boolean>) => {
      state.showCollaborationPanel = action.payload;
    },
    
    setShowUserCursors: (state, action: PayloadAction<boolean>) => {
      state.showUserCursors = action.payload;
    },
    
    setShowUserActions: (state, action: PayloadAction<boolean>) => {
      state.showUserActions = action.payload;
    },
    
    setFollowMode: (state, action: PayloadAction<CollaborationState['followMode']>) => {
      state.followMode = action.payload;
    },
    
    // Reset
    resetCollaboration: (state) => {
      return { ...initialState, currentUser: state.currentUser };
    },
  },
});

export const {
  setConnectionStatus,
  setCurrentUser,
  updateUsers,
  addUser,
  removeUser,
  updateUserStatus,
  updateCursor,
  addAction,
  clearActions,
  addChatMessage,
  setChatOpen,
  clearUnreadCount,
  updateSharedViewport,
  updateSharedSelection,
  clearSharedSelection,
  setCurrentSession,
  updateAvailableSessions,
  addSessionInvite,
  removeSessionInvite,
  setCollaborationPanelOpen,
  setShowUserCursors,
  setShowUserActions,
  setFollowMode,
  resetCollaboration,
} = collaborationSlice.actions;

export default collaborationSlice.reducer;