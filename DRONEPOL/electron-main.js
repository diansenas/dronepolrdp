const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow;

function iniciarServidor() {
  const userDataPath = app.getPath('userData');
  const databasePath = path.join(userDataPath, 'dronepol.db');

  if (!fs.existsSync(databasePath)) {
    const originalDatabase = path.join(__dirname, 'dronepol.db');

    if (fs.existsSync(originalDatabase)) {
      fs.copyFileSync(originalDatabase, databasePath);
    }
  }

  process.env.DRONEPOL_DB_PATH = databasePath;

  require('./server.js');
}

function criarJanela() {
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
  try {
    iniciarServidor();

    setTimeout(() => {
      criarJanela();
    }, 2000);
  } catch (erro) {
    console.error('Erro ao iniciar o servidor:', erro);
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
