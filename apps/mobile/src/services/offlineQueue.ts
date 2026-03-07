interface QueuedCall {
  id: string;
  functionName: string;
  data: Record<string, unknown>;
  timestamp: number;
  retryCount: number;
}

const MAX_RETRIES = 3;

let memoryQueue: QueuedCall[] = [];

export function enqueueCall(functionName: string, data: Record<string, unknown>): void {
  const call: QueuedCall = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    functionName,
    data,
    timestamp: Date.now(),
    retryCount: 0,
  };
  memoryQueue.push(call);
}

export function getQueuedCalls(): QueuedCall[] {
  return [...memoryQueue];
}

export function removeFromQueue(id: string): void {
  memoryQueue = memoryQueue.filter((call) => call.id !== id);
}

export function clearQueue(): void {
  memoryQueue = [];
}

export function incrementRetry(id: string): boolean {
  const call = memoryQueue.find((c) => c.id === id);
  if (!call) return false;
  call.retryCount += 1;
  if (call.retryCount >= MAX_RETRIES) {
    removeFromQueue(id);
    return false; // Exceeded max retries
  }
  return true;
}

export function getQueueSize(): number {
  return memoryQueue.length;
}
