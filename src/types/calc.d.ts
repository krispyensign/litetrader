type Steps = Step[] | Error | 0

type ValidatedSteps = Step[]

type StepSnapshot =
  | {
      steps: ValidatedSteps
      pair: IndexedPair
      index: number
      amount: number
    }
  | Error
  | 0

type Step = {
  orderCreateRequest: OrderCreateRequest
  index: number
  newAmount: number
  price?: number
  fee?: number
}

type StepMaterial = {
  index: number
  pair: IndexedPair
  amount: number
  eta: number
}
