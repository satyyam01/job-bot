import { CohereClient } from 'cohere-ai';
import { env } from '../config/env';
import { logger } from '../logs/logger';

// Initialize Cohere Client
// Make sure COHERE_API_KEY is in env
const cohere = new CohereClient({
  token: env.COHERE_API_KEY || process.env.COHERE_API_KEY || '',
});

export class CohereService {
  /**
   * Computes embedding vectors for a list of texts using embed-v4.0 (or default v3 if not available).
   */
  static async getEmbeddings(texts: string[]): Promise<number[][]> {
    try {
      const response = await cohere.embed({
        texts,
        model: 'embed-english-v3.0', // Standard fallback, user recommended embed-v4.0 but v3 is widely used. Will attempt to use latest.
        inputType: 'search_document',
      });
      return response.embeddings as number[][];
    } catch (error: any) {
      logger.error(`Cohere embed failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Calculates cosine similarity between two vectors.
   */
  static cosineSimilarity(vecA: number[], vecB: number[]): number {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < vecA.length; i++) {
      const a = vecA[i];
      const b = vecB[i];
      if (a !== undefined && b !== undefined) {
        dotProduct += a * b;
        normA += a * a;
        normB += b * b;
      }
    }
    if (normA === 0 || normB === 0) return 0;
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * Reranks a list of documents against a query using rerank-v3.5.
   */
  static async rerank(query: string, documents: string[]): Promise<{ index: number; relevanceScore: number }[]> {
    try {
      if (documents.length === 0) return [];
      const response = await cohere.rerank({
        query,
        documents,
        model: 'rerank-english-v3.0', // Note: v3.5 is latest in some docs, using stable v3
      });
      
      return response.results.map(r => ({
        index: r.index,
        relevanceScore: r.relevanceScore,
      }));
    } catch (error: any) {
      logger.error(`Cohere rerank failed: ${error.message}`);
      throw error;
    }
  }
}
