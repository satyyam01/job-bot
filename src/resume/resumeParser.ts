export interface ParsedBullet {
  id: string;
  originalText: string;
  optimizedText: string;
  wordCount: number;
}

export interface ParsedProject {
  id: string;
  titleAndTech: string[]; // Lines like title and tags before bullets
  bullets: ParsedBullet[];
}

export interface ParsedSection {
  name: string;
  content: string[]; // Raw lines if not parsed further
  projects: ParsedProject[]; // If applicable
}

export class ResumeParser {
  /**
   * Splits the resume into sections and extracts Experience and Projects for optimization.
   */
  static parse(markdown: string): { 
    header: string[];
    experience: ParsedProject[];
    projects: ParsedProject[];
    skills: string[];
    footer: string[];
  } {
    const lines = markdown.split('\n');
    
    const header: string[] = [];
    const experience: ParsedProject[] = [];
    const projects: ParsedProject[] = [];
    const skills: string[] = [];
    const footer: string[] = [];
    
    let currentSection = 'header';
    let currentProject: ParsedProject | null = null;
    let expCounter = 0;
    let projCounter = 0;
    let bulletCounter = 0;

    for (const line of lines) {
      if (line.trim() === 'Experience') {
        currentSection = 'experience';
        continue; // Skip the section header itself in output
      } else if (line.trim() === 'Projects') {
        currentSection = 'projects';
        if (currentProject) {
          experience.push(currentProject);
          currentProject = null;
        }
        continue;
      } else if (line.trim() === 'Technical Skills') {
        currentSection = 'skills';
        if (currentProject) {
          projects.push(currentProject);
          currentProject = null;
        }
        continue;
      } else if (line.trim() === 'Achievements, Certifications & Leadership') {
        currentSection = 'footer';
        continue;
      } else if (line.trim() === 'Education') {
        // In the master resume, Education is part of the header (we are omitting it from optimization)
        currentSection = 'header';
      }

      if (currentSection === 'header') {
        header.push(line);
      } else if (currentSection === 'footer') {
        footer.push(line);
      } else if (currentSection === 'skills') {
        skills.push(line);
      } else if (currentSection === 'experience') {
        if (line.trim().length > 0 && !line.trim().startsWith('•')) {
          // New Experience Block
          if (currentProject) experience.push(currentProject);
          currentProject = { id: `exp_${expCounter++}`, titleAndTech: [line], bullets: [] };
        } else if (line.trim().startsWith('•')) {
          if (!currentProject) currentProject = { id: `exp_${expCounter++}`, titleAndTech: [], bullets: [] };
          currentProject.bullets.push(this.createBullet(line, bulletCounter++));
        } else if (currentProject && line.trim().length > 0) {
           currentProject.titleAndTech.push(line);
        }
      } else if (currentSection === 'projects') {
        if (line.trim().length > 0 && !line.trim().startsWith('•')) {
          // New Project Block
          if (currentProject) projects.push(currentProject);
          currentProject = { id: `proj_${projCounter++}`, titleAndTech: [line], bullets: [] };
        } else if (line.trim().startsWith('•')) {
          if (!currentProject) currentProject = { id: `proj_${projCounter++}`, titleAndTech: [], bullets: [] };
          currentProject.bullets.push(this.createBullet(line, bulletCounter++));
        } else if (currentProject && line.trim().length > 0) {
           currentProject.titleAndTech.push(line);
        }
      }
    }
    
    // Push the last one
    if (currentProject && currentSection === 'experience') experience.push(currentProject);
    if (currentProject && currentSection === 'projects') projects.push(currentProject);

    return { header, experience, projects, skills, footer };
  }

  private static createBullet(text: string, idNum: number): ParsedBullet {
    return {
      id: `bullet_${idNum}`,
      originalText: text,
      optimizedText: text,
      wordCount: text.split(/\s+/).filter(w => w.length > 0).length
    };
  }
}
