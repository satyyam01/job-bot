import { StateGraph, Annotation } from '@langchain/langgraph';
import { ResumeParser, ParsedBullet, ParsedProject } from './resumeParser';
import { InferenceService } from '../ai/inferenceService';
import { CohereService } from '../ai/cohereService';
import { logger } from '../logs/logger';

// --- Interfaces & State ---

export interface OptimizationMetadata {
  bullet_id: string;
  original: string;
  optimized: string;
  ats_gain_score: number;
  semantic_similarity_score: number;
  layout_drift_score: number;
  authenticity_score: number;
  domain_compatibility_score: number;
  technical_density_score: number;
  optimization_confidence_score: number;
  retry_count: number;
  final_decision: "pending" | "optimized" | "preserved" | "rejected";
}

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

export type State = typeof GraphState.State;

// --- Node Functions ---

async function jdIntelligenceNode(state: State) {
  logger.info('[Graph] JD Intelligence Node');
  const jdString = JSON.stringify(state.jobDescription);
  const prompt = `
  Analyze this Job Description and extract structured semantic intelligence.
  Return EXACTLY a JSON object matching this schema:
  {
    "role_type": "string (e.g. backend_engineer, compliance_analytics)",
    "high_signal_keywords": ["keyword1", "keyword2"],
    "priority_domains": ["domain1", "domain2"],
    "optimization_targets": ["concept1", "concept2"]
  }
  JD: ${jdString}
  `;
  try {
    const result = await InferenceService.generateStructuredData(prompt);
    const emphasis = [...(result.high_signal_keywords || []), ...(result.optimization_targets || [])];
    return { 
      jdEmphasis: emphasis.length > 0 ? emphasis : ['software engineering'],
      jdString
    };
  } catch (e) {
    logger.warn('JD Intelligence extraction failed, using fallback.');
    return { jdEmphasis: ['software engineering'], jdString };
  }
}

async function relevanceRankerNode(state: State) {
  logger.info('[Graph] Relevance Ranker Node (Structural Anchoring Preserved)');
  
  const optimizedExperience = state.parsedResume.experience;
  const optimizedProjects = state.parsedResume.projects;
  const optimizedSkills = state.parsedResume.skills;

  const metadata: Record<string, OptimizationMetadata> = {};
  const allBullets = [...optimizedExperience.flatMap(p => p.bullets), ...optimizedProjects.flatMap(p => p.bullets)];
  for (const b of allBullets) {
    metadata[b.id] = {
      bullet_id: b.id,
      original: b.originalText,
      optimized: b.originalText,
      ats_gain_score: 0,
      semantic_similarity_score: 1.0,
      layout_drift_score: 0,
      authenticity_score: 1.0,
      domain_compatibility_score: 1.0,
      technical_density_score: 1.0,
      optimization_confidence_score: 0,
      retry_count: 0,
      final_decision: "pending"
    };
  }

  return { optimizedExperience, optimizedProjects, optimizedSkills, metadata };
}

async function bulletOptimizerNode(state: State) {
  logger.info('[Graph] Bullet Optimizer Node (Domain-Aware Generative Drafts)');
  
  const updatedMetadata = { ...state.metadata };

  const optimizeProjectGroup = async (projects: ParsedProject[]) => {
    const updated = [];
    for (const proj of projects) {
      const updatedBullets = [];
      for (const bullet of proj.bullets) {
        const meta = updatedMetadata[bullet.id];
        
        if (meta.final_decision !== "pending") {
           updatedBullets.push(bullet);
           continue;
        }

        const prompt = `
        You are a Domain-Authentic Semantic Optimizer. 
        Original Bullet: ${bullet.originalText}
        JD Semantic Targets: ${state.jdEmphasis.join(', ')}
        
        CRITICAL RULES:
        1. Keep it within 10-15% of original word count.
        2. Insert highly authentic SWE keywords IF AND ONLY IF they fit perfectly.
        3. Make NO CHANGE if original is strong.
        4. NEVER append generic HR fluff.
        5. DO NOT INJECT domain-specific targets (e.g. AML, anti-corruption) into incompatible domains (e.g. object detection, IoT). Semantic contamination will be heavily penalized.
        6. ENGINEERING TONE: Never explicitly inject generic soft skills (communication, time management, problem-solving, teamwork, collaboration, analytical skills). Demonstrate them implicitly through technical outcomes instead (e.g. use "cross-functional workflow automation" instead of "effective communication").
        
        Return ONLY a JSON object: { "optimizedText": "your text here" }
        `;
        
        try {
          const res = await InferenceService.generateStructuredData(prompt);
          const newText = res.optimizedText || bullet.originalText;
          meta.optimized = newText;
          meta.retry_count += 1;
          
          updatedBullets.push({ ...bullet, optimizedText: newText });
        } catch (e) {
          updatedBullets.push(bullet);
        }
      }
      updated.push({ ...proj, bullets: updatedBullets });
    }
    return updated;
  };

  const optimizedExperience = await optimizeProjectGroup(state.optimizedExperience);
  const optimizedProjects = await optimizeProjectGroup(state.optimizedProjects);

  return { optimizedExperience, optimizedProjects, metadata: updatedMetadata };
}

