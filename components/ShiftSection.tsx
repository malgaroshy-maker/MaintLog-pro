import React, { useState } from 'react';
import { ShiftData, LogEntry, INITIAL_ENTRY, TimeEntry, SparePart, UsedPart, AppSettings } from '../types';
import { Plus, Trash2, Clock, Check, X, Settings, Search, Save, Pencil } from 'lucide-react';

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
  onLearnSuggestion
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

  // Dynamic widths based on visibility
  let descWidth = 40;
  if (!showLine) descWidth += 10;
  if (!showTime) descWidth += 10;

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
        // Prevent duplicate names unless it's the same machine
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
      // Validation Check: duplicate name/number (excluding self if editing)
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
          // Update Existing Part
          onUpdateSparePartsDB(sparePartsDB.map(p => 
              p.id === editingPartId 
              ? { ...p, name: newPartForm.name, partNumber: newPartForm.partNumber } 
              : p
          ));
      } else {
          // Create New Part
          const newPart: SparePart = {
            id: crypto.randomUUID(),
            name: newPartForm.name,
            partNumber: newPartForm.partNumber
          };
          onUpdateSparePartsDB([...sparePartsDB, newPart]);
      }
      
      // Reset Form and View
      setNewPartForm({ name: '', partNumber: '' });
      setIsCreatingPart(false);
      setEditingPartId(null);
    }
  };

  const startEditingPart = (part: SparePart, e: React.MouseEvent) => {
      e.stopPropagation();
      setNewPartForm({ name: part.name, partNumber: part.partNumber });
      setEditingPartId(part.id);
      setIsCreatingPart(true);
  };

  const deletePart = (partId: string, e: React.MouseEvent) => {
      e.stopPropagation();
      if(confirm("Are you sure you want to permanently delete this part from the database?")) {
          onUpdateSparePartsDB(sparePartsDB.filter(p => p.id !== partId));
          // Remove from current selection if it was selected
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
    
    // Construct display strings
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
    if (!val || val.length < 2) return null; // Wait for at least 2 chars
    // Find first match that strictly starts with val (case insensitive)
    const match = suggestions.find(s => s.toLowerCase().startsWith(val.toLowerCase()));
    if (match && match.toLowerCase() !== val.toLowerCase()) {
        return match;
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
                {/* Left Panel: Database */}
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
                                        {/* Edit/Delete Actions */}
                                        <button 
                                            onClick={(e) => startEditingPart(part, e)} 
                                            className="p-1 hover:bg-gray-200 rounded text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                            title="Edit Part"
                                        >
                                            <Pencil size={14} />
                                        </button>
                                        <button 
                                            onClick={(e) => deletePart(part.id, e)} 
                                            className="p-1 hover:bg-gray-200 rounded text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                            title="Delete Part"
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

                {/* Right Panel: Selected */}
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

            {/* Engineer Selection Modal */}
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
            <div className="w-[10%] border-r border-white/20 flex items-center justify-center">LINE</div>
        )}
        <div 
            className="border-r border-white/20 flex items-center pl-2 text-left"
            style={{ width: `${descWidth}%` }}
        >
            WORK DESCRIPTION
        </div>
        {showTime && (
            <div className="w-[10%] border-r border-white/20 flex items-center justify-center">TOTAL TIME</div>
        )}
        <div className="w-[12%] border-r border-white/20 flex items-center justify-center">SPARE PARTS USED</div>
        <div className="w-[8%] border-r border-white/20 flex items-center justify-center">Quantity</div>
        <div className="w-[10%] flex items-center justify-center">NOTES</div>
      </div>

      {/* Rows */}
      {shift.entries.map((entry) => {
        // Calculate suggestion for this entry
        const inlineSuggestion = getInlineSuggestion(entry.description);
        const suggestionSuffix = inlineSuggestion ? inlineSuggestion.slice(entry.description.length) : '';

        return (
        <div 
          key={entry.id} 
          className={`flex border-b border-slate-200 print:border-black hover:bg-slate-50 transition-colors group relative ${compactMode ? 'min-h-[28px]' : 'min-h-[36px]'}`}
        >
          
          {/* Machine */}
          <div className="w-[10%] border-r border-slate-200 print:border-black relative">
            <input 
                list="machine-options"
                className="w-full h-full px-2 outline-none bg-transparent text-black placeholder-slate-300 focus:bg-blue-50/50 transition-colors text-center"
                value={entry.machine}
                onChange={(e) => handleEntryChange(entry.id, 'machine', e.target.value)}
                spellCheck={appSettings?.enableSpellCheck}
                placeholder="-"
            />
          </div>

          {/* Line */}
          {showLine && (
              <div className="w-[10%] border-r border-slate-200 print:border-black relative">
                <input 
                    readOnly
                    className="w-full h-full px-2 outline-none bg-transparent cursor-pointer text-black hover:bg-slate-100 focus:bg-blue-50/50 transition-colors text-center"
                    value={entry.line}
                    onClick={() => setActiveLinePopup(activeLinePopup === entry.id ? null : entry.id)}
                />
                {activeLinePopup === entry.id && (
                    <div className="absolute top-full left-0 bg-white border border-slate-200 shadow-xl z-30 p-2 w-32 rounded-lg" onClick={e => e.stopPropagation()}>
                        <div className="font-bold mb-2 text-xs text-slate-500 uppercase tracking-wide">Select Lines:</div>
                        {['1', '2', '3', '4', '5'].map(num => (
                            <label key={num} className="flex items-center gap-2 mb-1.5 cursor-pointer hover:bg-slate-50 p-1 rounded transition-colors">
                                <input 
                                    type="checkbox" 
                                    checked={entry.line?.split(', ').includes(num)}
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

          {/* Description */}
          <div className="border-r border-slate-200 print:border-black relative" style={{ width: `${descWidth}%` }}>
            <div className="relative w-full h-full">
                {/* Ghost Overlay */}
                {suggestionsEnabled && (
                  <div className="absolute inset-0 px-2 py-1.5 text-left pointer-events-none whitespace-pre-wrap overflow-hidden font-inter z-0">
                      <span className="opacity-0">{entry.description}</span>
                      <span className="text-gray-400 opacity-50">{suggestionSuffix}</span>
                  </div>
                )}
                
                <textarea 
                    className="w-full h-full px-2 outline-none bg-transparent text-black resize-none py-1.5 focus:bg-blue-50/50 transition-colors text-left font-inter relative z-10"
                    rows={1}
                    value={entry.description}
                    onChange={(e) => handleEntryChange(entry.id, 'description', e.target.value)}
                    onBlur={(e) => {
                        if (onLearnSuggestion) {
                            onLearnSuggestion(e.target.value);
                        }
                    }}
                    onKeyDown={(e) => {
                        if (e.key === 'Tab' && inlineSuggestion) {
                            e.preventDefault();
                            handleEntryChange(entry.id, 'description', inlineSuggestion);
                        }
                    }}
                    spellCheck={appSettings?.enableSpellCheck}
                    autoComplete="off"
                />
            </div>
          </div>

          {/* Total Time */}
          {showTime && (
              <div className="w-[10%] border-r border-slate-200 print:border-black relative group-time">
                <input 
                    className="w-full h-full px-2 outline-none text-center bg-transparent text-black focus:bg-blue-50/50 transition-colors"
                    value={entry.totalTime}
                    onChange={(e) => handleEntryChange(entry.id, 'totalTime', e.target.value)}
                    onBlur={(e) => {
                        const val = e.target.value.trim();
                        if (val && !val.toLowerCase().endsWith('m')) {
                            handleEntryChange(entry.id, 'totalTime', val + 'm');
                        }
                    }}
                />
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

          {/* Spare Parts (Swapped) */}
          <div 
             className="w-[12%] border-r border-slate-200 print:border-black p-1.5 cursor-pointer hover:bg-blue-50/50 transition-colors relative flex items-center justify-center"
             onClick={() => openSparePartsModal(entry)}
          >
             <div className="whitespace-pre-wrap text-black w-full pointer-events-none text-sm text-center">
                 {entry.spareParts || <span className="opacity-0">.</span>}
             </div>
          </div>

          {/* Quantity (Swapped) */}
          <div className="w-[8%] border-r border-slate-200 print:border-black p-1.5 pointer-events-none">
             <div className="whitespace-pre-wrap text-center text-black h-full w-full text-sm">
                 {entry.quantity || <span className="opacity-0">.</span>}
             </div>
          </div>

          {/* Notes */}
          <div className="w-[10%] relative">
             <textarea 
                className="w-full h-full px-2 outline-none bg-transparent text-black resize-none py-1.5 focus:bg-blue-50/50 transition-colors text-center"
                rows={1}
                value={entry.notes}
                onChange={(e) => handleEntryChange(entry.id, 'notes', e.target.value)}
                spellCheck={appSettings?.enableSpellCheck}
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