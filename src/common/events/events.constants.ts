export const EVENTS_CONSTANTS = {
  EVENTS_EXCHANGE: "eduhub.events",
  DEAD_LETTER_EXCHANGE: "eduhub.dlx",
  NOTIFICATIONS_QUEUE: "eduhub.notifications.queue",
  DEAD_LETTER_QUEUE: "eduhub.dlq",
  ROUTING_KEYS: {
    COURSE_ENROLLED: "course.enrolled",
    QUIZ_SUBMITTED: "quiz.submitted",
    COURSE_COMPLETED: "course.completed",
  },
} as const;
