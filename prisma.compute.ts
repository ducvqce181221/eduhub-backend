import { defineComputeConfig } from "@prisma/compute-sdk/config";

export default defineComputeConfig({
  app: {
    name: "eduhub-backend",
    framework: "nestjs",
    httpPort: 3000,
    env: ".env",
  },
});
