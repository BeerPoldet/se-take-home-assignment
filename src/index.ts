import { OrderController } from './controllers/OrderController';
import { OrderType } from './models/Order';
import { Logger } from './utils/Logger';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
  const logger = new Logger();
  const controller = new OrderController(logger);

  logger.log('McDonald\'s Order System Started');

  // User Story 1: Normal customer order flow
  logger.log('--- User Story 1: Normal Customer Order Flow ---');
  controller.createOrder(OrderType.NORMAL);
  controller.addBot();

  // Wait for order to complete (10 seconds)
  await sleep(11000);

  // User Story 2: VIP customer order priority
  logger.log('--- User Story 2: VIP Customer Order Priority ---');
  controller.createOrder(OrderType.NORMAL); // Order #2
  controller.createOrder(OrderType.NORMAL); // Order #3
  controller.createOrder(OrderType.VIP);    // Order #4 (should process before #2 and #3)
  controller.createOrder(OrderType.VIP);    // Order #5 (should process after #4 but before #2 and #3)

  // Wait for VIP orders to process
  await sleep(21000); // 20 seconds for 2 VIP orders

  // User Story 3: Manager increases/decreases bots
  logger.log('--- User Story 3: Manager Increases/Decreases Bots ---');
  controller.createOrder(OrderType.NORMAL); // Order #6
  controller.createOrder(OrderType.NORMAL); // Order #7
  controller.createOrder(OrderType.NORMAL); // Order #8

  controller.addBot(); // Bot #2 - should start processing order #2
  controller.addBot(); // Bot #3 - should start processing order #6

  // Wait a bit for processing to start
  await sleep(2000);

  // Remove a bot while it's processing
  controller.removeBot(); // Should remove Bot #3 and return Order #6 to pending

  // Wait for remaining orders to complete
  await sleep(25000);

  // User Story 4: Bot processing behavior (already demonstrated above)
  logger.log('--- System Final Status ---');
  const status = controller.getStatus();

  // Count VIP and NORMAL orders
  const vipPending = status.pendingOrders.filter(o => o.type === OrderType.VIP).length;
  const normalPending = status.pendingOrders.filter(o => o.type === OrderType.NORMAL).length;
  const vipProcessing = status.processingOrders.filter(o => o.type === OrderType.VIP).length;
  const normalProcessing = status.processingOrders.filter(o => o.type === OrderType.NORMAL).length;
  const vipComplete = status.completedOrders.filter(o => o.type === OrderType.VIP).length;
  const normalComplete = status.completedOrders.filter(o => o.type === OrderType.NORMAL).length;

  logger.log(`Pending: ${status.pendingOrders.length} (VIP: ${vipPending}, NORMAL: ${normalPending})`);
  logger.log(`Processing: ${status.processingOrders.length} (VIP: ${vipProcessing}, NORMAL: ${normalProcessing})`);
  logger.log(`Complete: ${status.completedOrders.length} (VIP: ${vipComplete}, NORMAL: ${normalComplete})`);
  logger.log(`Idle Bots: ${status.idleBots.length}, Processing Bots: ${status.processingBots.length}`);

  // Write logs to result.txt
  const outputPath = path.join(__dirname, '..', 'scripts', 'result.txt');
  fs.writeFileSync(outputPath, logger.getLogsAsString());

  logger.log('Results written to scripts/result.txt');
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

main().catch(console.error);
