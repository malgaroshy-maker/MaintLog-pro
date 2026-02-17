export interface TimeEntry {
  start: string;
  end: string;
}

export interface SparePart {
  id: string;
  name: string;
  partNumber: string;
}

export interface UsedPart {
  partId: string;
  name: string;
  partNumber: string;
  quantity: string;
}

export interface LogEntry {
  id: string;
  machine: string;
  line: string;
  description: string;
  totalTime: string;
  quantity: string;
  spareParts: string;
  notes: string;
  timeEntries?: TimeEntry[];
  usedParts?: UsedPart[];
}

export interface ShiftData {
  id: 'night' | 'morning' | 'evening';
  title: string;
  engineers: string;
  entries: LogEntry[];
}

export interface ReportData {
  section: string;
  date: string;
  shifts: {
    night: ShiftData;
    morning: ShiftData;
    evening: ShiftData;
  };
}

export interface AppSettings {
  fontSize: 'small' | 'medium' | 'large' | 'xl';
  fontFamily: 'Inter' | 'Roboto' | 'Open Sans' | 'Lato' | 'Courier Prime';
  theme: 'blue' | 'green' | 'slate' | 'purple' | 'orange' | 'red' | 'midnight';
  compactMode: boolean;
  confirmDeleteRow: boolean;
  enableSpellCheck: boolean;
  showLineColumn: boolean;
  showTimeColumn: boolean;
}

export const INITIAL_ENTRY: LogEntry = {
  id: '',
  machine: '',
  line: '',
  description: '',
  totalTime: '',
  quantity: '',
  spareParts: '',
  notes: ''
};