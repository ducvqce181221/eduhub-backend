import { describe, it, expect, beforeEach } from "vitest";
import { ForbiddenException, ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { PoliciesGuard } from "../src/casl/policies.guard";
import { CaslAbilityFactory } from "../src/casl/casl-ability.factory";
import { Action, AppAbility } from "../src/casl/casl.types";
import { CHECK_POLICIES_KEY } from "../src/casl/check-policies.decorator";
import { subject } from "@casl/ability";

describe("Phase 12 - PoliciesGuard & Policy Decorator (TDD: Red)", () => {
  let caslFactory: CaslAbilityFactory;
  let reflector: Reflector;
  let policiesGuard: PoliciesGuard;

  const teacherUser = {
    id: "teacher-123",
    email: "teacher@eduhub.dev",
    role: "TEACHER",
    isActive: true,
  };

  const studentUser = {
    id: "student-456",
    email: "student@eduhub.dev",
    role: "STUDENT",
    isActive: true,
  };

  const createMockContext = (
    user: any,
    policyHandlers: Array<(ability: AppAbility) => boolean> = [],
  ): ExecutionContext => {
    reflector.getAllAndOverride = () => policyHandlers;

    return {
      getHandler: () => () => {},
      getClass: () => class {},
      switchToHttp: () => ({
        getRequest: () => ({ user }),
        getResponse: () => ({}),
        getNext: () => ({}),
      }),
    } as unknown as ExecutionContext;
  };

  beforeEach(() => {
    caslFactory = new CaslAbilityFactory();
    reflector = new Reflector();
    policiesGuard = new PoliciesGuard(reflector, caslFactory);
  });

  it("should allow request if no policy handlers are defined", async () => {
    const context = createMockContext(teacherUser, []);
    const canActivate = await policiesGuard.canActivate(context);
    expect(canActivate).toBe(true);
  });

  it("should throw ForbiddenException if user is not attached to request", async () => {
    const handler = (ability: AppAbility) => ability.can(Action.Create, "Course");
    const context = createMockContext(undefined, [handler]);

    await expect(policiesGuard.canActivate(context)).rejects.toThrow(
      ForbiddenException,
    );
  });

  it("should allow request when user meets all policy handlers", async () => {
    const handler = (ability: AppAbility) => ability.can(Action.Create, "Course");
    const context = createMockContext(teacherUser, [handler]);

    const canActivate = await policiesGuard.canActivate(context);
    expect(canActivate).toBe(true);
  });

  it("should throw ForbiddenException when user fails a policy handler", async () => {
    const handler = (ability: AppAbility) => ability.can(Action.Create, "Course");
    const context = createMockContext(studentUser, [handler]);

    await expect(policiesGuard.canActivate(context)).rejects.toThrow(
      ForbiddenException,
    );
  });
});
