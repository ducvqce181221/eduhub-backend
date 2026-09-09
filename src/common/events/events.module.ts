import { Global, Module } from "@nestjs/common";
import { PrismaModule } from "../../prisma/prisma.module";
import { EventPublisherService } from "./event-publisher.service";
import { NotificationConsumer } from "./notification.consumer";

@Global()
@Module({
  imports: [PrismaModule],
  providers: [EventPublisherService, NotificationConsumer],
  exports: [EventPublisherService, NotificationConsumer],
})
export class EventsModule {}
