import React, { useState, useEffect, useRef } from 'react';
import { X, Send, Sparkles, Bot, User, Loader2, AlertTriangle, Terminal } from 'lucide-react';
import { GoogleGenAI, Type, FunctionDeclaration, Content } from "@google/genai";
import { ReportData, SparePart } from '../types';

interface AIChatProps {
  isOpen: boolean;
  onClose: () => void;
  apiKey?: string;
  report: ReportData;
  sparePartsDB: SparePart[];
  onToolAction: (toolName: string, args: any) => Promise<any>;
}

interface Message {
  role: 'user' | 'model' | 'system';
  content: string;
  isError?: boolean;
}

export const AIChat: React.FC<AIChatProps> = ({ isOpen, onClose, apiKey, report, sparePartsDB, onToolAction }) => {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    { role: 'model', content: 'Hello! I am your MaintLog Assistant. I can analyze your report, add detailed entries, or manage your spare parts database. How can I help?' }
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

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

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;
    
    if (!apiKey) {
        setMessages(prev => [...prev, { role: 'user', content: input }, { role: 'model', content: "Please configure your Google Gemini API Key in Settings > Data Management to use this feature.", isError: true }]);
        setInput('');
        return;
    }

    const userMsg = input.trim();
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setInput('');
    setIsLoading(true);

    try {
        const ai = new GoogleGenAI({ apiKey });
        
        // Define Tools
        const addLogEntryTool: FunctionDeclaration = {
            name: "add_log_entry",
            description: "Adds a new maintenance log entry row to a specific shift. Use this when the user wants to record work done. Can include used spare parts, time, line, etc.",
            parameters: {
                type: Type.OBJECT,
                properties: {
                    shift: { type: Type.STRING, enum: ["night", "morning", "evening"], description: "The shift to add the entry to." },
                    machine: { type: Type.STRING, description: "The name of the machine." },
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
                night: report.shifts.night.entries.filter(e => e.machine || e.description).map(e => ({ machine: e.machine, desc: e.description, time: e.totalTime, parts: e.spareParts })),
                morning: report.shifts.morning.entries.filter(e => e.machine || e.description).map(e => ({ machine: e.machine, desc: e.description, time: e.totalTime, parts: e.spareParts })),
                evening: report.shifts.evening.entries.filter(e => e.machine || e.description).map(e => ({ machine: e.machine, desc: e.description, time: e.totalTime, parts: e.spareParts })),
            }
        };
        
        const dbSummary = sparePartsDB.map(p => `${p.name} (${p.partNumber})`).join(", ");

        const systemPrompt = `You are MaintLog Pro AI. You help manage industrial maintenance logs.
        
        Current Report Context: ${JSON.stringify(simplifiedReport)}
        Existing Spare Parts Database: [${dbSummary}]
        
        Rules:
        1. When adding entries, infer the shift from context or ask if unclear. Default to 'morning' if completely ambiguous.
        2. If the user provides a calculation for time (e.g., "15+15"), calculate the sum (e.g., "30m") for the totalTime field.
        3. If the user mentions parts that are NOT in the database, and asks to add them, call 'add_spare_part' FIRST, then 'add_log_entry'.
        4. When using 'add_log_entry', match 'used_parts' names to the database if possible.
        5. Keep responses concise and professional.
        `;

        const chatHistory: any[] = messages.slice(1).map(m => ({
            role: m.role === 'model' ? 'model' : 'user',
            parts: [{ text: m.content }]
        }));

        // Call generateContent directly
        const result = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: [...chatHistory, { role: 'user', parts: [{ text: userMsg }] }],
            config: {
                systemInstruction: systemPrompt,
                tools: [{ functionDeclarations: [addLogEntryTool, addSparePartTool, changeDateTool, analyzeDataTool] }]
            }
        });
        
        // SAFE TEXT EXTRACTION: Check function calls first to avoid SDK warnings
        const functionCalls = result.functionCalls;
        let responseText = "";

        if (functionCalls && functionCalls.length > 0) {
            // Manually extract text parts if they exist to avoid accessing .text getter which warns on function calls
            const parts = result.candidates?.[0]?.content?.parts || [];
            responseText = parts.filter(p => p.text).map(p => p.text).join('');
        } else {
            responseText = result.text || "";
        }
        
        // Handle Function Calls
        if (functionCalls && functionCalls.length > 0) {
            // Process sequentially
            const toolResults: {name: string, result: any}[] = [];

            for (const call of functionCalls) {
                const fnName = call.name;
                const fnArgs = call.args;
                
                // Execute Tool
                let toolResult = "Tool executed successfully.";
                try {
                    // We treat analyze_report as a no-op that just prompts the AI to look at context
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

            // After all tools run, send results back to model
            const toolResponseParts = toolResults.map(t => ({
                functionResponse: { name: t.name, response: { result: t.result } }
            }));

            // We need to construct the history carefully for the second turn
            // Turn 1: User prompt
            // Turn 2: Model calls function (this is in result.candidates[0].content)
            // Turn 3: User provides function response
            
            const secondResponse = await ai.models.generateContent({
                    model: 'gemini-3-flash-preview',
                    contents: [
                        ...chatHistory, 
                        { role: 'user', parts: [{ text: userMsg }] },
                        { role: 'model', parts: result.candidates?.[0]?.content?.parts || [] }, // The function call request
                        { role: 'function', parts: toolResponseParts } // The execution results
                    ],
                    config: {
                    systemInstruction: systemPrompt,
                    tools: [{ functionDeclarations: [addLogEntryTool, addSparePartTool, changeDateTool, analyzeDataTool] }]
                    }
            });
            
            // Safe extraction for second response too
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
                 <div className={`max-w-[80%] p-3 rounded-xl text-sm ${msg.role === 'user' ? 'bg-indigo-600 text-white rounded-tr-none' : msg.isError ? 'bg-red-50 text-red-800 border border-red-100 rounded-tl-none' : 'bg-white border border-slate-200 text-slate-700 rounded-tl-none shadow-sm'}`}>
                     {msg.content}
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

      {/* Input */}
      <div className="p-3 bg-white border-t border-slate-100">
         <div className="flex gap-2 relative">
             <input 
               className="flex-1 bg-slate-100 border-transparent focus:bg-white border focus:border-indigo-300 rounded-lg px-4 py-2.5 text-sm outline-none transition-all pr-10 text-slate-800 placeholder-slate-400"
               placeholder="Ask AI to analyze or add log..."
               value={input}
               onChange={e => setInput(e.target.value)}
               onKeyDown={e => e.key === 'Enter' && handleSend()}
               disabled={isLoading}
               autoFocus
             />
             <button 
                onClick={handleSend}
                disabled={isLoading || !input.trim()}
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