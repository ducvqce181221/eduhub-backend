import {
  ForbiddenException,
  Inject,
  Injectable,
  Optional,
} from "@nestjs/common";
import type { CanActivate, ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { CaslAbilityFactory } from "./casl-ability.factory";
import type { AppAbility, PolicyHandler } from "./casl.types";
import { CHECK_POLICIES_KEY } from "./check-policies.decorator";

@Injectable()
export class PoliciesGuard implements CanActivate {
  constructor(
    @Optional()
    @Inject(Reflector)
    private reflector: Reflector = new Reflector(),
    @Optional()
    @Inject(CaslAbilityFactory)
    private caslAbilityFactory: CaslAbilityFactory = new CaslAbilityFactory(),
  ) {
    if (!this.reflector) {
      this.reflector = new Reflector();
    }
    if (!this.caslAbilityFactory) {
      this.caslAbilityFactory = new CaslAbilityFactory();
    }
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const policyHandlers =
      this.reflector.getAllAndOverride<PolicyHandler[]>(
        CHECK_POLICIES_KEY,
        [context.getHandler(), context.getClass()],
      ) || [];

    if (policyHandlers.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException("Forbidden resource: unauthenticated");
    }

    const ability = this.caslAbilityFactory.createForUser(user);

    for (const handler of policyHandlers) {
      const allowed = this.execPolicyHandler(handler, ability);
      if (!allowed) {
        throw new ForbiddenException(
          "Forbidden resource: insufficient CASL policy permissions",
        );
      }
    }

    return true;
  }

  private execPolicyHandler(
    handler: PolicyHandler,
    ability: AppAbility,
  ): boolean {
    if (typeof handler === "function") {
      return handler(ability);
    }
    return handler.handle(ability);
  }
}