async function computeScoresNode(state: State) {
  logger.info('[Graph] Compute Scores Node (Cohere & Domain Plausibility Validation)');
  
  const metadata = { ...state.metadata };
  
  const allOriginals: string[] = [];
  const allOptimized: string[] = [];
  const bulletIds: string[] = [];

  for (const [id, meta] of Object.entries(metadata)) {
    if (meta.final_decision === "pending") {
      bulletIds.push(id);
      allOriginals.push(meta.original);
      allOptimized.push(meta.optimized);
    }
  }

  if (bulletIds.length > 0) {
    const jdTargetStr = state.jdEmphasis.join(', ');
    const [origEmbeds, optEmbeds, jdEmbed] = await Promise.all([
      CohereService.getEmbeddings(allOriginals),
      CohereService.getEmbeddings(allOptimized),
      CohereService.getEmbeddings([jdTargetStr])
    ]);

    const jdVector = jdEmbed[0];

    for (let i = 0; i < bulletIds.length; i++) {
      const id = bulletIds[i];
      const meta = metadata[id];
      
      // 1. Semantic Preservation
      const similarity = CohereService.cosineSimilarity(origEmbeds[i], optEmbeds[i]);
      meta.semantic_similarity_score = similarity;

      // 2. Semantic ATS Gain
      const origToJD = CohereService.cosineSimilarity(origEmbeds[i], jdVector);
      const optToJD = CohereService.cosineSimilarity(optEmbeds[i], jdVector);
      const rawGain = Math.max(0, optToJD - origToJD);
      meta.ats_gain_score = Math.min(rawGain * 5, 1.0); 

      // 3. Layout Drift Score
      const origWords = meta.original.split(/\\s+/).length;
      const newWords = meta.optimized.split(/\\s+/).length;
      const diffRatio = Math.abs(newWords - origWords) / origWords;
      meta.layout_drift_score = diffRatio > 0.15 ? -0.5 : 1.0; 

      // 4. Authenticity Score (Heuristic Fluff Check)
      const banned = ['compliance', 'regulatory', 'stakeholder', 'quality assurance', 'customer satisfaction', 'communication', 'time management', 'problem-solving', 'analytical skills', 'leadership', 'teamwork', 'collaboration'];
      let authScore = 1.0;
      for (const b of banned) {
        if (meta.optimized.toLowerCase().includes(b) && !meta.original.toLowerCase().includes(b)) {
          authScore -= 0.5;
        }
      }
      meta.authenticity_score = authScore;
      
      // 5. Technical Density Score (Heuristic)
      const techWordsRegex = /[A-Z][a-zA-Z0-9]*|api|sql|db|ui|ux|backend|frontend/g;
      const origTechWords = (meta.original.match(techWordsRegex) || []).length;
      const optTechWords = (meta.optimized.match(techWordsRegex) || []).length;
      meta.technical_density_score = optTechWords >= origTechWords ? 1.0 : 0.5;

      // 6. Claim Plausibility / Domain Compatibility (LLM Validation)
      if (meta.original !== meta.optimized) {
         try {
           const plausibilityPrompt = `
           You are an expert technical recruiter evaluating resume realism.
           Original Bullet: ${meta.original}
           Optimized Bullet: ${meta.optimized}
           
           Does the optimized bullet make plausible engineering sense in the exact same domain? 
           Is there "semantic contamination" (e.g. forcing AML into object detection)?
           
           Return ONLY a JSON object:
           {
             "is_plausible": boolean,
             "domain_compatibility_score": number // 0.0 to 1.0. 1.0 means perfectly natural, 0.0 means suspicious fake keyword stuffing.
           }
           `;
           const validationRes = await InferenceService.generateStructuredData(plausibilityPrompt);
           meta.domain_compatibility_score = validationRes.domain_compatibility_score ?? 1.0;
         } catch (e) {
           meta.domain_compatibility_score = 1.0; // Fallback if LLM fails
         }
      } else {
         meta.domain_compatibility_score = 1.0;
      }

      // 7. Final Rebalanced Optimization Confidence
      meta.optimization_confidence_score = 
        (meta.ats_gain_score * 0.20) + 
        (meta.semantic_similarity_score * 0.25) + 
        (meta.authenticity_score * 0.25) + 
        (meta.domain_compatibility_score * 0.20) + 
        (meta.technical_density_score * 0.05) + 
        (meta.layout_drift_score * 0.05);
    }
  }

  return { metadata };
}

