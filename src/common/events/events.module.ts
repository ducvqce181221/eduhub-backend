import { Global, Module } from "@nestjs/common";
import { PrismaModule } from "../../prisma/prisma.module";
import { EventPublisherService } from "./event-publisher.service";

@Global()
@Module({
  imports: [PrismaModule],
  providers: [EventPublisherService],
  exports: [EventPublisherService],
})
export class EventsModule {}
