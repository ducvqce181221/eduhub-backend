import {
  Injectable,
} from "@nestjs/common";
import type {
  CallHandler,
  ExecutionContext,
  NestInterceptor,
} from "@nestjs/common";
import type { Observable } from "rxjs";
import { map } from "rxjs/operators";

export interface StandardResponse<T> {
  success: boolean;
  data: T;
  meta?: Record<string, any>;
}

@Injectable()
export class TransformInterceptor<T>
  implements NestInterceptor<T, StandardResponse<T>>
{
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<StandardResponse<T>> {
    return next.handle().pipe(
      map((res) => {
        // If response is already enveloped (e.g. custom controller response)
        if (res && typeof res === "object" && "success" in res && "data" in res) {
          return res;
        }

        // If response has { data, meta }
        if (
          res &&
          typeof res === "object" &&
          "data" in res &&
          "meta" in res
        ) {
          return {
            success: true,
            data: res.data,
            meta: res.meta,
          };
        }

        return {
          success: true,
          data: res !== undefined ? res : null,
        };
      }),
    );
  }
}
