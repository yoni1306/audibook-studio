/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	var __webpack_modules__ = ([
/* 0 */,
/* 1 */
/***/ ((module) => {

module.exports = require("@nestjs/common");

/***/ }),
/* 2 */
/***/ ((module) => {

module.exports = require("@nestjs/core");

/***/ }),
/* 3 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.AppModule = void 0;
const tslib_1 = __webpack_require__(4);
const common_1 = __webpack_require__(1);
const config_1 = __webpack_require__(5);
const app_controller_1 = __webpack_require__(6);
const health_module_1 = __webpack_require__(7);
const prisma_module_1 = __webpack_require__(9);
const s3_module_1 = __webpack_require__(12);
const queue_module_1 = __webpack_require__(23);
const books_module_1 = __webpack_require__(21);
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = tslib_1.__decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule.forRoot({
                isGlobal: true,
                envFilePath: ['.env.local', '.env'],
            }),
            prisma_module_1.PrismaModule,
            health_module_1.HealthModule,
            s3_module_1.S3Module,
            queue_module_1.QueueModule,
            books_module_1.BooksModule
        ],
        controllers: [app_controller_1.AppController],
    })
], AppModule);


/***/ }),
/* 4 */
/***/ ((module) => {

module.exports = require("tslib");

/***/ }),
/* 5 */
/***/ ((module) => {

module.exports = require("@nestjs/config");

/***/ }),
/* 6 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.AppController = void 0;
const tslib_1 = __webpack_require__(4);
const common_1 = __webpack_require__(1);
let AppController = class AppController {
    getData() {
        return {
            message: 'Welcome to Audibook Studio API',
            version: '0.1.0',
            docs: '/api/health for health check',
        };
    }
};
exports.AppController = AppController;
tslib_1.__decorate([
    (0, common_1.Get)(),
    tslib_1.__metadata("design:type", Function),
    tslib_1.__metadata("design:paramtypes", []),
    tslib_1.__metadata("design:returntype", void 0)
], AppController.prototype, "getData", null);
exports.AppController = AppController = tslib_1.__decorate([
    (0, common_1.Controller)()
], AppController);


/***/ }),
/* 7 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.HealthModule = void 0;
const tslib_1 = __webpack_require__(4);
const common_1 = __webpack_require__(1);
const health_controller_1 = __webpack_require__(8);
let HealthModule = class HealthModule {
};
exports.HealthModule = HealthModule;
exports.HealthModule = HealthModule = tslib_1.__decorate([
    (0, common_1.Module)({
        controllers: [health_controller_1.HealthController],
    })
], HealthModule);


/***/ }),
/* 8 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.HealthController = void 0;
const tslib_1 = __webpack_require__(4);
const common_1 = __webpack_require__(1);
let HealthController = class HealthController {
    check() {
        return {
            status: 'ok',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            environment: process.env.NODE_ENV || 'development',
            service: 'audibook-api',
        };
    }
};
exports.HealthController = HealthController;
tslib_1.__decorate([
    (0, common_1.Get)(),
    tslib_1.__metadata("design:type", Function),
    tslib_1.__metadata("design:paramtypes", []),
    tslib_1.__metadata("design:returntype", void 0)
], HealthController.prototype, "check", null);
exports.HealthController = HealthController = tslib_1.__decorate([
    (0, common_1.Controller)('health')
], HealthController);


/***/ }),
/* 9 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.PrismaModule = void 0;
const tslib_1 = __webpack_require__(4);
const common_1 = __webpack_require__(1);
const prisma_service_1 = __webpack_require__(10);
let PrismaModule = class PrismaModule {
};
exports.PrismaModule = PrismaModule;
exports.PrismaModule = PrismaModule = tslib_1.__decorate([
    (0, common_1.Global)(),
    (0, common_1.Module)({
        providers: [prisma_service_1.PrismaService],
        exports: [prisma_service_1.PrismaService],
    })
], PrismaModule);


/***/ }),
/* 10 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.PrismaService = void 0;
const tslib_1 = __webpack_require__(4);
const common_1 = __webpack_require__(1);
const client_1 = __webpack_require__(11);
let PrismaService = class PrismaService extends client_1.PrismaClient {
    constructor() {
        super({
            log: ['query', 'info', 'warn', 'error'],
        });
    }
    async onModuleInit() {
        await this.$connect();
    }
    async onModuleDestroy() {
        await this.$disconnect();
    }
};
exports.PrismaService = PrismaService;
exports.PrismaService = PrismaService = tslib_1.__decorate([
    (0, common_1.Injectable)(),
    tslib_1.__metadata("design:paramtypes", [])
], PrismaService);


/***/ }),
/* 11 */
/***/ ((module) => {

module.exports = require("@prisma/client");

/***/ }),
/* 12 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.S3Module = void 0;
const tslib_1 = __webpack_require__(4);
const common_1 = __webpack_require__(1);
const s3_service_1 = __webpack_require__(13);
const s3_controller_1 = __webpack_require__(16);
const books_module_1 = __webpack_require__(21);
const queue_module_1 = __webpack_require__(23);
let S3Module = class S3Module {
};
exports.S3Module = S3Module;
exports.S3Module = S3Module = tslib_1.__decorate([
    (0, common_1.Module)({
        imports: [books_module_1.BooksModule, queue_module_1.QueueModule],
        controllers: [s3_controller_1.S3Controller],
        providers: [s3_service_1.S3Service],
        exports: [s3_service_1.S3Service],
    })
], S3Module);


/***/ }),
/* 13 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


var S3Service_1;
var _a;
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.S3Service = void 0;
const tslib_1 = __webpack_require__(4);
const common_1 = __webpack_require__(1);
const config_1 = __webpack_require__(5);
const client_s3_1 = __webpack_require__(14);
const s3_request_presigner_1 = __webpack_require__(15);
let S3Service = S3Service_1 = class S3Service {
    constructor(configService) {
        this.configService = configService;
        this.logger = new common_1.Logger(S3Service_1.name);
        const endpoint = this.configService.get('S3_ENDPOINT');
        this.s3Client = new client_s3_1.S3Client({
            region: this.configService.get('AWS_REGION', 'us-east-1'),
            credentials: {
                accessKeyId: this.configService.get('AWS_ACCESS_KEY_ID'),
                secretAccessKey: this.configService.get('AWS_SECRET_ACCESS_KEY'),
            },
            ...(endpoint && {
                endpoint,
                forcePathStyle: true, // Required for MinIO
            }),
        });
        this.bucketName = this.configService.get('S3_BUCKET_NAME', 'audibook-storage');
        this.initializeBucket();
    }
    async initializeBucket() {
        try {
            await this.s3Client.send(new client_s3_1.HeadBucketCommand({ Bucket: this.bucketName }));
            this.logger.log(`Bucket ${this.bucketName} exists`);
        }
        catch (error) {
            this.logger.log(`Creating bucket ${this.bucketName}`);
            try {
                await this.s3Client.send(new client_s3_1.CreateBucketCommand({ Bucket: this.bucketName }));
                this.logger.log(`Bucket ${this.bucketName} created`);
            }
            catch (createError) {
                this.logger.error('Failed to create bucket', createError);
            }
        }
    }
    async getPresignedUploadUrl(key, contentType) {
        const command = new client_s3_1.PutObjectCommand({
            Bucket: this.bucketName,
            Key: key,
            ContentType: contentType,
        });
        const url = await (0, s3_request_presigner_1.getSignedUrl)(this.s3Client, command, {
            expiresIn: 3600, // 1 hour
        });
        return { url, key };
    }
};
exports.S3Service = S3Service;
exports.S3Service = S3Service = S3Service_1 = tslib_1.__decorate([
    (0, common_1.Injectable)(),
    tslib_1.__metadata("design:paramtypes", [typeof (_a = typeof config_1.ConfigService !== "undefined" && config_1.ConfigService) === "function" ? _a : Object])
], S3Service);


/***/ }),
/* 14 */
/***/ ((module) => {

module.exports = require("@aws-sdk/client-s3");

/***/ }),
/* 15 */
/***/ ((module) => {

module.exports = require("@aws-sdk/s3-request-presigner");

/***/ }),
/* 16 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


var _a, _b, _c;
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.S3Controller = void 0;
const tslib_1 = __webpack_require__(4);
const common_1 = __webpack_require__(1);
const s3_service_1 = __webpack_require__(13);
const books_service_1 = __webpack_require__(17);
const queue_service_1 = __webpack_require__(18);
let S3Controller = class S3Controller {
    constructor(s3Service, booksService, queueService) {
        this.s3Service = s3Service;
        this.booksService = booksService;
        this.queueService = queueService;
    }
    async getPresignedUploadUrl(body) {
        const { filename, contentType } = body;
        const key = `raw/${Date.now()}-${filename}`;
        const result = await this.s3Service.getPresignedUploadUrl(key, contentType);
        // Create book record
        const book = await this.booksService.createBook({
            title: filename.replace('.epub', ''),
            s3Key: key,
        });
        // Queue parsing job
        await this.queueService.addEpubParsingJob({
            bookId: book.id,
            s3Key: key,
        });
        return {
            uploadUrl: result.url,
            key: result.key,
            bookId: book.id,
        };
    }
};
exports.S3Controller = S3Controller;
tslib_1.__decorate([
    (0, common_1.Post)('presigned-upload'),
    tslib_1.__param(0, (0, common_1.Body)()),
    tslib_1.__metadata("design:type", Function),
    tslib_1.__metadata("design:paramtypes", [Object]),
    tslib_1.__metadata("design:returntype", Promise)
], S3Controller.prototype, "getPresignedUploadUrl", null);
exports.S3Controller = S3Controller = tslib_1.__decorate([
    (0, common_1.Controller)('s3'),
    tslib_1.__metadata("design:paramtypes", [typeof (_a = typeof s3_service_1.S3Service !== "undefined" && s3_service_1.S3Service) === "function" ? _a : Object, typeof (_b = typeof books_service_1.BooksService !== "undefined" && books_service_1.BooksService) === "function" ? _b : Object, typeof (_c = typeof queue_service_1.QueueService !== "undefined" && queue_service_1.QueueService) === "function" ? _c : Object])
], S3Controller);


/***/ }),
/* 17 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


var BooksService_1;
var _a;
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.BooksService = void 0;
const tslib_1 = __webpack_require__(4);
const common_1 = __webpack_require__(1);
const prisma_service_1 = __webpack_require__(10);
const client_1 = __webpack_require__(11);
let BooksService = BooksService_1 = class BooksService {
    constructor(prisma) {
        this.prisma = prisma;
        this.logger = new common_1.Logger(BooksService_1.name);
    }
    async createBook(data) {
        return this.prisma.book.create({
            data: {
                title: data.title,
                author: data.author,
                s3Key: data.s3Key,
                status: client_1.BookStatus.UPLOADING,
            },
        });
    }
    async updateBookStatus(bookId, status) {
        return this.prisma.book.update({
            where: { id: bookId },
            data: { status },
        });
    }
    async createParagraphs(bookId, paragraphs) {
        return this.prisma.paragraph.createMany({
            data: paragraphs.map((p) => ({
                ...p,
                bookId,
            })),
        });
    }
    async getBook(id) {
        return this.prisma.book.findUnique({
            where: { id },
            include: {
                paragraphs: {
                    orderBy: { orderIndex: 'asc' },
                },
            },
        });
    }
    async getAllBooks() {
        return this.prisma.book.findMany({
            orderBy: { createdAt: 'desc' },
            include: {
                _count: {
                    select: { paragraphs: true },
                },
            },
        });
    }
};
exports.BooksService = BooksService;
exports.BooksService = BooksService = BooksService_1 = tslib_1.__decorate([
    (0, common_1.Injectable)(),
    tslib_1.__metadata("design:paramtypes", [typeof (_a = typeof prisma_service_1.PrismaService !== "undefined" && prisma_service_1.PrismaService) === "function" ? _a : Object])
], BooksService);


/***/ }),
/* 18 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


var QueueService_1;
var _a;
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.QueueService = void 0;
const tslib_1 = __webpack_require__(4);
const common_1 = __webpack_require__(1);
const bullmq_1 = __webpack_require__(19);
const bullmq_2 = __webpack_require__(20);
let QueueService = QueueService_1 = class QueueService {
    constructor(audioQueue) {
        this.audioQueue = audioQueue;
        this.logger = new common_1.Logger(QueueService_1.name);
    }
    async addTestJob(data) {
        const job = await this.audioQueue.add('test-job', data);
        this.logger.log(`Added test job ${job.id} to queue`);
        return { jobId: job.id };
    }
    async addEpubParsingJob(data) {
        const job = await this.audioQueue.add('parse-epub', data);
        this.logger.log(`Added EPUB parsing job ${job.id} for book ${data.bookId}`);
        return { jobId: job.id };
    }
};
exports.QueueService = QueueService;
exports.QueueService = QueueService = QueueService_1 = tslib_1.__decorate([
    (0, common_1.Injectable)(),
    tslib_1.__param(0, (0, bullmq_1.InjectQueue)('audio-processing')),
    tslib_1.__metadata("design:paramtypes", [typeof (_a = typeof bullmq_2.Queue !== "undefined" && bullmq_2.Queue) === "function" ? _a : Object])
], QueueService);


/***/ }),
/* 19 */
/***/ ((module) => {

module.exports = require("@nestjs/bullmq");

/***/ }),
/* 20 */
/***/ ((module) => {

module.exports = require("bullmq");

/***/ }),
/* 21 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.BooksModule = void 0;
const tslib_1 = __webpack_require__(4);
const common_1 = __webpack_require__(1);
const books_service_1 = __webpack_require__(17);
const books_controller_1 = __webpack_require__(22);
let BooksModule = class BooksModule {
};
exports.BooksModule = BooksModule;
exports.BooksModule = BooksModule = tslib_1.__decorate([
    (0, common_1.Module)({
        controllers: [books_controller_1.BooksController],
        providers: [books_service_1.BooksService],
        exports: [books_service_1.BooksService],
    })
], BooksModule);


/***/ }),
/* 22 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


var _a;
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.BooksController = void 0;
const tslib_1 = __webpack_require__(4);
const common_1 = __webpack_require__(1);
const books_service_1 = __webpack_require__(17);
let BooksController = class BooksController {
    constructor(booksService) {
        this.booksService = booksService;
    }
    async createBook(body) {
        return this.booksService.createBook(body);
    }
    async getBook(id) {
        return this.booksService.getBook(id);
    }
    async getAllBooks() {
        return this.booksService.getAllBooks();
    }
    async createParagraphs(id, body) {
        return this.booksService.createParagraphs(id, body.paragraphs);
    }
    async updateStatus(id, body) {
        return this.booksService.updateBookStatus(id, body.status);
    }
};
exports.BooksController = BooksController;
tslib_1.__decorate([
    (0, common_1.Post)(),
    tslib_1.__param(0, (0, common_1.Body)()),
    tslib_1.__metadata("design:type", Function),
    tslib_1.__metadata("design:paramtypes", [Object]),
    tslib_1.__metadata("design:returntype", Promise)
], BooksController.prototype, "createBook", null);
tslib_1.__decorate([
    (0, common_1.Get)(':id'),
    tslib_1.__param(0, (0, common_1.Param)('id')),
    tslib_1.__metadata("design:type", Function),
    tslib_1.__metadata("design:paramtypes", [String]),
    tslib_1.__metadata("design:returntype", Promise)
], BooksController.prototype, "getBook", null);
tslib_1.__decorate([
    (0, common_1.Get)(),
    tslib_1.__metadata("design:type", Function),
    tslib_1.__metadata("design:paramtypes", []),
    tslib_1.__metadata("design:returntype", Promise)
], BooksController.prototype, "getAllBooks", null);
tslib_1.__decorate([
    (0, common_1.Post)(':id/paragraphs'),
    tslib_1.__param(0, (0, common_1.Param)('id')),
    tslib_1.__param(1, (0, common_1.Body)()),
    tslib_1.__metadata("design:type", Function),
    tslib_1.__metadata("design:paramtypes", [String, Object]),
    tslib_1.__metadata("design:returntype", Promise)
], BooksController.prototype, "createParagraphs", null);
tslib_1.__decorate([
    (0, common_1.Patch)(':id/status'),
    tslib_1.__param(0, (0, common_1.Param)('id')),
    tslib_1.__param(1, (0, common_1.Body)()),
    tslib_1.__metadata("design:type", Function),
    tslib_1.__metadata("design:paramtypes", [String, Object]),
    tslib_1.__metadata("design:returntype", Promise)
], BooksController.prototype, "updateStatus", null);
exports.BooksController = BooksController = tslib_1.__decorate([
    (0, common_1.Controller)('books'),
    tslib_1.__metadata("design:paramtypes", [typeof (_a = typeof books_service_1.BooksService !== "undefined" && books_service_1.BooksService) === "function" ? _a : Object])
], BooksController);


/***/ }),
/* 23 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.QueueModule = void 0;
const tslib_1 = __webpack_require__(4);
const common_1 = __webpack_require__(1);
const bullmq_1 = __webpack_require__(19);
const queue_service_1 = __webpack_require__(18);
const queue_controller_1 = __webpack_require__(24);
let QueueModule = class QueueModule {
};
exports.QueueModule = QueueModule;
exports.QueueModule = QueueModule = tslib_1.__decorate([
    (0, common_1.Module)({
        imports: [
            bullmq_1.BullModule.forRoot({
                connection: {
                    host: process.env.REDIS_HOST || 'localhost',
                    port: parseInt(process.env.REDIS_PORT, 10) || 6379,
                },
            }),
            bullmq_1.BullModule.registerQueue({
                name: 'audio-processing',
            }),
        ],
        controllers: [queue_controller_1.QueueController],
        providers: [queue_service_1.QueueService],
        exports: [queue_service_1.QueueService],
    })
], QueueModule);


/***/ }),
/* 24 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


var _a, _b;
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.QueueController = void 0;
const tslib_1 = __webpack_require__(4);
const common_1 = __webpack_require__(1);
const queue_service_1 = __webpack_require__(18);
const bullmq_1 = __webpack_require__(19);
const bullmq_2 = __webpack_require__(20);
let QueueController = class QueueController {
    constructor(queueService, audioQueue) {
        this.queueService = queueService;
        this.audioQueue = audioQueue;
    }
    async addTestJob(body) {
        return this.queueService.addTestJob(body);
    }
    async addEpubParsingJob(body) {
        return this.queueService.addEpubParsingJob(body);
    }
    async getQueueStatus() {
        const waiting = await this.audioQueue.getWaitingCount();
        const active = await this.audioQueue.getActiveCount();
        const completed = await this.audioQueue.getCompletedCount();
        const failed = await this.audioQueue.getFailedCount();
        return {
            waiting,
            active,
            completed,
            failed,
        };
    }
    async getJobs() {
        const waiting = await this.audioQueue.getWaiting();
        const active = await this.audioQueue.getActive();
        const completed = await this.audioQueue.getCompleted();
        const failed = await this.audioQueue.getFailed();
        return {
            waiting: waiting.map(job => ({
                id: job.id,
                name: job.name,
                data: job.data,
                timestamp: job.timestamp,
            })),
            active: active.map(job => ({
                id: job.id,
                name: job.name,
                data: job.data,
                timestamp: job.timestamp,
            })),
            completed: completed.map(job => ({
                id: job.id,
                name: job.name,
                data: job.data,
                returnvalue: job.returnvalue,
                finishedOn: job.finishedOn,
            })),
            failed: failed.map(job => ({
                id: job.id,
                name: job.name,
                data: job.data,
                failedReason: job.failedReason,
                finishedOn: job.finishedOn,
            })),
        };
    }
};
exports.QueueController = QueueController;
tslib_1.__decorate([
    (0, common_1.Post)('test'),
    tslib_1.__param(0, (0, common_1.Body)()),
    tslib_1.__metadata("design:type", Function),
    tslib_1.__metadata("design:paramtypes", [Object]),
    tslib_1.__metadata("design:returntype", Promise)
], QueueController.prototype, "addTestJob", null);
tslib_1.__decorate([
    (0, common_1.Post)('parse-epub'),
    tslib_1.__param(0, (0, common_1.Body)()),
    tslib_1.__metadata("design:type", Function),
    tslib_1.__metadata("design:paramtypes", [Object]),
    tslib_1.__metadata("design:returntype", Promise)
], QueueController.prototype, "addEpubParsingJob", null);
tslib_1.__decorate([
    (0, common_1.Get)('status'),
    tslib_1.__metadata("design:type", Function),
    tslib_1.__metadata("design:paramtypes", []),
    tslib_1.__metadata("design:returntype", Promise)
], QueueController.prototype, "getQueueStatus", null);
tslib_1.__decorate([
    (0, common_1.Get)('jobs'),
    tslib_1.__metadata("design:type", Function),
    tslib_1.__metadata("design:paramtypes", []),
    tslib_1.__metadata("design:returntype", Promise)
], QueueController.prototype, "getJobs", null);
exports.QueueController = QueueController = tslib_1.__decorate([
    (0, common_1.Controller)('queue'),
    tslib_1.__param(1, (0, bullmq_1.InjectQueue)('audio-processing')),
    tslib_1.__metadata("design:paramtypes", [typeof (_a = typeof queue_service_1.QueueService !== "undefined" && queue_service_1.QueueService) === "function" ? _a : Object, typeof (_b = typeof bullmq_2.Queue !== "undefined" && bullmq_2.Queue) === "function" ? _b : Object])
], QueueController);


/***/ })
/******/ 	]);
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		var cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		__webpack_modules__[moduleId](module, module.exports, __webpack_require__);
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
var __webpack_exports__ = {};
// This entry needs to be wrapped in an IIFE because it needs to be isolated against other modules in the chunk.
(() => {
var exports = __webpack_exports__;

Object.defineProperty(exports, "__esModule", ({ value: true }));
const common_1 = __webpack_require__(1);
const core_1 = __webpack_require__(2);
const app_module_1 = __webpack_require__(3);
async function bootstrap() {
    const app = await core_1.NestFactory.create(app_module_1.AppModule);
    // Enable CORS for the Next.js app
    app.enableCors({
        origin: 'http://localhost:3000',
        credentials: true,
    });
    const globalPrefix = 'api';
    app.setGlobalPrefix(globalPrefix);
    const port = process.env.PORT || 3333;
    await app.listen(port);
    common_1.Logger.log(`🚀 Application is running on: http://localhost:${port}/${globalPrefix}`);
    common_1.Logger.log(`🏥 Health check available at: http://localhost:${port}/${globalPrefix}/health`);
}
bootstrap();

})();

/******/ })()
;
//# sourceMappingURL=main.js.map