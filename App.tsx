import React, { useState, useEffect, useRef, useCallback } from 'react';
import ShiftSection from './components/ShiftSection';
import { AIChat } from './components/AIChat';
import { AIAnalysisWindow } from './components/AIAnalysisWindow';
import { ReportData, ShiftData, INITIAL_ENTRY, SparePart, AppSettings, LogEntry, UsedPart } from './types';
import { Printer, FileSpreadsheet, Lock, Settings, X, LogOut, Sliders, Plus, Check, Pencil, Calendar, Upload, Download, Type, Trash2, Undo2, Redo2, BarChart3, HardDrive, AlertTriangle, History, Clock, Sparkles, Key, Cpu, LineChart, Layout, Palette, Database, Info, Cloud, CloudUpload, CloudDownload, RefreshCw, FolderSymlink } from 'lucide-react';
import { gatherAllData, restoreData, isFileSystemApiSupported, pickSaveFile, pickOpenFile, writeToFile, readFromFile } from './services/driveService';

// Declare Google global for TypeScript
declare const google: any;

const INITIAL_ROWS = 5;
const DEFAULT_MACHINES = ['CFA', 'TP', 'Buffer', 'ACB', 'Palletizer', 'Straw', 'Shrink'];
const DEFAULT_SECTIONS = ['Filling and Downstream'];

const DEFAULT_SUGGESTIONS = [
  "Inspection", "Cleaning", "Lubrication", "Tightening", "Adjustment", 
  "Testing", "Calibration", "Replacement", "Repair", "Overhaul", 
  "Installation", "Dismantling", "Assembly", "Monitoring",
  "Bearing Replacement", "Sensor Alignment", "Motor Inspection", 
  "Belt Tensioning", "Filter Cleaning", "Oil Level Check", 
  "Chain Adjustment", "Gearbox Check", "Electrical Fault Finding", 
  "Fuse Replacement", "Contactor Replacement", "Emergency Stop Reset", 
  "Guard Repair", "Leakage Fix", "Software Parameter Change", "Jam Removal"
];

const THEMES = {
  blue: { primary: '#305496', accent: '#4472c4', name: 'Classic Blue' },
  green: { primary: '#15803d', accent: '#22c55e', name: 'Emerald Green' },
  slate: { primary: '#334155', accent: '#64748b', name: 'Slate Grey' },
  purple: { primary: '#6b21a8', accent: '#a855f7', name: 'Royal Purple' },
  orange: { primary: '#c2410c', accent: '#fb923c', name: 'Burnt Orange' },
  red: { primary: '#991b1b', accent: '#ef4444', name: 'Crimson Red' },
  midnight: { primary: '#1e293b', accent: '#334155', name: 'Midnight' }
};

const SHIFT_TITLE_COLORS = {
  night: '#94a3b8',   // Darker Slate (Slate 400)
  morning: '#fef08a', // Yellow 200
  evening: '#fed7aa'  // Orange 200
};

const FONT_SIZES = {
  small: 'text-[11px]',
  medium: 'text-[12px]',
  large: 'text-[14px]',
  xl: 'text-[16px]'
};

const FONT_FAMILIES = {
  'Inter': 'font-inter',
  'Roboto': 'font-roboto',
  'Open Sans': 'font-[Open_Sans]',
  'Lato': 'font-[Lato]',
  'Courier Prime': 'font-[Courier_Prime]'
};

const createEmptyShift = (id: 'night' | 'morning' | 'evening', title: string): ShiftData => ({
  id,
  title,
  engineers: '',
  entries: Array.from({ length: INITIAL_ROWS }, () => ({ ...INITIAL_ENTRY, id: crypto.randomUUID() }))
});

// Updated storage key to include section
const getStorageKey = (date: string, section: string) => `maintlog_report_${date}_${section}`;

const INITIAL_DATA_STRUCT: ReportData = {
  section: 'Filling and Downstream',
  date: new Date().toISOString().split('T')[0],
  shifts: {
    night: createEmptyShift('night', 'Night shift report'),
    morning: createEmptyShift('morning', 'Morning shift report'),
    evening: createEmptyShift('evening', 'Evening shift report'),
  }
};

