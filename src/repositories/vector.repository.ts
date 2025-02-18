import { Collection } from 'mongodb';
import { getDb } from '../config/mongodb.js';
import { IVectorResult } from '../domain/interfaces/vectorRepository.js';

/**
 * Repository class for handling vector-based document searches in MongoDB
 */
export default class VectorRepository {
  private collection: Collection;

  constructor() {
    this.collection = getDb().collection('docs');
  }

  /**
   * Searches for documents similar to the provided vector embedding
   * @param queryVector - The vector embedding to search against
   * @param topK - Number of similar documents to return (default: 5)
   * @returns Promise containing array of vector search results
   */
  async searchSimilar(queryVector: number[], topK: number = 5): Promise<IVectorResult[]> {
    const results = await this.collection
      .aggregate([
        {
          $search: {
            index: 'vectorDocsIndex',
            knnBeta: {
              vector: queryVector,
              path: 'embedding',
              k: topK,
            },
          },
        },
        {
          $project: {
            text: 1,
            metadata: 1,
            score: { $meta: 'searchScore' },
            _id: 0,
          },
        },
      ])
      .toArray();

    return results.map((doc) => ({
      text: doc.text,
      score: doc.score,
    }));
  }
}
