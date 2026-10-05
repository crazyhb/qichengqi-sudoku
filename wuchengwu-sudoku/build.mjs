// 把 src/ 下的页面、样式、脚本合成一个可直接部署的单文件 index.html。
// 用法：node build.mjs   （无第三方依赖）
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const src = join(here, 'src');

const [template, css, engine, app] = await Promise.all([
  readFile(join(src, 'index.html'), 'utf8'),
  readFile(join(src, 'styles.css'), 'utf8'),
  readFile(join(src, 'engine.js'), 'utf8'),
  readFile(join(src, 'app.js'), 'utf8'),
]);

// 两个模块拼成一个内联脚本：去掉 engine 的 export、app 的 import。
const engineInline = engine.replace(/^export /gm, '');
const appInline = app.replace(/^import\s+\{[^}]*\}\s+from\s+'\.\/engine\.js';\s*\n/m, '');
if (appInline === app) throw new Error('app.js 里没找到 engine.js 的 import，构建中止');
const script = `${engineInline.trimEnd()}\n\n${appInline.trimEnd()}\n`;
if (script.includes('</script')) throw new Error('脚本里不能出现 </script');

const banner = '<!-- 由 wuchengwu-sudoku/build.mjs 生成，请改 src/ 后重新构建 -->';
let html = template;
html = html.replace('<link rel="stylesheet" href="./styles.css" />', `<style>\n${css.trimEnd()}\n    </style>`);
html = html.replace('<script type="module" src="./app.js"></script>', `<script type="module">\n${script}    </script>`);
if (html === template || html.includes('./styles.css') || html.includes('./app.js')) {
  throw new Error('模板里的样式/脚本引用没有被替换，构建中止');
}
html = html.replace('<!doctype html>', `<!doctype html>\n${banner}`);

await writeFile(join(here, 'index.html'), html);
console.log(`已生成 ${join(here, 'index.html')}（${Buffer.byteLength(html)} 字节）`);
