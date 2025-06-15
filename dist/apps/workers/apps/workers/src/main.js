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
var import_epub_parser = require("./epub-parser");
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
        logger.log(
          `Parsing EPUB: ${job.data.s3Key} for book ${job.data.bookId}`
        );
        try {
          const paragraphs = await (0, import_epub_parser.parseEpub)(job.data.s3Key);
          const response = await fetch(
            `http://localhost:3333/api/books/${job.data.bookId}/paragraphs`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ paragraphs })
            }
          );
          if (!response.ok) {
            throw new Error(
              `Failed to save paragraphs: ${response.statusText}`
            );
          }
          await fetch(
            `http://localhost:3333/api/books/${job.data.bookId}/status`,
            {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ status: "READY" })
            }
          );
          return {
            processed: true,
            bookId: job.data.bookId,
            paragraphCount: paragraphs.length
          };
        } catch (error) {
          logger.error(`Failed to parse EPUB: ${error.message}`);
          await fetch(
            `http://localhost:3333/api/books/${job.data.bookId}/status`,
            {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ status: "ERROR" })
            }
          );
          throw error;
        }
      case "generate-audio":
        logger.log(`Generating audio for paragraph ${job.data.paragraphId}`);
        await new Promise((resolve) => setTimeout(resolve, 1e3));
        logger.log(
          `Audio generation placeholder for: "${job.data.content.substring(
            0,
            50
          )}..."`
        );
        return { processed: true, paragraphId: job.data.paragraphId };
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
