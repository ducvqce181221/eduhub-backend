import { Injectable } from "@nestjs/common";
import {
  AbilityBuilder,
  createMongoAbility,
} from "@casl/ability";
import { Action } from "./casl.types";
import type { AppAbility } from "./casl.types";

export interface UserPayload {
  id: string;
  role: string;
  email?: string;
  isActive?: boolean;
}

@Injectable()
export class CaslAbilityFactory {
  createForUser(user: UserPayload): AppAbility {
    const { can, cannot, build } = new AbilityBuilder<AppAbility>(
      createMongoAbility,
    );

    if (user.role === "ADMIN") {
      // Admin has full system control
      can(Action.Manage, "all");
    } else if (user.role === "TEACHER") {
      // Teacher course creation & management
      can(Action.Create, "Course");
      can(
        [Action.Read, Action.Update, Action.Delete, Action.Publish],
        "Course",
        { teacherId: user.id },
      );

      // Teacher curriculum hierarchy management
      can(Action.Create, "Chapter");
      can([Action.Read, Action.Update, Action.Delete], "Chapter", {
        teacherId: user.id,
      });

      can(Action.Create, "Lesson");
      can([Action.Read, Action.Update, Action.Delete], "Lesson", {
        teacherId: user.id,
      });

      // Teacher quizzes & resources
      can(
        Action.Manage,
        "Quiz",
        { teacherId: user.id },
      );
      can(
        Action.Manage,
        "QuizQuestion",
        { teacherId: user.id },
      );
      can(
        Action.Manage,
        "QuizAnswer",
        { teacherId: user.id },
      );
      can(
        Action.Manage,
        "Resource",
        { teacherId: user.id },
      );

      // Teacher progress & enrollment inspection
      can(Action.Read, "Enrollment", { teacherId: user.id });
      can(Action.Read, "LessonProgress", { teacherId: user.id });

      // Teacher personal profile & notifications
      can([Action.Read, Action.Update], "User", { id: user.id });
      can([Action.Read, Action.Update], "Notification", { userId: user.id });
      can(Action.Read, "Category");
    } else if (user.role === "STUDENT") {
      // Student course browsing
      can(Action.Read, "Course", { status: "PUBLISHED" });

      // Student enrollment
      can(Action.Create, "Enrollment");
      can(Action.Read, "Enrollment", { studentId: user.id });

      // Student learning progress & quiz submissions
      can([Action.Read, Action.Update], "LessonProgress", {
        studentId: user.id,
      });
      can(Action.Create, "QuizAttempt");
      can(Action.Read, "QuizAttempt", { studentId: user.id });

      // Student profile & notifications
      can([Action.Read, Action.Update], "User", { id: user.id });
      can([Action.Read, Action.Update], "Notification", { userId: user.id });
      can(Action.Read, "Category");

      // Deny student from modifying curriculum
      cannot(Action.Create, "Course");
      cannot(Action.Create, "Chapter");
      cannot(Action.Create, "Lesson");
      cannot(Action.Delete, "Course");
    }

    return build();
  }
}
