import React, { useState, useEffect, useRef } from 'react';
import { X, Send, Sparkles, Bot, User, Loader2, AlertTriangle, Terminal, Paperclip, FileText, Image as ImageIcon, Trash2 } from 'lucide-react';
import { GoogleGenAI, Type, FunctionDeclaration, Content } from "@google/genai";
import { ReportData, SparePart } from '../types';

interface AIChatProps {
  isOpen: boolean;
  onClose: () => void;
  apiKey?: string;
  report: ReportData;
  sparePartsDB: SparePart[];
  machines: string[];
  availableEngineers: string[];
  onToolAction: (toolName: string, args: any) => Promise<any>;
}

interface Message {
  role: 'user' | 'model' | 'system';
  content: string;
  isError?: boolean;
  attachments?: { name: string; type: string }[];
}

interface Attachment {
  file: File;
  preview: string; // Base64 for preview
  base64Data: string; // Raw base64 for API
}

export const AIChat: React.FC<AIChatProps> = ({ isOpen, onClose, apiKey, report, sparePartsDB, machines, availableEngineers, onToolAction }) => {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    { role: 'model', content: 'Hello! I am your MaintLog Assistant. I can analyze your report, add detailed entries, manage spare parts, or assign engineers. How can I help?' }
  ]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Scroll to bottom on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isOpen]);

  // Handle outside click to close
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
        if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
          const newAttachments: Attachment[] = [];
          for (let i = 0; i < e.target.files.length; i++) {
              const file = e.target.files[i];
              // Simple validation
              if (file.size > 10 * 1024 * 1024) {
                  alert(`File ${file.name} is too large (Max 10MB)`);
                  continue;
              }
              
              const base64Full = await new Promise<string>((resolve) => {
                  const reader = new FileReader();
                  reader.onloadend = () => resolve(reader.result as string);
                  reader.readAsDataURL(file);
              });

              // Strip prefix for API usage
              const base64Data = base64Full.split(',')[1];

              newAttachments.push({
                  file,
                  preview: base64Full,
                  base64Data
              });
          }
          setAttachments(prev => [...prev, ...newAttachments]);
      }
      // Reset input
      if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeAttachment = (index: number) => {
      setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const handleSend = async () => {
    if ((!input.trim() && attachments.length === 0) || isLoading) return;
    
    if (!apiKey) {
        setMessages(prev => [...prev, { role: 'user', content: input }, { role: 'model', content: "Please configure your Google Gemini API Key in Settings > Data Management to use this feature.", isError: true }]);
        setInput('');
        return;
    }

    const userMsg = input.trim();
    const currentAttachments = [...attachments];
    
    setMessages(prev => [...prev, { 
        role: 'user', 
        content: userMsg,
        attachments: currentAttachments.map(a => ({ name: a.file.name, type: a.file.type })) 
    }]);
    
    setInput('');
    setAttachments([]);
    setIsLoading(true);

    try {
        const ai = new GoogleGenAI({ apiKey });
        
        // Define Tools
        const addLogEntryTool: FunctionDeclaration = {
            name: "add_log_entry",
            description: "Adds a new maintenance log entry row. Use this to record work done. Can include used spare parts, time, line, etc.",
            parameters: {
                type: Type.OBJECT,
                properties: {
                    date: { type: Type.STRING, description: "Date of the entry in YYYY-MM-DD format. If not provided, defaults to the currently viewed report date." },
                    shift: { type: Type.STRING, enum: ["night", "morning", "evening"], description: "The shift to add the entry to." },
                    // STRICT MACHINE ENFORCEMENT
                    machine: machines.length > 0 
                        ? { type: Type.STRING, enum: machines, description: "The name of the machine." }
                        : { type: Type.STRING, description: "The name of the machine." },
                    line: { type: Type.STRING, description: "Production line number(s), e.g., '1', '1, 2', '3'." },
                    description: { type: Type.STRING, description: "The work description." },
                    totalTime: { type: Type.STRING, description: "Total duration in minutes, e.g., '30m', '90m'." },
                    notes: { type: Type.STRING, description: "Additional notes." },
                    used_parts: {
                        type: Type.ARRAY,
                        description: "List of spare parts used in this intervention.",
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                name: { type: Type.STRING, description: "Name of the part (e.g. 'Bearing', 'Motor')." },
                                quantity: { type: Type.STRING, description: "Quantity used (e.g. '1', '2')." }
                            }
                        }
                    }
                },
                required: ["shift", "machine", "description"]
            }
        };

        const addSparePartTool: FunctionDeclaration = {
            name: "add_spare_part",
            description: "Adds a new spare part to the section's database. Use this when the user explicitly mentions adding a part to the database/system.",
            parameters: {
                type: Type.OBJECT,
                properties: {
                    name: { type: Type.STRING, description: "Name of the part." },
                    partNumber: { type: Type.STRING, description: "Part number/ID." }
                },
                required: ["name", "partNumber"]
            }
        };

        const manageEngineersTool: FunctionDeclaration = {
            name: "manage_engineers",
            description: "Manages the engineer database or assigns engineers to a shift.",
            parameters: {
                type: Type.OBJECT,
                properties: {
                    action: { 
                        type: Type.STRING, 
                        enum: ["add_to_database", "remove_from_database", "assign_to_shift"],
                        description: "The action to perform. 'assign_to_shift' sets the active team for a shift."
                    },
                    names: {
                        type: Type.ARRAY,
                        items: { type: Type.STRING },
                        description: "List of engineer names to add, remove, or assign."
                    },
                    shift: {
                        type: Type.STRING,
                        enum: ["night", "morning", "evening"],
                        description: "Target shift (REQUIRED for 'assign_to_shift' action)."
                    },
                    date: {
                        type: Type.STRING,
                        description: "Target date in YYYY-MM-DD format (Optional, defaults to current view)."
                    }
                },
                required: ["action", "names"]
            }
        };

        const changeDateTool: FunctionDeclaration = {
            name: "change_date",
            description: "Changes the currently viewed report date.",
            parameters: {
                type: Type.OBJECT,
                properties: {
                    date: { type: Type.STRING, description: "Target date in YYYY-MM-DD format." }
                },
                required: ["date"]
            }
        };

        const analyzeDataTool: FunctionDeclaration = {
             name: "analyze_report",
             description: "Reads the current report data to answer questions about it.",
             parameters: {
                 type: Type.OBJECT,
                 properties: {},
             }
        };

        // Prepare Context
        const simplifiedReport = {
            date: report.date,
            section: report.section,
            shifts: {
                night: { engineers: report.shifts.night.engineers, entries: report.shifts.night.entries.filter(e => e.machine || e.description).map(e => ({ machine: e.machine, desc: e.description, time: e.totalTime, parts: e.spareParts })) },
                morning: { engineers: report.shifts.morning.engineers, entries: report.shifts.morning.entries.filter(e => e.machine || e.description).map(e => ({ machine: e.machine, desc: e.description, time: e.totalTime, parts: e.spareParts })) },
                evening: { engineers: report.shifts.evening.engineers, entries: report.shifts.evening.entries.filter(e => e.machine || e.description).map(e => ({ machine: e.machine, desc: e.description, time: e.totalTime, parts: e.spareParts })) },
            }
        };
        
        const dbSummary = sparePartsDB.map(p => `${p.name} (${p.partNumber})`).join(", ");
        const machineListStr = machines.join(', ');
        const engineerListStr = availableEngineers.join(', ');
        const todayStr = new Date().toISOString().split('T')[0];

        const systemPrompt = `You are MaintLog Pro AI. You help manage industrial maintenance logs.
        
        System Context:
        - Today's Date: ${todayStr}
        - Currently Viewing Report Date: ${report.date}
        - Current Section: ${report.section}
        
        VALID MACHINE LIST: [${machineListStr}]
        AVAILABLE ENGINEERS DATABASE: [${engineerListStr}]
        
        Current Report Data: ${JSON.stringify(simplifiedReport)}
        Existing Spare Parts Database: [${dbSummary}]
        
        Rules:
        1. When adding entries, YOU MUST ONLY use machine names from the 'VALID MACHINE LIST'.
        2. If the user specifies a relative date, calculate the YYYY-MM-DD string.
        3. If the user provides a calculation for time, calculate the sum for the totalTime field.
        4. Engineer Management:
           - Use 'manage_engineers' with action 'assign_to_shift' to set the team for a specific shift.
           - If the user asks to add a NEW engineer to the system/list, use action 'add_to_database'.
           - If assigning an engineer who is NOT in the 'AVAILABLE ENGINEERS DATABASE', YOU MUST add them to the database as well (the tool handles this, just send the name).
        5. Analyze any attached images or files to extract data if requested.
        `;

        const chatHistory: any[] = messages.slice(1).map(m => ({
            role: m.role === 'model' ? 'model' : 'user',
            parts: [{ text: m.content }] // Note: We don't replay old attachments in history for simplicity/cost, context is usually sufficient.
        }));

        // Construct current user content with attachments
        const currentUserContentParts: any[] = [];
        if (userMsg) {
            currentUserContentParts.push({ text: userMsg });
        }
        currentAttachments.forEach(att => {
            currentUserContentParts.push({
                inlineData: {
                    mimeType: att.file.type,
                    data: att.base64Data
                }
            });
        });
        
        // If empty input but has attachment, add a generic prompt
        if (currentUserContentParts.length === 0 && currentAttachments.length > 0) {
            currentUserContentParts.push({ text: "Please analyze this attachment." });
        }

        // Call generateContent
        const result = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: [...chatHistory, { role: 'user', parts: currentUserContentParts }],
            config: {
                systemInstruction: systemPrompt,
                tools: [{ functionDeclarations: [addLogEntryTool, addSparePartTool, changeDateTool, analyzeDataTool, manageEngineersTool] }]
            }
        });
        
        // SAFE TEXT EXTRACTION
        const functionCalls = result.functionCalls;
        let responseText = "";

        if (functionCalls && functionCalls.length > 0) {
            const parts = result.candidates?.[0]?.content?.parts || [];
            responseText = parts.filter(p => p.text).map(p => p.text).join('');
        } else {
            responseText = result.text || "";
        }
        
        // Handle Function Calls
        if (functionCalls && functionCalls.length > 0) {
            const toolResults: {name: string, result: any}[] = [];

            for (const call of functionCalls) {
                const fnName = call.name;
                const fnArgs = call.args;
                
                let toolResult = "Tool executed successfully.";
                try {
                    if (fnName === 'analyze_report') {
                        toolResult = "Report data is available in system context.";
                    } else {
                        toolResult = await onToolAction(fnName, fnArgs);
                    }
                } catch (e: any) {
                    toolResult = `Error executing tool: ${e.message}`;
                }
                toolResults.push({ name: fnName, result: toolResult });
            }

            const toolResponseParts = toolResults.map(t => ({
                functionResponse: { name: t.name, response: { result: t.result } }
            }));
            
            const secondResponse = await ai.models.generateContent({
                    model: 'gemini-3-flash-preview',
                    contents: [
                        ...chatHistory, 
                        { role: 'user', parts: currentUserContentParts },
                        { role: 'model', parts: result.candidates?.[0]?.content?.parts || [] }, 
                        { role: 'function', parts: toolResponseParts }
                    ],
                    config: {
                    systemInstruction: systemPrompt,
                    tools: [{ functionDeclarations: [addLogEntryTool, addSparePartTool, changeDateTool, analyzeDataTool, manageEngineersTool] }]
                    }
            });
            
            const secondCalls = secondResponse.functionCalls;
            let finalTxt = "";
            if (secondCalls && secondCalls.length > 0) {
                const parts = secondResponse.candidates?.[0]?.content?.parts || [];
                finalTxt = parts.filter(p => p.text).map(p => p.text).join('');
            } else {
                finalTxt = secondResponse.text || "";
            }

            if (finalTxt) {
                responseText = finalTxt;
            } else {
                responseText = toolResults.map(t => t.result).join("\n");
            }
        }

        setMessages(prev => [...prev, { role: 'model', content: responseText }]);

    } catch (error: any) {
        console.error("AI Error:", error);
        setMessages(prev => [...prev, { role: 'model', content: `Error: ${error.message || "Something went wrong."}`, isError: true }]);
    } finally {
        setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed bottom-6 right-6 w-96 h-[500px] bg-white rounded-2xl shadow-2xl border border-slate-200 z-50 flex flex-col overflow-hidden animate-in slide-in-from-bottom-10 fade-in duration-200 font-inter">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-violet-600 p-4 flex justify-between items-center text-white">
        <div className="flex items-center gap-2">
            <Sparkles size={18} className="text-yellow-300" />
            <h3 className="font-bold text-sm">MaintLog Copilot</h3>
        </div>
        <button onClick={onClose} className="hover:bg-white/20 p-1 rounded transition-colors"><X size={18}/></button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 bg-slate-50 space-y-4">
         {messages.map((msg, idx) => (
             <div key={idx} className={`flex gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                 <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${msg.role === 'user' ? 'bg-slate-200' : msg.isError ? 'bg-red-100 text-red-600' : 'bg-indigo-100 text-indigo-600'}`}>
                     {msg.role === 'user' ? <User size={16}/> : msg.isError ? <AlertTriangle size={16}/> : <Bot size={16}/>}
                 </div>
                 <div className={`max-w-[80%] flex flex-col items-end`}>
                    <div className={`p-3 rounded-xl text-sm ${msg.role === 'user' ? 'bg-indigo-600 text-white rounded-tr-none' : msg.isError ? 'bg-red-50 text-red-800 border border-red-100 rounded-tl-none' : 'bg-white border border-slate-200 text-slate-700 rounded-tl-none shadow-sm'}`}>
                         {msg.content}
                    </div>
                    {/* Attachments Indicator in Chat History */}
                    {msg.attachments && msg.attachments.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1 justify-end">
                            {msg.attachments.map((att, i) => (
                                <div key={i} className="text-[10px] bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full border border-indigo-100 flex items-center gap-1">
                                    {att.type.startsWith('image') ? <ImageIcon size={10}/> : <FileText size={10}/>}
                                    <span className="truncate max-w-[100px]">{att.name}</span>
                                </div>
                            ))}
                        </div>
                    )}
                 </div>
             </div>
         ))}
         {isLoading && (
             <div className="flex gap-2">
                 <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center flex-shrink-0">
                     <Loader2 size={16} className="animate-spin"/>
                 </div>
                 <div className="bg-white border border-slate-200 p-3 rounded-xl rounded-tl-none shadow-sm flex gap-1 items-center text-slate-400 text-xs">
                     Thinking...
                 </div>
             </div>
         )}
         <div ref={messagesEndRef} />
      </div>

      {/* Attachments Preview Area */}
      {attachments.length > 0 && (
          <div className="px-3 py-2 bg-slate-50 border-t border-slate-200 flex gap-2 overflow-x-auto">
              {attachments.map((att, idx) => (
                  <div key={idx} className="relative group flex-shrink-0 w-16 h-16 bg-white border border-slate-200 rounded-lg overflow-hidden flex items-center justify-center">
                      {att.file.type.startsWith('image') ? (
                          <img src={att.preview} alt="preview" className="w-full h-full object-cover" />
                      ) : (
                          <div className="flex flex-col items-center justify-center text-slate-500">
                              <FileText size={20} />
                              <span className="text-[8px] mt-1 px-1 text-center w-full truncate">{att.file.name}</span>
                          </div>
                      )}
                      <button 
                        onClick={() => removeAttachment(idx)}
                        className="absolute top-0 right-0 bg-red-500 text-white p-0.5 rounded-bl hover:bg-red-600 transition-colors"
                      >
                          <X size={12} />
                      </button>
                  </div>
              ))}
          </div>
      )}

      {/* Input */}
      <div className="p-3 bg-white border-t border-slate-100">
         <div className="flex gap-2 relative">
             <input 
                 type="file" 
                 multiple 
                 accept="image/*,application/pdf"
                 className="hidden" 
                 ref={fileInputRef}
                 onChange={handleFileSelect}
             />
             <button 
                onClick={() => fileInputRef.current?.click()}
                className={`p-2.5 rounded-lg border transition-colors ${attachments.length > 0 ? 'bg-indigo-50 border-indigo-200 text-indigo-600' : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'}`}
                title="Attach Images or PDF"
             >
                 <Paperclip size={16} />
             </button>
             <input 
               className="flex-1 bg-slate-100 border-transparent focus:bg-white border focus:border-indigo-300 rounded-lg px-4 py-2.5 text-sm outline-none transition-all pr-10 text-slate-800 placeholder-slate-400"
               placeholder={attachments.length > 0 ? "Ask about these files..." : "Ask AI..."}
               value={input}
               onChange={e => setInput(e.target.value)}
               onKeyDown={e => e.key === 'Enter' && handleSend()}
               disabled={isLoading}
               autoFocus
             />
             <button 
                onClick={handleSend}
                disabled={isLoading || (!input.trim() && attachments.length === 0)}
                className="absolute right-1 top-1 p-1.5 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:hover:bg-indigo-600 transition-colors"
             >
                 <Send size={14} />
             </button>
         </div>
         <div className="text-[10px] text-center text-slate-400 mt-2 flex items-center justify-center gap-1">
             <Terminal size={10} /> Powered by Gemini 3 Flash
         </div>
      </div>
    </div>
  );
};