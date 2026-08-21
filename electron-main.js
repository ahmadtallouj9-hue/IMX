const { app, BrowserWindow } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

let mainWindow;
let serverProcess;

function getNodePath() {
  if (process.env.NODE_ENV === 'development' || !app.isPackaged) {
    return 'node';
  }
  return path.join(process.resourcesPath, 'node.exe');
}

function getServerRoot() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'app.asar.unpacked', 'server');
  }
  return path.join(__dirname, 'server');
}

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
    title: 'IMX'
  });

  mainWindow.loadURL('http://localhost:8080');

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function waitForServer(url, timeout = 30000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const check = async () => {
      try {
        const res = await fetch(url);
        if (res.ok) return resolve();
      } catch {}
      if (Date.now() - start > timeout) return reject(new Error('Server start timed out'));
      setTimeout(check, 500);
    };
    check();
  });
}

const nodeExe = getNodePath();
const serverRoot = getServerRoot();

const serverEnv = {
  ...process.env,
  NODE_ENV: 'production',
  PORT: '8080',
  DATABASE_URL: 'file:./chatter.db',
  JWT_SECRET: 'electron-jwt-secret-minimum-32-characters',
  JWT_REFRESH_SECRET: 'electron-jwt-refresh-secret-minimum-32-chars',
  CORS_ORIGIN: 'http://localhost:8080',
  STORAGE_DRIVER: 'local',
  STORAGE_LOCAL_DIR: path.join(serverRoot, '..', 'uploads')
};

function runMigrate() {
  const prismaScript = path.join(serverRoot, 'node_modules', 'prisma', 'build', 'index.js');
  const schemaPath = path.join(serverRoot, 'prisma', 'schema.prisma');
  return new Promise((resolve, reject) => {
    const proc = spawn(nodeExe, [prismaScript, 'db', 'push', '--schema', schemaPath, '--accept-data-loss'], {
      cwd: serverRoot,
      env: serverEnv,
      stdio: 'pipe'
    });
    proc.stdout?.on('data', (d) => console.log(d.toString()));
    proc.stderr?.on('data', (d) => console.error(d.toString()));
    proc.on('close', (code) => code === 0 ? resolve() : reject(new Error(`prisma migrate exited ${code}`)));
  });
}

function startServer() {
  const serverPath = path.join(serverRoot, 'dist', 'src', 'server.js');
  serverProcess = spawn(nodeExe, [serverPath], {
    cwd: serverRoot,
    env: serverEnv,
    stdio: 'pipe'
  });

  serverProcess.stdout?.on('data', (data) => {
    console.log(`Server: ${data}`);
  });

  serverProcess.stderr?.on('data', (data) => {
    console.error(`Server Error: ${data}`);
  });

  serverProcess.on('error', (err) => {
    console.error('Server process error:', err.message);
  });
}

app.whenReady().then(async () => {
  try {
    await runMigrate();
  } catch (e) {
    console.error('Migration failed:', e.message);
  }

  startServer();

  try {
    await waitForServer('http://localhost:8080/health/live');
  } catch (e) {
    console.error('Server failed to start:', e.message);
  }

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
