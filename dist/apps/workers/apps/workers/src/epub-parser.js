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
var epub_parser_exports = {};
__export(epub_parser_exports, {
  parseEpub: () => parseEpub
});
module.exports = __toCommonJS(epub_parser_exports);
var import_common = require("@nestjs/common");
const logger = new import_common.Logger("EpubParser");
async function parseEpub(epubPath) {
  const paragraphs = [];
  try {
    logger.log(`Parsing EPUB file: ${epubPath}`);
    const mockChapters = [
      "Chapter 1 content with multiple paragraphs. This is paragraph 1.",
      "This is paragraph 2 of chapter 1.",
      "Chapter 2 starts here. This is the first paragraph.",
      "And this is the second paragraph of chapter 2."
    ];
    let orderIndex = 0;
    mockChapters.forEach((content, index) => {
      const chapterNumber = Math.floor(index / 2) + 1;
      paragraphs.push({
        chapterNumber,
        orderIndex: orderIndex++,
        content: content.trim()
      });
    });
    logger.log(`Extracted ${paragraphs.length} paragraphs`);
    return paragraphs;
  } catch (error) {
    logger.error("Error parsing EPUB:", error);
    throw error;
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  parseEpub
});
//# sourceMappingURL=epub-parser.js.map
