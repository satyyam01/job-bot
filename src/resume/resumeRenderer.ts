import { ParsedProject } from './resumeParser';

export class ResumeRenderer {
  /**
   * Normalizes spacing, replaces literal escaped newlines, and ensures clean rendering format.
   */
  private static normalizeText(text: string): string {
    if (!text) return '';
    // Replace any accidental double-escaped newlines with actual newlines
    let normalized = text.replace(/\\\\n/g, '\n');
    normalized = normalized.replace(/\\n/g, '\n');
    // Ensure bullets have a clean space after them
    normalized = normalized.replace(/^•([^\s])/gm, '• $1');
    return normalized.trim();
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
    lines.push(''); // Add spacing
    for (const proj of experience) {
      lines.push(...proj.titleAndTech.map(this.normalizeText));
      for (const bullet of proj.bullets) {
        lines.push(this.normalizeText(bullet.optimizedText));
      }
      lines.push(''); // Space between experiences
    }

    // Projects Section
    lines.push('Projects');
    lines.push(''); // Add spacing
    for (const proj of projects) {
      lines.push(...proj.titleAndTech.map(this.normalizeText));
      for (const bullet of proj.bullets) {
        lines.push(this.normalizeText(bullet.optimizedText));
      }
      lines.push(''); // Space between projects
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
