# MaintLog Pro 🏭

**MaintLog Pro** is a professional, offline-first digital logbook designed for industrial maintenance teams. It replaces traditional paper "Daily Maintenance Activity Reports" with a smart, AI-powered web application that mimics industry-standard spreadsheet layouts while adding powerful database and analytical capabilities.

![MaintLog Pro Screenshot](https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?auto=format&fit=crop&q=80&w=1000&ixlib=rb-4.0.3)

## 🚀 Key Features

### 📋 Core Reporting
- **Three-Shift Structure:** Night, Morning, and Evening shifts with visual color coding.
- **Context Isolation:** Create distinct "Sections" (e.g., Filling, Packaging, Utilities). Data (Machines, Engineers, Parts) is isolated per section.
- **Offline Persistence:** All data is stored locally in the browser (`localStorage`). No server setup required.

### 🧠 AI Copilot & Analysis (Powered by Google Gemini)
- **Chat Assistant:** Natural language commands to add logs, edit entries, or manage databases (e.g., *"Add a log for the Filler machine that the sensor was replaced"*).
- **Data Analyst:** Ask questions about your history (e.g., *"Which machine had the most downtime last month?"*).
- **Visualizations:** The AI generates on-demand Bar Charts, Pie Charts, and Data Tables.
- **Image Generation:** Visualize maintenance scenarios or concepts using integrated Gemini/Imagen models.
- **Thinking Budget:** Configurable "reasoning" capacity for complex problem solving (Gemini 2.5/3.0).

### 🛠️ Smart Tools
- **Time Calculator:** Input multiple intervals (e.g., `09:00-10:30 + 14:00-15:00`) to auto-calculate total downtime.
- **Spare Parts Database:** Manage a local inventory of parts. Search, select, and track quantities used per intervention.
- **Rich Text Editor:** Descriptions support Bold, Italic, Colors, and Highlights.
- **Smart Suggestions:** The app learns from your previous entries to provide autocomplete suggestions.

### 🖨️ Reporting & Export
- **Print Mode:** CSS-optimized A4 Landscape layout that removes UI clutter for official hard-copy filing.
- **CSV Export:** Bulk export data across date ranges for external analysis (Excel/PowerBI).
- **JSON Backup:** Full database backup and restore functionality.

## 🛠️ Tech Stack
- **Framework:** React 19 + Vite
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **Icons:** Lucide React
- **AI:** Google GenAI SDK (Gemini 2.5/3.0 Models)

## 🚦 Getting Started

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/maintlog-pro.git
   cd maintlog-pro
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Run Locally**
   ```bash
   npm run dev
   ```

4. **Build for Production**
   ```bash
   npm run build
   ```

## ⚙️ Configuration

### Setting up AI Features
To enable the AI Copilot and Analysis features:
1. Open the app.
2. Click the **Settings (Gear)** icon in the top toolbar.
3. Navigate to the **AI Copilot** tab.
4. Enter your **Google Gemini API Key** (Get one at [aistudio.google.com](https://aistudio.google.com/)).
5. Select your preferred Model (e.g., Gemini 3 Flash) and adjust the **Thinking Budget** slider.

## 🔐 Privacy & Security
MaintLog Pro is designed with a **Local-First** architecture.
- All operational data remains on the specific device's browser storage.
- Data is **never** sent to a cloud server (except the specific text prompts sent to the Google Gemini API if AI features are enabled).
- You can backup/restore your entire database via the **Data Management** settings tab.

---
*Developed by Mahamed Algaroshy*