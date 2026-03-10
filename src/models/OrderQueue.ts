import { Order, OrderType } from './Order';

export class OrderQueue {
  private vipQueue: Order[] = [];
  private normalQueue: Order[] = [];

  enqueue(order: Order): void {
    if (order.type === OrderType.VIP) {
      this.vipQueue.push(order);
    } else {
      this.normalQueue.push(order);
    }
  }

  dequeue(): Order | undefined {
    // Always prioritize VIP queue first
    if (this.vipQueue.length > 0) {
      return this.vipQueue.shift();
    }
    return this.normalQueue.shift();
  }

  requeue(order: Order): void {
    // Re-add order to the front of its respective queue to maintain original priority
    if (order.type === OrderType.VIP) {
      this.vipQueue.unshift(order);
    } else {
      this.normalQueue.unshift(order);
    }
  }

  isEmpty(): boolean {
    return this.vipQueue.length === 0 && this.normalQueue.length === 0;
  }

  size(): number {
    return this.vipQueue.length + this.normalQueue.length;
  }

  getPendingOrders(): Order[] {
    return [...this.vipQueue, ...this.normalQueue];
  }
}
