import React, { useState, useRef, useEffect } from 'react';
import { ShiftData, LogEntry, INITIAL_ENTRY, TimeEntry, SparePart, UsedPart, AppSettings } from '../types';
import { Plus, Trash2, Clock, Check, X, Settings, Search, Save, Pencil, Bold, Italic, Underline, Highlighter, Palette, Sparkles, Type, History } from 'lucide-react';

// --- Rich Text Component ---
interface RichTextCellProps {
  value: string;
  onChange: (val: string) => void;
  onBlur?: (val: string) => void;
  placeholder?: string;
  className?: string;
  suggestionSuffix?: string;
}

const RichTextCell: React.FC<RichTextCellProps> = ({ value, onChange, onBlur, placeholder, className, suggestionSuffix }) => {
  const contentEditableRef = useRef<HTMLDivElement>(null);
  const shouldMoveCursorToEnd = useRef(false);
  const [showToolbar, setShowToolbar] = useState(false);
  const [toolbarPos, setToolbarPos] = useState({ top: 0, left: 0 });

  // Safe value handling
  const safeValue = value || '';
  
  // Detect if content has HTML tags (Rich Text)
  // We treat simple <br> as not rich text so inline suggestions still work for multi-line plain text
  const hasRichText = /<(?!\/?br\s*\/?)[a-z][\s\S]*>/i.test(safeValue);

  // Sync value to innerHTML when value changes externally (and not focused)
  useEffect(() => {
    if (contentEditableRef.current && document.activeElement !== contentEditableRef.current) {
       if (contentEditableRef.current.innerHTML !== safeValue) {
         contentEditableRef.current.innerHTML = safeValue;
       }
    }
  }, [safeValue]);

  // Handle cursor placement after autocomplete
  useEffect(() => {
    if (shouldMoveCursorToEnd.current && contentEditableRef.current) {
        const el = contentEditableRef.current;
        el.focus();
        // Move caret to end of text
        const range = document.createRange();
        range.selectNodeContents(el);
        range.collapse(false);
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(range);
        shouldMoveCursorToEnd.current = false;
    }
  }, [value]); // Depend on value change to trigger cursor move

  const handleInput = (e: React.FormEvent<HTMLDivElement>) => {
    onChange(e.currentTarget.innerHTML);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    // Right Arrow to accept suggestion (instead of Tab)
    if (e.key === 'ArrowRight' && suggestionSuffix) {
        e.preventDefault();
        const newValue = safeValue + suggestionSuffix;
        onChange(newValue);
        shouldMoveCursorToEnd.current = true;
    }
  };

  const handleSelect = () => {
    const selection = window.getSelection();
    if (selection && !selection.isCollapsed && contentEditableRef.current?.contains(selection.anchorNode)) {
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      
      // Calculate centered position above selection
      const left = rect.left + (rect.width / 2) - 150; // approximate center (toolbar width ~300px)
      
      setToolbarPos({
        top: rect.top - 50, 
        left: left < 10 ? 10 : left // Keep on screen
      });
      setShowToolbar(true);
    } else {
      setShowToolbar(false);
    }
  };

  const execCmd = (command: string, value?: string) => {
    document.execCommand(command, false, value);
    if (contentEditableRef.current) {
        onChange(contentEditableRef.current.innerHTML); // Trigger update immediately
    }
  };

  return (
    <>
      {showToolbar && (
        <div 
          className="fixed z-50 bg-slate-800 text-white rounded-lg shadow-xl flex items-center p-1.5 gap-1 no-print animate-in fade-in zoom-in duration-150"
          style={{ top: toolbarPos.top, left: toolbarPos.left }}
          onMouseDown={(e) => e.preventDefault()} // Prevent losing focus
        >
           {/* Formatting Group */}
           <div className="flex gap-0.5 bg-slate-700/50 p-0.5 rounded">
              <button onClick={() => execCmd('bold')} className="p-1.5 hover:bg-slate-600 rounded" title="Bold"><Bold size={14}/></button>
              <button onClick={() => execCmd('italic')} className="p-1.5 hover:bg-slate-600 rounded" title="Italic"><Italic size={14}/></button>
              <button onClick={() => execCmd('underline')} className="p-1.5 hover:bg-slate-600 rounded" title="Underline"><Underline size={14}/></button>
           </div>
           
           <div className="w-px h-5 bg-slate-600 mx-1"></div>

           {/* Colors Group */}
           <div className="flex gap-0.5 bg-slate-700/50 p-0.5 rounded">
              <button onClick={() => execCmd('backColor', '#fef08a')} className="p-1.5 hover:bg-slate-600 rounded text-yellow-300" title="Highlight"><Highlighter size={14}/></button>
              <button onClick={() => execCmd('foreColor', '#ef4444')} className="p-1.5 hover:bg-slate-600 rounded text-red-500" title="Red Text"><Palette size={14}/></button>
              <button onClick={() => execCmd('foreColor', '#3b82f6')} className="p-1.5 hover:bg-slate-600 rounded text-blue-500" title="Blue Text"><Palette size={14}/></button>
              <button onClick={() => execCmd('foreColor', '#000000')} className="p-1.5 hover:bg-slate-600 rounded text-white" title="Reset Color"><X size={14}/></button>
           </div>

           <div className="w-px h-5 bg-slate-600 mx-1"></div>

           {/* Font Size Group - Optimized */}
           <div className="flex gap-0.5 bg-slate-700/50 p-0.5 rounded items-center">
              <Type size={14} className="mx-1 text-slate-400" />
              <button onClick={() => execCmd('fontSize', '1')} className="px-2 py-1 hover:bg-slate-600 rounded text-[10px] font-bold leading-none">S</button>
              <button onClick={() => execCmd('fontSize', '3')} className="px-2 py-1 hover:bg-slate-600 rounded text-[12px] font-bold leading-none">M</button>
              <button onClick={() => execCmd('fontSize', '5')} className="px-2 py-1 hover:bg-slate-600 rounded text-[14px] font-bold leading-none">L</button>
              <button onClick={() => execCmd('fontSize', '7')} className="px-2 py-1 hover:bg-slate-600 rounded text-[16px] font-bold leading-none">XL</button>
           </div>
        </div>
      )}
      
      <div className="relative w-full h-full min-h-[inherit]">
        {/* Placeholder Logic */}
        {(!safeValue || safeValue === '<br>') && placeholder && (
            <div className={`absolute inset-0 px-2 py-1.5 pointer-events-none text-slate-300 truncate z-0 ${className}`}>
                {placeholder}
            </div>
        )}
        
        {/* Suggestion Logic - Fixed Alignment Strategy */}
        {suggestionSuffix && (
            <>
                {/* If Plain Text: Show Inline Ghost Overlay */}
                {!hasRichText ? (
                    <div 
                        className={`absolute inset-0 px-2 py-1.5 pointer-events-none whitespace-pre-wrap break-words font-inter z-0 ${className}`}
                        style={{ color: 'transparent' }} // Make original text transparent
                        aria-hidden="true"
                        // We render the SAME HTML as the input + the suffix in a visible span
                        dangerouslySetInnerHTML={{
                            __html: safeValue + `<span style="color: #94a3b8; opacity: 1; pointer-events: none;">${suggestionSuffix}</span>`
                        }}
                    />
                ) : (
                    /* If Rich Text: Show Floating Tooltip to avoid misalignment */
                    <div className="absolute -top-6 left-1/2 transform -translate-x-1/2 bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded shadow-sm border border-blue-200 whitespace-nowrap z-20 pointer-events-none flex items-center gap-1">
                        <Sparkles size={10} />
                        <span>Arrow Right: ...{suggestionSuffix}</span>
                    </div>
                )}
            </>
        )}

        {/* Input Field */}
        <div 
            ref={contentEditableRef}
            contentEditable
            className={`w-full min-h-full px-2 py-1.5 outline-none bg-transparent text-black transition-colors whitespace-pre-wrap break-words relative z-10 ${className}`}
            onInput={handleInput}
            onKeyDown={handleKeyDown}
            onBlur={(e) => {
                setShowToolbar(false);
                if(onBlur) onBlur(e.currentTarget.innerHTML);
            }}
            onSelect={handleSelect}
            spellCheck={false}
            suppressContentEditableWarning={true}
        />
      </div>
    </>
  );
};

