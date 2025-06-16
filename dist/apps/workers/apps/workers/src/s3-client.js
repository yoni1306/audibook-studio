var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
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
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var s3_client_exports = {};
__export(s3_client_exports, {
  downloadFromS3: () => downloadFromS3
});
module.exports = __toCommonJS(s3_client_exports);
var import_client_s3 = require("@aws-sdk/client-s3");
var import_common = require("@nestjs/common");
var fs = __toESM(require("fs/promises"));
var path = __toESM(require("path"));
const logger = new import_common.Logger("S3Client");
const s3Client = new import_client_s3.S3Client({
  region: process.env.AWS_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || "test-access-key",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "test-secret-key"
  },
  ...process.env.S3_ENDPOINT && {
    endpoint: process.env.S3_ENDPOINT,
    forcePathStyle: true
  }
});
async function downloadFromS3(s3Key) {
  try {
    logger.log(`Downloading ${s3Key} from S3`);
    const command = new import_client_s3.GetObjectCommand({
      Bucket: process.env.S3_BUCKET_NAME || "audibook-storage",
      Key: s3Key
    });
    const response = await s3Client.send(command);
    const tempPath = path.join("/tmp", path.basename(s3Key));
    const data = await response.Body?.transformToByteArray();
    if (!data)
      throw new Error("No data received from S3");
    await fs.writeFile(tempPath, data);
    logger.log(`Downloaded to ${tempPath}`);
    return tempPath;
  } catch (error) {
    logger.error(`Failed to download from S3: ${error}`);
    throw error;
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  downloadFromS3
});
//# sourceMappingURL=s3-client.js.map
