import { test } from "node:test"
import assert from "node:assert/strict"
import { buildBnplCommand, buildDirectCommand, buildRepayCommand, buildSupplyEscrowCommand, buildSupplyRequestCommand } from "./canton-pay.ts"

test("buildBnplCommand: UnsecuredRequest create command, decimal-formatted", () => {
  const cmd: any = buildBnplCommand({ operator: "op::1", borrower: "b::1", amount: 45 })
  assert.equal(cmd.CreateCommand.templateId, "#irion-model:Irion.Bnpl:UnsecuredRequest")
  const a = cmd.CreateCommand.createArguments
  assert.equal(a.operator, "op::1")
  assert.equal(a.borrower, "b::1")
  assert.equal(a.amount, "45.0")
  assert.equal(a.termSeconds, String(30 * 86400))
})

test("buildBnplCommand: keeps fractional amounts + custom term", () => {
  const a: any = buildBnplCommand({ operator: "o", borrower: "b", amount: 49.99, termDays: 7 }).CreateCommand.createArguments
  assert.equal(a.amount, "49.99")
  assert.equal(a.termSeconds, String(7 * 86400))
})

test("buildDirectCommand: a Token_Transfer to the merchant party", () => {
  const cmd: any = buildDirectCommand("tok#1", "merch::1")
  assert.equal(cmd.ExerciseCommand.templateId, "#irion-model:Irion.Token:Token")
  assert.equal(cmd.ExerciseCommand.contractId, "tok#1")
  assert.equal(cmd.ExerciseCommand.choice, "Token_Transfer")
  assert.equal(cmd.ExerciseCommand.choiceArgument.newOwner, "merch::1")
})

test("buildSupplyEscrowCommand: Token_Transfer escrowing to the operator", () => {
  const cmd: any = buildSupplyEscrowCommand("tok#9", "op::1")
  assert.equal(cmd.ExerciseCommand.templateId, "#irion-model:Irion.Token:Token")
  assert.equal(cmd.ExerciseCommand.contractId, "tok#9")
  assert.equal(cmd.ExerciseCommand.choice, "Token_Transfer")
  assert.equal(cmd.ExerciseCommand.choiceArgument.newOwner, "op::1")
})

test("buildSupplyRequestCommand: SupplyRequest create with decimal amount", () => {
  const cmd: any = buildSupplyRequestCommand({ operator: "op::1", supplier: "s::1", usdcIssuer: "iss::1", amount: 100, escrowCid: "esc#1" })
  assert.equal(cmd.CreateCommand.templateId, "#irion-model:Irion.Pool:SupplyRequest")
  const a = cmd.CreateCommand.createArguments
  assert.equal(a.operator, "op::1")
  assert.equal(a.supplier, "s::1")
  assert.equal(a.usdcIssuer, "iss::1")
  assert.equal(a.amount, "100.0")
  assert.equal(a.escrowCid, "esc#1")
})

test("buildRepayCommand: Loan_Pay carrying the repay context", () => {
  const ctx = { loanCid: "loan#1", payTokenCid: "tok#2", poolCid: "pool#1", profileCid: "prof#1", configCid: "cfg#1" }
  const cmd: any = buildRepayCommand("b::1", ctx, 20)
  assert.equal(cmd.ExerciseCommand.templateId, "#irion-model:Irion.Bnpl:Loan")
  assert.equal(cmd.ExerciseCommand.contractId, "loan#1")
  assert.equal(cmd.ExerciseCommand.choice, "Loan_Pay")
  const a = cmd.ExerciseCommand.choiceArgument
  assert.equal(a.payer, "b::1")
  assert.equal(a.payTokenCid, "tok#2")
  assert.equal(a.amount, "20.0")
  assert.equal(a.poolCid, "pool#1")
  assert.equal(a.profileCid, "prof#1")
  assert.equal(a.configCid, "cfg#1")
})
