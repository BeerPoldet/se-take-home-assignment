# Technical Documentation: McDonald's Order Management System

## Table of Contents
1. [Project Structure](#project-structure)
2. [Architecture Overview](#architecture-overview)
3. [Core Components](#core-components)
4. [OrderController Deep Dive](#ordercontroller-deep-dive)
5. [Data Flow](#data-flow)
6. [Design Decisions](#design-decisions)
7. [Testing Strategy](#testing-strategy)

---

## Project Structure

```
se-take-home-assignment/
├── src/
│   ├── models/               # Data models and business entities
│   │   ├── Order.ts          # Order entity with state management
│   │   ├── Bot.ts            # Bot entity with processing logic
│   │   └── OrderQueue.ts     # Priority queue for order management
│   ├── controllers/
│   │   └── OrderController.ts # Main orchestrator and business logic
│   ├── utils/
│   │   └── Logger.ts         # Timestamp formatting and logging
│   └── index.ts              # CLI entry point
├── tests/
│   ├── OrderController.test.ts # Integration and unit tests
│   └── OrderQueue.test.ts      # Queue priority tests
├── scripts/
│   ├── build.sh              # Build and compile
│   ├── test.sh               # Run tests, type-check, lint
│   ├── run.sh                # Execute CLI
│   └── result.txt            # Output file (HH:MM:SS timestamped logs)
├── package.json              # Dependencies and scripts
├── tsconfig.json             # TypeScript configuration (strict mode)
├── jest.config.js            # Jest test configuration
└── .eslintrc.json            # ESLint configuration
```

---

## Architecture Overview

### System Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    CLI Interface                         │
│                   (src/index.ts)                         │
│          Demonstrates all user stories                   │
└───────────────────────┬─────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│               OrderController                            │
│                                                          │
│  - Orchestrates order and bot management                │
│  - Manages state transitions                            │
│  - Coordinates order-bot assignments                    │
│  - Handles timing for 10-second processing              │
└───────┬──────────────────────────┬──────────────────────┘
        │                          │
        ▼                          ▼
┌──────────────┐          ┌──────────────┐
│ OrderQueue   │          │   Bot Pool   │
│              │          │              │
│ - VIP Queue  │          │ - Active Bots│
│ - Normal Q   │          │ - State Mgmt │
└──────────────┘          └──────────────┘
        │                          │
        ▼                          ▼
┌──────────────┐          ┌──────────────┐
│    Orders    │          │     Bots     │
│  (Map by ID) │          │  (Map by ID) │
└──────────────┘          └──────────────┘
```

### Component Responsibilities

| Component | Responsibility |
|-----------|---------------|
| **OrderController** | Main orchestrator, business logic, state coordination |
| **OrderQueue** | Priority-based queue management (VIP > Normal) |
| **Order** | Order state management and transitions |
| **Bot** | Bot state management and timeout handling |
| **Logger** | Timestamp formatting and event logging |

---

## Core Components

### 1. Order Model (`src/models/Order.ts`)

**Purpose**: Represents an order with its lifecycle states

**Enums**:
```typescript
OrderType { NORMAL, VIP }
OrderState { PENDING, PROCESSING, COMPLETE }
```

**Key Properties**:
- `id: number` - Unique, auto-incrementing identifier
- `type: OrderType` - Priority level (VIP or NORMAL)
- `state: OrderState` - Current lifecycle state
- `createdAt: Date` - Order creation timestamp
- `processingStartedAt?: Date` - When bot started processing
- `completedAt?: Date` - When processing finished
- `assignedBotId?: number` - Bot currently processing this order

**Key Methods**:
- `startProcessing(botId)` - Transition to PROCESSING state
- `complete()` - Transition to COMPLETE state
- `resetToPending()` - Return to PENDING (when bot removed)

**State Transitions**:
```
PENDING ──addBot()──> PROCESSING ──10 seconds──> COMPLETE
   ▲
   │
   └──────removeBot()─────────────────────────────
```

### 2. Bot Model (`src/models/Bot.ts`)

**Purpose**: Represents a cooking bot with processing capabilities

**Enums**:
```typescript
BotState { IDLE, PROCESSING }
```

**Key Properties**:
- `id: number` - Unique bot identifier
- `state: BotState` - Current bot state
- `currentOrder?: Order` - Order being processed
- `processingTimeout?: NodeJS.Timeout` - Timer for 10s processing

**Key Methods**:
- `assignOrder(order)` - Start processing an order
- `completeOrder()` - Finish processing, clear timeout
- `cancelProcessing()` - Stop processing, return order

**State Transitions**:
```
IDLE ──assignOrder()──> PROCESSING ──10 seconds──> IDLE
                              ▲                       │
                              │                       │
                              └───next order exists───┘
```

### 3. OrderQueue Model (`src/models/OrderQueue.ts`)

**Purpose**: Dual-queue system for priority-based order management

**Data Structure**:
```typescript
vipQueue: Order[]    // VIP orders (FIFO)
normalQueue: Order[] // Normal orders (FIFO)
```

**Key Methods**:
- `enqueue(order)` - Add to appropriate queue
- `dequeue()` - Get next order (VIP priority)
- `requeue(order)` - Re-add order (for bot removal)
- `isEmpty()` - Check if any orders pending
- `getPendingOrders()` - Get all pending orders

**Priority Logic**:
```typescript
dequeue(): Order | undefined {
  // Always prioritize VIP queue first
  if (this.vipQueue.length > 0) {
    return this.vipQueue.shift(); // FIFO for VIP
  }
  return this.normalQueue.shift(); // FIFO for Normal
}
```

**Queue Ordering**:
```
Example State:
vipQueue:    [VIP#3, VIP#4, VIP#5]    (FIFO)
normalQueue: [NORM#1, NORM#2, NORM#6] (FIFO)

Dequeue Order: VIP#3 → VIP#4 → VIP#5 → NORM#1 → NORM#2 → NORM#6
```

---

## OrderController Deep Dive

### Overview

The `OrderController` is the heart of the system, orchestrating all interactions between orders, bots, and the queue. It implements the complete business logic for the McDonald's order management system.

### Class Structure

```typescript
class OrderController {
  // State Storage
  private orders: Map<number, Order>;      // All orders by ID
  private orderQueue: OrderQueue;          // Pending orders
  private bots: Map<number, Bot>;          // All bots by ID
  private nextOrderId: number = 1;         // Auto-increment
  private nextBotId: number = 1;           // Auto-increment
  private logger: Logger;                  // Event logging

  // Public API
  createOrder(type: OrderType): Order
  addBot(): Bot
  removeBot(): void
  getStatus(): SystemStatus

  // Private Helpers
  private getNewestBot(): Bot
  private assignOrderToIdleBot(): void
  private processNextOrder(bot: Bot): void
  private onOrderComplete(bot: Bot, order: Order): void
}
```

### Key Operations

#### 1. Creating an Order (`createOrder`)

**Flow**:
```
1. Create Order with auto-increment ID
2. Store in orders Map
3. Add to OrderQueue (VIP or Normal queue)
4. Log creation event
5. Try to assign to idle bot (if available)
6. Return order reference
```

**Code Path**:
```typescript
createOrder(type: OrderType): Order {
  const order = new Order(this.nextOrderId++, type);
  this.orders.set(order.id, order);
  this.orderQueue.enqueue(order);
  this.logger.log(`Order #${order.id} created (${type})`);

  // Opportunistic assignment
  this.assignOrderToIdleBot();

  return order;
}
```

**Important**: Orders created when no bots exist remain in PENDING state until a bot is added.

#### 2. Adding a Bot (`addBot`)

**Flow**:
```
1. Create Bot with auto-increment ID
2. Store in bots Map
3. Log creation event
4. Immediately try to process pending order
5. If no orders, bot remains IDLE
6. Return bot reference
```

**Code Path**:
```typescript
addBot(): Bot {
  const bot = new Bot(this.nextBotId++);
  this.bots.set(bot.id, bot);
  this.logger.log(`Bot #${bot.id} created`);

  // Immediate order assignment
  this.processNextOrder(bot);

  return bot;
}
```

**Key Behavior**: When a bot is added, it immediately checks for pending orders and starts processing if available.

#### 3. Removing a Bot (`removeBot`)

**Flow**:
```
1. Check if bots exist (log if none)
2. Get newest bot (highest ID)
3. If bot is PROCESSING:
   a. Cancel timeout
   b. Get current order
   c. Reset order to PENDING
   d. Requeue order (to front of queue)
   e. Log with order return info
4. If bot is IDLE:
   a. Simply remove
   b. Log removal
5. Delete bot from Map
```

**Code Path**:
```typescript
removeBot(): void {
  if (this.bots.size === 0) {
    this.logger.log('No bots to remove');
    return;
  }

  const newestBot = this.getNewestBot();

  if (newestBot.state === BotState.PROCESSING && newestBot.currentOrder) {
    const order = newestBot.cancelProcessing();
    if (order) {
      order.resetToPending();
      this.orderQueue.requeue(order); // To front!
      this.logger.log(`Bot #${newestBot.id} removed (Order #${order.id} returned to PENDING)`);
    }
  } else {
    this.logger.log(`Bot #${newestBot.id} removed`);
  }

  this.bots.delete(newestBot.id);
}
```

**Important**: The order is requeued to the **front** of its respective queue (VIP or Normal) to maintain its original priority position.

#### 4. Processing an Order (`processNextOrder`)

**Flow**:
```
1. Check if queue has orders
2. Dequeue next order (VIP priority)
3. Transition order to PROCESSING
4. Assign order to bot
5. Log processing start
6. Set 10-second timeout
7. On timeout: call onOrderComplete
```

**Code Path**:
```typescript
private processNextOrder(bot: Bot): void {
  if (this.orderQueue.isEmpty()) {
    return; // Bot stays IDLE
  }

  const order = this.orderQueue.dequeue();
  if (!order) return;

  // State transitions
  order.startProcessing(bot.id);
  bot.assignOrder(order);
  this.logger.log(`Order #${order.id} PROCESSING by Bot #${bot.id}`);

  // 10-second processing timer
  bot.processingTimeout = setTimeout(() => {
    this.onOrderComplete(bot, order);
  }, 10000);
}
```

**Timing**: The 10-second delay is implemented using JavaScript's `setTimeout`, which is non-blocking and allows concurrent processing by multiple bots.

#### 5. Order Completion (`onOrderComplete`)

**Flow**:
```
1. Transition order to COMPLETE
2. Clear bot's current order and timeout
3. Set bot to IDLE
4. Log completion
5. Check for next pending order
6. If order exists, process it (recursion)
7. If no orders, bot remains IDLE
```

**Code Path**:
```typescript
private onOrderComplete(bot: Bot, order: Order): void {
  order.complete();
  bot.completeOrder();
  this.logger.log(`Order #${order.id} COMPLETE`);

  // Auto-pickup next order
  this.processNextOrder(bot);
}
```

**Important**: The recursive call to `processNextOrder` enables continuous processing - as soon as a bot finishes, it automatically picks up the next order if available.

### State Management

The OrderController maintains consistency through:

1. **Centralized State**: All orders and bots stored in Maps
2. **Unique IDs**: Auto-incrementing counters ensure uniqueness
3. **Atomic Operations**: Each method completes state transitions atomically
4. **Event Logging**: Every state change is logged with timestamps

### Concurrency Handling

**Multiple Bots Processing Simultaneously**:
```
Time: 0s
Bot #1: IDLE
Bot #2: IDLE
Bot #3: IDLE

Orders: [Order#1, Order#2, Order#3]

Time: 0s (after addBot x3)
Bot #1: PROCESSING Order#1 ───┐
Bot #2: PROCESSING Order#2 ───┼─── Concurrent
Bot #3: PROCESSING Order#3 ───┘

Time: 10s
Bot #1: COMPLETE Order#1, now IDLE
Bot #2: COMPLETE Order#2, now IDLE
Bot #3: COMPLETE Order#3, now IDLE
```

Each bot has its own `setTimeout` timer, enabling true concurrent processing.

---

## Data Flow

### Scenario 1: Normal Order Flow

```
User Action: Create Normal Order
     │
     ▼
OrderController.createOrder(NORMAL)
     │
     ├─→ new Order(id=1, type=NORMAL)
     │       state = PENDING
     │
     ├─→ orders.set(1, order)
     │
     ├─→ orderQueue.enqueue(order)
     │       → normalQueue.push(order)
     │
     ├─→ logger.log("[HH:MM:SS] Order #1 created (NORMAL)")
     │
     └─→ assignOrderToIdleBot()
             → No bots available
             → Order stays in queue

User Action: Add Bot
     │
     ▼
OrderController.addBot()
     │
     ├─→ new Bot(id=1)
     │       state = IDLE
     │
     ├─→ bots.set(1, bot)
     │
     ├─→ logger.log("[HH:MM:SS] Bot #1 created")
     │
     └─→ processNextOrder(bot)
             │
             ├─→ orderQueue.dequeue()
             │       → normalQueue.shift() = Order #1
             │
             ├─→ order.startProcessing(bot.id)
             │       → state = PROCESSING
             │
             ├─→ bot.assignOrder(order)
             │       → state = PROCESSING
             │
             ├─→ logger.log("[HH:MM:SS] Order #1 PROCESSING by Bot #1")
             │
             └─→ setTimeout(() => onOrderComplete(bot, order), 10000)

[10 seconds later]
     │
     ▼
onOrderComplete(bot, Order#1)
     │
     ├─→ order.complete()
     │       → state = COMPLETE
     │
     ├─→ bot.completeOrder()
     │       → state = IDLE
     │
     ├─→ logger.log("[HH:MM:SS] Order #1 COMPLETE")
     │
     └─→ processNextOrder(bot)
             → No more orders
             → Bot stays IDLE
```

### Scenario 2: VIP Priority

```
Initial State:
  normalQueue: [Order#1, Order#2]
  vipQueue: []

User Action: Create VIP Order
     │
     ▼
OrderController.createOrder(VIP)
     │
     └─→ orderQueue.enqueue(Order#3, VIP)
             → vipQueue.push(Order#3)

Queue State:
  normalQueue: [Order#1, Order#2]
  vipQueue: [Order#3]

User Action: Add Bot
     │
     ▼
OrderController.addBot()
     │
     └─→ processNextOrder(bot)
             │
             └─→ orderQueue.dequeue()
                     │
                     ├─→ Check vipQueue.length > 0 ? YES
                     │
                     └─→ vipQueue.shift() = Order#3
                             → VIP processed FIRST!

Result: Order#3 (VIP) processes before Order#1, Order#2 (NORMAL)
```

### Scenario 3: Bot Removal During Processing

```
Initial State:
  Bot#1: PROCESSING Order#1 (5 seconds remaining)

User Action: Remove Bot
     │
     ▼
OrderController.removeBot()
     │
     ├─→ getNewestBot() = Bot#1
     │
     ├─→ bot.state === PROCESSING ? YES
     │
     ├─→ bot.cancelProcessing()
     │       │
     │       ├─→ clearTimeout(processingTimeout)
     │       │       → Cancel 10s timer
     │       │
     │       ├─→ order = currentOrder (Order#1)
     │       │
     │       └─→ return Order#1
     │
     ├─→ order.resetToPending()
     │       → state = PENDING
     │       → assignedBotId = undefined
     │
     ├─→ orderQueue.requeue(order)
     │       → normalQueue.unshift(Order#1)
     │       → Added to FRONT of queue
     │
     ├─→ logger.log("[HH:MM:SS] Bot #1 removed (Order #1 returned to PENDING)")
     │
     └─→ bots.delete(1)

Final State:
  normalQueue: [Order#1, ...]  ← Order back at front
  bots: empty
```

---

## Design Decisions

### 1. Dual Queue vs Single Priority Queue

**Decision**: Use dual queue (VIP + Normal)

**Rationale**:
- **Simplicity**: Clear separation of concerns
- **Performance**: O(1) enqueue, O(1) dequeue
- **Maintainability**: Easy to understand and debug
- **FIFO Guarantee**: Each queue maintains FIFO naturally

**Alternative Considered**: Single sorted queue
- More complex insertion logic
- Harder to maintain FIFO within priority levels

### 2. Map-Based Storage

**Decision**: Use `Map<number, T>` for orders and bots

**Rationale**:
- O(1) lookup by ID
- Easy iteration
- Type-safe with TypeScript
- Natural key-value relationship

### 3. Timeout-Based Processing

**Decision**: Use `setTimeout` for 10-second simulation

**Rationale**:
- Non-blocking (allows concurrency)
- Native JavaScript feature
- Easy to cancel on bot removal
- Realistic for simulation purposes

**Production Alternative**: Would use job queue (Bull, RabbitMQ) for real systems

### 4. Logger Utility

**Decision**: Separate Logger class for timestamp formatting

**Rationale**:
- Single responsibility principle
- Consistent timestamp format (HH:MM:SS)
- Centralized log collection
- Easy to extend (file writing, log levels, etc.)

### 5. State Management in Entities

**Decision**: Order and Bot manage their own state

**Rationale**:
- Encapsulation: State and transitions in one place
- Type safety: State enums prevent invalid states
- Testability: Can test state transitions independently

### 6. Requeue to Front

**Decision**: When bot removed, requeue order to front of queue

**Rationale**:
- Fairness: Order was already being processed
- Priority preservation: Maintains original position relative to others
- User expectation: Order shouldn't be penalized for bot removal

---

## Testing Strategy

### Test Coverage (18 tests)

**Unit Tests** (OrderQueue):
- VIP orders dequeued before Normal
- FIFO order within same priority
- Requeue functionality

**Integration Tests** (OrderController):
- Order creation with unique IDs
- Bot creation and management
- Order-to-bot assignment
- VIP priority in processing
- Multiple VIP orders maintain FIFO

**Edge Case Tests**:
- Order with no bots (stays PENDING)
- Remove bot when none exist (graceful handling)
- Multiple concurrent bots
- More bots than orders
- Remove idle bot
- Bot auto-picks next order
- Complete state transition flow

### Test Approach

**Jest Fake Timers**:
```typescript
beforeEach(() => {
  jest.useFakeTimers();
});

test('bot completes order after 10 seconds', () => {
  controller.createOrder(OrderType.NORMAL);
  controller.addBot();

  jest.advanceTimersByTime(10000);

  expect(order.state).toBe(OrderState.COMPLETE);
});
```

**Benefits**:
- Fast test execution (no real 10s waits)
- Deterministic timing
- Easy to test time-based scenarios

---

## Performance Characteristics

### Time Complexity

| Operation | Complexity | Notes |
|-----------|-----------|-------|
| createOrder | O(1) | Direct insert to queue |
| addBot | O(1) | Direct insert to map |
| removeBot | O(n) | Linear search for newest bot |
| dequeue | O(1) | Array shift operation |
| enqueue | O(1) | Array push operation |
| getStatus | O(n) | Iterates all orders/bots |

### Space Complexity

- Orders: O(n) where n = total orders created
- Bots: O(m) where m = total bots active
- Queue: O(p) where p = pending orders

### Scalability Considerations

**Current Implementation** (suitable for demo):
- In-memory storage
- Single-threaded processing
- Simple timeout-based scheduling

**Production Enhancements** (if scaling needed):
- Persistent storage (PostgreSQL, MongoDB)
- Message queue (Redis, RabbitMQ)
- Distributed bot management
- Horizontal scaling with load balancers
- Real-time websockets for status updates

---

## Summary

The McDonald's Order Management System demonstrates a clean, testable architecture with clear separation of concerns:

- **OrderController**: Central orchestrator
- **OrderQueue**: Priority-based order management
- **Order/Bot**: Self-managing entities
- **Logger**: Centralized event tracking

The system successfully implements all requirements:
- ✅ Unique, increasing order IDs
- ✅ VIP priority with FIFO
- ✅ Bot pool management
- ✅ 10-second processing simulation
- ✅ Dynamic bot addition/removal
- ✅ Comprehensive logging
- ✅ Robust edge case handling

The dual-queue architecture provides optimal performance while maintaining code clarity and maintainability.
