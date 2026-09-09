import fs from 'fs';
import path from 'path';

export class KnowledgeBaseService {
  private static cachedContent: string | null = null;
  private static lastMtime: number = 0;
  private static customFilePath: string | null = null;

  /**
   * Resolves the absolute path to knowledge-base.md across different execution contexts (dev, test, dist).
   */
  static getKnowledgeBasePath(): string {
    if (this.customFilePath && fs.existsSync(this.customFilePath)) {
      return this.customFilePath;
    }

    const possiblePaths = [
      path.resolve(process.cwd(), 'knowledge-base.md'),
      path.resolve(process.cwd(), 'backend', 'knowledge-base.md'),
      path.resolve(process.cwd(), '..', 'backend', 'knowledge-base.md'),
      path.resolve(__dirname, '..', '..', 'knowledge-base.md'),
      path.resolve(__dirname, '..', '..', '..', 'backend', 'knowledge-base.md'),
    ];

    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        return p;
      }
    }

    // Default fallback
    return path.resolve(process.cwd(), 'backend', 'knowledge-base.md');
  }

  /**
   * Sets a custom file path for testing or custom knowledge base files.
   */
  static setCustomFilePath(filePath: string | null): void {
    this.customFilePath = filePath;
    this.cachedContent = null;
    this.lastMtime = 0;
  }

  /**
   * Retrieves the current knowledge base markdown content.
   * Caches content in memory and reloads automatically if the file modification timestamp changes.
   */
  static getContent(): string {
    const filePath = this.getKnowledgeBasePath();

    try {
      if (!fs.existsSync(filePath)) {
        console.warn(`[KnowledgeBaseService] Warning: Knowledge base file not found at ${filePath}`);
        return this.cachedContent || '';
      }

      const stat = fs.statSync(filePath);
      if (this.cachedContent && stat.mtimeMs <= this.lastMtime) {
        return this.cachedContent;
      }

      const raw = fs.readFileSync(filePath, 'utf-8');
      this.cachedContent = raw.trim();
      this.lastMtime = stat.mtimeMs;
      return this.cachedContent;
    } catch (error) {
      console.error(`[KnowledgeBaseService] Error reading knowledge base file at ${filePath}:`, error);
      return this.cachedContent || '';
    }
  }

  /**
   * Clears the in-memory cache.
   */
  static clearCache(): void {
    this.cachedContent = null;
    this.lastMtime = 0;
  }
}
