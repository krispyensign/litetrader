import { updatePair, calcProfit } from './calc'
import {
  Config,
  Connections,
  OrdersExchangeDriver,
  TickerExchangeDriver,
  TradeDatum,
} from './types'
import WebSocket = require('ws')
// import os = require('os')

export async function sleep(timems: number): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, timems))
}

function setBool(bool: Boolean, newVal: boolean): Boolean {
  bool.valueOf = (): boolean => newVal
  return bool
}

export function constructTickCallback(tradeDatum: TradeDatum, tick: TickerExchangeDriver) {
  return (x: WebSocket.MessageEvent): void => {
    return updatePair(tradeDatum.pairMap, tradeDatum.pairs, tick.parseTick(x.toLocaleString()))
  }
}

export function constructShutdownCallback(
  connections: Connections,
  tradeDatum: TradeDatum,
  isUnsubscribe: Boolean
) {
  return (): void => {
    // only run once
    if (isUnsubscribe.valueOf()) return
    setBool(isUnsubscribe, true)

    // unsubsribe from everything
    connections.tickws.send(JSON.stringify(tradeDatum.unSubRequest))

    // kill the connections ( will also kill detached threads and thus the app )
    connections.tickws.close()
    connections.orderws.close()
    console.log('shutdown complete')
  }
}

export function constructGraphCallback(
  initialAssetIndex: number,
  config: Config,
  tradeDatum: TradeDatum,
  isSending: Boolean,
  conns: Connections,
  order: OrdersExchangeDriver,
  token: string
) {
  return async (cycle: number[]): Promise<void> => {
    // calc profit, hopefully something good is found
    const result = calcProfit(
      initialAssetIndex,
      config.initialAmount,
      cycle,
      tradeDatum.assets,
      tradeDatum.pairs,
      tradeDatum.pairMap,
      config.eta,
      '0'
    )

    // if not just an amount and is a cycle then do stuff
    if (typeof result !== 'number') {
      if (isSending) {
        console.log('blocked send while already sending')
        return
      }
      setBool(isSending, true)
      console.time('send')
      const [amount, recipe] = result
      console.log(`amounts: ${config.initialAmount} -> ${amount}`)
      console.log(recipe.steps)
      for (const step of recipe.steps) {
        conns.orderws.send(order.createOrderRequest(token, step))
        await sleep(2)
      }
      console.timeEnd('send')
      setBool(isSending, false)
    }
  }
}
