# Database Architecture - Stateless In-Memory Design & Filesystem Schemas

This document details the database architecture of the **AI Resume Tailor Bot**. The application is designed to be completely stateless, managing execution state in-memory and loading templates directly from the filesystem.

---

## 1. Stateless Architectural Design

Unlike standard MERN applications, the system has **no active connection bindings** to persistent transactional databases like MongoDB or PostgreSQL:

- **Zero DB Connection Overheads**: Running without database connections simplifies horizontal scaling.
- **In-Memory Operations**: Optimization states are retained entirely in RAM during execution via LangGraph State Annotations.
- **Scaling Benefits**: The bot requires zero database connection pooling and has zero disk write overhead (writing only to Winston log files), making it an excellent fit for serverless deployments (e.g., AWS Lambda, GCP Cloud Run, or Vercel Edge).

---

## 2. In-Memory State Annotation (`GraphState`)

The complete state of a tailoring request is managed in RAM using `@langchain/langgraph` Annotations:

```typescript
export const GraphState = Annotation.Root({
  parsedResume: Annotation<ReturnType<typeof ResumeParser.parse>>(),
  jobDescription: Annotation<any>(),
  jdEmphasis: Annotation<string[]>({ reducer: (x, y) => y }),
  jdString: Annotation<string>({ reducer: (x, y) => y }),
  
  optimizedExperience: Annotation<ParsedProject[]>({ reducer: (x, y) => y }),
  optimizedProjects: Annotation<ParsedProject[]>({ reducer: (x, y) => y }),
  optimizedSkills: Annotation<string[]>({ reducer: (x, y) => y }),
  
  metadata: Annotation<Record<string, OptimizationMetadata>>({ reducer: (x, y) => ({ ...x, ...y }) }),
});
```

This state is instantiated when a request begins, modified dynamically by the graph nodes, and garbage-collected once the compiled markdown is returned to the client.

---

## 3. Filesystem Schemas & Templates

The candidate's master profile is loaded statically from the filesystem, providing a single source of truth for resume tailoring:

- **Markdown Template (`masterResume.md`)**: The source of the resume text, containing technical descriptions and layout formatting.
- **JSON Profile (`masterResume.json`)**: A pre-parsed, structured JSON representation of the master resume, used for validation and tracking metadata.

When a tailoring request is initiated, the engine reads the markdown template from the filesystem using synchronous file reads:

```typescript
private loadMasterResume() {
  try {
    const resumePath = path.join(__dirname, 'masterResume.md');
    this.masterResumeMarkdown = fs.readFileSync(resumePath, 'utf-8');
  } catch (error: any) {
    logger.error(`Failed to load master resume: ${error.message}`);
    throw error;
  }
}
```

---

## 4. Resume Parsing & Section Extraction Rules (`ResumeParser`)

The `ResumeParser` extracts whitelisted sections from the master markdown template by scanning for section headings and bullet prefixes:

### A. Section Identification Boundaries
The parser splits text dynamically by checking for exact header matches on line streams:
- `Experience` -> Begins the Experience block.
- `Projects` -> Begins the Projects block.
- `Technical Skills` -> Begins the Skills block.
- `Achievements, Certifications & Leadership` -> Begins the Footer block.
- `Education` -> Begins the Header block.

### B. Bullet Identification Rules (`•` Detection)
Bullets are parsed within the `Experience` and `Projects` sections using exact prefix matching:
- **Project/Role Titles**: Any non-empty line that does **not** start with a bullet character (`•`) is treated as a title or tech stack metadata line and pushed to the project's `titleAndTech` array.
- **Bullet points**: Any line starting with a bullet character (`•`) is parsed into a `ParsedBullet` block:
  ```typescript
  private static createBullet(text: string, idNum: number): ParsedBullet {
    return {
      id: `bullet_${idNum}`,
      originalText: text,
      optimizedText: text,
      wordCount: text.split(/\s+/).filter(w => w.length > 0).length
    };
  }
  ```

---

## 5. Future Caching Integrations (Redis Blueprint)

The environment schema (`config/env.ts`) defines a `REDIS_URL` parameter to support optional high-speed caching in production.

```mermaid
graph LR
    User[Client Request] --> Engine[JobProcessorService]
    Engine -->|1. Check Cache: URL Key| Redis{Redis Cache}
    Redis -->|Hit: Return cached parsed JD| Engine
    Redis -->|Miss| Firecrawl[2. Crawl & Ingest Web Page]
    Firecrawl -->|Extract & Store JD| Redis
```

Integrating Redis caching would provide several performance benefits:
1. **Scraped Ingest Cache**: Caches scraped job descriptions by URL to avoid redundant external Firecrawl and LLM parsing requests.
2. **Rate Limiting Stores**: Replaces the default in-memory storage of `express-rate-limit` with Redis to support rate limiting across distributed, multi-instance server deployments.
3. **Telemetry and State Storage**: Temporarily stores active LangGraph optimization states to support asynchronous polling architectures in web dashboards.
