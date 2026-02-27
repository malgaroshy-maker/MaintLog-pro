# Product Requirements Document (PRD)
**Project Name:** MaintLog Pro  
**Version:** 2.1.0  
**Date:** 2026-02-26  
**Status:** Active / In Development  

---

## 1. Introduction

### 1.1 Purpose
MaintLog Pro is a specialized, offline-first web application designed to digitize the "Daily Maintenance Activity Report" process in industrial settings. It replaces traditional paper logbooks and static spreadsheets with an intelligent, structured, and analytical digital tool.

### 1.2 Scope
The application is a client-side Single Page Application (SPA) that runs entirely in the browser. It manages maintenance logs, tracks spare parts usage, calculates downtime, and provides AI-powered insights. Data persistence is handled locally via `localStorage` with optional cloud synchronization using the File System Access API.

### 1.3 Definitions
-   **Section:** A distinct factory area (e.g., "Filling", "Packaging"). Data is isolated per section.
-   **Shift:** A specific work period (Night, Morning, Evening).
-   **Log Entry:** A single record of a maintenance task.
-   **Copilot:** The AI assistant integrated into the application.

---

## 2. Product Overview

### 2.1 Vision
To empower maintenance teams with a tool that is as simple to use as paper but provides the data integrity, searchability, and analytical power of a modern database application.

### 2.2 Target Audience
-   **Maintenance Engineers:** For logging daily activities, tracking parts, and calculating work hours.
-   **Maintenance Supervisors:** For reviewing shift performance, assigning teams, and analyzing downtime.
-   **Plant Managers:** For high-level reporting and performance metrics.

---

## 3. Functional Requirements

### 3.1 Authentication & Access
-   **Simple Login:** A local authentication gate (default credentials: `admin/admin`).
-   **Session Management:** Persist login state in the browser.

### 3.2 Global Navigation & Structure
-   **Toolbar:** Fixed top bar containing global actions (Undo/Redo, Settings, AI Tools, Export, Print).
-   **Context Switching:**
    -   **Section Selector:** Dropdown to switch between factory areas. Changing sections must swap the entire dataset (Machines, Parts, Logs).
    -   **Date Picker:** Select the specific date for the report.
-   **Shift Layout:** Vertical stacking of three shifts:
    -   **Night Shift:** Visual Theme: Dark Slate/Blue.
    -   **Morning Shift:** Visual Theme: Yellow/Gold.
    -   **Evening Shift:** Visual Theme: Orange/Sunset.

### 3.3 Core Reporting Features (The Log Grid)
Each shift contains a dynamic grid for data entry.

#### 3.3.1 Machine Management
-   **Selection:** Dropdown with autocomplete.
-   **Manager:** Add/Edit/Delete machines specific to the current section.
-   **History View:** View a chronological timeline of all past interventions for a selected machine.

#### 3.3.2 Work Description
-   **Rich Text Editor:** Support for Bold, Italic, Underline, and Colors.
-   **Smart Suggestions:** Autocomplete suggestions based on a dictionary of learned maintenance terms.

#### 3.3.3 Time Tracking
-   **Total Time Field:** Read-only display of duration.
-   **Time Calculator:** A popup tool to input multiple time intervals (e.g., `09:00-10:00` + `13:00-13:30`) and auto-calculate total minutes.

#### 3.3.4 Spare Parts Management
-   **Database:** A local inventory of parts (Name, Part Number) isolated per section.
-   **Selector:** A modal to search the database and select parts + quantities for a specific task.
-   **Display:** Read-only summary in the grid.

#### 3.3.5 Additional Columns
-   **Line:** Multi-select for production line numbers (toggleable).
-   **Notes:** Rich text field for additional remarks.
-   **Actions:** Delete row functionality.

### 3.4 Analytics & Insights
-   **Analytics Dashboard:** A modal providing real-time statistics:
    -   Total Downtime (Aggregated).
    -   Downtime Distribution by Shift (Pie Chart).
    -   Top 5 Machines by Interventions (Bar Chart).
    -   Top 5 Spare Parts Used (List).
-   **AI Analysis Window:** A chat interface to query data using natural language (e.g., "Show me downtime for the Filler last week") and generate visualizations.

### 3.5 AI Copilot (Chat)
-   **Natural Language Processing:** Powered by Google Gemini.
-   **Capabilities:**
    -   Add/Edit/Delete logs via text commands.
    -   Batch operations (e.g., "Clear all night shift entries").
    -   Multi-date generation (e.g., "Generate logs for the last 3 days").
    -   Manage Engineers and Spare Parts.

### 3.6 Output & Reporting
-   **Print Mode:** A CSS-optimized view for A4 Landscape printing. Hides UI elements (buttons, icons) and enforces high-contrast borders.
-   **CSV Export:** Export data for the current day or a custom date range to `.csv` format.

### 3.7 Settings & Customization
-   **Visual:** Theme selection (Blue, Green, Slate, etc.), Font Size, Compact Mode.
-   **Functional:** Toggle columns (Line, Time), Spell Check, Auto-Capitalize.
-   **AI Config:** API Key input, Model selection (Flash/Pro), Thinking Budget.
-   **Data Management:** Backup/Restore database.

---

## 4. Non-Functional Requirements

### 4.1 Performance
-   **Offline-First:** The app must function 100% without an internet connection (after initial load).
-   **Responsiveness:** Instant UI updates and fast local data retrieval.

### 4.2 Data Persistence & Security
-   **Local Storage:** All data is stored in the browser's `localStorage`.
-   **File System Sync:** Optional synchronization to a local JSON file using the File System Access API for cloud backup (Google Drive/OneDrive).
-   **Privacy:** No data is sent to external servers (except for AI prompts sent to Google APIs when enabled).

### 4.3 Compatibility
-   **Browser:** Modern browsers (Chrome, Edge, Firefox, Safari).
-   **Device:** Optimized for Desktop/Laptop usage (Mouse & Keyboard).

---

## 5. Technical Stack

-   **Frontend Framework:** React 18
-   **Build Tool:** Vite
-   **Language:** TypeScript
-   **Styling:** Tailwind CSS
-   **Icons:** Lucide React
-   **AI Integration:** Google GenAI SDK (`@google/genai`)
-   **State Management:** React Hooks (`useState`, `useEffect`, `useReducer`)

---

## 6. Future Roadmap

-   **Real-Time Collaboration:** Backend integration (Supabase/Firebase) for multi-user editing.
-   **Mobile App:** A dedicated mobile view or PWA for tablets/phones.
-   **Predictive Maintenance:** AI models to predict breakdowns based on log history.
-   **Asset Management:** Expanded lifecycle tracking for machines.
-   **ERP Integration:** Direct connectors for SAP/Maximo.
