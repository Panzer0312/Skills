export interface LessonMeta {
  id: string;
  title: string;
  order: number;
  requires: string | null;
}

export function sortLessons(lessons: LessonMeta[]): LessonMeta[] {
  return [...lessons].sort((a, b) => a.order - b.order || a.id.localeCompare(b.id, "de"));
}

export function isUnlocked(lesson: LessonMeta, done: Set<string>): boolean {
  return lesson.requires === null || done.has(lesson.requires);
}
