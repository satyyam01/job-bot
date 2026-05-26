# System Architecture - In-Depth Review

This document provides a deep, technical breakdown of the system design, layered boundaries, orchestration patterns, scaling considerations, and request-response lifecycles of the **AI Resume Tailor Bot**.

---

## 1. Architectural Orchestration Patterns

The system divides orchestration into two distinct paradigms: **Sequential Service Orchestration** (Ingestion Pipeline) and **Stateful Graph Orchestration** (Optimization Pipeline).

```mermaid
graph TD
    subgraph Sequential Service Ingest [Sequential Service Ingestion]
        A[URL Input] --> B[Firecrawl Scrape]
        B --> C[LLM Structured Extraction]
    end

    subgraph Stateful Graph Optimization [Stateful Graph Optimization]
        C --> D[jdIntelligenceNode]
        D --> E[relevanceRankerNode]
        E --> F[bulletOptimizerNode]
        F --> G[computeScoresNode]
        G --> H{decisionNode}
        H -->|Retry: Pending| F
        H -->|Done| I[Compile and Render]
    end
```

### A. Sequential Service Orchestration (`JobProcessorService`)
The entry pipeline is standard, linear execution:
1. **Scraping Ingestion**: Calls `FirecrawlService.scrapeJobDescription` asynchronously to turn a URL into clean Markdown.
2. **Structural Sanitization**: Feeds raw markdown to `InferenceService.generateStructuredData` using `jdExtractionPrompt` to extract a structured JSON payload of the Job Description (JD).
3. **Trigger Tailoring Engine**: Initializes a new `TailoringEngine` instance and executes `tailorResume(structuredJd)`.

### B. Stateful Graph Orchestration (`TailoringGraph` via LangGraph)
Once the unstructured ingestion finishes, the pipeline switches to a stateful, iterative state machine powered by `@langchain/langgraph`:
- State transitions are managed using standard LangGraph `State` attributes (`GraphState.State`), retaining references to the parsed sections of the resume and scoring metadata.
- Using a graph allows **dynamic feedback loops** and **self-correction**. If a bullet point optimization degrades the technical quality or inserts non-factual fluff, the graph loops back to re-optimize that specific bullet up to 3 times before falling back to the original text.

---

## 2. Comprehensive Request-Response Lifecycle

Here is the exact journey of a request from client initiation to result delivery:

```mermaid
sequenceDiagram
    autonumber
    actor User as Telegram Client
    participant Bot as telegram/bot.ts
    participant Proc as JobProcessorService
    participant Fire as FirecrawlService
    participant AI as InferenceService
    participant Graph as TailoringGraph
    participant Cohere as CohereService
    participant Render as ResumeRenderer

    User->>Bot: Sends Job URL
    Bot->>User: Sends "⏳ Processing... (approx. 1 min)" message
    Bot->>Proc: processJobUrl(jobUrl)
    
    %% Ingestion Stage
    critical Scrape Job Description
        Proc->>Fire: scrapeJobDescription(url)
        Fire->>Fire: POST https://api.firecrawl.dev/v1/scrape
        Note over Fire: 3x Retry loop on connection failures
        Fire-->>Proc: Raw Markdown text
    end

    critical Extract Structured JD
        Proc->>AI: generateStructuredData(extractionPrompt)
        AI->>AI: Groq / Ollama (temp: 0.2, json_object)
        AI-->>Proc: Structured JD JSON
    end

    %% Optimization Stage
    Proc->>Graph: TailoringGraph.invoke(initialState)
    
    activate Graph
    Note over Graph: Node 1: jdIntelligenceNode extracts emphasis
    Note over Graph: Node 2: relevanceRankerNode maps original bullets
    
    rect rgb(240, 245, 255)
        Note over Graph: Dynamic Optimization Loop (Max 3 iterations)
        Graph->>AI: bulletOptimizerNode (temp: 0.7, Calibration Instructions)
        AI-->>Graph: Proposed optimized text suggestions
        Graph->>Cohere: computeScoresNode (Compute original/optimized/JD vectors)
        Cohere-->>Graph: Semantic similarity & ATS gain vectors
        Graph->>AI: computeScoresNode (LLM-in-the-loop realism checks)
        AI-->>Graph: Plausibility & domain similarity score
        Graph->>Graph: decisionNode evaluates scoring thresholds
        Note over Graph: If thresholds fail & retries < 3, loop back to bulletOptimizerNode
    end
    
    Graph-->>Proc: Finalized State (experience, projects, skills)
    deactivate Graph

    %% Rendering Stage
    Proc->>Render: render(experience, projects, skills)
    Render-->>Proc: Formatted Markdown text
    Proc-->>Bot: Returns { success, role, company, atsScore, tailoredResume }
    
    %% Chunking & Delivery
    Note over Bot: Splits tailoredResume into <= 4000 char chunks
    Bot->>User: Sends Success Header card
    loop For each text chunk
        Bot->>User: Sends Resume markdown chunk
    end
```

---

## 3. Rendering Pipeline & Spacing Architecture

The **`ResumeRenderer`** acts as a compiler translating structured parsed nodes back into a unified plain-text markdown file:
- **Strict Whitelisting**: Only the whitelisted sections (`Experience`, `Projects`, `Technical Skills`) are output. Sections like contact info, objectives, education, and achievements are stripped from the final tailoring, optimizing keyword real estate for ATS evaluations.
- **Normalization**:
  - Unescapes literal `\n` and `\\n` inputs returned from the LLM JSON objects.
  - Ensures every bullet point is strictly prefix-normalized with `• ` (bullet plus single space), fixing occurrences of direct strings like `•Bullet Text` or missing bullet indicators.
  - Generates clear, single empty line margins between experience and project items to maintain standardized layout rules.

---

## 4. Scaling Considerations & System Tradeoffs

### A. Stateless Execution (Pros & Cons)
- **Tradeoff**: Running without databases (MongoDB, PostgreSQL) means the application cannot persist historical outputs or save user-customized master resumes directly via the bot interface.
- **Pros**: Extreme horizonal scalability. The bot has zero database connection limits, uses almost zero filesystem writes (only Winston log appending), and can run on ephemeral architectures like AWS Lambda or Google Cloud Run.

### B. Rate Limits & LLM Bottlenecks (TPM/RPM Strategies)
Because LangGraph executes recursive optimization across multiple bullets in a loop, it hits LLM provider endpoints frequently.
- **Pacing**: A `1.5-second` delay is hardcoded inside `InferenceService` on retry paths to protect the application from hitting Groq standard Tokens Per Minute (TPM) limits.
- **Failover routing**: If cloud keys are exhausted, configuring `OLLAMA_MODEL` instantly redirects load locally, providing a stable fall-back layer.
- **Local host caching**: While Redis is not currently active, `REDIS_URL` is parsed at environment validation. A caching layer should be introduced to save scraped job postings to avoid repetitive external network latency.
