# Onboarding & Development Guide

This onboarding guide explains how to install, run, debug, extend, and tune the **AI Resume Tailor Bot** locally.

---

## 1. Quick Start Local Installation

Follow these steps to set up your local development environment:

### Prerequisites:
- **Node.js**: Ensure Node.js `v20+` is installed.
- **Package Manager**: NPM is used for dependency resolution.

### A. Clone and Install Dependencies
Navigate to the root of the project directory and install the required packages:
```bash
npm install
```

### B. Configure Environment Keys
Duplicate the `.env.example` file to create your `.env` configuration file:
```bash
cp .env.example .env
```
Open `.env` and fill in the required keys:
```text
PORT=3000
NODE_ENV=development
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
FIRECRAWL_API_KEY=your_firecrawl_api_key
COHERE_API_KEY=your_cohere_api_key
GROQ_API_KEY=your_groq_api_key
```

### C. Launch Local Server
Start the Express server and launch the Telegram bot in development polling mode:
```bash
npx tsx src/app.ts
```

The terminal should output:
```text
2026-05-26 12:57:16 [info] : Server is running on port 3000 in development mode 
```

---

## 2. Dynamic Development & Testing Procedures

### A. Testing the Telegram Bot Interface
1. Open the Telegram app and search for the username of the bot you registered with BotFather.
2. Send the `/start` command. The bot should reply with a welcome message.
3. Send a valid job posting URL (e.g. from LinkedIn or Indeed).
4. Monitor your terminal output to view the real-time processing logs.

### B. Testing via Direct API Hooks
You can trigger the tailoring pipeline directly without going through the Telegram client. Use `curl` to hit the local endpoint:

```bash
curl -X POST http://localhost:3000/api/process-job \
     -H "Content-Type: application/json" \
     -d '{"url":"https://example.com/job-posting-url"}'
```

---

## 3. Debugging & Monitoring LangGraph Nodes

Because the optimization process is asynchronous and stateful, monitoring state transitions is crucial:

- **Console Outputs**: The application prints real-time node executions in the terminal:
  - `[Graph] JD Intelligence Node`: Extracts job description targets.
  - `[Graph] Relevance Ranker Node`: Initializes resume bullet metadata maps.
  - `[Graph] Bullet Optimizer Node`: Optimizes pending bullets.
  - `[Graph] Compute Scores Node`: Calculates similarity metrics.
  - `[Graph] Decision Node`: Evaluates optimization thresholds.
- **Log Files**: In development, logs are colorized and output to the terminal console. In production, structured logs are written to the `logs` folder:
  - `logs/combined.log`: General activity, node executions, and output metrics.
  - `logs/error.log`: Traces and exceptions.

---

## 4. Tuning Optimization Heuristics

You can fine-tune the optimization criteria by modifying the scoring metrics inside `computeScoresNode` in `src/resume/tailoringGraph.ts`:

- **Banned Fluff Penalties**:
  To add or remove words that trigger fluff penalties, modify the `bannedAuth` list:
  ```typescript
  const bannedAuth = ['compliance', 'regulatory', 'stakeholder', 'quality assurance', ...];
  ```
- **Banned Verbose Terms**:
  To update words that trigger verbosity penalties, modify the `bannedVerbose` list:
  ```typescript
  const bannedVerbose = ['leveraging', 'utilizing', 'showcasing expertise', ...];
  ```
- **Confidence Weights Matrix**:
  To adjust how much weight each metric contributes to the overall optimization score, update the weights in `optimization_confidence_score`:
  ```typescript
  meta.optimization_confidence_score = 
    (meta.semantic_similarity_score * 0.25) + 
    (meta.authenticity_score * 0.25) + 
    (meta.domain_compatibility_score * 0.20) + 
    (meta.engineering_tone_score * 0.15) + 
    (meta.conciseness_score * 0.10) + 
    (meta.ats_gain_score * 0.05);
  ```

---

## 5. How to Extend the Codebase

### A. Updating the Master Resume Template
To update the template resume used for optimizations, edit the source markdown file:
`src/resume/masterResume.md`

Ensure you maintain the exact header spacing layout and prefix bullet points with standard characters (`• `).

### B. Adding a New LangGraph Processing Node
To add a new node to the optimization graph:
1. Define the node function in `src/resume/tailoringGraph.ts`.
2. Register the node in the `StateGraph` builder:
   ```typescript
   const builder = new StateGraph(GraphState)
     .addNode('myCustomNode', myCustomNode)
   ```
3. Update the edge routing to integrate your node into the execution path:
   ```typescript
   .addEdge('myCustomNode', 'bulletOptimizerNode')
   ```

### C. Customizing the LaTeX Template
To adjust the styling, margins, fonts, or structural metadata (such as contact information or static education details) of the PDF:
- Edit the source LaTeX file: `src/resume/resumeTemplate.tex`.
- Keep the dynamic placeholders (`%%EXPERIENCE_SECTION%%`, `%%PROJECTS_SECTION%%`, and `%%SKILLS_SECTION%%`) in their correct list locations to ensure that the mapping engine compiles them successfully.

---

## 6. PDF Compiler Toolchain (Tectonic) Setup

To allow the bot to compile PDFs automatically, you need to install the Tectonic compiler CLI on your host machine or deployment container.

### A. Local Installation Options

#### On macOS (using Homebrew):
```bash
brew install tectonic
```

#### On Windows (using winget or scoop):
```powershell
winget install tectonic
# or using scoop
scoop install tectonic
```

#### On Linux (Ubuntu/Debian):
```bash
sudo apt-get update
sudo apt-get install tectonic
```

### B. Verification
To verify that the Tectonic compiler is correctly installed and accessible in your shell, run:
```bash
tectonic --version
```

Once Tectonic is verified, the server-side compiler spawner will automatically locate the binary, fetch required packages on-the-fly, and deliver PDF files alongside raw plain-text summaries in chat.

