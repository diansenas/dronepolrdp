const { app, BrowserWindow } = require('electron');
const { spawn } = require('child_process');
const path = require('path');

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
    serverProcess = spawn(
        process.execPath,
        [path.join(__dirname, 'server.js')],
        {
            cwd: __dirname,
            stdio: 'inherit'
        }
    );

    setTimeout(createWindow, 2000);
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