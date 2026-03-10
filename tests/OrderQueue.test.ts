import { OrderQueue } from '../src/models/OrderQueue';
import { Order, OrderType } from '../src/models/Order';

describe('OrderQueue', () => {
  let queue: OrderQueue;

  beforeEach(() => {
    queue = new OrderQueue();
  });

  test('should enqueue and dequeue orders', () => {
    const order1 = new Order(1, OrderType.NORMAL);
    const order2 = new Order(2, OrderType.NORMAL);

    queue.enqueue(order1);
    queue.enqueue(order2);

    expect(queue.size()).toBe(2);
    expect(queue.dequeue()?.id).toBe(1);
    expect(queue.dequeue()?.id).toBe(2);
    expect(queue.isEmpty()).toBe(true);
  });

  test('VIP orders should be dequeued before Normal orders', () => {
    const normal1 = new Order(1, OrderType.NORMAL);
    const vip1 = new Order(2, OrderType.VIP);
    const normal2 = new Order(3, OrderType.NORMAL);

    queue.enqueue(normal1);
    queue.enqueue(vip1);
    queue.enqueue(normal2);

    expect(queue.dequeue()?.id).toBe(2); // VIP first
    expect(queue.dequeue()?.id).toBe(1); // Normal
    expect(queue.dequeue()?.id).toBe(3); // Normal
  });

  test('should maintain FIFO order within same priority', () => {
    const vip1 = new Order(1, OrderType.VIP);
    const vip2 = new Order(2, OrderType.VIP);
    const vip3 = new Order(3, OrderType.VIP);

    queue.enqueue(vip1);
    queue.enqueue(vip2);
    queue.enqueue(vip3);

    expect(queue.dequeue()?.id).toBe(1);
    expect(queue.dequeue()?.id).toBe(2);
    expect(queue.dequeue()?.id).toBe(3);
  });

  test('requeue should add order to front of respective queue', () => {
    const normal1 = new Order(1, OrderType.NORMAL);
    const normal2 = new Order(2, OrderType.NORMAL);
    const vip1 = new Order(3, OrderType.VIP);

    queue.enqueue(normal1);
    queue.enqueue(normal2);

    queue.requeue(vip1);

    expect(queue.dequeue()?.id).toBe(3); // Requeued VIP
    expect(queue.dequeue()?.id).toBe(1); // Original normal
  });
});
