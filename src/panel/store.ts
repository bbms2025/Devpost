import { useReducer } from 'react';
import type { MessageEntry, ExtractionStatus } from '../shared/types';

export interface OutlineState {
  entries: MessageEntry[];
  status: ExtractionStatus;
  selectedId: string | null;
}

export type OutlineAction =
  | { type: 'RESET' }
  | { type: 'SET_STATUS'; status: ExtractionStatus }
  | { type: 'APPEND_ENTRIES'; entries: MessageEntry[] }
  | { type: 'ADD_ENTRY'; entry: MessageEntry }
  | { type: 'UPDATE_ENTRY'; entry: MessageEntry }
  | { type: 'SET_SELECTED'; id: string | null }
  | { type: 'SET_ENTRY_FAILED'; id: string };

const initialState: OutlineState = {
  entries: [],
  status: 'waiting',
  selectedId: null,
};

function reducer(state: OutlineState, action: OutlineAction): OutlineState {
  switch (action.type) {
    case 'RESET':
      return { ...initialState };

    case 'SET_STATUS':
      return { ...state, status: action.status };

    case 'APPEND_ENTRIES': {
      // Deduplicate by ID
      const existingIds = new Set(state.entries.map((e) => e.id));
      const newEntries = action.entries.filter((e) => !existingIds.has(e.id));
      return { ...state, entries: [...state.entries, ...newEntries] };
    }

    case 'ADD_ENTRY': {
      // Ignore if already present
      if (state.entries.some((e) => e.id === action.entry.id)) return state;
      return { ...state, entries: [...state.entries, action.entry] };
    }

    case 'UPDATE_ENTRY':
      return {
        ...state,
        entries: state.entries.map((e) =>
          e.id === action.entry.id ? { ...e, ...action.entry } : e
        ),
      };

    case 'SET_SELECTED':
      return { ...state, selectedId: action.id };

    case 'SET_ENTRY_FAILED':
      return {
        ...state,
        entries: state.entries.map((e) =>
          e.id === action.id ? { ...e, status: 'failed' as const } : e
        ),
      };

    default:
      return state;
  }
}

export function useOutlineStore() {
  return useReducer(reducer, initialState);
}