const App: React.FC = () => {
  // Login State
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return localStorage.getItem('isLoggedIn') === 'true';
  });
  const [loginUser, setLoginUser] = useState('');
  const [loginPass, setLoginPass] = useState('');
  const [loginError, setLoginError] = useState('');

  // Settings State
  const [settings, setSettings] = useState<AppSettings>(() => {
    const defaults = { 
        fontSize: 'medium', 
        theme: 'blue', 
        fontFamily: 'Inter', 
        compactMode: false,
        confirmDeleteRow: true,
        enableSpellCheck: false,
        showLineColumn: true,
        showTimeColumn: true,
        enableSuggestions: true,
        customLogo: '',
        dateFormat: 'iso',
        reportTitle: 'Daily Maintenance Activity Report',
        hideEmptyRowsPrint: false,
        autoCapitalize: true,
        geminiApiKey: '',
        aiModel: 'gemini-3-flash-preview',
        aiTemperature: 0.7,
        enableImageGen: true,
        aiImageModel: 'gemini-2.5-flash-image',
        aiImageAspectRatio: '4:3',
        aiThinkingBudget: 0,
        lastSyncTime: ''
    } as AppSettings;

    try {
        const saved = localStorage.getItem('appSettings');
        return saved ? { ...defaults, ...JSON.parse(saved) } : defaults;
    } catch (e) {
        console.error("Failed to parse settings", e);
        return defaults;
    }
  });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [activeSettingsTab, setActiveSettingsTab] = useState<'general' | 'appearance' | 'ai' | 'data'>('general');

  // File System Sync State
  const [syncHandle, setSyncHandle] = useState<FileSystemFileHandle | null>(null);
  const [syncStatus, setSyncStatus] = useState<string>('');
  const [isSyncing, setIsSyncing] = useState(false);

  // Sections List
  const [sections, setSections] = useState<string[]>(() => {
    const saved = localStorage.getItem('sections');
    return saved ? JSON.parse(saved) : DEFAULT_SECTIONS;
  });

  // Selection State (Controls which report is loaded)
  const [currentDate, setCurrentDate] = useState(new Date().toISOString().split('T')[0]);
  const [currentSection, setCurrentSection] = useState(() => {
     return localStorage.getItem('lastActiveSection') || DEFAULT_SECTIONS[0];
  });

  // Export Range State
  const [exportStart, setExportStart] = useState(new Date().toISOString().split('T')[0]);
  const [exportEnd, setExportEnd] = useState(new Date().toISOString().split('T')[0]);

  // App Data State (The currently loaded report)
  const [report, setReport] = useState<ReportData>(INITIAL_DATA_STRUCT);
  
  // Undo/Redo Stacks
  const [history, setHistory] = useState<ReportData[]>([]);
  const [future, setFuture] = useState<ReportData[]>([]);

  // Learned Suggestions State
  const [learnedSuggestions, setLearnedSuggestions] = useState<string[]>(() => {
    const saved = localStorage.getItem('maintlog_learned_suggestions');
    return saved ? JSON.parse(saved) : [];
  });

  // Print State
  const [printModalOpen, setPrintModalOpen] = useState(false);
  const [printFilter, setPrintFilter] = useState<'all' | 'night' | 'morning' | 'evening'>('all');
  
  // Per-Section Database States
  const [machines, setMachines] = useState<string[]>([]);
  const [availableEngineers, setAvailableEngineers] = useState<string[]>([]);
  const [sparePartsDB, setSparePartsDB] = useState<SparePart[]>([]);

  // Section Manager State
  const [sectionManagerOpen, setSectionManagerOpen] = useState(false);
  const [newSectionName, setNewSectionName] = useState('');
  const [editingSection, setEditingSection] = useState<string | null>(null);
  const [editSectionName, setEditSectionName] = useState('');

  // Analytics & History State
  const [analyticsOpen, setAnalyticsOpen] = useState(false);
  const [analysisWindowOpen, setAnalysisWindowOpen] = useState(false);
  const [analyticsData, setAnalyticsData] = useState<{topMachines: {name: string, count: number}[], downtime: {date: string, minutes: number}[], totalInterventions: number}>({ topMachines: [], downtime: [], totalInterventions: 0});
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [historyTargetMachine, setHistoryTargetMachine] = useState('');
  const [machineHistoryData, setMachineHistoryData] = useState<any[]>([]);

  // AI Chat State
  const [aiChatOpen, setAiChatOpen] = useState(false);

  // Auto-save Reference
  const reportRef = useRef(report);
  const isDirtyRef = useRef(false);

  // Save settings
  useEffect(() => {
    localStorage.setItem('appSettings', JSON.stringify(settings));
  }, [settings]);

  // Persist last active section
  useEffect(() => {
    localStorage.setItem('lastActiveSection', currentSection);
  }, [currentSection]);

  // Update ref whenever report changes
  useEffect(() => {
    reportRef.current = report;
    isDirtyRef.current = true;
  }, [report]);

  // Auto-persist Spare Parts DB
  useEffect(() => {
      if (currentSection) {
          localStorage.setItem(`sparePartsDB_${currentSection}`, JSON.stringify(sparePartsDB));
      }
  }, [sparePartsDB, currentSection]);

  // Undo/Redo Keyboard Shortcuts
  useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
          if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
              e.preventDefault();
              undo();
          }
          if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
              e.preventDefault();
              redo();
          }
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
  }, [history, future, report]);

  // Auto-save interval (every 5 seconds)
  useEffect(() => {
    const interval = setInterval(() => {
      if (isDirtyRef.current) {
        saveCurrentReport(reportRef.current);
        // Also sync to file if connected
        if (syncHandle) {
             performFileSync();
        }
        isDirtyRef.current = false;
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [syncHandle]); // Re-bind if handle changes

  const performFileSync = async () => {
      if (!syncHandle) return;
      setIsSyncing(true);
      try {
          const data = gatherAllData();
          await writeToFile(syncHandle, data);
          const now = new Date().toISOString();
          setSettings(prev => ({ ...prev, lastSyncTime: now }));
      } catch (e: any) {
          console.error("Auto-sync failed", e);
          setSyncStatus("Sync failed: " + e.message);
          // If permission lost, clear handle
          if (e.name === 'NotAllowedError') {
              setSyncHandle(null);
              setSyncStatus("Permission lost. Re-connect file.");
          }
      } finally {
          setIsSyncing(false);
      }
  };

  // Load Data when Date or Section Changes
  useEffect(() => {
    loadReportAndConfig(currentDate, currentSection);
  }, [currentDate, currentSection]);

  const loadReportAndConfig = (date: string, section: string) => {
    loadSectionConfig(section);
    const specificKey = getStorageKey(date, section);
    const savedSpecific = localStorage.getItem(specificKey);
    setHistory([]);
    setFuture([]);

    if (savedSpecific) {
        try {
            setReport(JSON.parse(savedSpecific));
            isDirtyRef.current = false;
            return;
        } catch (e) { console.error(e); }
    }

    const legacyKey = `maintlog_report_${date}`;
    const savedLegacy = localStorage.getItem(legacyKey);
    if (savedLegacy) {
        try {
            const legacyData = JSON.parse(savedLegacy);
            if (legacyData.section === section) {
                setReport(legacyData);
                localStorage.setItem(specificKey, savedLegacy);
                return;
            }
        } catch(e) { console.error(e); }
    }

    setReport({
        section: section,
        date: date,
        shifts: {
            night: createEmptyShift('night', 'Night shift report'),
            morning: createEmptyShift('morning', 'Morning shift report'),
            evening: createEmptyShift('evening', 'Evening shift report'),
        }
    });
    isDirtyRef.current = false;
  };

  const updateReport = (newReport: ReportData) => {
      setHistory(prev => {
          const newHistory = [...prev, report];
          if (newHistory.length > 50) return newHistory.slice(1);
          return newHistory;
      });
      setFuture([]); 
      setReport(newReport);
  };

  const undo = () => {
      if (history.length === 0) return;
      const previous = history[history.length - 1];
      const newHistory = history.slice(0, history.length - 1);
      
      setFuture(prev => [report, ...prev]);
      setHistory(newHistory);
      setReport(previous);
  };

  const redo = () => {
      if (future.length === 0) return;
      const next = future[0];
      const newFuture = future.slice(1);

      setHistory(prev => [...prev, report]);
      setFuture(newFuture);
      setReport(next);
  };

  const migrateLegacyData = (sectionName: string) => {
    if (!localStorage.getItem(`machines_${sectionName}`) && localStorage.getItem('machines')) {
        localStorage.setItem(`machines_${sectionName}`, localStorage.getItem('machines')!);
    }
    if (!localStorage.getItem(`availableEngineers_${sectionName}`) && localStorage.getItem('availableEngineers')) {
        localStorage.setItem(`availableEngineers_${sectionName}`, localStorage.getItem('availableEngineers')!);
    }
    if (!localStorage.getItem(`sparePartsDB_${sectionName}`) && localStorage.getItem('sparePartsDB')) {
        localStorage.setItem(`sparePartsDB_${sectionName}`, localStorage.getItem('sparePartsDB')!);
    }
  };

  const loadSectionConfig = (sectionName: string) => {
      if (sectionName === 'Filling and Downstream') {
          migrateLegacyData(sectionName);
      }
      const m = localStorage.getItem(`machines_${sectionName}`);
      setMachines(m ? JSON.parse(m) : DEFAULT_MACHINES);
      const e = localStorage.getItem(`availableEngineers_${sectionName}`);
      setAvailableEngineers(e ? JSON.parse(e) : ['Mahamed Algaroshy']);
      const s = localStorage.getItem(`sparePartsDB_${sectionName}`);
      setSparePartsDB(s ? JSON.parse(s) : []);
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if ((loginUser === 'user' && loginPass === 'pass') || (loginUser === 'admin' && loginPass === 'admin')) {
        setIsAuthenticated(true);
        localStorage.setItem('isLoggedIn', 'true');
        setLoginError('');
    } else {
        setLoginError('Invalid credentials');
    }
  };

  const handleLogout = () => {
      setIsAuthenticated(false);
      localStorage.removeItem('isLoggedIn');
      setLoginUser('');
      setLoginPass('');
  };

  const saveCurrentReport = (data: ReportData) => {
      const key = getStorageKey(data.date, data.section);
      localStorage.setItem(key, JSON.stringify(data));
  };

  const saveMachines = (newMachines: string[]) => {
    setMachines(newMachines);
    localStorage.setItem(`machines_${currentSection}`, JSON.stringify(newMachines));
  };

  const saveSparePartsDB = (newDB: SparePart[]) => {
    setSparePartsDB(newDB);
  };

  const handleAddEngineer = (name: string) => {
    if (name && !availableEngineers.includes(name)) {
      const updated = [...availableEngineers, name];
      setAvailableEngineers(updated);
      localStorage.setItem(`availableEngineers_${currentSection}`, JSON.stringify(updated));
    }
  };

  const handleDeleteEngineer = (name: string) => {
    const updated = availableEngineers.filter(n => n !== name);
    setAvailableEngineers(updated);
    localStorage.setItem(`availableEngineers_${currentSection}`, JSON.stringify(updated));
  };

  const saveSections = (newSections: string[]) => {
    setSections(newSections);
    localStorage.setItem('sections', JSON.stringify(newSections));
  };

  const handleAddSection = () => {
    if (newSectionName.trim() && !sections.includes(newSectionName.trim())) {
        saveSections([...sections, newSectionName.trim()]);
        setNewSectionName('');
    }
  };

  const handleEditSection = (oldName: string) => {
      if (editSectionName.trim() && editSectionName.trim() !== oldName) {
          const newName = editSectionName.trim();
          if (sections.includes(newName)) {
              alert('Section name already exists');
              return;
          }
          const updatedSections = sections.map(s => s === oldName ? newName : s);
          saveSections(updatedSections);
          
          const migrateKey = (keyPrefix: string) => {
              const oldData = localStorage.getItem(`${keyPrefix}_${oldName}`);
              if (oldData) {
                  localStorage.setItem(`${keyPrefix}_${newName}`, oldData);
                  localStorage.removeItem(`${keyPrefix}_${oldName}`);
              }
          };
          migrateKey('machines');
          migrateKey('availableEngineers');
          migrateKey('sparePartsDB');

          if (currentSection === oldName) {
              setCurrentSection(newName);
          }
          setEditingSection(null);
          setEditSectionName('');
      }
  };

  const handleDeleteSection = (name: string) => {
    if (name === 'Filling and Downstream') {
        alert("Cannot delete default section.");
        return;
    }
    if (confirm(`Delete section "${name}" and all its database settings?`)) {
        saveSections(sections.filter(s => s !== name));
        localStorage.removeItem(`machines_${name}`);
        localStorage.removeItem(`availableEngineers_${name}`);
        localStorage.removeItem(`sparePartsDB_${name}`);
        
        if (currentSection === name) {
            setCurrentSection('Filling and Downstream');
        }
    }
  };

  const updateShift = (shiftId: 'night' | 'morning' | 'evening', data: ShiftData) => {
    updateReport({
      ...report,
      shifts: { ...report.shifts, [shiftId]: data }
    });
  };

  const handlePrintRequest = () => {
    setPrintModalOpen(true);
  };

  const executePrint = (filter: 'all' | 'night' | 'morning' | 'evening') => {
      setPrintFilter(filter);
      setTimeout(() => {
          window.print();
          setPrintModalOpen(false);
          setPrintFilter('all');
      }, 500);
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
          const file = e.target.files[0];
          const reader = new FileReader();
          reader.onloadend = () => {
              const base64String = reader.result as string;
              setSettings({ ...settings, customLogo: base64String });
          };
          reader.readAsDataURL(file);
      }
  };

  // --- New File System Sync Logic ---
  const handleConnectSyncFile = async () => {
      if (!isFileSystemApiSupported()) {
          alert("Your browser does not support the File System Access API. Please use Chrome, Edge, or Opera on desktop.");
          return;
      }
      try {
          // Open 'Save' dialog so we create/select a file to WRITE to.
          // This gives us Read/Write permissions until page reload.
          const handle = await pickSaveFile();
          setSyncHandle(handle);
          setSyncStatus(`Connected: ${handle.name}`);
          
          // Perform immediate save
          await performFileSync();
      } catch (err: any) {
          // Handle specific browser restrictions (e.g. iframes, sandboxes)
          if (err.name === 'SecurityError' || (err.message && err.message.includes('Cross origin sub frames'))) {
              alert("⚠️ Environment Restriction\n\nThe File System Access API is blocked in this preview environment (iframe). \n\nTo use Cloud Sync:\n1. Open this app in a full window/new tab.\n2. Or use the 'Manual Backup' buttons below.");
          } else if (err.name !== 'AbortError') {
              console.error(err);
              alert("Error connecting file: " + err.message);
          }
      }
  };

  const handleImportSyncFile = async () => {
      if (!isFileSystemApiSupported()) {
           alert("Your browser does not support the File System Access API.");
           return;
      }
      try {
          const handle = await pickOpenFile();
          const content = await readFromFile(handle);
          if (confirm(`Load data from "${handle.name}"? This will overwrite local changes.`)) {
              restoreData(content);
              setSyncHandle(handle);
              setSyncStatus(`Loaded & Connected: ${handle.name}`);
              window.location.reload();
          }
      } catch (err: any) {
          // Handle specific browser restrictions (e.g. iframes, sandboxes)
          if (err.name === 'SecurityError' || (err.message && err.message.includes('Cross origin sub frames'))) {
              alert("⚠️ Environment Restriction\n\nThe File System Access API is blocked in this preview environment (iframe). \n\nTo use Cloud Sync:\n1. Open this app in a full window/new tab.\n2. Or use the 'Manual Backup' buttons below.");
          } else if (err.name !== 'AbortError') {
               console.error(err);
               alert("Error loading file: " + err.message);
          }
      }
  };

  // ... (Existing export logic, analytics, history, backup/restore local)

  // --- Optimized CSV Export Logic ---
  const timeToMinutes = (timeStr: string): string => {
      if (!timeStr) return "0";
      let totalMinutes = 0;
      const parts = timeStr.split('+');
      parts.forEach(part => {
          const p = part.trim().toLowerCase();
          if (!p) return;
          let partVal = 0;
          let matched = false;
          const hMatch = p.match(/(\d+)\s*h/);
          if (hMatch) {
              partVal += parseInt(hMatch[1], 10) * 60;
              matched = true;
          }
          const mMatch = p.match(/(\d+)\s*m/);
          if (mMatch) {
              partVal += parseInt(mMatch[1], 10);
              matched = true;
          }
          if (!matched) {
              const rawNum = parseInt(p.replace(/[^0-9]/g, ''), 10);
              if (!isNaN(rawNum)) partVal += rawNum;
          }
          totalMinutes += partVal;
      });
      return totalMinutes.toString();
  };

  // Helper to strip HTML tags for CSV
  const stripHtml = (html: string) => {
      if (!html) return '';
      return html.replace(/<[^>]*>/g, '').trim();
  };

  const generateAIExport = (start: string, end: string) => {
      const startDate = new Date(start);
      const endDate = new Date(end);
      const rows = [['Date', 'Section', 'Shift', 'Engineer_Team', 'Machine', 'Line', 'Description', 'Total_Minutes', 'Spare_Parts', 'Spare_Parts_Qty', 'Notes']];

      // Iterate dates
      for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
          const dateStr = d.toISOString().split('T')[0];
          sections.forEach(sec => {
              const key = getStorageKey(dateStr, sec);
              const data = localStorage.getItem(key);
              if (data) {
                  try {
                      const reportData: ReportData = JSON.parse(data);
                      (['night', 'morning', 'evening'] as const).forEach(shiftKey => {
                          const shift = reportData.shifts[shiftKey];
                          shift.entries.forEach(entry => {
                              if (entry.machine || entry.description) {
                                  const partsClean = (entry.spareParts || '').replace(/\n/g, ' | ').replace(/"/g, '""');
                                  const qtyClean = (entry.quantity || '').replace(/\n/g, ' | ').replace(/"/g, '""');
                                  
                                  rows.push([
                                      reportData.date,
                                      reportData.section,
                                      shiftKey, // standardized shift name
                                      `"${(shift.engineers || '').replace(/"/g, '""')}"`,
                                      `"${(entry.machine || '').replace(/"/g, '""')}"`,
                                      `"${(entry.line || '').replace(/"/g, '""')}"`,
                                      `"${stripHtml(entry.description || '').replace(/"/g, '""')}"`,
                                      timeToMinutes(entry.totalTime), // Numeric minutes for AI
                                      `"${partsClean}"`,
                                      `"${qtyClean}"`,
                                      `"${stripHtml(entry.notes || '').replace(/"/g, '""')}"`
                                  ]);
                              }
                          });
                      });
                  } catch (e) { console.error("Error parsing report for export", e); }
              }
          });
      }

      const csvContent = "data:text/csv;charset=utf-8," + rows.map(e => e.join(",")).join("\n");
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `MaintLog_AI_Data_${start}_to_${end}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
  };

  const handleExportCSV = () => {
      const rows = [['Date', 'Section', 'Shift', 'Machine', 'Line', 'Description', 'Total Time', 'Spare Parts', 'Qty', 'Notes']];
      (['night', 'morning', 'evening'] as const).forEach(shiftKey => {
          const shift = report.shifts[shiftKey];
          shift.entries.forEach(entry => {
              if (entry.description || entry.machine) {
                  rows.push([
                      report.date,
                      report.section,
                      shift.title,
                      `"${(entry.machine || '').replace(/"/g, '""')}"`,
                      `"${(entry.line || '').replace(/"/g, '""')}"`,
                      `"${stripHtml(entry.description || '').replace(/"/g, '""')}"`,
                      `"${(entry.totalTime || '').replace(/"/g, '""')}"`,
                      `"${(entry.spareParts || '').replace(/\n/g, '; ').replace(/"/g, '""')}"`,
                      `"${(entry.quantity || '').replace(/\n/g, '; ').replace(/"/g, '""')}"`,
                      `"${stripHtml(entry.notes || '').replace(/"/g, '""')}"`
                  ]);
              }
          });
      });
      const csvContent = "data:text/csv;charset=utf-8," + rows.map(e => e.join(",")).join("\n");
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `MaintLog_${report.date}_${report.section}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
  };

  const calculateAnalytics = () => {
    let machineCounts: {[key: string]: number} = {};
    let downtimeStats: {[key: string]: number} = {};
    let interventionCount = 0;

    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('maintlog_report_') && key.endsWith(currentSection)) {
            try {
                const data: ReportData = JSON.parse(localStorage.getItem(key)!);
                (['night', 'morning', 'evening'] as const).forEach(shiftKey => {
                    const shift = data.shifts[shiftKey];
                    shift.entries.forEach(entry => {
                        if (entry.machine && entry.description) {
                            interventionCount++;
                            machineCounts[entry.machine] = (machineCounts[entry.machine] || 0) + 1;
                            const mins = parseInt(timeToMinutes(entry.totalTime));
                            if (mins > 0) {
                                downtimeStats[data.date] = (downtimeStats[data.date] || 0) + mins;
                            }
                        }
                    });
                });
            } catch (e) { console.error(e); }
        }
    }

    const sortedMachines = Object.entries(machineCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([name, count]) => ({ name, count }));

    const sortedDowntime = Object.entries(downtimeStats)
        .sort((a, b) => new Date(b[0]).getTime() - new Date(a[0]).getTime())
        .slice(0, 7)
        .map(([date, minutes]) => ({ date, minutes }))
        .reverse();

    setAnalyticsData({
        topMachines: sortedMachines,
        downtime: sortedDowntime,
        totalInterventions: interventionCount
    });
    setAnalyticsOpen(true);
  };

  const showMachineHistory = (machineName: string) => {
      setHistoryTargetMachine(machineName);
      const historyList: any[] = [];
      
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('maintlog_report_') && key.endsWith(currentSection)) {
            try {
                const data: ReportData = JSON.parse(localStorage.getItem(key)!);
                (['night', 'morning', 'evening'] as const).forEach(shiftKey => {
                    const shift = data.shifts[shiftKey];
                    shift.entries.forEach(entry => {
                        if (entry.machine === machineName && (entry.description || entry.totalTime)) {
                            historyList.push({
                                date: data.date,
                                shift: shift.title,
                                description: stripHtml(entry.description),
                                totalTime: entry.totalTime,
                                spareParts: entry.spareParts,
                                engineers: shift.engineers
                            });
                        }
                    });
                });
            } catch (e) { console.error(e); }
        }
    }
    historyList.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    setMachineHistoryData(historyList);
    setHistoryModalOpen(true);
  };

  const handleBackup = () => {
    const backupData: any = {};
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key) {
             if(key.startsWith('maintlog_') || key.startsWith('machines_') || key.startsWith('availableEngineers_') || key.startsWith('sparePartsDB_') || key === 'sections' || key === 'appSettings') {
                 backupData[key] = localStorage.getItem(key);
             }
        }
    }
    const blob = new Blob([JSON.stringify(backupData, null, 2)], {type: "application/json"});
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `MaintLog_Backup_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleRestore = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
          const file = e.target.files[0];
          const reader = new FileReader();
          reader.onload = (event) => {
              try {
                  const data = JSON.parse(event.target?.result as string);
                  if (confirm("WARNING: This will overwrite your current database. Are you sure?")) {
                      Object.keys(localStorage).forEach(key => {
                          if (key.startsWith('maintlog_') || key.startsWith('machines_')) {
                              localStorage.removeItem(key);
                          }
                      });
                      Object.keys(data).forEach(key => {
                          localStorage.setItem(key, data[key]);
                      });
                      alert("Restore successful! Reloading application...");
                      window.location.reload();
                  }
              } catch (err) {
                  alert("Invalid backup file.");
              }
          };
          reader.readAsText(file);
      }
  };

  const handleClear = () => {
    if(confirm("Are you sure you want to clear the form? This will overwrite the current entry.")) {
        const freshReport: ReportData = {
            section: currentSection,
            date: currentDate,
            shifts: {
                night: createEmptyShift('night', 'Night shift report'),
                morning: createEmptyShift('morning', 'Morning shift report'),
                evening: createEmptyShift('evening', 'Evening shift report'),
            }
        };
        updateReport(freshReport);
        localStorage.removeItem(getStorageKey(currentDate, currentSection));
    }
  };

  // ... (Learning mechanism, getSuggestions, getFormattedDate, AI tools - Unchanged)

  const handleLearnSuggestion = (text: string) => {
      if (!settings.enableSuggestions) return;
      const cleanText = text.trim();
      if (!cleanText || cleanText.length < 3) return;
      const lowerDefaults = DEFAULT_SUGGESTIONS.map(s => s.toLowerCase());
      const lowerLearned = learnedSuggestions.map(s => s.toLowerCase());

      if (!lowerDefaults.includes(cleanText.toLowerCase()) && !lowerLearned.includes(cleanText.toLowerCase())) {
          const newLearned = [...learnedSuggestions, cleanText].sort();
          setLearnedSuggestions(newLearned);
          localStorage.setItem('maintlog_learned_suggestions', JSON.stringify(newLearned));
      }
  };

  const getSuggestions = () => {
    const unique = new Set([...DEFAULT_SUGGESTIONS, ...learnedSuggestions]);
    (Object.values(report.shifts) as ShiftData[]).forEach(shift => {
        shift.entries.forEach(e => {
            const cleanDesc = stripHtml(e.description);
            if(cleanDesc && cleanDesc.trim()) {
                unique.add(cleanDesc.trim());
            }
        })
    });
    return Array.from(unique).sort();
  };

  const suggestions = getSuggestions();

  const getFormattedDate = (isoDate: string) => {
      if (!isoDate) return '';
      const d = new Date(isoDate);
      if (settings.dateFormat === 'uk') {
          return `${d.getDate().toString().padStart(2,'0')}/${(d.getMonth()+1).toString().padStart(2,'0')}/${d.getFullYear()}`;
      } else if (settings.dateFormat === 'us') {
          return `${(d.getMonth()+1).toString().padStart(2,'0')}/${d.getDate().toString().padStart(2,'0')}/${d.getFullYear()}`;
      }
      return isoDate;
  }

  // AI Tools logic
  const addEntryToReportObject = (reportObj: ReportData, args: any, currentSparePartsDB: SparePart[]) => {
      const shiftId = args.shift?.toLowerCase() as 'night'|'morning'|'evening';
      if (!shiftId || !['night','morning','evening'].includes(shiftId)) throw new Error("Invalid shift: " + args.shift);
      
      const shift = reportObj.shifts[shiftId];
      // Try to find the first truly empty row to overwrite, otherwise append
      const emptyEntryIndex = shift.entries.findIndex(e => !e.machine && !e.description && !e.notes);
      
      let newEntries = [...shift.entries];
      
      let usedPartsData: UsedPart[] = [];
      let sparePartsString = "";
      let quantityString = "";

      if (args.used_parts && Array.isArray(args.used_parts)) {
          usedPartsData = args.used_parts.map((up: any) => {
              const dbPart = currentSparePartsDB.find(p => p.name.toLowerCase() === up.name.toLowerCase());
              const partName = dbPart ? dbPart.name : up.name;
              const partNum = dbPart ? dbPart.partNumber : "N/A";
              const partId = dbPart ? dbPart.id : crypto.randomUUID(); 
              return { partId, name: partName, partNumber: partNum, quantity: up.quantity || "1" };
          });
          sparePartsString = usedPartsData.map(p => `${p.name} (${p.partNumber})`).join('\n');
          quantityString = usedPartsData.map(p => p.quantity).join('\n');
      }

      const entryData = {
          machine: args.machine || '',
          line: args.line || '',
          description: args.description || '',
          notes: args.notes || '',
          totalTime: args.totalTime || '',
          spareParts: sparePartsString,
          quantity: quantityString,
          usedParts: usedPartsData
      };

      if (emptyEntryIndex !== -1) {
          // Update the existing empty row
          newEntries[emptyEntryIndex] = { ...newEntries[emptyEntryIndex], ...entryData };
      } else {
          // Append new row
          newEntries.push({ ...INITIAL_ENTRY, id: crypto.randomUUID(), ...entryData });
      }

      return { ...reportObj, shifts: { ...reportObj.shifts, [shiftId]: { ...shift, entries: newEntries } } };
  };

  const handleAiToolAction = async (toolName: string, args: any): Promise<any> => {
      // Use ref to ensure we work with latest data in current closure
      const currentReport = reportRef.current;
      let updatedReport = JSON.parse(JSON.stringify(currentReport));

      if (toolName === 'change_date') {
          if (args.date) {
              setCurrentDate(args.date);
              return `Date changed to ${args.date}`;
          }
          return "No date provided";
      }

      if (toolName === 'add_spare_part') {
          if (args.name && args.partNumber) {
              // Check duplicate
              if (sparePartsDB.some(p => p.name.toLowerCase() === args.name.toLowerCase())) {
                  return "Part already exists.";
              }
              const newPart = { id: crypto.randomUUID(), name: args.name, partNumber: args.partNumber };
              const updatedDB = [...sparePartsDB, newPart];
              setSparePartsDB(updatedDB); // This triggers the useEffect to save to localStorage
              return `Spare part added: ${args.name}`;
          }
          return "Name and Part Number required";
      }

      if (toolName === 'manage_engineers') {
          if (args.action === 'add_to_database') {
              const newNames = args.names.filter((n: string) => !availableEngineers.includes(n));
              if (newNames.length > 0) {
                  const updated = [...availableEngineers, ...newNames];
                  setAvailableEngineers(updated);
                  localStorage.setItem(`availableEngineers_${currentSection}`, JSON.stringify(updated));
                  return `Added engineers to database: ${newNames.join(', ')}`;
              }
              return "Engineers already exist in database.";
          }
          if (args.action === 'assign_to_shift') {
              const shiftId = args.shift?.toLowerCase();
              if (shiftId && ['night','morning','evening'].includes(shiftId)) {
                  const names = args.names.join(', ');
                  updatedReport.shifts[shiftId].engineers = names;
                  updateReport(updatedReport);
                  return `Assigned ${names} to ${shiftId} shift.`;
              }
              return "Invalid shift for assignment.";
          }
      }

      if (toolName === 'add_log_entries') {
          try {
              if (Array.isArray(args.entries)) {
                  const entriesByDate: Record<string, any[]> = {};
                  const currentSec = reportRef.current.section;

                  // Group by date
                  args.entries.forEach((entry: any) => {
                      const date = entry.date || reportRef.current.date; // Default to current
                      if (!entriesByDate[date]) entriesByDate[date] = [];
                      entriesByDate[date].push(entry);
                  });

                  let currentReportUpdated = false;
                  let updatedCurrentReport = JSON.parse(JSON.stringify(reportRef.current));

                  for (const [date, entries] of Object.entries(entriesByDate)) {
                      if (date === reportRef.current.date) {
                          // Update current report state
                          entries.forEach(e => {
                              updatedCurrentReport = addEntryToReportObject(updatedCurrentReport, e, sparePartsDB);
                          });
                          currentReportUpdated = true;
                      } else {
                          // Update localStorage for other dates
                          const key = getStorageKey(date, currentSec);
                          let storedReport: ReportData;
                          const storedJson = localStorage.getItem(key);
                          
                          if (storedJson) {
                              storedReport = JSON.parse(storedJson);
                          } else {
                              // Create new if not exists
                              storedReport = {
                                  section: currentSec,
                                  date: date,
                                  shifts: {
                                      night: createEmptyShift('night', 'Night shift report'),
                                      morning: createEmptyShift('morning', 'Morning shift report'),
                                      evening: createEmptyShift('evening', 'Evening shift report'),
                                  }
                              };
                          }

                          entries.forEach(e => {
                              storedReport = addEntryToReportObject(storedReport, e, sparePartsDB);
                          });
                          
                          localStorage.setItem(key, JSON.stringify(storedReport));
                      }
                  }

                  if (currentReportUpdated) {
                      updateReport(updatedCurrentReport);
                  }
                  
                  return `Successfully added ${args.entries.length} entries across ${Object.keys(entriesByDate).length} dates.`;
              }
              return "Invalid format: entries must be an array.";
          } catch (e: any) {
              return "Failed to add entries: " + e.message;
          }
      }

      if (toolName === 'edit_log_entries') {
          try {
              if (!Array.isArray(args.edits)) return "Edits must be an array.";
              const editsMap = new Map(args.edits.map((e:any) => [e.id, e]));
              let count = 0;

              (['night', 'morning', 'evening'] as const).forEach(shiftId => {
                  updatedReport.shifts[shiftId].entries = updatedReport.shifts[shiftId].entries.map((e: LogEntry) => {
                      if (editsMap.has(e.id)) {
                          count++;
                          const { id, ...updates } = editsMap.get(e.id) as any;
                          
                          // Handle complex updates like used_parts
                          let partUpdates = {};
                          if (updates.used_parts) {
                              const usedPartsData = updates.used_parts.map((up: any) => {
                                  const dbPart = sparePartsDB.find(p => p.name.toLowerCase() === up.name.toLowerCase());
                                  return { 
                                      partId: dbPart?.id || crypto.randomUUID(), 
                                      name: up.name, 
                                      partNumber: dbPart?.partNumber || "N/A", 
                                      quantity: up.quantity || "1" 
                                  };
                              });
                              partUpdates = {
                                  usedParts: usedPartsData,
                                  spareParts: usedPartsData.map((p: any) => `${p.name} (${p.partNumber})`).join('\n'),
                                  quantity: usedPartsData.map((p: any) => p.quantity).join('\n')
                              };
                              delete updates.used_parts;
                          }

                          return { ...e, ...updates, ...partUpdates };
                      }
                      return e;
                  });
              });
              
              if (count > 0) {
                  updateReport(updatedReport);
                  return `Updated ${count} entries.`;
              }
              return "No matching entries found to edit.";
          } catch (e: any) {
              return "Edit error: " + e.message;
          }
      }

      if (toolName === 'delete_log_entries') {
          if (!Array.isArray(args.ids)) return "IDs must be an array.";
          const idsToDelete = new Set(args.ids);
          let deletedCount = 0;

          (['night', 'morning', 'evening'] as const).forEach(shiftId => {
              const originalLen = updatedReport.shifts[shiftId].entries.length;
              updatedReport.shifts[shiftId].entries = updatedReport.shifts[shiftId].entries.filter((e: LogEntry) => !idsToDelete.has(e.id));
              deletedCount += (originalLen - updatedReport.shifts[shiftId].entries.length);
          });
          
          updateReport(updatedReport);
          return `Deleted ${deletedCount} entries.`;
      }

      return "Tool not recognized.";
  };


  if (!isAuthenticated) {
     return <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-inter">
        <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md flex flex-col border border-slate-100">
           <div className="flex justify-center mb-6">
              <div className="bg-gradient-to-br from-blue-600 to-blue-800 p-4 rounded-2xl shadow-lg transform rotate-3"><Lock className="text-white" size={32} /></div>
           </div>
           <h1 className="text-3xl font-bold text-center mb-2 text-slate-800 tracking-tight">MaintLog Pro</h1>
           <form onSubmit={handleLogin} className="flex-grow space-y-4">
              <div>
                 <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Username</label>
                 <input className="w-full bg-black border border-gray-700 p-3 rounded-lg text-white" type="text" value={loginUser} onChange={e => setLoginUser(e.target.value)} placeholder="Enter username" />
              </div>
              <div>
                 <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Password</label>
                 <input className="w-full bg-black border border-gray-700 p-3 rounded-lg text-white" type="password" value={loginPass} onChange={e => setLoginPass(e.target.value)} placeholder="Enter password" />
              </div>
              {loginError && <div className="text-red-500 text-sm text-center font-medium bg-red-50 p-2 rounded-lg">{loginError}</div>}
              <button className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 transition-all shadow-md hover:shadow-lg mt-2">Login to System</button>
           </form>
        </div>
      </div>
  }

  const currentTheme = THEMES[settings.theme];
  const fontSizeClass = FONT_SIZES[settings.fontSize];
  const fontFamilyClass = FONT_FAMILIES[settings.fontFamily] || 'font-inter';

  return (
    <div className={`min-h-screen bg-slate-50 print:bg-white ${fontSizeClass} ${fontFamilyClass}`}>
      
      <AIChat 
        isOpen={aiChatOpen} 
        onClose={() => setAiChatOpen(false)} 
        apiKey={settings.geminiApiKey}
        model={settings.aiModel}
        report={report}
        sparePartsDB={sparePartsDB}
        machines={machines}
        availableEngineers={availableEngineers}
        onToolAction={handleAiToolAction}
        temperature={settings.aiTemperature}
      />

      <AIAnalysisWindow 
        isOpen={analysisWindowOpen} 
        onClose={() => setAnalysisWindowOpen(false)} 
        apiKey={settings.geminiApiKey}
        model={settings.aiModel}
        sections={sections}
        currentDate={currentDate}
        currentSection={currentSection}
        temperature={settings.aiTemperature}
        enableImageGen={settings.enableImageGen}
        imageModel={settings.aiImageModel}
        imageAspectRatio={settings.aiImageAspectRatio}
        thinkingBudget={settings.aiThinkingBudget}
      />

      {/* Analytics Modal Code ... */}
      {/* History Modal Code ... */}

      {settingsOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 print:hidden">
          <div className="bg-white rounded-2xl shadow-2xl w-[900px] h-[600px] flex overflow-hidden">
             
             <div className="w-64 bg-slate-50 border-r border-slate-200 flex flex-col p-4">
                 <h3 className="font-bold text-lg text-slate-800 mb-6 flex items-center gap-2"><Sliders size={20}/> Settings</h3>
                 <nav className="space-y-1 flex-1">
                     {['general', 'appearance', 'ai', 'data'].map(tab => (
                        <button key={tab} onClick={() => setActiveSettingsTab(tab as any)} className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 capitalize ${activeSettingsTab === tab ? 'bg-blue-100 text-blue-700' : 'text-slate-600 hover:bg-slate-100'}`}>
                           {tab === 'general' && <Layout size={16}/>}
                           {tab === 'appearance' && <Palette size={16}/>}
                           {tab === 'ai' && <Sparkles size={16}/>}
                           {tab === 'data' && <Database size={16}/>}
                           {tab === 'ai' ? 'AI Copilot' : tab + (tab === 'data' ? ' Management' : '')}
                        </button>
                     ))}
                 </nav>
                 <div className="mt-auto pt-4 border-t border-slate-200 text-[10px] text-slate-400 text-center">MaintLog Pro v2.1.0</div>
             </div>

             <div className="flex-1 flex flex-col h-full bg-white">
                 <div className="flex-1 overflow-y-auto p-8">
                     <div className="max-w-2xl mx-auto space-y-8">
                         
                         {activeSettingsTab === 'general' && (
                             <div className="space-y-6 animate-in fade-in duration-300">
                                 <div>
                                     <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2"><Layout /> General Configuration</h2>
                                     
                                     <div className="space-y-4">
                                         <div>
                                            <label className="block text-sm font-bold text-slate-700 mb-1">Report Title</label>
                                            <input className="w-full border border-slate-300 rounded-lg py-2 px-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none" value={settings.reportTitle} onChange={e => setSettings({...settings, reportTitle: e.target.value})} />
                                         </div>
                                         <div>
                                            <label className="block text-sm font-bold text-slate-700 mb-1">Date Format</label>
                                            <select className="w-full border border-slate-300 rounded-lg py-2 px-3 text-sm bg-white text-black" value={settings.dateFormat} onChange={e => setSettings({...settings, dateFormat: e.target.value as any})}>
                                                <option value="iso">ISO (YYYY-MM-DD)</option>
                                                <option value="uk">UK/EU (DD/MM/YYYY)</option>
                                                <option value="us">US (MM/DD/YYYY)</option>
                                            </select>
                                         </div>

                                         <div className="pt-4 border-t border-slate-100">
                                            {/* Auto Capitalize Toggle - NEW */}
                                            <label className="flex items-center gap-3 cursor-pointer py-2">
                                                <input 
                                                    type="checkbox"
                                                    checked={settings.autoCapitalize}
                                                    onChange={(e) => setSettings({...settings, autoCapitalize: e.target.checked})}
                                                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                                                />
                                                <div>
                                                    <span className="text-sm font-bold text-slate-800 block">Auto-Capitalize</span>
                                                    <span className="text-xs text-slate-500">Automatically capitalize the first letter of sentences in descriptions.</span>
                                                </div>
                                            </label>

                                            <label className="flex items-center gap-3 cursor-pointer py-2">
                                                <input 
                                                    type="checkbox"
                                                    checked={settings.enableSuggestions}
                                                    onChange={(e) => setSettings({...settings, enableSuggestions: e.target.checked})}
                                                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                                                />
                                                <div>
                                                    <span className="text-sm font-bold text-slate-800 block">Smart Suggestions</span>
                                                    <span className="text-xs text-slate-500">Enable autocomplete for work descriptions based on history.</span>
                                                </div>
                                            </label>
                                            <label className="flex items-center gap-3 cursor-pointer py-2">
                                                <input 
                                                    type="checkbox"
                                                    checked={settings.enableSpellCheck}
                                                    onChange={(e) => setSettings({...settings, enableSpellCheck: e.target.checked})}
                                                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                                                />
                                                <div>
                                                    <span className="text-sm font-bold text-slate-800 block">Browser Spell Check</span>
                                                    <span className="text-xs text-slate-500">Highlight spelling errors in text fields.</span>
                                                </div>
                                            </label>
                                            <label className="flex items-center gap-3 cursor-pointer py-2">
                                                <input 
                                                    type="checkbox"
                                                    checked={settings.confirmDeleteRow}
                                                    onChange={(e) => setSettings({...settings, confirmDeleteRow: e.target.checked})}
                                                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                                                />
                                                <div>
                                                    <span className="text-sm font-bold text-slate-800 block">Confirm Row Deletion</span>
                                                    <span className="text-xs text-slate-500">Ask for confirmation before deleting a log entry.</span>
                                                </div>
                                            </label>
                                         </div>
                                     </div>
                                 </div>
                             </div>
                         )}

                         {/* Appearance Tab Content */}
                         {activeSettingsTab === 'appearance' && (
                             <div className="space-y-6 animate-in fade-in duration-300">
                                 <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2"><Palette /> Visual Customization</h2>
                                 
                                 {/* Color Theme */}
                                 <div className="mb-6">
                                     <label className="block text-sm font-bold text-slate-700 mb-3">Color Theme</label>
                                     <div className="grid grid-cols-4 gap-3">
                                         {Object.entries(THEMES).map(([key, theme]: [string, any]) => (
                                             <button 
                                                 key={key}
                                                 onClick={() => setSettings({...settings, theme: key as any})}
                                                 className={`flex flex-col items-center gap-2 p-2 rounded-xl border-2 transition-all ${settings.theme === key ? 'border-blue-500 bg-blue-50' : 'border-transparent hover:bg-slate-50'}`}
                                             >
                                                 <div className="w-full h-8 rounded-lg shadow-sm" style={{ background: `linear-gradient(135deg, ${theme.primary}, ${theme.accent})` }}></div>
                                                 <span className="text-xs font-medium text-slate-600 capitalize">{theme.name}</span>
                                             </button>
                                         ))}
                                     </div>
                                 </div>

                                 {/* Typography */}
                                 <div className="grid grid-cols-2 gap-6 mb-6">
                                      <div>
                                          <label className="block text-sm font-bold text-slate-700 mb-2">Font Family</label>
                                          <select className="w-full border border-slate-300 rounded-lg p-2 text-sm bg-white text-black" value={settings.fontFamily} onChange={(e) => setSettings({...settings, fontFamily: e.target.value as any})}>
                                              {Object.keys(FONT_FAMILIES).map(f => <option key={f} value={f}>{f}</option>)}
                                          </select>
                                      </div>
                                      <div>
                                          <label className="block text-sm font-bold text-slate-700 mb-2">Font Size</label>
                                          <div className="flex bg-slate-100 rounded-lg p-1">
                                              {['small', 'medium', 'large', 'xl'].map(s => (
                                                  <button 
                                                      key={s}
                                                      onClick={() => setSettings({...settings, fontSize: s as any})}
                                                      className={`flex-1 py-1.5 rounded-md text-xs font-bold capitalize transition-all ${settings.fontSize === s ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                                  >
                                                      {s}
                                                  </button>
                                              ))}
                                          </div>
                                      </div>
                                 </div>

                                 {/* View Options */}
                                 <div className="space-y-3 pt-4 border-t border-slate-100">
                                      <label className="flex items-center justify-between cursor-pointer p-3 rounded-lg border border-slate-200 hover:border-blue-300 hover:bg-blue-50/30 transition-all">
                                          <span className="text-sm font-medium text-slate-700">Compact Mode (High Density)</span>
                                          <input type="checkbox" checked={settings.compactMode} onChange={(e) => setSettings({...settings, compactMode: e.target.checked})} className="toggle-checkbox w-5 h-5 text-blue-600 rounded" />
                                      </label>
                                      <label className="flex items-center justify-between cursor-pointer p-3 rounded-lg border border-slate-200 hover:border-blue-300 hover:bg-blue-50/30 transition-all">
                                          <span className="text-sm font-medium text-slate-700">Show "Line" Column</span>
                                          <input type="checkbox" checked={settings.showLineColumn} onChange={(e) => setSettings({...settings, showLineColumn: e.target.checked})} className="w-5 h-5 text-blue-600 rounded" />
                                      </label>
                                      <label className="flex items-center justify-between cursor-pointer p-3 rounded-lg border border-slate-200 hover:border-blue-300 hover:bg-blue-50/30 transition-all">
                                          <span className="text-sm font-medium text-slate-700">Show "Total Time" Column</span>
                                          <input type="checkbox" checked={settings.showTimeColumn} onChange={(e) => setSettings({...settings, showTimeColumn: e.target.checked})} className="w-5 h-5 text-blue-600 rounded" />
                                      </label>
                                      <label className="flex items-center justify-between cursor-pointer p-3 rounded-lg border border-slate-200 hover:border-blue-300 hover:bg-blue-50/30 transition-all">
                                          <span className="text-sm font-medium text-slate-700">Hide Empty Rows in Print</span>
                                          <input type="checkbox" checked={settings.hideEmptyRowsPrint} onChange={(e) => setSettings({...settings, hideEmptyRowsPrint: e.target.checked})} className="w-5 h-5 text-blue-600 rounded" />
                                      </label>
                                 </div>

                                 {/* Logo Upload */}
                                 <div className="pt-6 mt-6 border-t border-slate-200">
                                     <h3 className="text-sm font-bold text-slate-700 mb-3">Custom Branding</h3>
                                     <div className="flex items-center gap-4">
                                         {settings.customLogo ? (
                                             <div className="relative group">
                                                 <img src={settings.customLogo} alt="Logo" className="h-12 w-auto object-contain border border-slate-200 rounded p-1" />
                                                 <button onClick={() => setSettings({...settings, customLogo: ''})} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"><X size={12}/></button>
                                             </div>
                                         ) : <div className="h-12 w-32 bg-slate-100 rounded border border-dashed border-slate-300 flex items-center justify-center text-xs text-slate-400">No Logo</div>}
                                         
                                         <label className="bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 px-3 py-2 rounded-lg text-xs font-bold shadow-sm cursor-pointer transition-colors">
                                             Upload Logo
                                             <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
                                         </label>
                                     </div>
                                 </div>
                             </div>
                         )}

                         {/* AI Tab Content */}
                         {activeSettingsTab === 'ai' && (
                            <div className="space-y-6 animate-in fade-in duration-300">
                                <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2"><Sparkles /> AI Configuration</h2>
                                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 mb-6">
                                    <label className="block text-xs font-bold text-slate-500 mb-1">API Key</label>
                                    <input type="password" className="w-full border border-slate-300 rounded px-3 py-2 text-sm bg-white text-black" value={settings.geminiApiKey || ''} onChange={(e) => setSettings({...settings, geminiApiKey: e.target.value})} placeholder="Enter Google Gemini API Key..." />
                                </div>
                                
                                <div className="space-y-6">
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 mb-2">Model Selection</label>
                                        <select className="w-full border border-slate-300 rounded-lg p-2 text-sm bg-white text-black" value={settings.aiModel} onChange={(e) => setSettings({...settings, aiModel: e.target.value})}>
                                            <option value="gemini-3-flash-preview">Gemini 3 Flash (Fast & Efficient)</option>
                                            <option value="gemini-3-pro-preview">Gemini 3 Pro (Reasoning & Complex Tasks)</option>
                                            <option value="gemini-2.0-flash">Gemini 2.0 Flash</option>
                                        </select>
                                    </div>

                                    <div>
                                        <div className="flex justify-between mb-2">
                                            <label className="text-sm font-bold text-slate-700">Creativity (Temperature)</label>
                                            <span className="text-xs font-medium text-slate-500">{settings.aiTemperature}</span>
                                        </div>
                                        <input type="range" min="0" max="1" step="0.1" value={settings.aiTemperature} onChange={(e) => setSettings({...settings, aiTemperature: parseFloat(e.target.value)})} className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600" />
                                        <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                                            <span>Precise</span>
                                            <span>Creative</span>
                                        </div>
                                    </div>

                                    {/* Reasoning/Thinking Budget */}
                                    <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                                        <div className="flex justify-between mb-2">
                                            <label className="text-sm font-bold text-blue-800 flex items-center gap-2"><Cpu size={14}/> Thinking Budget</label>
                                            <span className="text-xs font-bold text-blue-600">{settings.aiThinkingBudget > 0 ? `${settings.aiThinkingBudget} Tokens` : 'Disabled'}</span>
                                        </div>
                                        <input type="range" min="0" max="8192" step="1024" value={settings.aiThinkingBudget} onChange={(e) => setSettings({...settings, aiThinkingBudget: parseInt(e.target.value)})} className="w-full h-2 bg-blue-200 rounded-lg appearance-none cursor-pointer accent-blue-600" />
                                        <p className="text-[10px] text-blue-600/70 mt-2 leading-relaxed">
                                            Allocates "thinking tokens" for the model to reason before answering. Higher values improve complex logic but increase latency. Only works with specific models (e.g. Gemini 2.5/3.0). Set to 0 to disable.
                                        </p>
                                    </div>

                                    <div className="pt-4 border-t border-slate-100">
                                        <label className="flex items-center justify-between cursor-pointer p-3 rounded-lg border border-slate-200 hover:bg-slate-50 transition-all mb-4">
                                            <span className="text-sm font-bold text-slate-700">Enable Image Generation</span>
                                            <input type="checkbox" checked={settings.enableImageGen} onChange={(e) => setSettings({...settings, enableImageGen: e.target.checked})} className="w-5 h-5 text-blue-600 rounded" />
                                        </label>

                                        {settings.enableImageGen && (
                                            <div className="grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2">
                                                <div>
                                                    <label className="block text-xs font-bold text-slate-500 mb-1">Image Model</label>
                                                    <select className="w-full border border-slate-300 rounded p-1.5 text-xs bg-white text-black" value={settings.aiImageModel} onChange={(e) => setSettings({...settings, aiImageModel: e.target.value})}>
                                                        <option value="gemini-2.5-flash-image">Gemini 2.5 Flash Image</option>
                                                        <option value="imagen-3.0-generate-001">Imagen 3.0</option>
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-bold text-slate-500 mb-1">Aspect Ratio</label>
                                                    <select className="w-full border border-slate-300 rounded p-1.5 text-xs bg-white text-black" value={settings.aiImageAspectRatio} onChange={(e) => setSettings({...settings, aiImageAspectRatio: e.target.value as any})}>
                                                        <option value="1:1">Square (1:1)</option>
                                                        <option value="16:9">Landscape (16:9)</option>
                                                        <option value="4:3">Standard (4:3)</option>
                                                        <option value="3:4">Portrait (3:4)</option>
                                                    </select>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                         )}


                         {activeSettingsTab === 'data' && (
                             <div className="space-y-6 animate-in fade-in duration-300">
                                 <div>
                                     <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2"><Database /> Data Management</h2>
                                     
                                     {/* File System Sync Section */}
                                     <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm mb-6">
                                         <h4 className="font-bold text-slate-800 mb-4 flex items-center gap-2"><Cloud className="text-blue-500"/> Cloud Drive Sync (via Local File)</h4>
                                         
                                         <div className="bg-blue-50 p-4 rounded-lg mb-4 text-sm text-slate-700 border border-blue-100">
                                             <p><strong>How it works:</strong> Click "Connect Sync File" and create/select a file inside your <strong>Google Drive</strong>, <strong>OneDrive</strong>, or <strong>Dropbox</strong> folder on your computer.</p>
                                             <p className="mt-2 text-xs text-slate-500">The app will automatically save your changes to this file, and your cloud software will sync it.</p>
                                         </div>

                                         {!syncHandle ? (
                                             <div className="grid grid-cols-2 gap-3">
                                                 <button onClick={handleConnectSyncFile} className="flex flex-col items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-xl font-bold transition-all shadow-md">
                                                     <FolderSymlink size={24}/> 
                                                     <span>Connect Sync File</span>
                                                     <span className="text-[10px] font-normal opacity-80">Creates a new sync file</span>
                                                 </button>
                                                 <button onClick={handleImportSyncFile} className="flex flex-col items-center justify-center gap-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 py-4 rounded-xl font-bold transition-all shadow-sm">
                                                     <Upload size={24}/> 
                                                     <span>Load Existing File</span>
                                                     <span className="text-[10px] font-normal opacity-80">Restores data & connects</span>
                                                 </button>
                                             </div>
                                         ) : (
                                             <div className="space-y-4">
                                                 <div className="flex items-center gap-3 text-green-700 bg-green-50 p-4 rounded-xl border border-green-100">
                                                     <div className="bg-green-200 p-2 rounded-full"><Check size={20}/></div>
                                                     <div>
                                                         <div className="font-bold text-sm">Sync Active</div>
                                                         <div className="text-xs opacity-80 truncate max-w-[200px]">{syncStatus}</div>
                                                     </div>
                                                 </div>
                                                 
                                                 <div className="flex justify-between items-center text-xs text-slate-400 px-1">
                                                     <span>Last Synced: {settings.lastSyncTime ? new Date(settings.lastSyncTime).toLocaleTimeString() : 'Just now'}</span>
                                                     {isSyncing && <span className="flex items-center gap-1 text-blue-500"><RefreshCw size={10} className="animate-spin"/> Syncing...</span>}
                                                 </div>

                                                 <button onClick={() => setSyncHandle(null)} className="w-full text-center text-red-500 hover:text-red-700 text-xs font-medium py-2">
                                                     Disconnect File
                                                 </button>
                                             </div>
                                         )}
                                     </div>

                                     <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 mb-6 text-center">
                                         <p className="text-sm text-slate-600 mb-4">Manual Backup: Export the full application database to a standard JSON file.</p>
                                         <div className="flex gap-4 justify-center">
                                            <button onClick={handleBackup} className="bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 px-4 py-2 rounded-lg text-sm font-bold shadow-sm flex items-center gap-2">
                                                <Download size={16}/> Download Backup
                                            </button>
                                            <label className="bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 px-4 py-2 rounded-lg text-sm font-bold shadow-sm flex items-center gap-2 cursor-pointer">
                                                <Upload size={16}/> Restore Backup
                                                <input type="file" accept=".json" onChange={handleRestore} className="hidden" />
                                            </label>
                                         </div>
                                     </div>

                                     <div className="bg-blue-50 p-6 rounded-xl border border-blue-100 mb-6">
                                         <h4 className="font-bold text-blue-800 mb-2 flex items-center gap-2"><FileSpreadsheet size={16}/> Bulk CSV Export</h4>
                                         <div className="flex gap-4 items-end mb-4">
                                             <div className="flex-1">
                                                 <label className="text-[10px] uppercase font-bold text-blue-500 block mb-1">Start Date</label>
                                                 <input type="date" value={exportStart} onChange={e => setExportStart(e.target.value)} className="w-full text-sm p-2 rounded border border-blue-200" />
                                             </div>
                                             <div className="flex-1">
                                                 <label className="text-[10px] uppercase font-bold text-blue-500 block mb-1">End Date</label>
                                                 <input type="date" value={exportEnd} onChange={e => setExportEnd(e.target.value)} className="w-full text-sm p-2 rounded border border-blue-200" />
                                             </div>
                                         </div>
                                         <button onClick={() => generateAIExport(exportStart, exportEnd)} className="w-full bg-blue-600 text-white text-sm font-bold py-2 rounded-lg hover:bg-blue-700 transition-colors">Download CSV</button>
                                     </div>

                                     <div className="pt-6 border-t border-slate-200">
                                         <button onClick={handleClear} className="text-red-500 hover:text-red-700 text-sm font-medium flex items-center gap-2"><Trash2 size={16}/> Clear Current Report Form</button>
                                     </div>
                                 </div>
                             </div>
                         )}

                     </div>
                 </div>
                 
                 <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end">
                     <button onClick={() => setSettingsOpen(false)} className="bg-slate-800 text-white px-6 py-2 rounded-lg hover:bg-slate-700 font-medium transition-colors shadow-lg">Close Settings</button>
                 </div>
             </div>
          </div>
        </div>
      )}

      {/* Other components (SectionManager, PrintModal, FloatingToolbar, MainReportCard) remain ... */}
      {sectionManagerOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 print:hidden" onClick={() => setSectionManagerOpen(false)}>
              <div className="bg-white rounded-2xl shadow-2xl w-96 p-6" onClick={e => e.stopPropagation()}>
                  <div className="flex justify-between items-center mb-4">
                      <h3 className="font-bold text-lg text-slate-800">Manage Sections</h3>
                      <button onClick={() => setSectionManagerOpen(false)} className="text-slate-400 hover:text-slate-700"><X size={20}/></button>
                  </div>
                  <div className="flex gap-2 mb-4">
                      <input className="border border-slate-300 p-2.5 flex-1 text-sm rounded-lg text-black bg-white focus:ring-2 focus:ring-green-500 outline-none" placeholder="New section name..." value={newSectionName} onChange={e => setNewSectionName(e.target.value)} />
                      <button onClick={handleAddSection} className="bg-green-600 text-white p-2.5 rounded-lg hover:bg-green-700 transition-colors"><Plus size={18}/></button>
                  </div>
                  <div className="max-h-60 overflow-y-auto border border-slate-200 rounded-lg bg-slate-50">
                      {sections.map(section => (
                          <div key={section} className="flex justify-between items-center p-3 border-b border-slate-200 last:border-0 hover:bg-white transition-colors text-sm">
                              {editingSection === section ? (
                                  <div className="flex gap-2 w-full items-center">
                                      <input className="border p-1.5 text-xs rounded flex-1 text-black bg-white" value={editSectionName} onChange={e => setEditSectionName(e.target.value)} autoFocus />
                                      <button onClick={() => handleEditSection(section)} className="text-green-600 hover:bg-green-50 p-1 rounded"><Check size={14}/></button>
                                      <button onClick={() => setEditingSection(null)} className="text-slate-400 hover:bg-slate-100 p-1 rounded"><X size={14}/></button>
                                  </div>
                              ) : (
                                  <>
                                    <span className={`text-slate-700 flex-1 ${section === currentSection ? 'font-bold text-blue-600' : ''}`}>{section} {section === currentSection && ' (Active)'}</span>
                                    <div className="flex gap-1">
                                        <button onClick={() => { setEditingSection(section); setEditSectionName(section); }} className="text-blue-500 hover:bg-blue-50 p-1.5 rounded-md transition-colors"><Pencil size={14}/></button>
                                        <button onClick={() => handleDeleteSection(section)} className={`p-1.5 rounded-md transition-colors ${section === 'Filling and Downstream' ? 'text-slate-300 cursor-not-allowed' : 'text-red-500 hover:bg-red-50'}`} disabled={section === 'Filling and Downstream'}><Trash2 size={14}/></button>
                                    </div>
                                  </>
                              )}
                          </div>
                      ))}
                      {sections.length === 0 && <div className="p-4 text-center text-slate-400">No sections found</div>}
                  </div>
              </div>
          </div>
      )}

      {printModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 print:hidden">
          <div className="bg-white rounded-2xl shadow-2xl w-80 p-6">
             <h3 className="font-bold text-lg mb-6 text-center text-slate-800">Print Options</h3>
             <div className="flex flex-col gap-3">
               <button onClick={() => executePrint('all')} className="bg-blue-600 text-white py-2.5 rounded-lg hover:bg-blue-700 font-medium transition-colors">Print All Shifts</button>
               <button onClick={() => executePrint('night')} className="bg-slate-600 text-white py-2.5 rounded-lg hover:bg-slate-700 font-medium transition-colors">Night Shift Only</button>
               <button onClick={() => executePrint('morning')} className="bg-orange-400 text-white py-2.5 rounded-lg hover:bg-orange-500 font-medium transition-colors">Morning Shift Only</button>
               <button onClick={() => executePrint('evening')} className="bg-purple-600 text-white py-2.5 rounded-lg hover:bg-purple-700 font-medium transition-colors">Evening Shift Only</button>
               <button onClick={() => setPrintModalOpen(false)} className="mt-2 text-slate-500 hover:text-slate-800 font-medium">Cancel</button>
             </div>
          </div>
        </div>
      )}

      {/* Floating Toolbar (Same as before) */}
      <div className="fixed top-0 left-0 right-0 z-40 bg-white/90 backdrop-blur-md border-b border-slate-200 shadow-sm px-6 py-3 no-print">
        <div className="max-w-[1200px] mx-auto flex flex-wrap gap-4 justify-between items-center">
            <div className="flex items-center gap-4">
                <div className="bg-blue-600 p-2 rounded-lg text-white shadow-lg shadow-blue-600/20"><FileSpreadsheet size={20} /></div>
                <div><h1 className="font-bold text-lg text-slate-800 leading-tight">MaintLog Pro</h1><p className="text-[10px] text-slate-400 font-medium tracking-wide">DIGITAL LOGBOOK</p></div>
                <div className="h-6 w-px bg-slate-200 mx-2"></div>
                <div className="flex gap-1">
                    <button onClick={undo} disabled={history.length === 0} className={`p-2 rounded-lg transition-colors ${history.length === 0 ? 'text-slate-300 cursor-not-allowed' : 'text-slate-600 hover:bg-slate-100'}`} title="Undo (Ctrl+Z)"><Undo2 size={20} /></button>
                    <button onClick={redo} disabled={future.length === 0} className={`p-2 rounded-lg transition-colors ${future.length === 0 ? 'text-slate-300 cursor-not-allowed' : 'text-slate-600 hover:bg-slate-100'}`} title="Redo (Ctrl+Y)"><Redo2 size={20} /></button>
                </div>
                <div className="h-6 w-px bg-slate-200 mx-2"></div>
                <button onClick={() => { setSettingsOpen(true); setActiveSettingsTab('general'); }} className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors" title="Settings"><Settings size={20} /></button>
            </div>
            <div className="flex gap-2">
                <div className="flex items-center gap-2 px-3 py-1.5 bg-green-50 text-green-700 rounded-lg text-xs font-medium border border-green-200 mr-2"><Check size={12} /> Auto-Saving On</div>
                <button onClick={() => setAiChatOpen(!aiChatOpen)} className="flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white rounded-lg text-xs font-bold transition-all shadow-md shadow-indigo-200" title="Quick AI Copilot"><Sparkles size={16} className="text-yellow-300" />Copilot</button>
                <button onClick={() => setAnalysisWindowOpen(true)} className="flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white rounded-lg text-xs font-bold transition-all shadow-md shadow-blue-200" title="Full Data Analysis"><LineChart size={16} className="text-white" />Analysis</button>
                <button onClick={calculateAnalytics} className="flex items-center gap-2 px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-bold transition-all border border-indigo-200" title="Standard Analytics"><BarChart3 size={16} /></button>
                <button onClick={handleExportCSV} className="flex items-center gap-2 px-4 py-2 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-lg text-xs font-bold transition-all"><FileSpreadsheet size={14} /> CSV</button>
                <button onClick={handlePrintRequest} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-all shadow-sm shadow-blue-200"><Printer size={14} /> PRINT / PDF</button>
                <div className="w-px bg-slate-200 mx-2"></div>
                <button onClick={handleLogout} className="flex items-center gap-2 px-3 py-2 text-slate-400 hover:text-slate-600 rounded-lg transition-colors" title="Logout"><LogOut size={18} /></button>
            </div>
        </div>
      </div>

      {/* Main Report Card (Same as before) */}
      <div className="max-w-[1200px] mx-auto bg-white shadow-xl rounded-xl overflow-visible my-24 print:shadow-none print:w-full print:m-0 print:rounded-none border border-slate-200 print:border-none">
        <div className="bg-slate-900 text-white p-6 rounded-t-xl print:rounded-none print:p-0 print:pt-4 print:pb-4 print:bg-white print:text-black print:border-b-2 print:border-black">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 print:items-center">
            <div className="flex items-center gap-4">
               {settings.customLogo && <div className="h-14 w-auto bg-white/10 rounded p-1 print:bg-transparent print:h-20 print:p-0"><img src={settings.customLogo} alt="Company Logo" className="h-full w-auto object-contain" /></div>}
               <div><h1 className="text-2xl font-bold uppercase tracking-wider text-blue-400 print:text-black mb-1 leading-tight">{settings.reportTitle}</h1><div className="hidden print:block text-sm font-bold text-gray-500">SECTION: {currentSection}</div></div>
            </div>
            <div className="flex gap-6 w-full md:w-auto print:hidden">
               <div className="flex-1 md:flex-none">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Section</label>
                  <div className="relative group">
                    <input className="w-full md:w-64 bg-slate-800 border border-slate-700 rounded px-3 py-1.5 text-sm font-medium text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all placeholder-slate-500" value={currentSection} onChange={(e) => setCurrentSection(e.target.value)} list="sections-list" placeholder="Select Section..." />
                    <datalist id="sections-list">{sections.map(s => <option key={s} value={s} />)}</datalist>
                    <button onClick={() => setSectionManagerOpen(true)} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white" title="Manage Sections"><Settings size={14}/></button>
                  </div>
               </div>
               <div className="flex-1 md:flex-none">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Date</label>
                  <div className="relative">
                    <input type="date" className="w-full md:w-auto bg-slate-800 border border-slate-700 rounded px-3 py-1.5 text-sm font-medium text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all uppercase" value={currentDate} onChange={(e) => setCurrentDate(e.target.value)} />
                    <Calendar size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                  </div>
               </div>
            </div>
            <div className="hidden print:block text-right">
                <div className="text-xl font-bold text-black border border-black px-4 py-2 rounded">DATE: {getFormattedDate(currentDate)}</div>
            </div>
          </div>
        </div>
        <div className="bg-white print:w-full">
            <ShiftSection shift={report.shifts.night} onChange={(data) => updateShift('night', data)} availableEngineers={availableEngineers} onAddEngineer={handleAddEngineer} onDeleteEngineer={handleDeleteEngineer} machines={machines} onUpdateMachines={saveMachines} sparePartsDB={sparePartsDB} onUpdateSparePartsDB={saveSparePartsDB} printHidden={printFilter !== 'all' && printFilter !== 'night'} themeColor={currentTheme.primary} accentColor={currentTheme.accent} compactMode={settings.compactMode} titleBgColor={SHIFT_TITLE_COLORS.night} appSettings={settings} suggestions={suggestions} onLearnSuggestion={handleLearnSuggestion} onShowHistory={showMachineHistory} />
            <ShiftSection shift={report.shifts.morning} onChange={(data) => updateShift('morning', data)} availableEngineers={availableEngineers} onAddEngineer={handleAddEngineer} onDeleteEngineer={handleDeleteEngineer} machines={machines} onUpdateMachines={saveMachines} sparePartsDB={sparePartsDB} onUpdateSparePartsDB={saveSparePartsDB} printHidden={printFilter !== 'all' && printFilter !== 'morning'} themeColor={currentTheme.primary} accentColor={currentTheme.accent} compactMode={settings.compactMode} titleBgColor={SHIFT_TITLE_COLORS.morning} appSettings={settings} suggestions={suggestions} onLearnSuggestion={handleLearnSuggestion} onShowHistory={showMachineHistory} />
            <ShiftSection shift={report.shifts.evening} onChange={(data) => updateShift('evening', data)} availableEngineers={availableEngineers} onAddEngineer={handleAddEngineer} onDeleteEngineer={handleDeleteEngineer} machines={machines} onUpdateMachines={saveMachines} sparePartsDB={sparePartsDB} onUpdateSparePartsDB={saveSparePartsDB} printHidden={printFilter !== 'all' && printFilter !== 'evening'} themeColor={currentTheme.primary} accentColor={currentTheme.accent} compactMode={settings.compactMode} titleBgColor={SHIFT_TITLE_COLORS.evening} appSettings={settings} suggestions={suggestions} onLearnSuggestion={handleLearnSuggestion} onShowHistory={showMachineHistory} />
            <div className={`h-2 bg-gradient-to-r from-blue-600 to-blue-400 w-full rounded-b-xl print:rounded-none ${printFilter !== 'all' ? 'print:hidden' : ''}`}></div>
        </div>
      </div>
    </div>
  );
};

export default App;