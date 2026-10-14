const { readFile, writeFile } = require('node:fs/promises');
const path = require('node:path');
const { app, BrowserWindow } = require('electron');

app.whenReady().then(async () => {
  const sourcePath = path.resolve(__dirname, '..', 'build', 'icon.svg');
  const targetPath = path.resolve(__dirname, '..', 'build', 'icon.png');
  const svg = await readFile(sourcePath, 'utf8');
  const dataUrl = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
  const window = new BrowserWindow({
    width: 512,
    height: 512,
    show: false,
    frame: false,
    transparent: true,
    webPreferences: { backgroundThrottling: false }
  });
  await window.loadURL(dataUrl);
  window.showInactive();
  await new Promise((resolve) => setTimeout(resolve, 100));
  const image = await window.webContents.capturePage();

  if (image.isEmpty()) throw new Error('Electron could not render the UniFind icon.');
  await writeFile(targetPath, image.toPNG());
  window.destroy();
  app.quit();
}).catch((error) => {
  console.error(error);
  app.exit(1);
});
