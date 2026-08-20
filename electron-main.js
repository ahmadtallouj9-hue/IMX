const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

let mainWindow;
let serverProcess;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    icon: path.join(__dirname, 'web', 'public', 'icon.png'),
    title: 'Chatter'
  });

  mainWindow.loadFile(path.join(__dirname, 'web', 'dist', 'index.html'));

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function startServer() {
  const serverPath = path.join(__dirname, 'server', 'dist', 'src', 'server.js');
  serverProcess = spawn('node', [serverPath], {
    cwd: path.join(__dirname, 'server'),
    env: {
      ...process.env,
      NODE_ENV: 'production',
      PORT: '8080',
      DATABASE_URL: 'file:./chatter.db',
      JWT_SECRET: 'electron-jwt-secret-change-in-production',
      JWT_REFRESH_SECRET: 'electron-jwt-refresh-secret-change-in-production',
      CORS_ORIGIN: 'http://localhost:8080',
      STORAGE_DRIVER: 'local',
      STORAGE_LOCAL_DIR: path.join(__dirname, 'uploads')
    }
  });

  serverProcess.stdout.on('data', (data) => {
    console.log(`Server: ${data}`);
  });

  serverProcess.stderr.on('data', (data) => {
    console.error(`Server Error: ${data}`);
  });
}

app.whenReady().then(() => {
  startServer();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (serverProcess) {
    serverProcess.kill();
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  if (serverProcess) {
    serverProcess.kill();
  }
});