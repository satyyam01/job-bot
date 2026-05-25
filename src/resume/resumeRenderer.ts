import { ParsedProject } from './resumeParser';

export class ResumeRenderer {
  /**
   * Normalizes spacing, replaces literal escaped newlines, and ensures clean rendering format.
   */
  private static normalizeText(text: string, isBullet = false): string {
    if (!text) return '';
    let normalized = text.replace(/\\\\n/g, '\n');
    normalized = normalized.replace(/\\n/g, '\n');
    normalized = normalized.trim();
    if (isBullet && !normalized.startsWith('•')) {
       normalized = '• ' + normalized;
    }
    normalized = normalized.replace(/^•([^\s])/gm, '• $1');
    return normalized;
  }

  /**
   * Assembles the optimized projects and skills into a beautifully formatted string.
   */
  static render(
    experience: ParsedProject[],
    projects: ParsedProject[],
    skills: string[]
  ): string {
    const lines: string[] = [];

    // Experience Section
    lines.push('Experience');
    lines.push(''); 
    for (const proj of experience) {
      lines.push(...proj.titleAndTech.map(t => this.normalizeText(t)));
      for (const bullet of proj.bullets) {
        lines.push(this.normalizeText(bullet.optimizedText, true));
      }
      lines.push(''); 
    }

    // Projects Section
    lines.push('Projects');
    lines.push(''); 
    for (const proj of projects) {
      lines.push(...proj.titleAndTech.map(t => this.normalizeText(t)));
      for (const bullet of proj.bullets) {
        lines.push(this.normalizeText(bullet.optimizedText, true));
      }
      lines.push(''); 
    }

    // Technical Skills Section
    lines.push('Technical Skills');
    for (const skill of skills) {
      lines.push(this.normalizeText(skill));
    }

    // Join with actual newline characters
    return lines.join('\n').trim();
  }
}
