var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var database_service_exports = {};
__export(database_service_exports, {
  prisma: () => prisma,
  saveParagraphs: () => saveParagraphs,
  updateBookStatus: () => updateBookStatus,
  updateParagraphAudio: () => updateParagraphAudio
});
module.exports = __toCommonJS(database_service_exports);
var import_client = require("@prisma/client");
var import_common = require("@nestjs/common");
const logger = new import_common.Logger("DatabaseService");
const prisma = new import_client.PrismaClient({
  log: ["error", "warn"]
});
async function saveParagraphs(bookId, paragraphs) {
  try {
    logger.log(`Saving ${paragraphs.length} paragraphs for book ${bookId}`);
    const batchSize = 100;
    for (let i = 0; i < paragraphs.length; i += batchSize) {
      const batch = paragraphs.slice(i, i + batchSize);
      await prisma.paragraph.createMany({
        data: batch.map((p) => ({
          bookId,
          chapterNumber: p.chapterNumber,
          orderIndex: p.orderIndex,
          content: p.content,
          audioStatus: import_client.AudioStatus.PENDING
        }))
      });
      logger.log(
        `Saved batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(
          paragraphs.length / batchSize
        )}`
      );
    }
    logger.log(`Successfully saved all paragraphs for book ${bookId}`);
  } catch (error) {
    logger.error(`Failed to save paragraphs: ${error}`);
    throw error;
  }
}
async function updateBookStatus(bookId, status) {
  try {
    await prisma.book.update({
      where: { id: bookId },
      data: { status }
    });
    logger.log(`Updated book ${bookId} status to ${status}`);
  } catch (error) {
    logger.error(`Failed to update book status: ${error}`);
    throw error;
  }
}
async function updateParagraphAudio(paragraphId, audioS3Key, audioDuration) {
  try {
    await prisma.paragraph.update({
      where: { id: paragraphId },
      data: {
        audioS3Key,
        audioDuration,
        audioStatus: import_client.AudioStatus.READY
      }
    });
    logger.log(`Updated paragraph ${paragraphId} with audio`);
  } catch (error) {
    logger.error(`Failed to update paragraph audio: ${error}`);
    throw error;
  }
}
prisma.$connect().then(() => {
  logger.log("Connected to database");
}).catch((error) => {
  logger.error("Failed to connect to database:", error);
});
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  prisma,
  saveParagraphs,
  updateBookStatus,
  updateParagraphAudio
});
//# sourceMappingURL=database.service.js.map
