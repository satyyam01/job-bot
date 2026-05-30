import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { logger } from '../logs/logger';
import { ParsedProject } from './resumeParser';

export class LatexGeneratorService {
  /**
   * Escapes standard characters that would crash LaTeX compilation
   */
  public static escapeLatex(text: string): string {
    if (!text) return '';
    return text
      .replace(/\\/g, '\\textbackslash ')
      .replace(/&/g, '\\&')
      .replace(/%/g, '\\%')
      .replace(/\$/g, '\\$')
      .replace(/#/g, '\\#')
      .replace(/_/g, '\\_')
      .replace(/{/g, '\\{')
      .replace(/}/g, '\\}')
      .replace(/~/g, '\\textasciitilde ')
      .replace(/\^/g, '\\textasciicircum ')
      .replace(/•/g, '') // Remove bullet character if accidentally preserved
      // Clean up markdown bold tags that the LLM might have output
      .replace(/\*\*([^*]+)\*\*/g, '\\textbf{$1}')
      .replace(/\*([^*]+)\*/g, '\\emph{$1}');
  }

  /**
   * Directly maps optimized text elements to specific LaTeX template tokens
   */
  public static generateTex(
    experience: ParsedProject[],
    projects: ParsedProject[],
    skills: string[]
  ): string {
    logger.info('[LaTeX Generator] Mapping optimized graph bullets directly to resumeTemplate.tex placeholders');

    const FALLBACK_BULLETS: Record<string, string[]> = {
      accenture: [
        "Architected multi-agent AI enrollment platform automating 15+ complex healthcare workflows.",
        "Built scalable async enrollment pipelines with fault-tolerant processing and policy-driven automation.",
        "Developed real-time SSE observability for AI reasoning, auditability, and decision traceability."
      ],
      drdo: [
        "Led a 4-member team building real-time object detection models, improving detection accuracy by 25%.",
        "Designed edge analytics systems using Arduino, ESP8266, and PyFirmata for low-latency processing.",
        "Conducted field testing and optimization cycles, reducing false positives by 85%."
      ],
      defence: [
        "Led a 4-member team building real-time object detection models, improving detection accuracy by 25%.",
        "Designed edge analytics systems using Arduino, ESP8266, and PyFirmata for low-latency processing.",
        "Conducted field testing and optimization cycles, reducing false positives by 85%."
      ],
      farmtrack: [
        "Built a multi-farm analytics platform with RFID tracking and real-time operational insights.",
        "Implemented JWT authentication, role-based access, and automated alerting workflows.",
        "Improved system responsiveness by 40% using Redis caching and modular backend design."
      ],
      finsage: [
        "Developed LightGBM risk models on 32K+ records with SHAP-based explainability (93% accuracy).",
        "Built a contextual financial analytics assistant using Llama3 and LangGraph.",
        "Secured analytical workflows using bcrypt authentication, JWT sessions, and SQL-based controls."
      ],
      lumora: [
        "Designed an AI journaling assistant with emotion tracking and contextual memory retrieval.",
        "Built LangGraph RAG pipelines using Cohere and Pinecone for sub-3s analytical responses.",
        "Implemented OTP verification and engagement reminders to improve user retention."
      ]
    };

    const FALLBACK_SKILLS: Record<string, string> = {
      languages: "JavaScript, C++ (Data Structures and Problem Solving)",
      frameworks: "Node.js, Express.js, Streamlit",
      databases: "MongoDB (NoSQL), PostgreSQL (SQL), Pinecone (Vector Database)",
      devops: "Git, CI/CD, Agile Basic: Microservices, AWS, Docker",
      ai: "Generative AI, LangChain, LangGraph, RAG, REST APIs, Postman, Github"
    };

    // Helper to find and map experience bullets
    const findExpBullets = (companyKey: string): string => {
      const expItem = experience.find(exp => 
        exp.titleAndTech[0]?.toLowerCase().includes(companyKey.toLowerCase())
      );
      
      const bullets = (expItem && expItem.bullets && expItem.bullets.length > 0)
        ? expItem.bullets.map(b => b.optimizedText || b.originalText)
        : FALLBACK_BULLETS[companyKey.toLowerCase()] || [];

      if (bullets.length === 0) {
        logger.warn(`[LaTeX Generator] Could not find experience bullets for company key: ${companyKey}, using standard bullet.`);
        return '        \\resumeItem{Key accomplishments and engineering contributions.}';
      }

      return bullets
        .map(b => `        \\resumeItem{${this.escapeLatex(b)}}`)
        .join('\n');
    };

    // Helper to find and map project bullets
    const findProjBullets = (projectKey: string): string => {
      const projItem = projects.find(proj => 
        proj.titleAndTech[0]?.toLowerCase().includes(projectKey.toLowerCase())
      );

      const bullets = (projItem && projItem.bullets && projItem.bullets.length > 0)
        ? projItem.bullets.map(b => b.optimizedText || b.originalText)
        : FALLBACK_BULLETS[projectKey.toLowerCase()] || [];

      if (bullets.length === 0) {
        logger.warn(`[LaTeX Generator] Could not find project bullets for project key: ${projectKey}, using standard bullet.`);
        return '            \\resumeItem{Key system design and software development achievements.}';
      }

      return bullets
        .map(b => `            \\resumeItem{${this.escapeLatex(b)}}`)
        .join('\n');
    };

    // Helper to find and extract skill details by category prefix
    const getSkillDetails = (categoryKey: string): string => {
      const item = skills.find(s => s.toLowerCase().startsWith(categoryKey.toLowerCase()));
      let details = '';
      if (item) {
        const parts = item.split(':');
        details = parts.slice(1).join(':').trim();
      }
      
      if (!details) {
        logger.warn(`[LaTeX Generator] Could not find technical skills details for category key: ${categoryKey}, using fallback.`);
        let key = categoryKey.toLowerCase();
        if (key.includes('framework')) key = 'frameworks';
        if (key.includes('database')) key = 'databases';
        if (key.includes('devops')) key = 'devops';
        if (key.includes('ai')) key = 'ai';
        details = FALLBACK_SKILLS[key] || '';
      }
      return details;
    };

    // 1. Extract Experience Bullets
    const accentureBullets = findExpBullets('accenture');
    const drdoBullets = findExpBullets('drdo') || findExpBullets('defence');

    // 2. Extract Projects Bullets
    const farmtrackBullets = findProjBullets('farmtrack');
    const finsageBullets = findProjBullets('finsage');
    const lumoraBullets = findProjBullets('lumora');

    // 3. Extract Technical Skills categories
    const languages = this.escapeLatex(getSkillDetails('Languages'));
    const frameworks = this.escapeLatex(getSkillDetails('Frameworks'));
    const databases = this.escapeLatex(getSkillDetails('Databases'));
    
    // Custom check for DevOps to preserve your original \textbf{Basic:} macro style
    const devOpsRaw = getSkillDetails('DevOps');
    let devOps = this.escapeLatex(devOpsRaw);
    if (devOpsRaw.toLowerCase().includes('basic:')) {
      const parts = devOpsRaw.split(/basic:/i);
      if (parts[0] && parts[1]) {
        devOps = `${this.escapeLatex(parts[0].trim())} \\textbf{Basic:} ${this.escapeLatex(parts[1].trim())}`;
      }
    }
    
    const aiTools = this.escapeLatex(getSkillDetails('AI/ML'));

    // 4. Load the master resumeTemplate.tex
    const templatePath = path.join(__dirname, 'resumeTemplate.tex');
    let template = fs.readFileSync(templatePath, 'utf-8');

    // 5. Injects tokens securely
    template = template.replace('%%ACCENTURE_BULLETS%%', accentureBullets);
    template = template.replace('%%DRDO_BULLETS%%', drdoBullets);
    
    template = template.replace('%%FARMTRACK_BULLETS%%', farmtrackBullets);
    template = template.replace('%%FINSAGE_BULLETS%%', finsageBullets);
    template = template.replace('%%LUMORA_BULLETS%%', lumoraBullets);
    
    template = template.replace('%%LANGUAGES_SKILLS%%', languages);
    template = template.replace('%%FRAMEWORKS_SKILLS%%', frameworks);
    template = template.replace('%%DATABASES_SKILLS%%', databases);
    template = template.replace('%%DEVOPS_SKILLS%%', devOps);
    template = template.replace('%%AI_SKILLS%%', aiTools);

    return template;
  }

  /**
   * Compiles LaTeX code into PDF using tectonic CLI
   */
  public static async compileToPdf(latexCode: string, outputPath: string): Promise<string> {
    const scratchDir = path.dirname(outputPath);
    if (!fs.existsSync(scratchDir)) {
      fs.mkdirSync(scratchDir, { recursive: true });
    }

    const texFilePath = outputPath.replace('.pdf', '.tex');
    fs.writeFileSync(texFilePath, latexCode, 'utf-8');
    logger.info(`[LaTeX Generator] Saved LaTeX code to ${texFilePath}`);

    // Prepend local bin directory to PATH so compiled tectonic binary is discovered
    const localBin = path.join(process.cwd(), 'bin');
    const childEnv = { ...process.env };
    if (fs.existsSync(localBin)) {
      childEnv.PATH = `${localBin}${path.delimiter}${childEnv.PATH || ''}`;
    }

    return new Promise((resolve, reject) => {
      logger.info(`[LaTeX Generator] Spawning tectonic compiler on ${texFilePath}`);
      
      const compileCmd = `tectonic -o "${scratchDir}" "${texFilePath}"`;
      
      exec(compileCmd, { env: childEnv }, (error, stdout, stderr) => {
        if (error) {
          logger.error(`[LaTeX Generator] Tectonic compilation failed: ${stderr || error.message}`);
          reject(error);
          return;
        }
        
        logger.info(`[LaTeX Generator] Successfully compiled PDF at ${outputPath}`);
        resolve(outputPath);
      });
    });
  }
}
