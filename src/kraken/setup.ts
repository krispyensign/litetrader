const krakenWsUrl = 'wss://ws.kraken.com'

export const createStopRequest = (pairs: readonly string[]): string =>
  JSON.stringify({
    event: 'unsubscribe',
    pair: pairs,
    subscription: {
      name: 'ticker',
    },
  })

export const createTickSubRequest = (pairs: readonly string[]): string =>
  JSON.stringify({
    event: 'subscribe',
    pair: pairs,
    subscription: {
      name: 'ticker',
    },
  })

export const webSocketUrl = krakenWsUrl
