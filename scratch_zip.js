const { execSync } = require('child_process');
const fs = require('fs');

const zipPath = 'C:\\Users\\Administrator\\Desktop\\echorura_hk_update.zip';
if (fs.existsSync(zipPath)) {
  fs.unlinkSync(zipPath);
}

console.log('Zipping D:\\极声音乐香港版 for aaPanel deployment...');

const psScript = `
$items = @(
  "D:\\极声音乐香港版\\.next",
  "D:\\极声音乐香港版\\src",
  "D:\\极声音乐香港版\\public",
  "D:\\极声音乐香港版\\package.json",
  "D:\\极声音乐香港版\\next.config.ts",
  "D:\\极声音乐香港版\\ecosystem.config.js"
)
Compress-Archive -Path $items -DestinationPath "${zipPath}" -Force
`;

fs.writeFileSync('create_zip.ps1', psScript, 'utf8');
execSync('powershell -ExecutionPolicy Bypass -File create_zip.ps1', { stdio: 'inherit' });
if (fs.existsSync('create_zip.ps1')) {
  fs.unlinkSync('create_zip.ps1');
}

const stats = fs.statSync(zipPath);
console.log(`SUCCESS! Zip created at ${zipPath} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
