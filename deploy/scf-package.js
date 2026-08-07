// deploy/scf-package.js
// ============================================================
// 把 OCR 后端打包成适合腾讯云 SCF 上传的 zip
//
// 用法（在仓库根目录执行）：
//   node deploy/scf-package.js
// 输出：dist/ocr-scf.zip
//
// 兼容性：Windows 没有 zip 命令，自动改用 PowerShell Compress-Archive；
//         临时目录放在系统 %TEMP%，避免污染仓库。
// ============================================================

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

const rootDir = path.join(__dirname, '..');
const outDir = path.join(rootDir, 'dist');
const zipPath = path.join(outDir, 'ocr-scf.zip');
const tmpDir = path.join(os.tmpdir(), 'ocr-scf-tmp-' + Date.now());

if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

// 复制入口文件到临时目录
fs.mkdirSync(tmpDir, { recursive: true });
fs.copyFileSync(path.join(rootDir, 'api', 'ocr.js'), path.join(tmpDir, 'ocr.js'));
fs.copyFileSync(path.join(rootDir, 'api', 'ocr-scf.js'), path.join(tmpDir, 'ocr-scf.js'));
fs.writeFileSync(path.join(tmpDir, 'index.js'), `module.exports = require('./ocr-scf.js');\n`);

// 打包成 zip：优先 zip 命令（Git Bash/Linux/macOS），Windows 用 PowerShell Compress-Archive
const zipFull = path.resolve(zipPath);
const tmpFull = path.resolve(tmpDir);
const winTmp = tmpFull.replace(/\//g, '\\');

function buildWithZipCmd() {
  try {
    execSync(`cd "${tmpFull}" && zip -r "${zipFull}" .`, { stdio: 'inherit' });
    return true;
  } catch (e) {
    return false;
  }
}

function buildWithPowerShell() {
  try {
    execSync(
      `powershell -NoProfile -Command "Compress-Archive -Path '${winTmp}\\*' -DestinationPath '${zipFull}' -Force"`,
      { stdio: 'inherit' }
    );
    return true;
  } catch (e) {
    return false;
  }
}

let ok = false;
if (process.platform === 'win32') {
  ok = buildWithPowerShell() || buildWithZipCmd();
} else {
  ok = buildWithZipCmd() || buildWithPowerShell();
}

if (!ok) {
  console.error('无法自动打包。请手动把以下文件压缩成 zip：');
  fs.readdirSync(tmpDir).forEach(f => console.log('  -', f));
  console.error('目标文件：', zipFull);
  process.exit(1);
}

console.log('SCF 部署包已生成：', zipFull);
console.log('包含文件：');
fs.readdirSync(tmpDir).forEach(f => console.log('  -', f));

// 清理临时目录（失败忽略，不影响产物）
try {
  fs.rmSync(tmpDir, { recursive: true, force: true });
} catch (e) {
  try {
    execSync(`powershell -NoProfile -Command "Remove-Item -Recurse -Force '${winTmp}'"`);
  } catch (e2) {
    console.log('（临时目录清理跳过，可手动删除：', tmpDir, '）');
  }
}
