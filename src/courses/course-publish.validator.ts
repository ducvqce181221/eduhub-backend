export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

export interface PublishableCourse {
  title?: string | null;
  description?: string | null;
  categoryId?: string | null;
  thumbnailUrl?: string | null;
  level?: string | null;
  category?: {
    isActive?: boolean | null;
  } | null;
  chapters?: Array<{
    id: string;
    title: string;
    lessons?: Array<{
      id: string;
      title: string;
      video?: {
        id: string;
        videoUrl: string;
        durationSeconds: number;
      } | null;
      quiz?: {
        id: string;
        questions?: Array<{
          id: string;
          content: string;
          answers?: Array<{
            id: string;
            isCorrect: boolean;
          }> | null;
        }> | null;
      } | null;
    }> | null;
  }> | null;
}

/**
 * Validates course readiness for publication per 5-point checklist [BR-CRS-02].
 */
export function validateCoursePublish(course: PublishableCourse): ValidationResult {
  const errors: string[] = [];

  // Criterion 1: Required metadata
  if (!course.title || course.title.trim().length === 0) {
    errors.push("Course title is required and cannot be empty.");
  }
  if (!course.description || course.description.trim().length === 0) {
    errors.push("Course description is required and cannot be empty.");
  }
  if (!course.thumbnailUrl || course.thumbnailUrl.trim().length === 0) {
    errors.push("Course thumbnailUrl is required and cannot be empty.");
  }
  if (!course.level) {
    errors.push("Course level is required.");
  }
  if (!course.categoryId) {
    errors.push("Course categoryId is required.");
  } else if (course.category && course.category.isActive === false) {
    errors.push("Course category must be active.");
  }

  // Criterion 2: At least 1 chapter
  const chapters = course.chapters || [];
  if (chapters.length === 0) {
    errors.push("Course must contain at least 1 chapter.");
  }

  // Criterion 3 & 4 & 5: Chapter, Lesson, Video, Quiz validation
  for (let cIdx = 0; cIdx < chapters.length; cIdx++) {
    const chapter = chapters[cIdx];
    const lessons = chapter.lessons || [];

    // Criterion 3: Each chapter must contain at least 1 lesson
    if (lessons.length === 0) {
      errors.push(`Chapter "${chapter.title || cIdx + 1}" must contain at least 1 lesson.`);
      continue;
    }

    for (let lIdx = 0; lIdx < lessons.length; lIdx++) {
      const lesson = lessons[lIdx];

      // Criterion 4: Every lesson strictly has attached video with durationSeconds > 0
      if (!lesson.video || !lesson.video.videoUrl || lesson.video.durationSeconds <= 0) {
        errors.push(
          `Lesson "${lesson.title || lIdx + 1}" in chapter "${chapter.title || cIdx + 1}" must have an attached video with duration > 0 seconds.`,
        );
      }

      // Criterion 5: Quiz rules (if quiz is attached)
      if (lesson.quiz) {
        const questions = lesson.quiz.questions || [];
        if (questions.length === 0) {
          errors.push(
            `Quiz in lesson "${lesson.title || lIdx + 1}" must contain at least 1 question.`,
          );
        } else {
          for (let qIdx = 0; qIdx < questions.length; qIdx++) {
            const question = questions[qIdx];
            const answers = question.answers || [];

            if (answers.length < 2) {
              errors.push(
                `Question ${qIdx + 1} in quiz of lesson "${lesson.title || lIdx + 1}" must have at least 2 answers.`,
              );
            }

            const correctCount = answers.filter((a) => a.isCorrect === true).length;
            if (correctCount !== 1) {
              errors.push(
                `Question ${qIdx + 1} in quiz of lesson "${lesson.title || lIdx + 1}" must have exactly 1 correct answer (found ${correctCount}).`,
              );
            }
          }
        }
      }
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}
