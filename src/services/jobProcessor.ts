import { FirecrawlService } from '../firecrawl/firecrawlService';
import { InferenceService } from '../ai/inferenceService';
import { TailoringEngine } from '../resume/tailoringEngine';
import { jdExtractionPrompt } from '../prompts/jdPrompts';
import { logger } from '../logs/logger';

export class JobProcessorService {
  /**
   * Main pipeline to process a job URL and return a tailored resume.
   */
  static async processJobUrl(url: string) {
    try {
      logger.info(`Starting job processing for URL: ${url}`);
      
      // Step 1: Scrape JD
      const rawMarkdown = await FirecrawlService.scrapeJobDescription(url);
      logger.info('Successfully scraped JD markdown.');

      // Step 2: Extract structured JD using Groq
      const extractionPrompt = `${jdExtractionPrompt}\n\nJob Description Markdown:\n${rawMarkdown}`;
      const structuredJd = await InferenceService.generateStructuredData(extractionPrompt);
      logger.info('Successfully extracted structured JD.');

      // Step 3: Tailor Resume
      const tailoringEngine = new TailoringEngine();
      const { tailoredResume, tailoredLatex, pdfPath, atsScore } = await tailoringEngine.tailorResume(structuredJd);
      
      logger.info(`Successfully generated tailored resume with estimated ATS score: ${atsScore}`);

      return {
        success: true,
        company: structuredJd.company || 'Unknown Company',
        role: structuredJd.role_title || 'Unknown Role',
        atsScore,
        tailoredResume,
        tailoredLatex,
        pdfPath,
        structuredJd
      };
    } catch (error: any) {
      logger.error(`Job processing failed for ${url}: ${error.message}`);
      return {
        success: false,
        error: error.message
      };
    }
  }
}
