const { execSync } = require('child_process');
const fs = require('fs');

const zipPath = 'C:/Users/Administrator/Desktop/echorura_hk_update.zip';
if (fs.existsSync(zipPath)) {
  fs.unlinkSync(zipPath);
}

console.log('Packaging D:/极声音乐香港版 for aaPanel deployment...');
const cmd = `tar.exe -caf "${zipPath}" -C "D:/极声音乐香港版" .next src public package.json next.config.ts ecosystem.config.js`;
console.log('Running:', cmd);

execSync(cmd, { stdio: 'inherit' });

if (fs.existsSync(zipPath)) {
  const stats = fs.statSync(zipPath);
  console.log(`✅ SUCCESS! Zip package created at: ${zipPath}`);
  console.log(`📦 Size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
} else {
  console.error('❌ Failed to create zip package.');
}
