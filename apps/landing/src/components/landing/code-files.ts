import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { codeToHtml } from 'shiki';

export type CodeFile = { path: string; lines: number; html: string };
export type PluginCode = { id: string; files: CodeFile[] };

const root = path.join(process.cwd(), 'src/plugins');
// Agent guides describe the folder; the code view shows what runs.
const skipped = new Set(['AGENTS.md', 'CLAUDE.md']);
const languages: Record<string, string> = { '.ts': 'ts', '.tsx': 'tsx', '.json': 'json' };

/**
 * Reads every playground plugin folder and highlights its files once, on the server, so the
 * code view always shows the code that is running in the frame.
 */
export async function loadPluginCode(): Promise<PluginCode[]> {
  const result: PluginCode[] = [];
  const plugins = await readdir(root, { withFileTypes: true });
  for (const { name: id } of plugins.filter((entry) => entry.isDirectory())) {
    const folder = path.join(root, id);
    const entries = await readdir(folder, { recursive: true, withFileTypes: true });
    const files = entries
      .filter(
        (entry) =>
          entry.isFile() && !skipped.has(entry.name) && languages[path.extname(entry.name)],
      )
      .map((entry) => path.relative(folder, path.join(entry.parentPath, entry.name)))
      .sort((a, b) => a.split('/').length - b.split('/').length || a.localeCompare(b));
    if (!files.length) continue;
    result.push({
      id,
      files: await Promise.all(
        files.map(async (file) => {
          const code = (await readFile(path.join(folder, file), 'utf8')).trimEnd();
          return {
            path: file,
            lines: code.split('\n').length,
            html: await codeToHtml(code, {
              lang: languages[path.extname(file)],
              themes: { light: 'github-light', dark: 'github-dark' },
              defaultColor: false,
            }),
          };
        }),
      ),
    });
  }
  return result;
}
