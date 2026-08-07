// deploy/scf-package.js
// ============================================================
// 把 OCR 后端打包成适合腾讯云 SCF 上传的 zip
//
// 用法（在仓库根目录执行）：
//   node deploy/scf-package.js
// 输出：dist/ocr-scf.zip
// ============================================================

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const outDir = path.join(__dirname, '..', 'dist');
const zipPath = path.join(outDir, 'ocr-scf.zip');
const tmpDir = path.join(__dirname, '..', 'dist', 'ocr-scf-tmp');

if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
if (fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true, force: true });
fs.mkdirSync(tmpDir, { recursive: true });

// 复制入口文件
fs.copyFileSync(path.join(__dirname, '..', 'api', 'ocr.js'), path.join(tmpDir, 'ocr.js'));
fs.copyFileSync(path.join(__dirname, '..', 'api', 'ocr-scf.js'), path.join(tmpDir, 'ocr-scf.js'));

// 生成 index.js（SCF 默认入口）
fs.writeFileSync(path.join(tmpDir, 'index.js'), `module.exports = require('./ocr-scf.js');\n`);

// 打包成 zip（Git Bash / Linux / macOS 自带 zip；Windows 没有 zip.exe 时提示手动压缩）
const zipFull = path.resolve(zipPath);
const tmpFull = path.resolve(tmpDir);

try {
  execSync(`cd "${tmpFull}" && zip -r "${zipFull}" .`, { stdio: 'inherit' });
  console.log('SCF 部署包已生成：', zipFull);
} catch (e) {
  console.error('本机没有 zip 命令，无法自动打包。请手动把以下文件压缩成 zip：');
  fs.readdirSync(tmpFull).forEach(f => console.log('  -', f));
  console.error('目标文件：', zipFull);
  process.exit(1);
}

console.log('包含文件：');
fs.readdirSync(tmpFull).forEach(f => console.log('  -', f));

// 清理临时目录
fs.rmSync(tmpDir, { recursive: true, force: true });