async function decisionNode(state: State) {
  logger.info('[Graph] Decision Node (Domain-Authentic Threshold Finalizer)');
  
  const metadata = { ...state.metadata };
  let allDone = true;

  const decideGroup = (projects: ParsedProject[]) => {
    for (const proj of projects) {
      for (const bullet of proj.bullets) {
        const meta = metadata[bullet.id];
        if (meta.final_decision !== "pending") continue;

        if (meta.original === meta.optimized) {
          meta.final_decision = "preserved";
          continue;
        }

        // Calibrated Domain Thresholds
        if (meta.domain_compatibility_score < 0.8) {
          meta.final_decision = "rejected"; // Domain invalid keyword insertion
        } else if (meta.semantic_similarity_score < 0.82) {
          meta.final_decision = "rejected";
        } else if (meta.authenticity_score < 0.8) {
          meta.final_decision = "rejected";
        } else if (meta.layout_drift_score < 0) {
          meta.final_decision = "rejected";
        } else if (meta.ats_gain_score <= 0 && meta.semantic_similarity_score < 0.95) {
          meta.final_decision = "rejected";
        } else {
          meta.final_decision = "optimized";
        }

        if (meta.final_decision === "rejected") {
          if (meta.retry_count < 3) {
            meta.final_decision = "pending"; 
            allDone = false;
          } else {
            meta.final_decision = "preserved"; 
            bullet.optimizedText = meta.original;
          }
        }
      }
    }
  };

  decideGroup(state.optimizedExperience);
  decideGroup(state.optimizedProjects);

  // Observability
  if (allDone) {
    for (const meta of Object.values(metadata)) {
      if (meta.original !== meta.optimized || meta.retry_count > 0) {
         logger.info(`[Scoring] Bullet ${meta.bullet_id} -> ${meta.final_decision} (Conf: ${meta.optimization_confidence_score.toFixed(2)}, ATS: ${meta.ats_gain_score.toFixed(2)}, Domain: ${meta.domain_compatibility_score.toFixed(2)})`);
      }
    }
  }

  return { metadata };
}

function routeAfterDecision(state: State) {
  const pending = Object.values(state.metadata).some(m => m.final_decision === "pending");
  return pending ? 'bulletOptimizerNode' : 'end';
}

const builder = new StateGraph(GraphState)
  .addNode('jdIntelligenceNode', jdIntelligenceNode)
  .addNode('relevanceRankerNode', relevanceRankerNode)
  .addNode('bulletOptimizerNode', bulletOptimizerNode)
  .addNode('computeScoresNode', computeScoresNode)
  .addNode('decisionNode', decisionNode)
  
  .addEdge('__start__', 'jdIntelligenceNode')
  .addEdge('jdIntelligenceNode', 'relevanceRankerNode')
  .addEdge('relevanceRankerNode', 'bulletOptimizerNode')
  .addEdge('bulletOptimizerNode', 'computeScoresNode')
  .addEdge('computeScoresNode', 'decisionNode')
  .addConditionalEdges('decisionNode', routeAfterDecision, {
    end: '__end__',
    bulletOptimizerNode: 'bulletOptimizerNode'
  });

export const TailoringGraph = builder.compile();
