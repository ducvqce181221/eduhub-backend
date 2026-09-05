import { describe, it, expect } from "vitest";
import { CaslAbilityFactory } from "../src/casl/casl-ability.factory";
import { Action } from "../src/casl/casl.types";
import { subject } from "@casl/ability";

describe("Phase 12 - CASL Ability Factory (TDD: Red)", () => {
  const caslFactory = new CaslAbilityFactory();

  const adminUser = {
    id: "admin-uuid-1",
    email: "admin@eduhub.dev",
    role: "ADMIN",
    isActive: true,
  };

  const teacherA = {
    id: "teacher-uuid-a",
    email: "teacher.a@eduhub.dev",
    role: "TEACHER",
    isActive: true,
  };

  const teacherB = {
    id: "teacher-uuid-b",
    email: "teacher.b@eduhub.dev",
    role: "TEACHER",
    isActive: true,
  };

  const studentUser = {
    id: "student-uuid-1",
    email: "student@eduhub.dev",
    role: "STUDENT",
    isActive: true,
  };

  describe("ADMIN Role Capabilities", () => {
    it("should allow ADMIN to manage all subjects and actions", () => {
      const ability = caslFactory.createForUser(adminUser);

      expect(ability.can(Action.Manage, "all")).toBe(true);
      expect(ability.can(Action.Delete, "Course")).toBe(true);
      expect(ability.can(Action.Update, "User")).toBe(true);
      expect(ability.can(Action.Publish, "Course")).toBe(true);
      expect(
        ability.can(
          Action.Delete,
          subject("Course", { id: "c1", teacherId: teacherA.id }),
        ),
      ).toBe(true);
    });
  });

  describe("TEACHER Role Capabilities & Resource Ownership", () => {
    it("should allow TEACHER to create Courses", () => {
      const ability = caslFactory.createForUser(teacherA);
      expect(ability.can(Action.Create, "Course")).toBe(true);
    });

    it("should allow TEACHER to read, update, delete, and publish owned courses", () => {
      const ability = caslFactory.createForUser(teacherA);
      const ownedCourse = subject("Course", {
        id: "course-1",
        teacherId: teacherA.id,
        status: "DRAFT",
      });

      expect(ability.can(Action.Read, ownedCourse)).toBe(true);
      expect(ability.can(Action.Update, ownedCourse)).toBe(true);
      expect(ability.can(Action.Delete, ownedCourse)).toBe(true);
      expect(ability.can(Action.Publish, ownedCourse)).toBe(true);
    });

    it("should deny TEACHER from updating, deleting, or publishing courses owned by another teacher", () => {
      const ability = caslFactory.createForUser(teacherA);
      const foreignCourse = subject("Course", {
        id: "course-2",
        teacherId: teacherB.id,
        status: "DRAFT",
      });

      expect(ability.can(Action.Update, foreignCourse)).toBe(false);
      expect(ability.can(Action.Delete, foreignCourse)).toBe(false);
      expect(ability.can(Action.Publish, foreignCourse)).toBe(false);
    });

    it("should deny TEACHER from managing User administration or Category deletion", () => {
      const ability = caslFactory.createForUser(teacherA);

      expect(ability.can(Action.Manage, "User")).toBe(false);
      expect(ability.can(Action.Delete, "Category")).toBe(false);
    });
  });

  describe("STUDENT Role Capabilities & Progress Boundaries", () => {
    it("should allow STUDENT to read PUBLISHED courses, but not DRAFT courses", () => {
      const ability = caslFactory.createForUser(studentUser);
      const publishedCourse = subject("Course", {
        id: "c-pub",
        status: "PUBLISHED",
        teacherId: teacherA.id,
      });
      const draftCourse = subject("Course", {
        id: "c-draft",
        status: "DRAFT",
        teacherId: teacherA.id,
      });

      expect(ability.can(Action.Read, publishedCourse)).toBe(true);
      expect(ability.can(Action.Read, draftCourse)).toBe(false);
    });

    it("should allow STUDENT to manage own LessonProgress and QuizAttempts", () => {
      const ability = caslFactory.createForUser(studentUser);
      const ownProgress = subject("LessonProgress", {
        id: "lp-1",
        studentId: studentUser.id,
        lessonId: "l-1",
      });
      const otherProgress = subject("LessonProgress", {
        id: "lp-2",
        studentId: "other-student-id",
        lessonId: "l-1",
      });

      expect(ability.can(Action.Update, ownProgress)).toBe(true);
      expect(ability.can(Action.Update, otherProgress)).toBe(false);
    });

    it("should deny STUDENT from creating or modifying Course, Chapter, or Lesson", () => {
      const ability = caslFactory.createForUser(studentUser);

      expect(ability.can(Action.Create, "Course")).toBe(false);
      expect(ability.can(Action.Create, "Chapter")).toBe(false);
      expect(ability.can(Action.Create, "Lesson")).toBe(false);
      expect(ability.can(Action.Delete, "Course")).toBe(false);
    });
  });
});
