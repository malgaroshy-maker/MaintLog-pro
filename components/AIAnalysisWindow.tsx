import React, { useState, useEffect, useRef } from 'react';
import { X, Send, Sparkles, Bot, User, Loader2, BarChart3, FileText, Image as ImageIcon, LineChart } from 'lucide-react';
import { GoogleGenAI, Type } from "@google/genai";
import type { FunctionDeclaration } from "@google/genai";
import { ReportData } from '../types';

interface AIAnalysisWindowProps {
  isOpen: boolean;
  onClose: () => void;
  apiKey?: string;
  model: string;
  sections?: string[];
  currentDate: string;
  currentSection: string;
  temperature: number;
  enableImageGen: boolean;
  imageModel: string;
  imageAspectRatio: string;
  thinkingBudget: number;
}

interface AnalysisMessage {
  role: 'user' | 'model';
  content: string;
  chartData?: any; // JSON object for charts
  tableData?: any; // JSON object for tables
  imageData?: string; // Base64 string for generated images
}

export const AIAnalysisWindow: React.FC<AIAnalysisWindowProps> = ({ 
    isOpen, onClose, apiKey, model, currentDate, currentSection, 
    temperature, enableImageGen, imageModel, imageAspectRatio, thinkingBudget 
}) => {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<AnalysisMessage[]>([
    { role: 'model', content: `I am your Data Analyst. I can scan your logs, generate charts, and summarize performance.${enableImageGen ? ' You can also ask me to "generate an image" to visualize maintenance scenarios.' : ''}` }
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (messagesEndRef.current) {
        messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  if (!isOpen) return null;

  // --- Helpers for Data Retrieval ---
  
  const parseDuration = (str: string): number => {
      if (!str) return 0;
      let total = 0;
      const parts = str.toLowerCase().split(/[+\s]+/); 
      parts.forEach(p => {
         if (!p) return;
         let mins = 0;
         const h = p.match(/(\d+)h/);
         const m = p.match(/(\d+)m/);
         if(h) mins += parseInt(h[1]) * 60;
         if(m) mins += parseInt(m[1]);
         if(!h && !m) {
             const val = parseInt(p.replace(/[^0-9]/g, ''));
             if(!isNaN(val)) mins += val;
         }
         total += mins;
      });
      return total;
  };

  const getAllData = (startDate?: string, endDate?: string, section?: string) => {
      const allData: any[] = [];
      const effectiveStart = startDate || "1970-01-01";
      const effectiveEnd = endDate || "2099-12-31";

      for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith('maintlog_report_')) {
              try {
                  const report: ReportData = JSON.parse(localStorage.getItem(key)!);
                  if (report.date < effectiveStart) continue;
                  if (report.date > effectiveEnd) continue;
                  if (section && report.section !== section) continue;

                  (['night', 'morning', 'evening'] as const).forEach(shiftKey => {
                      const shift = report.shifts[shiftKey];
                      shift.entries.forEach(entry => {
                          if (entry.machine || entry.description) {
                              // Create a unique display name for the machine including line number
                              // This helps the AI distinguish "CFA (Line 1)" from "CFA (Line 2)"
                              const machineDisplay = entry.line 
                                  ? `${entry.machine} (Line ${entry.line})` 
                                  : entry.machine;

                              allData.push({
                                  date: report.date,
                                  section: report.section,
                                  shift: shiftKey,
                                  machine: entry.machine,
                                  line: entry.line,
                                  machine_display: machineDisplay, // Critical for AI Context
                                  description: entry.description,
                                  totalTimeStr: entry.totalTime,
                                  durationMinutes: parseDuration(entry.totalTime),
                                  spareParts: entry.spareParts,
                                  qty: entry.quantity,
                                  notes: entry.notes,
                                  engineers: shift.engineers
                              });
                          }
                      });
                  });
              } catch (e) { console.error("Error parsing report", e); }
          }
      }
      return allData;
  };

  const handleSend = async () => {
      if (!input.trim() || isLoading) return;
      if (!apiKey) {
          setMessages(prev => [...prev, { role: 'user', content: input }, { role: 'model', content: "Please configure your API Key in settings first." }]);
          setInput('');
          return;
      }

      const userMsg = input;
      setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
      setInput('');
      setIsLoading(true);

      try {
          const ai = new GoogleGenAI({ apiKey });

          const getDataTool: FunctionDeclaration = {
              name: "get_maintenance_data",
              description: "Retrieves maintenance log data. Use this to perform analysis, count occurrences, or summarize activities.",
              parameters: {
                  type: Type.OBJECT,
                  properties: {
                      startDate: { type: Type.STRING, description: "Start date (YYYY-MM-DD)." },
                      endDate: { type: Type.STRING, description: "End date (YYYY-MM-DD)." },
                      section: { type: Type.STRING, description: "Optional section name." }
                  }
              }
          };

          const generateImageTool: FunctionDeclaration = {
              name: "generate_image",
              description: "Generates an AI image based on a detailed text description.",
              parameters: {
                  type: Type.OBJECT,
                  properties: {
                      prompt: { type: Type.STRING, description: "Detailed visual description of the image to generate." }
                  },
                  required: ["prompt"]
              }
          };

          const toolsList: any[] = [getDataTool];
          if (enableImageGen) {
              toolsList.push(generateImageTool);
          }

          const systemPrompt = `You are an expert Industrial Data Analyst for MaintLog Pro.
          
          SYSTEM CONTEXT:
          - Current App Date: ${currentDate}.
          - Current App Section: ${currentSection}
          
          Capabilities:
          1. Retrieve data using 'get_maintenance_data'.
          2. Analyze the data.
          3. GENERATE CHARTS/TABLES.
          ${enableImageGen ? '4. GENERATE IMAGES (Call \'generate_image\').' : ''}

          CRITICAL RULES FOR ANALYSIS:
          - Machines with the same name often exist on different lines (e.g., "CFA" on Line 1 is different from "CFA" on Line 2).
          - ALWAYS use the 'machine_display' field from the data when aggregating stats or labeling charts. This combines the machine name and line number.
          - If 'machine_display' is not available, group by BOTH 'machine' and 'line'.
          - The 'notes' field contains important context. Always consider it when analyzing failure reasons or patterns.

          RESPONSE FORMAT FOR CHARTS:
          If the user asks for a chart or table, you MUST append a valid JSON block at the very end of your response. 
          Do not include any text after the JSON block.
          
          \`\`\`json
          {
            "visualization": {
              "type": "bar" | "pie" | "table",
              "title": "Chart Title",
              "data": { 
                  "labels": ["CFA (Line 1)", "TP (Line 2)", ...],
                  "values": [10, 5, ...],
                  "color": "#3b82f6" // Optional hex color
                  // For pie charts, use "segments": [{ "name": "...", "value": 10, "color": "..." }]
                  // For tables, use "headers": [...], "rows": [[...], [...]]
              }
            }
          }
          \`\`\`
          `;

          const chatHistory = messages.map(m => ({
              role: m.role,
              parts: [{ text: m.content }]
          }));

          const config: any = {
              systemInstruction: systemPrompt,
              tools: [{ functionDeclarations: toolsList }],
              temperature: temperature,
          };

          // Apply thinking budget if > 0 and using supported model
          if (thinkingBudget > 0 && (model.includes('gemini-2.5') || model.includes('gemini-3'))) {
              config.thinkingConfig = { thinkingBudget: thinkingBudget };
          }

          const result = await ai.models.generateContent({
              model: model || 'gemini-3-flash-preview',
              contents: [...chatHistory, { role: 'user', parts: [{ text: userMsg }] }],
              config: config
          });

          // Handle Tool Calls
          const functionCalls = result.functionCalls;
          let finalResponseText = "";
          let chartData = null;
          let tableData = null;
          let generatedImage: string | undefined = undefined;

          if (functionCalls && functionCalls.length > 0) {
              const toolResults = await Promise.all(functionCalls.map(async (call) => {
                  if (call.name === 'get_maintenance_data') {
                      const args = call.args || {};
                      const start = args.startDate as string;
                      const end = args.endDate as string;
                      const sec = (args.section as string) || currentSection;
                      
                      const data = getAllData(start, end, sec);
                      const jsonResult = JSON.stringify(data);
                      const truncatedResult = jsonResult.length > 20000 ? jsonResult.substring(0, 20000) + "...(truncated)" : jsonResult;
                      return {
                          functionResponse: {
                              name: call.name,
                              response: { result: truncatedResult }
                          }
                      };
                  }
                  
                  if (call.name === 'generate_image') {
                      try {
                          const args = call.args || {};
                          const prompt = args.prompt as string;
                          const selectedImageModel = imageModel || 'gemini-2.5-flash-image';
                          
                          if (selectedImageModel.includes('imagen')) {
                              // Use generateImages for Imagen models
                              const imgResponse = await ai.models.generateImages({
                                  model: selectedImageModel,
                                  prompt: prompt,
                                  config: {
                                      numberOfImages: 1,
                                      aspectRatio: imageAspectRatio || "1:1",
                                      outputMimeType: 'image/jpeg'
                                  }
                              });
                              if (imgResponse.generatedImages && imgResponse.generatedImages.length > 0) {
                                  generatedImage = imgResponse.generatedImages[0].image?.imageBytes;
                              }
                          } else {
                              // Use generateContent for Gemini models (Nano Banana series)
                              const imgResponse = await ai.models.generateContent({
                                    model: selectedImageModel,
                                    contents: { parts: [{ text: prompt }] },
                                    config: {
                                        imageConfig: {
                                            aspectRatio: imageAspectRatio || "1:1"
                                        }
                                    }
                              });
                              if (imgResponse.candidates && imgResponse.candidates.length > 0) {
                                  for (const part of imgResponse.candidates[0].content?.parts || []) {
                                      if (part.inlineData) {
                                          generatedImage = part.inlineData.data;
                                          break;
                                      }
                                  }
                              }
                          }
                          
                          return {
                              functionResponse: {
                                  name: call.name,
                                  response: { result: generatedImage ? "Image generated successfully." : "Failed to generate image." }
                              }
                          };
                      } catch (e: any) {
                          return {
                              functionResponse: {
                                  name: call.name,
                                  response: { result: "Error generating image: " + e.message }
                              }
                          };
                      }
                  }

                  return { functionResponse: { name: call.name, response: { result: "Unknown tool" } } };
              }));

              const secondResponse = await ai.models.generateContent({
                  model: model || 'gemini-3-flash-preview',
                  contents: [
                      ...chatHistory,
                      { role: 'user', parts: [{ text: userMsg }] },
                      { role: 'model', parts: result.candidates?.[0]?.content?.parts || [] },
                      { role: 'function', parts: toolResults }
                  ],
                  config: { systemInstruction: systemPrompt }
              });

              finalResponseText = secondResponse.text || "";
          } else {
              finalResponseText = result.text || "";
          }

          // Robust JSON Parsing for Charts
          // Try standard markdown block first
          let jsonStr = "";
          const jsonMatch = finalResponseText.match(/```json\s*([\s\S]*?)\s*```/i) || finalResponseText.match(/```\s*([\s\S]*?)\s*```/i);
          
          if (jsonMatch) {
              jsonStr = jsonMatch[1];
              // Remove the JSON block from the text shown to user to avoid clutter
              finalResponseText = finalResponseText.replace(jsonMatch[0], '').trim();
          } else {
              // Fallback: Try to find raw JSON object in text if markdown is missing
              const firstBrace = finalResponseText.indexOf('{');
              const lastBrace = finalResponseText.lastIndexOf('}');
              if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
                  const potentialJson = finalResponseText.substring(firstBrace, lastBrace + 1);
                  // Basic validation to see if it looks like the visualization object
                  if (potentialJson.includes('"visualization"')) {
                      jsonStr = potentialJson;
                      // Don't remove raw JSON from text automatically as it might be part of the sentence, 
                      // unless it's at the very end.
                      if (lastBrace === finalResponseText.length - 1) {
                           finalResponseText = finalResponseText.substring(0, firstBrace).trim();
                      }
                  }
              }
          }

          if (jsonStr) {
              try {
                  const parsed = JSON.parse(jsonStr);
                  if (parsed.visualization) {
                      const viz = parsed.visualization;
                      if (viz.type === 'bar') {
                          chartData = { type: 'bar', ...viz };
                      } else if (viz.type === 'pie') {
                          chartData = { type: 'pie', title: viz.title, data: viz.data.segments };
                      } else if (viz.type === 'table') {
                          tableData = viz.data;
                      }
                  }
              } catch (e) {
                  console.error("Failed to parse AI JSON visualization", e);
                  // Optionally append an error note to the chat
                  // finalResponseText += "\n[System: Failed to render chart due to invalid data format]";
              }
          }

          if (!finalResponseText && (chartData || tableData || generatedImage)) {
              finalResponseText = "Here is the visualization based on your request.";
          }

          setMessages(prev => [...prev, { 
              role: 'model', 
              content: finalResponseText,
              chartData,
              tableData,
              imageData: generatedImage
          }]);

      } catch (error: any) {
          let errorMsg = `Error: ${error.message}`;
          if (errorMsg.includes("429") || errorMsg.includes("quota") || errorMsg.includes("RESOURCE_EXHAUSTED")) {
              errorMsg = "⚠️ AI Quota Exceeded. You have hit the limit for the free tier. Please wait a while or switch to 'Gemini 2.0 Flash' in Settings which may have higher availability.";
          }
          setMessages(prev => [...prev, { role: 'model', content: errorMsg }]);
      } finally {
          setIsLoading(false);
      }
  };

  // --- Simple Visualization Components ---
  const BarChart = ({ data }: { data: any }) => {
      if (!data || !data.data || !data.data.values || data.data.values.length === 0) return <div className="text-center text-gray-400 p-4">No data for chart</div>;
      const values = data.data.values;
      const labels = data.data.labels;
      const max = Math.max(...values, 1);
      
      return (
          <div className="bg-white p-4 rounded-lg border border-slate-200 mt-4 shadow-sm w-full">
              <h4 className="font-bold text-slate-700 mb-4 text-center">{data.title}</h4>
              <div className="flex items-end gap-2 h-60 w-full px-2">
                  {values.map((val: number, idx: number) => (
                      <div key={idx} className="flex-1 flex flex-col items-center justify-end h-full group relative">
                          <div className="text-[10px] text-slate-500 mb-1 opacity-0 group-hover:opacity-100 absolute -top-4">{val}</div>
                          <div 
                              className="w-full rounded-t hover:opacity-80 transition-all min-w-[20px]"
                              style={{ height: `${(val / max) * 100}%`, backgroundColor: data.data.color || '#3b82f6' }}
                          ></div>
                          {/* Updated Label Container for rotated text */}
                          <div className="relative h-20 w-full mt-2">
                              <div 
                                  className="absolute top-0 left-1/2 -translate-x-1/2 text-[10px] text-slate-500 rotate-45 origin-top-left whitespace-nowrap overflow-visible" 
                                  title={labels[idx]}
                              >
                                  {labels[idx]}
                              </div>
                          </div>
                      </div>
                  ))}
              </div>
              {/* Extra Spacer for rotated labels */}
              <div className="h-10"></div>
          </div>
      );
  };

  const PieChartComp = ({ data }: { data: any }) => {
      if (!data || !data.data) return null;
      const segments = data.data; 
      const total = segments.reduce((acc: number, item: any) => acc + item.value, 0);
      let currentDeg = 0;
      const gradientParts = segments.map((item: any) => {
          const deg = (item.value / total) * 360;
          const str = `${item.color || '#ccc'} ${currentDeg}deg ${currentDeg + deg}deg`;
          currentDeg += deg;
          return str;
      }).join(', ');

      return (
          <div className="bg-white p-6 rounded-lg border border-slate-200 mt-4 shadow-sm flex flex-col items-center">
              <h4 className="font-bold text-slate-700 mb-6">{data.title}</h4>
              <div className="flex items-center gap-8">
                <div 
                    className="w-40 h-40 rounded-full flex-shrink-0 shadow-inner"
                    style={{ background: `conic-gradient(${gradientParts})` }}
                ></div>
                <div className="space-y-2">
                    {segments.map((item: any, idx: number) => (
                        <div key={idx} className="flex items-center justify-between text-xs min-w-[150px]">
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full shadow-sm" style={{ backgroundColor: item.color }}></div>
                                <span className="text-slate-600 font-medium">{item.name}</span>
                            </div>
                            <span className="font-bold text-slate-800">{item.value} ({Math.round(item.value/total*100)}%)</span>
                        </div>
                    ))}
                </div>
              </div>
          </div>
      );
  };

  const DataTable = ({ data }: { data: any }) => {
      if (!data || !data.rows) return null;
      return (
          <div className="bg-white rounded-lg border border-slate-200 mt-4 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                      <thead className="bg-slate-50 text-slate-500 uppercase font-bold border-b border-slate-200">
                          <tr>
                              {data.headers.map((h: string, i: number) => <th key={i} className="px-4 py-3 whitespace-nowrap">{h}</th>)}
                          </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                          {data.rows.map((row: any[], i: number) => (
                              <tr key={i} className="hover:bg-slate-50">
                                  {row.map((cell: any, j: number) => <td key={j} className="px-4 py-2.5 whitespace-nowrap text-slate-700">{cell}</td>)}
                              </tr>
                          ))}
                      </tbody>
                  </table>
              </div>
          </div>
      );
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="bg-slate-50 w-full max-w-6xl h-[90vh] rounded-2xl shadow-2xl flex overflow-hidden font-inter">
            
            {/* Sidebar - Chat */}
            <div className="w-1/3 bg-white flex flex-col border-r border-slate-200">
                <div className="p-4 border-b border-slate-100 flex items-center gap-2 bg-slate-50">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white">
                        <Sparkles size={16} />
                    </div>
                    <div>
                        <h3 className="font-bold text-slate-800">AI Analyst</h3>
                        <p className="text-[10px] text-slate-500">Powered by {model}</p>
                    </div>
                </div>
                
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {messages.map((msg, idx) => (
                        <div key={idx} className={`flex gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${msg.role === 'user' ? 'bg-slate-200' : 'bg-indigo-100 text-indigo-600'}`}>
                                {msg.role === 'user' ? <User size={12}/> : <Bot size={12}/>}
                            </div>
                            <div className={`p-2.5 rounded-xl text-xs max-w-[90%] ${msg.role === 'user' ? 'bg-indigo-600 text-white rounded-tr-none' : 'bg-slate-100 text-slate-700 rounded-tl-none'}`}>
                                {msg.content}
                            </div>
                        </div>
                    ))}
                    {isLoading && (
                        <div className="flex gap-2">
                            <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600">
                                <Loader2 size={12} className="animate-spin" />
                            </div>
                            <div className="text-xs text-slate-400 py-1">Analyzing data...</div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                <div className="p-3 border-t border-slate-100">
                    <div className="relative">
                        <input 
                            className="w-full bg-slate-100 border-transparent focus:bg-white border focus:border-indigo-300 rounded-lg px-3 py-2.5 text-xs outline-none pr-10 text-black placeholder-slate-400" 
                            placeholder="Ask for analysis..."
                            value={input}
                            onChange={e => setInput(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleSend()}
                            disabled={isLoading}
                        />
                        <button 
                            onClick={handleSend}
                            disabled={isLoading || !input.trim()}
                            className="absolute right-1 top-1 p-1.5 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors disabled:opacity-50"
                        >
                            <Send size={12} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Main Content - Visualization */}
            <div className="w-2/3 flex flex-col bg-slate-50/50">
                <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-white">
                    <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                        <BarChart3 className="text-indigo-600" /> Visualization Dashboard
                    </h3>
                    <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 relative flex flex-col">
                    {messages.length > 1 ? (
                        <div className="space-y-6 w-full max-w-4xl mx-auto">
                            {(() => {
                                const lastDataMsg = [...messages].reverse().find(m => m.chartData || m.tableData || m.imageData);
                                if (!lastDataMsg) return (
                                    <div className="flex flex-col items-center justify-center h-64 text-slate-400 mt-20">
                                        <Bot size={48} className="mb-4 opacity-20" />
                                        <p>No visualization generated yet.</p>
                                    </div>
                                );

                                return (
                                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 w-full">
                                        {lastDataMsg.chartData?.type === 'bar' && <BarChart data={lastDataMsg.chartData} />}
                                        {lastDataMsg.chartData?.type === 'pie' && <PieChartComp data={lastDataMsg.chartData} />}
                                        {lastDataMsg.tableData && <DataTable data={lastDataMsg.tableData} />}
                                        
                                        {lastDataMsg.imageData && (
                                            <div className="flex flex-col items-center bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
                                                <h4 className="font-bold text-slate-700 mb-4 flex items-center gap-2 text-sm uppercase tracking-wide">
                                                    <ImageIcon size={16} className="text-indigo-600"/> AI Generated Visualization
                                                </h4>
                                                <img 
                                                    src={`data:image/png;base64,${lastDataMsg.imageData}`} 
                                                    alt="AI Generated" 
                                                    className="rounded-lg shadow-inner max-h-[500px] w-auto border border-slate-100" 
                                                />
                                            </div>
                                        )}

                                        {!lastDataMsg.chartData && !lastDataMsg.tableData && !lastDataMsg.imageData && (
                                            <div className="bg-white p-6 rounded-lg border border-slate-200 text-center text-slate-500 mt-10">
                                                <FileText className="mx-auto mb-2 opacity-50" size={32} />
                                                Check the chat for analysis.
                                            </div>
                                        )}
                                    </div>
                                );
                            })()}
                        </div>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-6">
                            <div className="w-20 h-20 bg-white rounded-3xl shadow-sm flex items-center justify-center mb-2">
                                <LineChart size={40} className="text-indigo-200" />
                            </div>
                            <div className="text-center">
                                <h4 className="font-bold text-slate-600 mb-1">Ready to Analyze</h4>
                                <p className="text-sm text-slate-400 max-w-xs mx-auto">Ask the AI to generate charts, tables, or summaries based on your maintenance logs.</p>
                            </div>
                            <div className="flex gap-3">
                                <button onClick={() => { setInput("Show a chart of the top 5 machines by interventions"); handleSend(); }} className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs hover:border-indigo-300 hover:text-indigo-600 transition-all text-slate-600 font-medium shadow-sm">
                                    📊 Top Machines Chart
                                </button>
                                {enableImageGen && (
                                    <button onClick={() => { setInput("Generate an image of a futuristic factory line"); handleSend(); }} className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs hover:border-indigo-300 hover:text-indigo-600 transition-all text-slate-600 font-medium shadow-sm">
                                        🎨 Generate Image
                                    </button>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    </div>
  );
};