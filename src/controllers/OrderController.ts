import { Order, OrderType, OrderState } from '../models/Order';
import { Bot, BotState } from '../models/Bot';
import { OrderQueue } from '../models/OrderQueue';
import { Logger } from '../utils/Logger';

export class OrderController {
  private orders: Map<number, Order>;
  private orderQueue: OrderQueue;
  private bots: Map<number, Bot>;
  private nextOrderId: number = 1;
  private nextBotId: number = 1;
  private logger: Logger;

  constructor(logger: Logger) {
    this.orders = new Map();
    this.orderQueue = new OrderQueue();
    this.bots = new Map();
    this.logger = logger;
  }

  createOrder(type: OrderType): Order {
    const order = new Order(this.nextOrderId++, type);
    this.orders.set(order.id, order);
    this.orderQueue.enqueue(order);
    this.logger.log(`Order #${order.id} created (${type})`);

    // Try to assign to an idle bot
    this.assignOrderToIdleBot();

    return order;
  }

  addBot(): Bot {
    const bot = new Bot(this.nextBotId++);
    this.bots.set(bot.id, bot);
    this.logger.log(`Bot #${bot.id} created`);

    // Immediately try to assign an order if available
    this.processNextOrder(bot);

    return bot;
  }

  removeBot(): void {
    if (this.bots.size === 0) {
      this.logger.log('No bots to remove');
      return;
    }

    // Get the newest bot (highest ID)
    const newestBot = this.getNewestBot();

    if (newestBot.state === BotState.PROCESSING && newestBot.currentOrder) {
      // Cancel processing and return order to pending
      const order = newestBot.cancelProcessing();
      if (order) {
        order.resetToPending();
        this.orderQueue.requeue(order);
        this.logger.log(`Bot #${newestBot.id} removed (Order #${order.id} returned to PENDING)`);
      }
    } else {
      this.logger.log(`Bot #${newestBot.id} removed`);
    }

    this.bots.delete(newestBot.id);
  }

  private getNewestBot(): Bot {
    let newestBot: Bot | undefined;
    let maxId = -1;

    for (const bot of this.bots.values()) {
      if (bot.id > maxId) {
        maxId = bot.id;
        newestBot = bot;
      }
    }

    if (!newestBot) {
      throw new Error('No bots available');
    }

    return newestBot;
  }

  private assignOrderToIdleBot(): void {
    // Find an idle bot and assign the next order
    for (const bot of this.bots.values()) {
      if (bot.state === BotState.IDLE && !this.orderQueue.isEmpty()) {
        this.processNextOrder(bot);
        break;
      }
    }
  }

  private processNextOrder(bot: Bot): void {
    if (this.orderQueue.isEmpty()) {
      return;
    }

    const order = this.orderQueue.dequeue();
    if (!order) {
      return;
    }

    // Start processing
    order.startProcessing(bot.id);
    bot.assignOrder(order);
    this.logger.log(`Order #${order.id} PROCESSING by Bot #${bot.id}`);

    // Set timeout for 10 seconds
    bot.processingTimeout = setTimeout(() => {
      this.onOrderComplete(bot, order);
    }, 10000);
  }

  private onOrderComplete(bot: Bot, order: Order): void {
    order.complete();
    bot.completeOrder();
    this.logger.log(`Order #${order.id} COMPLETE`);

    // Try to process next order
    this.processNextOrder(bot);
  }

  getStatus(): {
    pendingOrders: Order[];
    processingOrders: Order[];
    completedOrders: Order[];
    idleBots: Bot[];
    processingBots: Bot[];
  } {
    const allOrders = Array.from(this.orders.values());
    const allBots = Array.from(this.bots.values());

    return {
      pendingOrders: allOrders.filter(o => o.state === OrderState.PENDING),
      processingOrders: allOrders.filter(o => o.state === OrderState.PROCESSING),
      completedOrders: allOrders.filter(o => o.state === OrderState.COMPLETE),
      idleBots: allBots.filter(b => b.state === BotState.IDLE),
      processingBots: allBots.filter(b => b.state === BotState.PROCESSING)
    };
  }
}
