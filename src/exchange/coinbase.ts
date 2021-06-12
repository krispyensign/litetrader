/* eslint-disable @typescript-eslint/no-unused-vars */
import tls from 'tls'

const BeginString = '8=FIX.4.2'
const TargetComp = '56=Coinbase'
const SenderCompIDBase = '49='

const EncryptMethod = '98=0'
const HeartBtInt = '108=30'
const PasswordBase = '554='
const RawDataBase = '96='
const CancelOrdersOnDisconnect = '8013=Y'
const DropCopyFlag = '9406=Y'
let seqnum = 0

export const buildHeader = (key: string): [number, string] => [
  TargetComp.length + SenderCompIDBase.length + key.length,
  `${BeginString}|${SenderCompIDBase}${key}|${TargetComp}`,
]

export const buildLogon = (
  passphrase: string,
  signature: string,
  [headerLength, headerString]: [number, string]
): [number, string] => [
  headerLength +
    EncryptMethod.length +
    HeartBtInt.length +
    PasswordBase.length +
    passphrase.length +
    RawDataBase.length +
    signature.length +
    CancelOrdersOnDisconnect.length +
    DropCopyFlag.length,
  `${headerString}|
  ${EncryptMethod}|
  ${HeartBtInt}|
  ${PasswordBase}${passphrase}|
  ${RawDataBase}${signature}|
  ${CancelOrdersOnDisconnect}|
  ${DropCopyFlag}`,
]

export const sign = (key: string, passphrase: string): string =>
  [new Date(), 'Logon', seqnum, key, 'Coinbase', passphrase].join('\x01')

const sleep = (ms: number): Promise<unknown> => new Promise(resolve => setTimeout(resolve, ms))

export const getConnection = (): tls.TLSSocket => {
  seqnum++
  const conn = tls.connect(
    {
      host: 'fix-public.sandbox.pro.coinbase.com',
      port: 4198,
    },
    () => console.log('connected!') // send logon message here
  )
  while (conn.writable === false) sleep(10)

  // const msg = buildLogon(passphrase, sign)
  // conn.write(msg)
  return conn
}

export const dropConnection = (ws: unknown): tls.TLSSocket | undefined =>
  (ws as tls.TLSSocket).unref()
