import {
  API_SUCCESS_CODE,
  fetchJimiaigo,
  getApiUrl,
  getStoredChatToken,
} from './jimiaigoApi';

function getSSEUrl(token) {
  return getApiUrl('/api/user/sse', { token });
}

class SSEManager {
  constructor() {
    this.eventSource = null;
    this.isConnected = false;
    this.isConnecting = false;
    this.reconnectTimer = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 8;
    this.reconnectDelay = 5000;
    this.maxReconnectDelay = 30000;
    this.pollingTimer = null;
    this.pollingInterval = 30000;
    this.usePolling = false;
    this.lastEventId = null;
    this.messageHandlers = new Set();
  }

  connect() {
    if (this.isConnected || this.isConnecting) return;

    const token = getStoredChatToken();
    if (!token) {
      this.startPolling();
      return;
    }

    try {
      this.isConnecting = true;
      this.eventSource = new EventSource(getSSEUrl(token));

      this.eventSource.onopen = () => {
        this.isConnected = true;
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        this.usePolling = false;
        this.stopPolling();
        void this.pollEvents();
      };

      this.eventSource.onmessage = (event) => {
        if (!event?.data || event.data === 'ping' || event.data.trim() === '') return;
        try {
          const data = JSON.parse(event.data);
          if (data?.type === 'connected') return;
          if (event.lastEventId) this.lastEventId = event.lastEventId;
          this.dispatchMessage(data);
        } catch {
          this.dispatchMessage(event.data);
        }
      };

      this.eventSource.onerror = () => {
        this.isConnected = false;
        this.isConnecting = false;
        if (this.eventSource) {
          this.eventSource.close();
          this.eventSource = null;
        }
        this.scheduleReconnect();
      };
    } catch {
      this.isConnecting = false;
      this.scheduleReconnect();
    }
  }

  disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    this.isConnected = false;
    this.isConnecting = false;
    this.reconnectAttempts = 0;
    this.stopPolling();
  }

  onMessage(handler) {
    this.messageHandlers.add(handler);
    return () => {
      this.messageHandlers.delete(handler);
    };
  }

  async syncCachedEvents() {
    await this.pollEvents();
  }

  dispatchMessage(data) {
    this.messageHandlers.forEach((handler) => {
      try {
        handler(data);
      } catch (error) {
        console.error('SSE message handler error:', error);
      }
    });
  }

  scheduleReconnect() {
    if (this.reconnectTimer) return;
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.startPolling();
      return;
    }
    this.reconnectAttempts += 1;
    const delay = Math.min(
      this.reconnectDelay * 1.5 ** (this.reconnectAttempts - 1),
      this.maxReconnectDelay
    );
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }

  startPolling() {
    if (this.pollingTimer || this.isConnected) return;
    this.usePolling = true;
    void this.pollEvents();
    this.pollingTimer = setInterval(() => {
      void this.pollEvents();
    }, this.pollingInterval);
  }

  stopPolling() {
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
      this.pollingTimer = null;
    }
    this.usePolling = false;
  }

  async pollEvents() {
    const token = getStoredChatToken();
    if (!token) return;

    try {
      const { parsed } = await fetchJimiaigo('/api/user/events/poll', {
        token,
        query: { lastEventId: this.lastEventId || undefined },
      });

      if (Number(parsed?.code) !== API_SUCCESS_CODE) return;

      const events = Array.isArray(parsed?.data?.events) ? parsed.data.events : [];
      for (const event of events) {
        if (event?.id) this.lastEventId = event.id;
        if (event?.data != null) this.dispatchMessage(event.data);
      }

      if (this.usePolling && !this.isConnected && !this.isConnecting) {
        this.connect();
      }
    } catch (error) {
      console.error('SSE events poll error:', error);
    }
  }
}

export const sseManager = new SSEManager();
