const { app, BrowserWindow, Menu } = require('electron');
const path = require('path');

let mainWindow;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1280,
        height: 800,
        title: "Controle de Caixa Âncora Consultoria Financeira",
        icon: path.join(__dirname, 'icon.png'), // Opcional: Se tiver um ícone
        webPreferences: {
            nodeIntegration: false, // Segurança: Mantém isolado
            contextIsolation: true,
            enableRemoteModule: false
        }
    });

    // Remove o menu padrão (Arquivo, Editar, etc) para ficar "App Nativo"
    mainWindow.setMenuBarVisibility(false);

    // Carrega o arquivo inicial
    mainWindow.loadFile('index.html');
}

app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});