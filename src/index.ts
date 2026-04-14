import 'dotenv/config';
import express from 'express';
import { loadConfig } from './config';
import { createDefaultHeatmapRouter } from './heatmapService';

const app = express();

// Mount the heatmap router
app.use(createDefaultHeatmapRouter());

// Only start the server when run directly (not imported for testing)
if (require.main === module) {
  const config = loadConfig();
  app.listen(config.port, () => {
    console.log(`Heatmap service listening on port ${config.port}`);
  });
}

export { app };
