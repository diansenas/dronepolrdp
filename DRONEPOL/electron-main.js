const { app, BrowserWindow } = require('electron');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

let serverProcess;
let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadURL('http://localhost:3000');
}

app.whenReady().then(() => {
  const userDataPath = app.getPath('userData');
  const databasePath = path.join(userDataPath, 'dronepol.db');

  if (!fs.existsSync(databasePath)) {
    const originalDatabase = path.join(__dirname, 'dronepol.db');

    if (fs.existsSync(originalDatabase)) {
      fs.copyFileSync(originalDatabase, databasePath);
    }
  }

  serverProcess = spawn(
    process.execPath,
    [path.join(__dirname, 'server.js')],
    {
      cwd: __dirname,
      env: {
        ...process.env,
        ELECTRON_RUN_AS_NODE: '1',
        DRONEPOL_DB_PATH: databasePath
      },
      stdio: 'inherit'
    }
  );

  setTimeout(createWindow, 2500);
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
