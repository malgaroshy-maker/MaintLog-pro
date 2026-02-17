import React, { useState, useEffect, useRef, useCallback } from 'react';
import ShiftSection from './components/ShiftSection';
import { ReportData, ShiftData, INITIAL_ENTRY, SparePart, AppSettings } from './types';
import { Printer, FileSpreadsheet, Lock, Settings, X, LogOut, Sliders, Plus, Check, Pencil, Calendar, Upload, Download, Type, Trash2, Undo2, Redo2 } from 'lucide-react';

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
    const saved = localStorage.getItem('appSettings');
    return saved ? JSON.parse(saved) : { 
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
        autoCapitalize: true
    };
  });
  const [settingsOpen, setSettingsOpen] = useState(false);

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
        isDirtyRef.current = false;
      }
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  // Load Data when Date or Section Changes
  useEffect(() => {
    loadReportAndConfig(currentDate, currentSection);
  }, [currentDate, currentSection]);

  const loadReportAndConfig = (date: string, section: string) => {
    // 1. Load Section Config (Machines, Engineers, Parts)
    loadSectionConfig(section);

    // 2. Load Report Data
    const specificKey = getStorageKey(date, section);
    const savedSpecific = localStorage.getItem(specificKey);

    // Reset History when loading new report
    setHistory([]);
    setFuture([]);

    if (savedSpecific) {
        try {
            setReport(JSON.parse(savedSpecific));
            // Reset dirty flag after loading to prevent immediate save
            isDirtyRef.current = false;
            return;
        } catch (e) { console.error(e); }
    }

    // Migration Support: Check for legacy single-report format
    // If a report exists for this date in the old format AND matches the current section, use it.
    const legacyKey = `maintlog_report_${date}`;
    const savedLegacy = localStorage.getItem(legacyKey);
    if (savedLegacy) {
        try {
            const legacyData = JSON.parse(savedLegacy);
            if (legacyData.section === section) {
                setReport(legacyData);
                // Auto-migrate to new key structure
                localStorage.setItem(specificKey, savedLegacy);
                return;
            }
        } catch(e) { console.error(e); }
    }

    // Initialize New Report for this Date + Section
    setReport({
        section: section,
        date: date,
        shifts: {
            night: createEmptyShift('night', 'Night shift report'),
            morning: createEmptyShift('morning', 'Morning shift report'),
            evening: createEmptyShift('evening', 'Evening shift report'),
        }
    });
    // Reset dirty flag for new report
    isDirtyRef.current = false;
  };

  const updateReport = (newReport: ReportData) => {
      // Push current state to history before updating
      setHistory(prev => {
          const newHistory = [...prev, report];
          // Limit history size to 50 steps
          if (newHistory.length > 50) return newHistory.slice(1);
          return newHistory;
      });
      setFuture([]); // Clear redo stack on new action
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
      // Use the date/section from the report data to save
      const key = getStorageKey(data.date, data.section);
      localStorage.setItem(key, JSON.stringify(data));
  };

  const saveMachines = (newMachines: string[]) => {
    setMachines(newMachines);
    localStorage.setItem(`machines_${currentSection}`, JSON.stringify(newMachines));
  };

  const saveSparePartsDB = (newDB: SparePart[]) => {
    setSparePartsDB(newDB);
    localStorage.setItem(`sparePartsDB_${currentSection}`, JSON.stringify(newDB));
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
          
          // Migrate database configurations
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

          // If current section is the one being renamed, update selection
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
        
        // If deleting active section, fallback to default
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
      // Increased delay to 500ms to allow React state to settle and DOM to update
      // especially for images and large layout shifts.
      setTimeout(() => {
          window.print();
          // Reset after print dialog closes
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

  // Learning Mechanism
  const handleLearnSuggestion = (text: string) => {
      if (!settings.enableSuggestions) return;
      
      const cleanText = text.trim();
      if (!cleanText || cleanText.length < 3) return; // Ignore empty or very short words

      // Case insensitive check to prevent duplicates
      const lowerDefaults = DEFAULT_SUGGESTIONS.map(s => s.toLowerCase());
      const lowerLearned = learnedSuggestions.map(s => s.toLowerCase());

      if (!lowerDefaults.includes(cleanText.toLowerCase()) && !lowerLearned.includes(cleanText.toLowerCase())) {
          const newLearned = [...learnedSuggestions, cleanText].sort();
          setLearnedSuggestions(newLearned);
          localStorage.setItem('maintlog_learned_suggestions', JSON.stringify(newLearned));
      }
  };

  // Compute suggestions including history
  const getSuggestions = () => {
    const unique = new Set([...DEFAULT_SUGGESTIONS, ...learnedSuggestions]);
    // Also include what is currently on screen for immediate consistency, strip HTML
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
      return isoDate; // ISO default
  }

  // --- LOGIN SCREEN ---
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-inter">
        <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md flex flex-col border border-slate-100">
           <div className="flex justify-center mb-6">
              <div className="bg-gradient-to-br from-blue-600 to-blue-800 p-4 rounded-2xl shadow-lg transform rotate-3">
                 <Lock className="text-white" size={32} />
              </div>
           </div>
           <h1 className="text-3xl font-bold text-center mb-2 text-slate-800 tracking-tight">MaintLog Pro</h1>
           <p className="text-center text-slate-500 mb-8 text-sm">Industrial Digital Maintenance Logger</p>
           
           <form onSubmit={handleLogin} className="flex-grow space-y-4">
              <div>
                 <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Username</label>
                 <input 
                   className="w-full bg-black border border-gray-700 p-3 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-sm font-medium text-white placeholder-gray-500"
                   type="text"
                   value={loginUser}
                   onChange={e => setLoginUser(e.target.value)}
                   placeholder="Enter username"
                 />
              </div>
              <div>
                 <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Password</label>
                 <input 
                   className="w-full bg-black border border-gray-700 p-3 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-sm font-medium text-white placeholder-gray-500"
                   type="password"
                   value={loginPass}
                   onChange={e => setLoginPass(e.target.value)}
                   placeholder="Enter password"
                 />
              </div>
              {loginError && <div className="text-red-500 text-sm text-center font-medium bg-red-50 p-2 rounded-lg">{loginError}</div>}
              <button className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 transition-all shadow-md hover:shadow-lg mt-2">
                 Login to System
              </button>
           </form>
           
           <div className="mt-8 pt-6 border-t border-slate-100 text-center">
              <p className="text-xs text-slate-400">Developed by</p>
              <p className="font-bold text-slate-700">Mahamed Algaroshy</p>
              <p className="text-[10px] text-slate-400 mt-2">v2.0.0 • 2026</p>
           </div>
        </div>
      </div>
    );
  }

  // --- MAIN APP ---
  const currentTheme = THEMES[settings.theme];
  const fontSizeClass = FONT_SIZES[settings.fontSize];
  const fontFamilyClass = FONT_FAMILIES[settings.fontFamily] || 'font-inter';

  return (
    <div className={`min-h-screen bg-slate-50 print:bg-white ${fontSizeClass} ${fontFamilyClass}`}>
      
      {/* Settings Modal */}
      {settingsOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 print:hidden">
          <div className="bg-white rounded-2xl shadow-2xl w-96 p-6 max-h-[90vh] overflow-y-auto transform transition-all flex flex-col">
             <div className="flex justify-between items-center mb-6 flex-shrink-0">
                <h3 className="font-bold text-lg flex items-center gap-2 text-slate-800"><Sliders size={20}/> App Settings</h3>
                <button onClick={() => setSettingsOpen(false)} className="text-slate-400 hover:text-slate-700 transition-colors"><X size={20}/></button>
             </div>
             
             {/* ... Settings Content ... */}
             <div className="space-y-6 flex-grow overflow-y-auto pr-2">
                 
                 {/* Branding */}
                 <div>
                   <label className="block text-sm font-bold text-slate-700 mb-2">Company Branding</label>
                   <div className="flex items-center gap-4">
                       <div className="w-16 h-16 rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-center overflow-hidden">
                           {settings.customLogo ? (
                               <img src={settings.customLogo} alt="Logo" className="w-full h-full object-contain" />
                           ) : (
                               <span className="text-xs text-slate-400">No Logo</span>
                           )}
                       </div>
                       <label className="flex-1 cursor-pointer bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 transition-colors text-center">
                           <Upload size={16} className="inline mr-2" />
                           Upload New Logo
                           <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
                       </label>
                       {settings.customLogo && (
                           <button onClick={() => setSettings({...settings, customLogo: ''})} className="p-2 text-red-500 hover:bg-red-50 rounded-lg">
                               <Trash2 size={16} />
                           </button>
                       )}
                   </div>
                 </div>

                 {/* Report Customization */}
                 <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Report Customization</label>
                    <div className="space-y-3">
                        <div>
                            <label className="text-xs text-slate-500 mb-1 block">Report Title</label>
                            <div className="relative">
                                <Type size={14} className="absolute left-2.5 top-2.5 text-slate-400"/>
                                <input 
                                    className="w-full border border-slate-300 rounded-lg py-2 pl-8 pr-3 text-sm text-black focus:ring-2 focus:ring-blue-500 outline-none" 
                                    value={settings.reportTitle}
                                    onChange={e => setSettings({...settings, reportTitle: e.target.value})}
                                    placeholder="Daily Maintenance Activity Report"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="text-xs text-slate-500 mb-1 block">Date Format</label>
                            <select 
                                className="w-full border border-slate-300 rounded-lg py-2 px-3 text-sm text-black focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                                value={settings.dateFormat}
                                onChange={e => setSettings({...settings, dateFormat: e.target.value as any})}
                            >
                                <option value="iso">ISO (YYYY-MM-DD)</option>
                                <option value="uk">UK/EU (DD/MM/YYYY)</option>
                                <option value="us">US (MM/DD/YYYY)</option>
                            </select>
                        </div>
                    </div>
                 </div>

                 <div className="space-y-3">
                   <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Display Options</div>
                   
                   <label className="flex items-center gap-3 cursor-pointer bg-slate-50 p-3 rounded-xl hover:bg-slate-100 transition-colors border border-transparent hover:border-slate-200">
                      <input 
                        type="checkbox"
                        checked={settings.enableSuggestions}
                        onChange={(e) => setSettings({...settings, enableSuggestions: e.target.checked})}
                        className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                      />
                      <div>
                        <span className="text-sm font-bold text-slate-800 block">Smart Suggestions</span>
                        <span className="text-xs text-slate-500">Enable autocomplete for work descriptions.</span>
                      </div>
                   </label>

                   <label className="flex items-center gap-3 cursor-pointer bg-slate-50 p-3 rounded-xl hover:bg-slate-100 transition-colors border border-transparent hover:border-slate-200">
                      <input 
                        type="checkbox"
                        checked={settings.compactMode}
                        onChange={(e) => setSettings({...settings, compactMode: e.target.checked})}
                        className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                      />
                      <div>
                        <span className="text-sm font-bold text-slate-800 block">Compact Row Mode</span>
                        <span className="text-xs text-slate-500">Reduces vertical spacing for printing.</span>
                      </div>
                   </label>

                   <label className="flex items-center gap-3 cursor-pointer bg-slate-50 p-3 rounded-xl hover:bg-slate-100 transition-colors border border-transparent hover:border-slate-200">
                      <input 
                        type="checkbox"
                        checked={settings.showLineColumn ?? true}
                        onChange={(e) => setSettings({...settings, showLineColumn: e.target.checked})}
                        className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                      />
                      <div>
                        <span className="text-sm font-bold text-slate-800 block">Show "Line" Column</span>
                        <span className="text-xs text-slate-500">Toggle the visibility of line selection.</span>
                      </div>
                   </label>

                   <label className="flex items-center gap-3 cursor-pointer bg-slate-50 p-3 rounded-xl hover:bg-slate-100 transition-colors border border-transparent hover:border-slate-200">
                      <input 
                        type="checkbox"
                        checked={settings.hideEmptyRowsPrint}
                        onChange={(e) => setSettings({...settings, hideEmptyRowsPrint: e.target.checked})}
                        className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                      />
                      <div>
                        <span className="text-sm font-bold text-slate-800 block">Hide Empty Rows (Print)</span>
                        <span className="text-xs text-slate-500">Only print rows with data to save paper.</span>
                      </div>
                   </label>
                 </div>

                 {/* Advanced Data Export (Moved to Bottom) */}
                 <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 mt-6">
                     <label className="block text-sm font-bold text-blue-900 mb-2 flex items-center gap-2">
                         <Download size={16}/> Advanced Data Export
                     </label>
                     <p className="text-xs text-blue-700 mb-3">Export optimized CSV for AI analysis over a date range.</p>
                     <div className="flex gap-2 mb-2">
                         <div className="flex-1">
                             <label className="text-[10px] uppercase font-bold text-blue-500">Start</label>
                             <input type="date" value={exportStart} onChange={e => setExportStart(e.target.value)} className="w-full text-xs p-1.5 rounded border border-blue-200" />
                         </div>
                         <div className="flex-1">
                             <label className="text-[10px] uppercase font-bold text-blue-500">End</label>
                             <input type="date" value={exportEnd} onChange={e => setExportEnd(e.target.value)} className="w-full text-xs p-1.5 rounded border border-blue-200" />
                         </div>
                     </div>
                     <button 
                         onClick={() => generateAIExport(exportStart, exportEnd)}
                         className="w-full bg-blue-600 text-white text-xs font-bold py-2 rounded-lg hover:bg-blue-700 transition-colors"
                     >
                         Download Data Range CSV
                     </button>
                 </div>
             </div>
             
             <div className="flex justify-end pt-4 border-t mt-6 flex-shrink-0">
                <button 
                  onClick={() => setSettingsOpen(false)}
                  className="bg-slate-800 text-white px-6 py-2 rounded-lg hover:bg-slate-700 font-medium transition-colors"
                >
                  Done
                </button>
             </div>
          </div>
        </div>
      )}

      {/* Section Manager Modal */}
      {sectionManagerOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 print:hidden" onClick={() => setSectionManagerOpen(false)}>
              <div className="bg-white rounded-2xl shadow-2xl w-96 p-6" onClick={e => e.stopPropagation()}>
                  <div className="flex justify-between items-center mb-4">
                      <h3 className="font-bold text-lg text-slate-800">Manage Sections</h3>
                      <button onClick={() => setSectionManagerOpen(false)} className="text-slate-400 hover:text-slate-700"><X size={20}/></button>
                  </div>
                  <div className="flex gap-2 mb-4">
                      <input 
                          className="border border-slate-300 p-2.5 flex-1 text-sm rounded-lg text-black bg-white focus:ring-2 focus:ring-green-500 outline-none"
                          placeholder="New section name..."
                          value={newSectionName}
                          onChange={e => setNewSectionName(e.target.value)}
                      />
                      <button onClick={handleAddSection} className="bg-green-600 text-white p-2.5 rounded-lg hover:bg-green-700 transition-colors"><Plus size={18}/></button>
                  </div>
                  <div className="max-h-60 overflow-y-auto border border-slate-200 rounded-lg bg-slate-50">
                      {sections.map(section => (
                          <div key={section} className="flex justify-between items-center p-3 border-b border-slate-200 last:border-0 hover:bg-white transition-colors text-sm">
                              {editingSection === section ? (
                                  <div className="flex gap-2 w-full items-center">
                                      <input 
                                          className="border p-1.5 text-xs rounded flex-1 text-black bg-white"
                                          value={editSectionName}
                                          onChange={e => setEditSectionName(e.target.value)}
                                          autoFocus
                                      />
                                      <button onClick={() => handleEditSection(section)} className="text-green-600 hover:bg-green-50 p-1 rounded"><Check size={14}/></button>
                                      <button onClick={() => setEditingSection(null)} className="text-slate-400 hover:bg-slate-100 p-1 rounded"><X size={14}/></button>
                                  </div>
                              ) : (
                                  <>
                                    <span className={`text-slate-700 flex-1 ${section === currentSection ? 'font-bold text-blue-600' : ''}`}>
                                        {section} {section === currentSection && ' (Active)'}
                                    </span>
                                    <div className="flex gap-1">
                                        <button onClick={() => { setEditingSection(section); setEditSectionName(section); }} className="text-blue-500 hover:bg-blue-50 p-1.5 rounded-md transition-colors"><Pencil size={14}/></button>
                                        <button 
                                            onClick={() => handleDeleteSection(section)} 
                                            className={`p-1.5 rounded-md transition-colors ${section === 'Filling and Downstream' ? 'text-slate-300 cursor-not-allowed' : 'text-red-500 hover:bg-red-50'}`}
                                            disabled={section === 'Filling and Downstream'}
                                        >
                                            <Trash2 size={14}/>
                                        </button>
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

      {/* Print Option Modal */}
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

      {/* Floating Toolbar */}
      <div className="fixed top-0 left-0 right-0 z-40 bg-white/90 backdrop-blur-md border-b border-slate-200 shadow-sm px-6 py-3 no-print">
        <div className="max-w-[1200px] mx-auto flex flex-wrap gap-4 justify-between items-center">
            <div className="flex items-center gap-4">
                <div className="bg-blue-600 p-2 rounded-lg text-white shadow-lg shadow-blue-600/20">
                    <FileSpreadsheet size={20} />
                </div>
                <div>
                    <h1 className="font-bold text-lg text-slate-800 leading-tight">MaintLog Pro</h1>
                    <p className="text-[10px] text-slate-400 font-medium tracking-wide">DIGITAL LOGBOOK</p>
                </div>
                <div className="h-6 w-px bg-slate-200 mx-2"></div>
                <div className="flex gap-1">
                    <button 
                        onClick={undo} 
                        disabled={history.length === 0}
                        className={`p-2 rounded-lg transition-colors ${history.length === 0 ? 'text-slate-300 cursor-not-allowed' : 'text-slate-600 hover:bg-slate-100'}`}
                        title="Undo (Ctrl+Z)"
                    >
                        <Undo2 size={20} />
                    </button>
                    <button 
                        onClick={redo} 
                        disabled={future.length === 0}
                        className={`p-2 rounded-lg transition-colors ${future.length === 0 ? 'text-slate-300 cursor-not-allowed' : 'text-slate-600 hover:bg-slate-100'}`}
                        title="Redo (Ctrl+Y)"
                    >
                        <Redo2 size={20} />
                    </button>
                </div>
                <div className="h-6 w-px bg-slate-200 mx-2"></div>
                <button onClick={() => setSettingsOpen(true)} className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors" title="Settings">
                  <Settings size={20} />
                </button>
            </div>
            <div className="flex gap-2">
                <div className="flex items-center gap-2 px-3 py-1.5 bg-green-50 text-green-700 rounded-lg text-xs font-medium border border-green-200 mr-2">
                   <Check size={12} /> Auto-Saving On
                </div>
                <button onClick={handleExportCSV} className="flex items-center gap-2 px-4 py-2 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-lg text-xs font-bold transition-all">
                    <FileSpreadsheet size={14} /> CSV
                </button>
                <button onClick={handlePrintRequest} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-all shadow-sm shadow-blue-200">
                    <Printer size={14} /> PRINT / PDF
                </button>
                <div className="w-px bg-slate-200 mx-2"></div>
                <button onClick={handleLogout} className="flex items-center gap-2 px-3 py-2 text-slate-400 hover:text-slate-600 rounded-lg transition-colors" title="Logout">
                    <LogOut size={18} />
                </button>
            </div>
        </div>
      </div>

      {/* Main Report Card */}
      <div className="max-w-[1200px] mx-auto bg-white shadow-xl rounded-xl overflow-visible my-24 print:shadow-none print:w-full print:m-0 print:rounded-none border border-slate-200 print:border-none">
        
        {/* Modern Header (Optimized for Screen vs Print) */}
        <div className="bg-slate-900 text-white p-6 rounded-t-xl print:rounded-none print:p-0 print:pt-4 print:pb-4 print:bg-white print:text-black print:border-b-2 print:border-black">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 print:items-center">
            <div className="flex items-center gap-4">
               {/* Logo handling: White wrapper on screen, transparent/large on print */}
               {settings.customLogo && (
                   <div className="h-14 w-auto bg-white/10 rounded p-1 print:bg-transparent print:h-20 print:p-0">
                       <img src={settings.customLogo} alt="Company Logo" className="h-full w-auto object-contain" />
                   </div>
               )}
               <div>
                   <h1 className="text-2xl font-bold uppercase tracking-wider text-blue-400 print:text-black mb-1 leading-tight">{settings.reportTitle}</h1>
                   <div className="hidden print:block text-sm font-bold text-gray-500">SECTION: {currentSection}</div>
               </div>
            </div>
            
            <div className="flex gap-6 w-full md:w-auto print:hidden">
               <div className="flex-1 md:flex-none">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Section</label>
                  <div className="relative group">
                    <input 
                        className="w-full md:w-64 bg-slate-800 border border-slate-700 rounded px-3 py-1.5 text-sm font-medium text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all placeholder-slate-500"
                        value={currentSection}
                        onChange={(e) => setCurrentSection(e.target.value)}
                        list="sections-list"
                        placeholder="Select Section..."
                    />
                    <datalist id="sections-list">
                        {sections.map(s => <option key={s} value={s} />)}
                    </datalist>
                    <button 
                        onClick={() => setSectionManagerOpen(true)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
                        title="Manage Sections"
                    >
                        <Settings size={14}/>
                    </button>
                  </div>
               </div>
               <div className="flex-1 md:flex-none">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Date</label>
                  <div className="relative">
                    <input 
                        type="date" 
                        className="w-full md:w-auto bg-slate-800 border border-slate-700 rounded px-3 py-1.5 text-sm font-medium text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all uppercase"
                        value={currentDate}
                        onChange={(e) => setCurrentDate(e.target.value)}
                    />
                    <Calendar size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                  </div>
               </div>
            </div>

            {/* Print Only Date Display */}
            <div className="hidden print:block text-right">
                <div className="text-xl font-bold text-black border border-black px-4 py-2 rounded">
                    DATE: {getFormattedDate(currentDate)}
                </div>
            </div>
          </div>
        </div>

        {/* Report Content */}
        <div className="bg-white print:w-full">
            
            {/* Shift Sections */}
            <ShiftSection 
                shift={report.shifts.night} 
                onChange={(data) => updateShift('night', data)}
                availableEngineers={availableEngineers}
                onAddEngineer={handleAddEngineer}
                onDeleteEngineer={handleDeleteEngineer}
                machines={machines}
                onUpdateMachines={saveMachines}
                sparePartsDB={sparePartsDB}
                onUpdateSparePartsDB={saveSparePartsDB}
                printHidden={printFilter !== 'all' && printFilter !== 'night'}
                themeColor={currentTheme.primary}
                accentColor={currentTheme.accent}
                compactMode={settings.compactMode}
                titleBgColor={SHIFT_TITLE_COLORS.night}
                appSettings={settings}
                suggestions={suggestions}
                onLearnSuggestion={handleLearnSuggestion}
            />
            
            <ShiftSection 
                shift={report.shifts.morning} 
                onChange={(data) => updateShift('morning', data)}
                availableEngineers={availableEngineers}
                onAddEngineer={handleAddEngineer}
                onDeleteEngineer={handleDeleteEngineer}
                machines={machines}
                onUpdateMachines={saveMachines}
                sparePartsDB={sparePartsDB}
                onUpdateSparePartsDB={saveSparePartsDB}
                printHidden={printFilter !== 'all' && printFilter !== 'morning'}
                themeColor={currentTheme.primary}
                accentColor={currentTheme.accent}
                compactMode={settings.compactMode}
                titleBgColor={SHIFT_TITLE_COLORS.morning}
                appSettings={settings}
                suggestions={suggestions}
                onLearnSuggestion={handleLearnSuggestion}
            />
            
            <ShiftSection 
                shift={report.shifts.evening} 
                onChange={(data) => updateShift('evening', data)}
                availableEngineers={availableEngineers}
                onAddEngineer={handleAddEngineer}
                onDeleteEngineer={handleDeleteEngineer}
                machines={machines}
                onUpdateMachines={saveMachines}
                sparePartsDB={sparePartsDB}
                onUpdateSparePartsDB={saveSparePartsDB}
                printHidden={printFilter !== 'all' && printFilter !== 'evening'}
                themeColor={currentTheme.primary}
                accentColor={currentTheme.accent}
                compactMode={settings.compactMode}
                titleBgColor={SHIFT_TITLE_COLORS.evening}
                appSettings={settings}
                suggestions={suggestions}
                onLearnSuggestion={handleLearnSuggestion}
            />

            {/* Footer Line */}
            <div className={`h-2 bg-gradient-to-r from-blue-600 to-blue-400 w-full rounded-b-xl print:rounded-none ${printFilter !== 'all' ? 'print:hidden' : ''}`}></div>
        </div>
        
      </div>
    </div>
  );
};

export default App;