// --- Main Shift Section ---

interface ShiftSectionProps {
  shift: ShiftData;
  onChange: (updatedShift: ShiftData) => void;
  availableEngineers: string[];
  onAddEngineer: (name: string) => void;
  onDeleteEngineer: (name: string) => void;
  machines: string[];
  onUpdateMachines: (machines: string[]) => void;
  sparePartsDB: SparePart[];
  onUpdateSparePartsDB: (db: SparePart[]) => void;
  printHidden?: boolean;
  themeColor: string;
  accentColor: string;
  compactMode: boolean;
  titleBgColor: string;
  appSettings?: AppSettings;
  suggestions: string[];
  onLearnSuggestion?: (text: string) => void;
  onShowHistory?: (machineName: string) => void;
}

const ShiftSection: React.FC<ShiftSectionProps> = ({ 
  shift, 
  onChange, 
  availableEngineers, 
  onAddEngineer,
  onDeleteEngineer,
  machines,
  onUpdateMachines,
  sparePartsDB,
  onUpdateSparePartsDB,
  printHidden,
  themeColor,
  accentColor,
  compactMode,
  titleBgColor,
  appSettings,
  suggestions,
  onLearnSuggestion,
  onShowHistory
}) => {
  const [activeLinePopup, setActiveLinePopup] = useState<string | null>(null);
  const [activeTimePopup, setActiveTimePopup] = useState<string | null>(null);
  const [engineerPopupOpen, setEngineerPopupOpen] = useState(false);
  const [newEngineerName, setNewEngineerName] = useState('');
  
  // Machine Management State
  const [machineManagerOpen, setMachineManagerOpen] = useState(false);
  const [newMachineName, setNewMachineName] = useState('');
  const [editingMachine, setEditingMachine] = useState<string | null>(null);
  const [editMachineName, setEditMachineName] = useState('');

  // Spare Parts Modal State
  const [activePartEntryId, setActivePartEntryId] = useState<string | null>(null);
  const [partSearch, setPartSearch] = useState('');
  const [tempUsedParts, setTempUsedParts] = useState<UsedPart[]>([]);
  
  // Part Creation/Editing State
  const [isCreatingPart, setIsCreatingPart] = useState(false);
  const [editingPartId, setEditingPartId] = useState<string | null>(null);
  const [newPartForm, setNewPartForm] = useState({ name: '', partNumber: '' });

  // Time Calculator State
  const [timeRows, setTimeRows] = useState<TimeEntry[]>([{start: '', end: ''}]);

  // Determine column visibility
  const showLine = appSettings?.showLineColumn ?? true;
  const showTime = appSettings?.showTimeColumn ?? true;
  const suggestionsEnabled = appSettings?.enableSuggestions ?? true;

  // New Weighted Layout for wider notes
  let descWidth = 32;
  let notesWidth = 24;
  
  if (!showLine) descWidth += 8;
  if (!showTime) {
      descWidth += 5;
      notesWidth += 5;
  }

  const handleEntryChange = (id: string, field: keyof LogEntry, value: string) => {
    const updatedEntries = shift.entries.map(entry => 
      entry.id === id ? { ...entry, [field]: value } : entry
    );
    onChange({ ...shift, entries: updatedEntries });
  };

  const addRow = () => {
    const newEntry: LogEntry = { ...INITIAL_ENTRY, id: crypto.randomUUID() };
    onChange({ ...shift, entries: [...shift.entries, newEntry] });
  };

  const removeRow = (id: string) => {
    if (appSettings?.confirmDeleteRow) {
        if (!confirm("Are you sure you want to delete this row?")) return;
    }
    onChange({ ...shift, entries: shift.entries.filter(e => e.id !== id) });
  };

  // --- Line Selection Logic ---
  const toggleLine = (entryId: string, lineNum: string) => {
    const entry = shift.entries.find(e => e.id === entryId);
    if (!entry) return;

    let currentLines = entry.line ? entry.line.split(',').map(s => s.trim()) : [];
    if (currentLines.includes(lineNum)) {
      currentLines = currentLines.filter(l => l !== lineNum);
    } else {
      currentLines.push(lineNum);
    }
    currentLines.sort();
    handleEntryChange(entryId, 'line', currentLines.join(', '));
  };

  // --- Engineer Selection Logic ---
  const toggleEngineer = (name: string) => {
    let current = shift.engineers ? shift.engineers.split(',').map(s => s.trim()) : [];
    if (current.includes(name)) {
        current = current.filter(n => n !== name);
    } else {
        current.push(name);
    }
    onChange({ ...shift, engineers: current.join(', ') });
  };

  const handleAddNewEngineer = () => {
      if(newEngineerName.trim()) {
          onAddEngineer(newEngineerName.trim());
          toggleEngineer(newEngineerName.trim());
          setNewEngineerName('');
      }
  };

  // --- Machine Management Logic ---
  const handleAddMachine = () => {
    if (newMachineName.trim() && !machines.includes(newMachineName.trim())) {
      onUpdateMachines([...machines, newMachineName.trim()]);
      setNewMachineName('');
    }
  };

  const handleEditMachine = () => {
    if (editMachineName.trim() && editingMachine) {
        const newName = editMachineName.trim();
        if (machines.includes(newName) && newName !== editingMachine) {
             alert('Machine name already exists');
             return;
        }
        const newMachines = machines.map(m => m === editingMachine ? newName : m);
        onUpdateMachines(newMachines);
        setEditingMachine(null);
        setEditMachineName('');
    }
  };

  const handleDeleteMachine = (name: string) => {
    if (confirm(`Delete machine "${name}" from list?`)) {
      onUpdateMachines(machines.filter(m => m !== name));
    }
  };

  // --- Spare Parts Logic ---
  const openSparePartsModal = (entry: LogEntry) => {
    setActivePartEntryId(entry.id);
    setTempUsedParts(entry.usedParts ? [...entry.usedParts] : []);
    setPartSearch('');
    setIsCreatingPart(false);
    setEditingPartId(null);
    setNewPartForm({ name: '', partNumber: '' });
  };

  const handleSavePart = () => {
    if (newPartForm.name && newPartForm.partNumber) {
      const exists = sparePartsDB.find(p => 
          (p.id !== editingPartId) && 
          (p.name.toLowerCase() === newPartForm.name.toLowerCase() || 
          p.partNumber.toLowerCase() === newPartForm.partNumber.toLowerCase())
      );

      if (exists) {
          alert(`Error: A part with this name or number already exists in the current section database.\n\nExisting: ${exists.name} (${exists.partNumber})`);
          return;
      }

      if (editingPartId) {
          onUpdateSparePartsDB(sparePartsDB.map(p => 
              p.id === editingPartId 
              ? { ...p, name: newPartForm.name, partNumber: newPartForm.partNumber } 
              : p
          ));
      } else {
          const newPart: SparePart = {
            id: crypto.randomUUID(),
            name: newPartForm.name,
            partNumber: newPartForm.partNumber
          };
          onUpdateSparePartsDB([...sparePartsDB, newPart]);
      }
      
      setNewPartForm({ name: '', partNumber: '' });
      setIsCreatingPart(false);
      setEditingPartId(null);
    }
  };

  const startEditingPart = (part: SparePart, e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setNewPartForm({ name: part.name, partNumber: part.partNumber });
      setEditingPartId(part.id);
      setIsCreatingPart(true);
  };

  const deletePart = (partId: string, e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if(window.confirm("Are you sure you want to permanently delete this part from the database?")) {
          const updatedDB = sparePartsDB.filter(p => p.id !== partId);
          onUpdateSparePartsDB(updatedDB);
          setTempUsedParts(prev => prev.filter(p => p.partId !== partId));
      }
  };

  const cancelPartForm = () => {
      setIsCreatingPart(false);
      setEditingPartId(null);
      setNewPartForm({ name: '', partNumber: '' });
  };

  const togglePartSelection = (part: SparePart) => {
    const exists = tempUsedParts.find(p => p.partId === part.id);
    if (exists) {
      setTempUsedParts(tempUsedParts.filter(p => p.partId !== part.id));
    } else {
      setTempUsedParts([...tempUsedParts, {
        partId: part.id,
        name: part.name,
        partNumber: part.partNumber,
        quantity: '1'
      }]);
    }
  };

  const updatePartQuantity = (partId: string, qty: string) => {
    setTempUsedParts(tempUsedParts.map(p => p.partId === partId ? { ...p, quantity: qty } : p));
  };

  const saveSpareParts = () => {
    if (!activePartEntryId) return;
    const partsString = tempUsedParts.map(p => `${p.name} (${p.partNumber})`).join('\n');
    const qtyString = tempUsedParts.map(p => p.quantity).join('\n');

    const updatedEntries = shift.entries.map(entry => 
      entry.id === activePartEntryId 
        ? { ...entry, spareParts: partsString, quantity: qtyString, usedParts: tempUsedParts } 
        : entry
    );
    onChange({ ...shift, entries: updatedEntries });
    setActivePartEntryId(null);
  };

  // --- Time Calculator Logic ---
  const openTimeCalculator = (entry: LogEntry) => {
      setActiveTimePopup(entry.id);
      if (entry.timeEntries && entry.timeEntries.length > 0) {
        setTimeRows([...entry.timeEntries]);
      } else {
        setTimeRows([{start: '', end: ''}]);
      }
  };

  const calculateDurationString = (rows: TimeEntry[]) => {
      const parts: string[] = [];
      rows.forEach(row => {
          if (row.start && row.end) {
              const [startH, startM] = row.start.split(':').map(Number);
              const [endH, endM] = row.end.split(':').map(Number);
              let diff = (endH * 60 + endM) - (startH * 60 + startM);
              if (diff < 0) diff += 24 * 60; 
              if (diff > 0) {
                  parts.push(`${diff}m`);
              }
          }
      });
      if (parts.length === 0) return '';
      return parts.join('+');
  };

  const applyTime = (entryId: string) => {
      const durationStr = calculateDurationString(timeRows);
      const updatedEntries = shift.entries.map(entry => 
        entry.id === entryId ? { ...entry, totalTime: durationStr, timeEntries: timeRows } : entry
      );
      onChange({ ...shift, entries: updatedEntries });
      setActiveTimePopup(null);
  };

  // Helper to get suggestion
  const getInlineSuggestion = (val: string) => {
    if (!suggestionsEnabled) return null;
    
    // Robust cleanup to handle contentEditable HTML entities
    const div = document.createElement("div");
    div.innerHTML = val || '';
    const cleanVal = (div.textContent || div.innerText || '').trim();

    if (!cleanVal || cleanVal.length < 2) return null; 
    
    const match = suggestions.find(s => s.toLowerCase().startsWith(cleanVal.toLowerCase()));
    if (match && match.toLowerCase() !== cleanVal.toLowerCase()) {
        return match.slice(cleanVal.length);
    }
    return null;
  };

  if (printHidden) return null;

  return (
    <div className={`flex flex-col border-x border-slate-300 print:border-2 print-border-black relative mb-4 print:mb-0 bg-white shadow-sm print:shadow-none rounded-lg overflow-visible print:rounded-none`}>
      {/* Global Overlay */}
      {(activeLinePopup || activeTimePopup || engineerPopupOpen || machineManagerOpen || activePartEntryId) && (
          <div 
            className="fixed inset-0 bg-black/20 z-10" 
            onClick={() => {
                setActiveLinePopup(null);
                setActiveTimePopup(null);
                setEngineerPopupOpen(false);
                setMachineManagerOpen(false);
                setActivePartEntryId(null);
            }} 
          />
      )}

      {/* Machine Manager Modal */}
      {machineManagerOpen && (
        <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
          <div className="bg-white rounded shadow-xl border p-4 w-80 pointer-events-auto" onClick={e => e.stopPropagation()}>
             <h3 className="font-bold mb-2 flex justify-between items-center text-black">
               Manage Machines
               <button onClick={() => setMachineManagerOpen(false)}><X size={16}/></button>
             </h3>
             <div className="flex gap-1 mb-2">
               <input 
                 className="border p-1 flex-1 text-sm rounded text-black"
                 placeholder="New machine name..."
                 value={newMachineName}
                 onChange={e => setNewMachineName(e.target.value)}
               />
               <button onClick={handleAddMachine} className="bg-green-600 text-white p-1 rounded"><Plus size={16}/></button>
             </div>
             <div className="max-h-60 overflow-y-auto border rounded">
               {machines.map(m => (
                 <div key={m} className="flex justify-between items-center p-2 hover:bg-gray-100 text-sm">
                   {editingMachine === m ? (
                       <div className="flex items-center gap-1 w-full">
                           <input 
                               className="border p-1 text-xs rounded flex-1 text-black"
                               value={editMachineName}
                               onChange={e => setEditMachineName(e.target.value)}
                               autoFocus
                           />
                           <button onClick={handleEditMachine} className="text-green-600 hover:bg-green-100 p-1 rounded"><Check size={14}/></button>
                           <button onClick={() => setEditingMachine(null)} className="text-gray-500 hover:bg-gray-100 p-1 rounded"><X size={14}/></button>
                       </div>
                   ) : (
                       <>
                           <span className="text-black">{m}</span>
                           <div className="flex gap-1">
                               <button onClick={() => { setEditingMachine(m); setEditMachineName(m); }} className="text-blue-500 hover:text-blue-700 p-1"><Pencil size={14}/></button>
                               <button onClick={() => handleDeleteMachine(m)} className="text-red-500 hover:text-red-700 p-1"><Trash2 size={14}/></button>
                           </div>
                       </>
                   )}
                 </div>
               ))}
             </div>
          </div>
        </div>
      )}

      {/* Spare Parts Modal */}
      {activePartEntryId && (
        <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
          <div className="bg-white rounded-lg shadow-2xl border w-[800px] h-[500px] pointer-events-auto flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
             <div className="bg-gray-100 p-3 border-b flex justify-between items-center">
                <h3 className="font-bold text-lg text-black">Select Spare Parts</h3>
                <button onClick={() => setActivePartEntryId(null)} className="hover:bg-gray-200 p-1 rounded"><X /></button>
             </div>
             <div className="flex-1 flex overflow-hidden">
                <div className="w-1/2 border-r p-4 flex flex-col bg-gray-50">
                   <h4 className="font-bold text-sm mb-2 text-gray-700">Parts Database</h4>
                   {!isCreatingPart ? (
                     <>
                        <div className="flex gap-2 mb-2">
                          <div className="relative flex-1">
                            <Search className="absolute left-2 top-1.5 text-gray-400" size={16} />
                            <input 
                              className="w-full pl-8 pr-2 py-1 border rounded text-sm text-black bg-white" 
                              placeholder="Search parts..."
                              value={partSearch}
                              onChange={e => setPartSearch(e.target.value)}
                            />
                          </div>
                          <button 
                            onClick={() => { setIsCreatingPart(true); setEditingPartId(null); setNewPartForm({name:'', partNumber:''}); }} 
                            className="bg-blue-600 text-white px-2 py-1 rounded text-xs flex items-center gap-1 hover:bg-blue-700"
                          >
                             <Plus size={14} /> New
                          </button>
                        </div>
                        <div className="flex-1 overflow-y-auto border bg-white rounded">
                           {sparePartsDB
                             .filter(p => p.name.toLowerCase().includes(partSearch.toLowerCase()) || p.partNumber.toLowerCase().includes(partSearch.toLowerCase()))
                             .map(part => {
                               const isSelected = tempUsedParts.some(up => up.partId === part.id);
                               return (
                                 <div 
                                    key={part.id} 
                                    onClick={() => togglePartSelection(part)}
                                    className={`p-2 border-b text-sm cursor-pointer hover:bg-blue-50 flex justify-between items-center group ${isSelected ? 'bg-blue-100' : ''}`}
                                 >
                                    <div className="flex-1">
                                      <div className="font-medium text-black">{part.name}</div>
                                      <div className="text-xs text-gray-500">{part.partNumber}</div>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <button 
                                            onClick={(e) => startEditingPart(part, e)} 
                                            className="p-1 hover:bg-gray-200 rounded text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                            title="Edit Part"
                                            type="button"
                                        >
                                            <Pencil size={14} />
                                        </button>
                                        <button 
                                            onClick={(e) => deletePart(part.id, e)} 
                                            className="p-1 hover:bg-gray-200 rounded text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                            title="Delete Part"
                                            type="button"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                        {isSelected && <Check size={16} className="text-blue-600 ml-1" />}
                                    </div>
                                 </div>
                               );
                             })}
                           {sparePartsDB.length === 0 && <div className="p-4 text-center text-gray-400 text-sm">No parts found. Add one!</div>}
                        </div>
                     </>
                   ) : (
                     <div className="flex-1 flex flex-col">
                        <h5 className="font-bold text-sm mb-3 text-blue-600">{editingPartId ? 'Edit Part' : 'Create New Part'}</h5>
                        <div className="mb-4">
                          <label className="block text-xs font-bold mb-1 text-gray-700">Part Name</label>
                          <input 
                             className="w-full border p-2 rounded text-sm text-black focus:ring-2 focus:ring-blue-500 outline-none bg-white" 
                             value={newPartForm.name}
                             onChange={e => setNewPartForm({...newPartForm, name: e.target.value})}
                             placeholder="e.g. Bearing 6205"
                          />
                        </div>
                        <div className="mb-4">
                          <label className="block text-xs font-bold mb-1 text-gray-700">Part Number</label>
                          <input 
                             className="w-full border p-2 rounded text-sm text-black focus:ring-2 focus:ring-blue-500 outline-none bg-white" 
                             value={newPartForm.partNumber}
                             onChange={e => setNewPartForm({...newPartForm, partNumber: e.target.value})}
                             placeholder="e.g. 102-345-A"
                          />
                        </div>
                        <div className="flex gap-2 mt-auto">
                           <button onClick={cancelPartForm} className="flex-1 border py-2 rounded text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
                           <button onClick={handleSavePart} className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 rounded text-sm font-medium">
                                {editingPartId ? 'Update Part' : 'Save to DB'}
                           </button>
                        </div>
                     </div>
                   )}
                </div>
                <div className="w-1/2 p-4 flex flex-col">
                   <h4 className="font-bold text-sm mb-2 text-gray-700">Selected for Intervention</h4>
                   <div className="flex-1 overflow-y-auto border rounded mb-4 p-2 bg-gray-50">
                      {tempUsedParts.length === 0 && <div className="text-gray-400 text-center text-sm mt-10">No parts selected</div>}
                      {tempUsedParts.map(part => (
                        <div key={part.partId} className="bg-white border rounded p-2 mb-2 shadow-sm">
                           <div className="flex justify-between items-start mb-2">
                              <div>
                                 <div className="font-bold text-sm text-black">{part.name}</div>
                                 <div className="text-xs text-gray-500">{part.partNumber}</div>
                              </div>
                              <button onClick={() => setTempUsedParts(tempUsedParts.filter(p => p.partId !== part.partId))} className="text-red-500 hover:bg-red-50 p-1 rounded">
                                 <X size={14} />
                              </button>
                           </div>
                           <div className="flex items-center gap-2">
                              <label className="text-xs font-medium text-gray-600">Quantity:</label>
                              <input 
                                className="border rounded p-1 w-20 text-sm text-black focus:ring-1 focus:ring-blue-500 outline-none bg-white"
                                value={part.quantity}
                                onChange={e => updatePartQuantity(part.partId, e.target.value)}
                              />
                           </div>
                        </div>
                      ))}
                   </div>
                   <div className="flex justify-end gap-2">
                      <button onClick={() => setActivePartEntryId(null)} className="px-4 py-2 text-gray-600 border rounded hover:bg-gray-50">Cancel</button>
                      <button onClick={saveSpareParts} className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-medium flex items-center gap-2">
                        <Save size={16} /> Save Changes
                      </button>
                   </div>
                </div>
             </div>
          </div>
        </div>
      )}

      {/* Datalist for Machine Suggestions */}
      <datalist id="machine-options">
        {machines.map(opt => <option key={opt} value={opt} />)}
      </datalist>

      {/* Shift Header Row */}
      <div className="flex border-b border-slate-300 print:border-b-2 print-border-black relative z-20">
        <div 
            className="w-1/4 border-r border-slate-300 print:border-r-2 print-border-black p-2 flex items-center justify-center font-bold uppercase text-black rounded-tl-lg"
            style={{ backgroundColor: titleBgColor }}
        >
          {shift.title}
        </div>
        <div 
          className="w-1/2 border-r border-slate-300 print:border-r-2 print-border-black p-2 flex items-center justify-center text-white font-bold relative"
          style={{ backgroundColor: themeColor }}
        >
          SHIFT ENGINEERS
        </div>
        <div className="w-1/4 bg-slate-100 p-2 flex items-center relative rounded-tr-lg">
            <div 
                className="w-full h-full flex items-center px-2 cursor-pointer hover:bg-white border border-transparent hover:border-slate-300 rounded transition-all text-black font-medium"
                onClick={() => setEngineerPopupOpen(!engineerPopupOpen)}
            >
                {shift.engineers || <span className="text-slate-400 italic">Select Engineers...</span>}
            </div>
            {engineerPopupOpen && (
                <div className="absolute top-full right-0 mt-1 w-64 bg-white border border-slate-200 shadow-xl rounded-lg z-50 p-3" onClick={e => e.stopPropagation()}>
                    <div className="font-bold text-xs mb-2 text-slate-500 uppercase tracking-wide">Select Engineers:</div>
                    <div className="max-h-40 overflow-y-auto mb-2 border border-slate-100 rounded-md p-1 bg-slate-50">
                        {availableEngineers.map(name => (
                            <div key={name} className="flex items-center justify-between p-1.5 hover:bg-white rounded cursor-pointer text-sm group transition-colors">
                                <label className="flex items-center gap-2 flex-grow cursor-pointer">
                                    <input 
                                        type="checkbox" 
                                        checked={shift.engineers.includes(name)}
                                        onChange={() => toggleEngineer(name)}
                                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                    />
                                    <span className="text-slate-700">{name}</span>
                                </label>
                                <button 
                                    onClick={(e) => { e.stopPropagation(); onDeleteEngineer(name); }}
                                    className="text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 p-1"
                                    title="Remove Engineer"
                                >
                                    <Trash2 size={12} />
                                </button>
                            </div>
                        ))}
                    </div>
                    <div className="flex gap-2 border-t pt-2">
                        <input 
                            className="flex-1 border border-slate-300 px-2 py-1 text-sm rounded text-black focus:ring-2 focus:ring-blue-500 outline-none"
                            placeholder="Add new..."
                            value={newEngineerName}
                            onChange={(e) => setNewEngineerName(e.target.value)}
                        />
                        <button 
                            className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-xs font-medium transition-colors"
                            onClick={handleAddNewEngineer}
                        >
                            Add
                        </button>
                    </div>
                </div>
            )}
        </div>
      </div>

      {/* Column Headers */}
      <div 
        className="flex text-white font-bold text-center border-b border-slate-300 print:border-b-2 print-border-black h-9 text-xs tracking-tight"
        style={{ backgroundColor: accentColor }}
      >
        <div className="w-[10%] border-r border-white/20 flex items-center justify-center relative group">
           MACHINE
           <button onClick={() => setMachineManagerOpen(true)} className="absolute right-1 text-white/50 hover:text-white no-print">
             <Settings size={12} />
           </button>
        </div>
        {showLine && (
            <div className="w-[8%] border-r border-white/20 flex items-center justify-center">LINE</div>
        )}
        <div 
            className="border-r border-white/20 flex items-center justify-center text-center"
            style={{ width: `${descWidth}%` }}
        >
            WORK DESCRIPTION
        </div>
        {showTime && (
            <div className="w-[10%] border-r border-white/20 flex items-center justify-center">TOTAL TIME</div>
        )}
        <div className="w-[10%] border-r border-white/20 flex items-center justify-center">SPARE PARTS USED</div>
        <div className="w-[6%] border-r border-white/20 flex items-center justify-center">Qty</div>
        <div className="flex items-center justify-center" style={{ width: `${notesWidth}%` }}>NOTES</div>
      </div>

      {/* Rows */}
      {shift.entries.map((entry) => {
        const suggestionSuffix = getInlineSuggestion(entry.description);
        
        // Logic to hide empty rows in print
        const isEmpty = !entry.description && !entry.machine && !entry.notes;
        const hideInPrint = appSettings?.hideEmptyRowsPrint && isEmpty;

        return (
        <div 
          key={entry.id} 
          className={`flex border-b border-slate-200 print:border-black hover:bg-slate-50 transition-colors group relative ${compactMode ? 'min-h-[28px]' : 'min-h-[36px]'} ${hideInPrint ? 'print:hidden' : ''}`}
        >
          
          {/* Machine */}
          <div className="w-[10%] border-r border-slate-200 print:border-black relative group/machine">
            <input 
                list="machine-options"
                className="w-full h-full px-2 outline-none bg-transparent text-black placeholder-slate-300 focus:bg-blue-50/50 transition-colors text-center"
                value={entry.machine || ''}
                onChange={(e) => handleEntryChange(entry.id, 'machine', e.target.value)}
                spellCheck={appSettings?.enableSpellCheck}
                placeholder="-"
            />
            {entry.machine && (
              <button 
                onClick={() => onShowHistory && onShowHistory(entry.machine)}
                className="absolute right-1 top-1/2 -translate-y-1/2 text-slate-300 hover:text-blue-600 opacity-0 group-hover/machine:opacity-100 transition-all no-print bg-white/80 rounded-full p-0.5"
                title={`View History for ${entry.machine}`}
              >
                <History size={12} />
              </button>
            )}
          </div>

          {/* Line */}
          {showLine && (
              <div className="w-[8%] border-r border-slate-200 print:border-black relative">
                <input 
                    readOnly
                    className="w-full h-full px-2 outline-none bg-transparent cursor-pointer text-black hover:bg-slate-100 focus:bg-blue-50/50 transition-colors text-center"
                    value={entry.line || ''}
                    onClick={() => setActiveLinePopup(activeLinePopup === entry.id ? null : entry.id)}
                />
                {activeLinePopup === entry.id && (
                    <div className="absolute top-full left-0 bg-white border border-slate-200 shadow-xl z-30 p-2 w-32 rounded-lg" onClick={e => e.stopPropagation()}>
                        <div className="font-bold mb-2 text-xs text-slate-500 uppercase tracking-wide">Select Lines:</div>
                        {['1', '2', '3', '4', '5'].map(num => (
                            <label key={num} className="flex items-center gap-2 mb-1.5 cursor-pointer hover:bg-slate-50 p-1 rounded transition-colors">
                                <input 
                                    type="checkbox" 
                                    checked={(entry.line || '').split(', ').includes(num)}
                                    onChange={() => toggleLine(entry.id, num)}
                                    className="rounded text-blue-600 focus:ring-blue-500 border-slate-300"
                                />
                                <span className="text-slate-700 text-sm">Line {num}</span>
                            </label>
                        ))}
                        <button 
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white text-xs py-1.5 mt-1 rounded font-medium transition-colors"
                            onClick={() => setActiveLinePopup(null)}
                        >
                            Done
                        </button>
                    </div>
                )}
              </div>
          )}

          {/* Description - Rich Text */}
          <div className="border-r border-slate-200 print:border-black relative" style={{ width: `${descWidth}%` }}>
            <RichTextCell 
               value={entry.description || ''}
               onChange={(val) => handleEntryChange(entry.id, 'description', val)}
               onBlur={(val) => {
                  if (onLearnSuggestion) {
                      // Strip HTML for learning mechanism
                      onLearnSuggestion(val.replace(/<[^>]*>/g, ''));
                  }
               }}
               suggestionSuffix={suggestionSuffix || undefined}
               placeholder=""
               className="text-left font-inter" // Changed from text-center to text-left for better alignment with ghost text
            />
          </div>

          {/* Total Time - Flexbox Centering Fix */}
          {showTime && (
              <div className="w-[10%] border-r border-slate-200 print:border-black relative group-time flex flex-col justify-center">
                 {/* Sizer for width/height consistency if other cells wrap */}
                 <div className="invisible px-1 py-1.5 whitespace-pre-wrap break-words text-center min-h-full">
                     {entry.totalTime || '.'}
                 </div>
                 
                 {/* Centered Content */}
                 <div className="absolute inset-0 flex items-center justify-center">
                     <textarea 
                        className="w-full h-auto px-2 py-1.5 outline-none bg-transparent text-black resize-none focus:bg-blue-50/50 transition-colors text-center overflow-hidden"
                        style={{ height: 'auto', minHeight: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        value={entry.totalTime || ''}
                        onChange={(e) => handleEntryChange(entry.id, 'totalTime', e.target.value)}
                        onBlur={(e) => {
                            const val = e.target.value.trim();
                            if (val && !val.toLowerCase().endsWith('m') && !val.includes('+') && val.length > 0) {
                                handleEntryChange(entry.id, 'totalTime', val + 'm');
                            }
                        }}
                     />
                 </div>

                <button 
                    className="absolute right-0 top-0 h-full w-5 flex items-center justify-center text-slate-300 hover:text-blue-600 no-print transition-colors"
                    onClick={() => openTimeCalculator(entry)}
                    title="Time Calculator"
                >
                    <Clock size={12} />
                </button>

                {/* Time Calculator Modal */}
                {activeTimePopup === entry.id && (
                    <div className="absolute top-full right-0 mt-1 bg-white border border-slate-200 shadow-xl z-50 p-4 w-72 rounded-xl" onClick={e => e.stopPropagation()}>
                       <h4 className="font-bold text-sm mb-3 text-slate-700">Calculate Duration</h4>
                       <div className="space-y-2 mb-4">
                           {timeRows.map((row, idx) => (
                               <div key={idx} className="flex items-center gap-2">
                                   <input 
                                      type="time" 
                                      className="border border-slate-300 rounded text-xs p-1.5 w-24 text-black focus:ring-1 focus:ring-blue-500 outline-none bg-white" 
                                      value={row.start}
                                      onChange={e => {
                                          const newRows = [...timeRows];
                                          newRows[idx].start = e.target.value;
                                          setTimeRows(newRows);
                                      }}
                                   />
                                   <span className="text-slate-400">-</span>
                                   <input 
                                      type="time" 
                                      className="border border-slate-300 rounded text-xs p-1.5 w-24 text-black focus:ring-1 focus:ring-blue-500 outline-none bg-white" 
                                      value={row.end}
                                      onChange={e => {
                                          const newRows = [...timeRows];
                                          newRows[idx].end = e.target.value;
                                          setTimeRows(newRows);
                                      }}
                                   />
                                   <button 
                                     onClick={() => {
                                       const newRows = timeRows.filter((_, i) => i !== idx);
                                       setTimeRows(newRows.length ? newRows : [{start:'', end:''}]);
                                     }}
                                     className="text-slate-400 hover:text-red-500 transition-colors"
                                   >
                                     <X size={14}/>
                                   </button>
                               </div>
                           ))}
                       </div>
                       <div className="flex justify-between items-center mb-4">
                           <button onClick={() => setTimeRows([...timeRows, {start:'', end:''}])} className="text-xs text-blue-600 flex items-center hover:text-blue-700 font-medium">
                               <Plus size={12} /> Add Interval
                           </button>
                           <span className="font-bold text-sm bg-slate-100 px-2 py-1 rounded text-slate-700">{calculateDurationString(timeRows)}</span>
                       </div>
                       <div className="flex gap-2">
                           <button 
                             className="flex-1 bg-white border border-slate-300 text-slate-700 text-xs py-2 rounded-lg hover:bg-slate-50 transition-colors font-medium"
                             onClick={() => setActiveTimePopup(null)}
                            >
                               Cancel
                           </button>
                           <button 
                             className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-xs py-2 rounded-lg transition-colors font-bold shadow-sm"
                             onClick={() => applyTime(entry.id)}
                            >
                               Apply
                           </button>
                       </div>
                    </div>
                )}
              </div>
          )}

          {/* Spare Parts (Swapped) - Auto Expanding */}
          <div 
             className="w-[10%] border-r border-slate-200 print:border-black relative flex flex-col justify-center cursor-pointer hover:bg-blue-50/50 transition-colors"
             onClick={() => openSparePartsModal(entry)}
          >
             {/* Sizer */}
             <div className="invisible px-1 py-1.5 whitespace-pre-wrap break-words text-center text-sm min-h-full">
                 {entry.spareParts || '.'}
             </div>
             {/* Content */}
             <div className="absolute inset-0 w-full h-full flex items-center justify-center p-1.5 text-center text-sm whitespace-pre-wrap text-black pointer-events-none">
                 {entry.spareParts || <span className="opacity-0">.</span>}
             </div>
          </div>

          {/* Quantity (Swapped) - Auto Expanding */}
          <div className="w-[6%] border-r border-slate-200 print:border-black relative flex flex-col justify-center pointer-events-none">
             {/* Sizer */}
             <div className="invisible px-1 py-1.5 whitespace-pre-wrap break-words text-center text-sm min-h-full">
                 {entry.quantity || '.'}
             </div>
             {/* Content */}
             <div className="absolute inset-0 w-full h-full flex items-center justify-center p-1.5 text-center text-sm whitespace-pre-wrap text-black">
                 {entry.quantity || <span className="opacity-0">.</span>}
             </div>
          </div>

          {/* Notes - Rich Text */}
          <div className="relative" style={{ width: `${notesWidth}%` }}>
             <RichTextCell 
                value={entry.notes || ''}
                onChange={(val) => handleEntryChange(entry.id, 'notes', val)}
                className="text-center font-inter"
             />
             <button 
                onClick={() => removeRow(entry.id)}
                className="absolute right-0 top-0 h-full w-8 flex items-center justify-center text-red-400 opacity-0 group-hover:opacity-100 hover:bg-red-50 hover:text-red-600 transition-all no-print"
                tabIndex={-1}
            >
                <Trash2 size={14} />
            </button>
          </div>
        </div>
      );})}

      {/* Add Row Button (No Print) */}
      <div className="bg-slate-50 border-b border-slate-300 p-1.5 flex justify-center no-print rounded-b-lg">
         <button 
            onClick={addRow}
            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-blue-600 font-medium px-4 py-1.5 rounded-full hover:bg-white border border-transparent hover:border-slate-200 hover:shadow-sm transition-all"
         >
            <Plus size={14} /> Add Row
         </button>
      </div>
    </div>
  );
};

export default ShiftSection;