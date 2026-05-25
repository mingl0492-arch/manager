const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs/promises');

let mainWindow;
const DATA_FILE_NAME = 'inspiration-data.json';
const DATA_DIR_NAME = 'data';

function appDirectory() {
  // Packaged app: put data next to the app EXE, so copying the app folder copies data too.
  // Development mode: put data in the project folder for easier testing.
  return app.isPackaged ? path.dirname(app.getPath('exe')) : app.getAppPath();
}

function dataDirectoryPath() {
  return path.join(appDirectory(), DATA_DIR_NAME);
}

function dataFilePath() {
  return path.join(dataDirectoryPath(), DATA_FILE_NAME);
}

function legacyUserDataFilePath() {
  // v1.0.4 and earlier used Electron's userData directory.
  return path.join(app.getPath('userData'), DATA_FILE_NAME);
}

async function pathExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function ensureDataFile() {
  const localDataDir = dataDirectoryPath();
  const localDataFile = dataFilePath();
  const legacyDataFile = legacyUserDataFilePath();

  await fs.mkdir(localDataDir, { recursive: true });

  const hasLocalData = await pathExists(localDataFile);
  if (hasLocalData) return;

  // Auto-migrate old data once, so existing users do not lose data after upgrading.
  if (legacyDataFile !== localDataFile && await pathExists(legacyDataFile)) {
    try {
      await fs.copyFile(legacyDataFile, localDataFile);
      return;
    } catch (error) {
      console.error('Failed to migrate legacy data:', error);
    }
  }

  await fs.writeFile(localDataFile, JSON.stringify(null, null, 2), 'utf-8');
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1500,
    height: 920,
    minWidth: 1180,
    minHeight: 760,
    backgroundColor: '#f6f4ef',
    title: '灵感管理',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: true
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));
}

app.whenReady().then(async () => {
  await ensureDataFile();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

ipcMain.handle('store:load', async () => {
  try {
    await ensureDataFile();
    const raw = await fs.readFile(dataFilePath(), 'utf-8');
    return JSON.parse(raw);
  } catch (error) {
    console.error('Failed to load data:', error);
    return null;
  }
});

ipcMain.handle('store:save', async (_event, state) => {
  try {
    await ensureDataFile();
    const serialized = JSON.stringify(state, null, 2);
    await fs.writeFile(dataFilePath(), serialized, 'utf-8');
    return { ok: true };
  } catch (error) {
    console.error('Failed to save data:', error);
    return { ok: false, message: error.message };
  }
});

ipcMain.handle('store:path', async () => dataFilePath());
