import type { MongoAbility, MongoQuery } from "@casl/ability";

export enum Action {
  Manage = "manage",
  Create = "create",
  Read = "read",
  Update = "update",
  Delete = "delete",
  Publish = "publish",
}

export type Subjects =
  | "all"
  | "Course"
  | "Chapter"
  | "Lesson"
  | "Quiz"
  | "QuizQuestion"
  | "QuizAnswer"
  | "QuizAttempt"
  | "LessonProgress"
  | "Resource"
  | "Enrollment"
  | "Notification"
  | "User"
  | "Category"
  | Record<string, any>;

export type AppAbility = MongoAbility<[Action, Subjects], MongoQuery<any>>;

export interface IPolicyHandler {
  handle(ability: AppAbility): boolean;
}

type PolicyHandlerCallback = (ability: AppAbility) => boolean;

export type PolicyHandler = IPolicyHandler | PolicyHandlerCallback;
