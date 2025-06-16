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
var import_jsdom = require("jsdom");
var import_util = require("util");
const logger = new import_common.Logger("EpubParser");
const EPub = require("epub");
async function parseEpub(epubPath) {
  const paragraphs = [];
  try {
    logger.log(`Parsing EPUB file: ${epubPath}`);
    const epub = new EPub(epubPath);
    await new Promise((resolve, reject) => {
      epub.parse();
      epub.on("end", () => resolve());
      epub.on("error", reject);
    });
    logger.log(`Book loaded: ${epub.metadata.title}`);
    let orderIndex = 0;
    for (let i = 0; i < epub.flow.length; i++) {
      const chapter = epub.flow[i];
      try {
        const chapterHtml = await (0, import_util.promisify)(epub.getChapter.bind(epub))(
          chapter.id
        );
        const dom = new import_jsdom.JSDOM(chapterHtml);
        const document = dom.window.document;
        const paragraphElements = document.querySelectorAll("p");
        paragraphElements.forEach((p) => {
          const text = p.textContent?.trim();
          if (text && text.length > 0) {
            paragraphs.push({
              chapterNumber: i + 1,
              orderIndex: orderIndex++,
              content: text
            });
          }
        });
        const divElements = document.querySelectorAll("div");
        divElements.forEach((div) => {
          const hasOnlyTextNodes = Array.from(div.childNodes).every(
            (node) => node.nodeType === 3 || node.nodeName === "BR"
          );
          if (hasOnlyTextNodes) {
            const text = div.textContent?.trim();
            if (text && text.length > 50) {
              paragraphs.push({
                chapterNumber: i + 1,
                orderIndex: orderIndex++,
                content: text
              });
            }
          }
        });
      } catch (error) {
        logger.error(`Error processing chapter ${i}:`, error);
      }
    }
    logger.log(
      `Extracted ${paragraphs.length} paragraphs from ${epub.flow.length} chapters`
    );
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
