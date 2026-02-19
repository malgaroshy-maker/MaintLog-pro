// File System Sync Service (Replaces legacy Google Drive API service)
// Uses the modern File System Access API to write directly to a file on the user's disk.
// If the user selects a file inside their Google Drive/OneDrive folder, it acts as a cloud sync.

// Type definitions for File System Access API
interface FilePickerAcceptType {
    description?: string;
    accept: Record<string, string[]>;
}

interface SaveFilePickerOptions {
    suggestedName?: string;
    types?: FilePickerAcceptType[];
    excludeAcceptAllOption?: boolean;
}

interface OpenFilePickerOptions {
    multiple?: boolean;
    types?: FilePickerAcceptType[];
    excludeAcceptAllOption?: boolean;
}

declare global {
    interface Window {
        showSaveFilePicker(options?: SaveFilePickerOptions): Promise<FileSystemFileHandle>;
        showOpenFilePicker(options?: OpenFilePickerOptions): Promise<FileSystemFileHandle[]>;
    }
}

// Helper to gather local data
export const gatherAllData = () => {
    const backupData: any = {};
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.startsWith('maintlog_') || key.startsWith('machines_') || key.startsWith('availableEngineers_') || key.startsWith('sparePartsDB_') || key === 'sections' || key === 'appSettings')) {
             backupData[key] = localStorage.getItem(key);
        }
    }
    return JSON.stringify(backupData, null, 2);
};

// Helper to restore data to LocalStorage
export const restoreData = (jsonString: string) => {
    try {
        const data = JSON.parse(jsonString);
        // Clear existing relevant keys to avoid stale data mixing
        Object.keys(localStorage).forEach(key => {
            if (key.startsWith('maintlog_') || key.startsWith('machines_') || key.startsWith('availableEngineers_') || key.startsWith('sparePartsDB_')) {
                localStorage.removeItem(key);
            }
        });
        // Restore keys
        Object.keys(data).forEach(key => {
            localStorage.setItem(key, data[key]);
        });
        return true;
    } catch (err) {
        console.error("Restore failed", err);
        return false;
    }
};

// Browser support check
export const isFileSystemApiSupported = () => {
    return 'showSaveFilePicker' in window;
};

// --- API Functions ---

// 1. Pick a file to save to (Connect)
export const pickSaveFile = async (): Promise<FileSystemFileHandle> => {
    const options: SaveFilePickerOptions = {
        suggestedName: `MaintLogPro_Sync.json`,
        types: [{
            description: 'MaintLog Database File',
            accept: { 'application/json': ['.json'] },
        }],
    };
    const handle = await window.showSaveFilePicker(options);
    return handle;
};

// 2. Pick a file to load from (Restore/Connect Existing)
export const pickOpenFile = async (): Promise<FileSystemFileHandle> => {
    const options: OpenFilePickerOptions = {
        types: [{
            description: 'MaintLog Database File',
            accept: { 'application/json': ['.json'] },
        }],
        multiple: false
    };
    const [handle] = await window.showOpenFilePicker(options);
    return handle;
};

// 3. Write data to the handle
export const writeToFile = async (handle: FileSystemFileHandle, contents: string) => {
    const writable = await handle.createWritable();
    await writable.write(contents);
    await writable.close();
};

// 4. Read data from the handle
export const readFromFile = async (handle: FileSystemFileHandle): Promise<string> => {
    const file = await handle.getFile();
    return await file.text();
};
