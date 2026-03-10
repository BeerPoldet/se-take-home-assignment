import { OrderController } from '../src/controllers/OrderController';
import { OrderType, OrderState } from '../src/models/Order';
import { Logger } from '../src/utils/Logger';

describe('OrderController', () => {
  let controller: OrderController;
  let logger: Logger;

  beforeEach(() => {
    jest.useFakeTimers();
    logger = new Logger();
    controller = new OrderController(logger);
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  test('should create orders with unique increasing IDs', () => {
    const order1 = controller.createOrder(OrderType.NORMAL);
    const order2 = controller.createOrder(OrderType.VIP);
    const order3 = controller.createOrder(OrderType.NORMAL);

    expect(order1.id).toBe(1);
    expect(order2.id).toBe(2);
    expect(order3.id).toBe(3);
  });

  test('should create bots with unique increasing IDs', () => {
    const bot1 = controller.addBot();
    const bot2 = controller.addBot();

    expect(bot1.id).toBe(1);
    expect(bot2.id).toBe(2);
  });

  test('should assign order to bot when bot is added', () => {
    controller.createOrder(OrderType.NORMAL);
    controller.addBot();

    const status = controller.getStatus();
    expect(status.processingOrders.length).toBe(1);
    expect(status.pendingOrders.length).toBe(0);
  });

  test('bot should remain idle when no orders exist', () => {
    controller.addBot();

    const status = controller.getStatus();
    expect(status.idleBots.length).toBe(1);
    expect(status.processingBots.length).toBe(0);
  });

  test('removing bot should return order to pending', () => {
    controller.createOrder(OrderType.NORMAL);
    controller.addBot();

    // Remove bot while processing
    controller.removeBot();

    const status = controller.getStatus();
    expect(status.pendingOrders.length).toBe(1);
    expect(status.processingOrders.length).toBe(0);
    expect(status.pendingOrders[0].state).toBe(OrderState.PENDING);
  });

  test('should process VIP orders before normal orders', () => {
    controller.createOrder(OrderType.NORMAL);
    const vip = controller.createOrder(OrderType.VIP);

    controller.addBot();

    // VIP should be processing
    const status = controller.getStatus();
    const processingOrder = status.processingOrders[0];
    expect(processingOrder.id).toBe(vip.id);
    expect(processingOrder.type).toBe(OrderType.VIP);
  });

  test('multiple VIP orders should maintain FIFO order but come before normal orders', () => {
    // Create normal orders first
    const normal1 = controller.createOrder(OrderType.NORMAL); // Order #1
    const normal2 = controller.createOrder(OrderType.NORMAL); // Order #2

    // Add VIP orders
    const vip1 = controller.createOrder(OrderType.VIP); // Order #3
    const vip2 = controller.createOrder(OrderType.VIP); // Order #4
    const vip3 = controller.createOrder(OrderType.VIP); // Order #5

    // Add more normal orders
    const normal3 = controller.createOrder(OrderType.NORMAL); // Order #6

    // Add a bot to start processing
    controller.addBot();

    // First VIP should be processing (not first normal order)
    let status = controller.getStatus();
    expect(status.processingOrders[0].id).toBe(vip1.id);
    expect(status.processingOrders[0].type).toBe(OrderType.VIP);

    // Simulate completion and check order of processing
    jest.advanceTimersByTime(10000); // Complete vip1
    status = controller.getStatus();
    expect(status.completedOrders.length).toBe(1);
    expect(vip1.state).toBe(OrderState.COMPLETE);
    expect(status.processingOrders[0].id).toBe(vip2.id); // Second VIP

    jest.advanceTimersByTime(10000); // Complete vip2
    status = controller.getStatus();
    expect(status.completedOrders.length).toBe(2);
    expect(vip2.state).toBe(OrderState.COMPLETE);
    expect(status.processingOrders[0].id).toBe(vip3.id); // Third VIP

    jest.advanceTimersByTime(10000); // Complete vip3
    status = controller.getStatus();
    expect(status.completedOrders.length).toBe(3);
    expect(vip3.state).toBe(OrderState.COMPLETE);
    // Now normal orders should be processed in FIFO order
    expect(status.processingOrders[0].id).toBe(normal1.id);
    expect(status.processingOrders[0].type).toBe(OrderType.NORMAL);

    jest.advanceTimersByTime(10000); // Complete normal1
    status = controller.getStatus();
    expect(normal1.state).toBe(OrderState.COMPLETE);
    expect(status.processingOrders[0].id).toBe(normal2.id);

    jest.advanceTimersByTime(10000); // Complete normal2
    status = controller.getStatus();
    expect(normal2.state).toBe(OrderState.COMPLETE);
    expect(status.processingOrders[0].id).toBe(normal3.id);

    jest.advanceTimersByTime(10000); // Complete normal3
    status = controller.getStatus();
    expect(normal3.state).toBe(OrderState.COMPLETE);
    expect(status.completedOrders.length).toBe(6);

    // Verify that all VIP orders completed before any normal orders by checking completion timestamps
    expect(vip1.completedAt).toBeDefined();
    expect(vip2.completedAt).toBeDefined();
    expect(vip3.completedAt).toBeDefined();
    expect(normal1.completedAt).toBeDefined();
    expect(normal2.completedAt).toBeDefined();
    expect(normal3.completedAt).toBeDefined();

    // VIP orders should have earlier completion times than normal orders
    expect(vip1.completedAt!.getTime()).toBeLessThan(normal1.completedAt!.getTime());
    expect(vip2.completedAt!.getTime()).toBeLessThan(normal1.completedAt!.getTime());
    expect(vip3.completedAt!.getTime()).toBeLessThan(normal1.completedAt!.getTime());
  });
});
