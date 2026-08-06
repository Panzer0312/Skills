export type PracticeResult = "correct" | "wrong";

export interface ProgressApi {
  record(itemId: string, result: PracticeResult): void;
  get(itemId: string): PracticeResult | null;
  complete(moduleId: string): Promise<void>;
}
