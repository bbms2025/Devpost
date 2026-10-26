import { useReducer } from 'react';
import type { MessageEntry, ExtractionStatus } from '../shared/types';

export interface ConversationStats {
  userCount: number;
  assistantCount: number;
  totalCount: number;
}

export interface OutlineState {
  entries: MessageEntry[];
  status: ExtractionStatus;
  selectedId: string | null;
  stats: ConversationStats | null;
  staleNavigation: boolean;
  generation: number; // incremented on every OUTLINE_RESET; batches from old generations are discarded
}

export type OutlineAction =
  | { type: 'RESET'; generation: number }
  | { type: 'SET_STATUS'; status: ExtractionStatus; generation?: number }
  | { type: 'APPEND_ENTRIES'; entries: MessageEntry[]; generation: number }
  | { type: 'ADD_ENTRY'; entry: MessageEntry; generation: number }
  | { type: 'UPDATE_ENTRY'; entry: MessageEntry; generation: number }
  | { type: 'SET_SELECTED'; id: string | null }
  | { type: 'SET_ENTRY_FAILED'; id: string }
  | { type: 'SET_STALE_NAVIGATION'; stale: boolean };

const initialState: OutlineState = {
  entries: [],
  status: 'waiting',
  selectedId: null,
  stats: null,
  staleNavigation: false,
  generation: 0,
};

function computeStats(entries: MessageEntry[]): ConversationStats {
  const userCount = entries.filter((e) => e.speaker === 'user').length;
  const assistantCount = entries.filter((e) => e.speaker === 'assistant').length;
  return { userCount, assistantCount, totalCount: entries.length };
}

function reducer(state: OutlineState, action: OutlineAction): OutlineState {
  switch (action.type) {
    case 'RESET':
      return {
        entries: [],
        status: 'waiting',
        selectedId: null,
        stats: null,
        staleNavigation: false,
        generation: action.generation,
      };

    case 'SET_STATUS':
      if (action.generation !== undefined && action.generation !== state.generation) return state;
      return { ...state, status: action.status };

    case 'APPEND_ENTRIES': {
      if (action.generation !== state.generation) return state;
      if (state.entries.length === 0) {
        return {
          ...state,
          entries: action.entries,
          stats: computeStats(action.entries),
          staleNavigation: false,
        };
      }
      const existingIds = new Set(state.entries.map((e) => e.id));
      const newEntries = action.entries.filter((e) => !existingIds.has(e.id));
      if (newEntries.length === 0) return state;
      const merged = [...state.entries, ...newEntries];
      return { ...state, entries: merged, stats: computeStats(merged), staleNavigation: false };
    }

    case 'ADD_ENTRY': {
      if (action.generation !== state.generation) return state;
      if (state.entries.some((e) => e.id === action.entry.id)) return state;
      const merged = [...state.entries, action.entry];
      return { ...state, entries: merged, stats: computeStats(merged) };
    }

    case 'UPDATE_ENTRY': {
      if (action.generation !== state.generation) return state;
      const merged = state.entries.map((e) =>
        e.id === action.entry.id ? { ...e, ...action.entry } : e
      );
      return { ...state, entries: merged, stats: computeStats(merged) };
    }

    case 'SET_SELECTED':
      return { ...state, selectedId: action.id };

    case 'SET_ENTRY_FAILED':
      return {
        ...state,
        staleNavigation: state.entries.length > 0,
        entries: state.entries.map((e) =>
          e.id === action.id ? { ...e, status: 'failed' as const } : e
        ),
      };

    case 'SET_STALE_NAVIGATION':
      return { ...state, staleNavigation: action.stale };

    default:
      return state;
  }
}

export function useOutlineStore() {
  return useReducer(reducer, initialState);
}
