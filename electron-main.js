const { app, BrowserWindow } = require('electron');
const path = require('path');
const { fork } = require('child_process');

let mainWindow;
let serverProcess;

function isPackaged() {
  return !process.argv[0].endsWith('node');
}

function appRoot() {
  if (isPackaged()) {
    return process.resourcesPath;
  }
  return __dirname;
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

const root = appRoot();
const serverCwd = path.join(root, 'server');

const serverEnv = {
  ...process.env,
  NODE_ENV: 'production',
  PORT: '8080',
  DATABASE_URL: 'file:./chatter.db',
  JWT_SECRET: 'electron-jwt-secret-minimum-32-characters',
  JWT_REFRESH_SECRET: 'electron-jwt-refresh-secret-minimum-32-chars',
  CORS_ORIGIN: 'http://localhost:8080',
  STORAGE_DRIVER: 'local',
  STORAGE_LOCAL_DIR: path.join(root, 'uploads')
};

function runMigrate() {
  const prismaBin = process.platform === 'win32' ? 'prisma.cmd' : 'prisma';
  const prismaPath = path.join(serverCwd, 'node_modules', '.bin', prismaBin);
  const schemaPath = path.join(serverCwd, 'prisma', 'schema.prisma');
  return new Promise((resolve, reject) => {
    const proc = fork(prismaPath, ['db', 'push', '--schema', schemaPath, '--accept-data-loss'], {
      cwd: serverCwd,
      env: serverEnv,
      stdio: 'pipe'
    });
    proc.stdout?.on('data', (d) => console.log(d.toString()));
    proc.stderr?.on('data', (d) => console.error(d.toString()));
    proc.on('close', (code) => code === 0 ? resolve() : reject(new Error(`prisma migrate exited ${code}`)));
  });
}

function startServer() {
  const serverPath = path.join(serverCwd, 'dist', 'src', 'server.js');
  serverProcess = fork(serverPath, [], {
    cwd: serverCwd,
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
