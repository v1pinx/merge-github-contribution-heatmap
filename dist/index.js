"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.app = void 0;
require("dotenv/config");
const express_1 = __importDefault(require("express"));
const config_1 = require("./config");
const heatmapService_1 = require("./heatmapService");
const app = (0, express_1.default)();
exports.app = app;
// Mount the heatmap router
app.use((0, heatmapService_1.createDefaultHeatmapRouter)());
// Only start the server when run directly (not imported for testing)
if (require.main === module) {
    const config = (0, config_1.loadConfig)();
    app.listen(config.port, () => {
        console.log(`Heatmap service listening on port ${config.port}`);
    });
}
//# sourceMappingURL=index.js.map