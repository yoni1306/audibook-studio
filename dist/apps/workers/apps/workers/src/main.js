var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var import_common = require("@nestjs/common");
var import_bullmq = require("bullmq");
var dotenv = __toESM(require("dotenv"));
dotenv.config();
const logger = new import_common.Logger("Worker");
const worker = new import_bullmq.Worker(
  "audio-processing",
  async (job) => {
    logger.log(`Processing job ${job.id} of type ${job.name}`);
    logger.log(`Job data:`, job.data);
    switch (job.name) {
      case "test-job":
        logger.log(`Test job message: ${job.data.message}`);
        await new Promise((resolve) => setTimeout(resolve, 2e3));
        return { processed: true, message: job.data.message };
      case "parse-epub":
        logger.log(`Parsing EPUB: ${job.data.s3Key} for book ${job.data.bookId}`);
        await new Promise((resolve) => setTimeout(resolve, 3e3));
        return { processed: true, bookId: job.data.bookId };
      default:
        logger.warn(`Unknown job type: ${job.name}`);
        throw new Error(`Unknown job type: ${job.name}`);
    }
  },
  {
    connection: {
      host: process.env.REDIS_HOST || "localhost",
      port: parseInt(process.env.REDIS_PORT, 10) || 6379
    },
    concurrency: 1
  }
);
worker.on("completed", (job) => {
  logger.log(`Job ${job.id} completed`);
});
worker.on("failed", (job, err) => {
  logger.error(`Job ${job?.id} failed:`, err);
});
worker.on("active", (job) => {
  logger.log(`Job ${job.id} started`);
});
logger.log("\u{1F680} Worker started and listening for jobs...");
process.on("SIGTERM", async () => {
  logger.log("SIGTERM received, closing worker...");
  await worker.close();
  process.exit(0);
});
//# sourceMappingURL=main.js.map
