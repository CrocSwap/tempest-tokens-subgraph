import { BigInt, BigDecimal, Address } from "@graphprotocol/graph-ts"
import {
  Transfer as TransferEvent,
  ERC20 as ERC20Contract
} from "../generated/ERC20/ERC20"
import { Token, Account, Balance, BalanceUpdate } from "../generated/schema"

function getOrCreateToken(address: string): Token {
  let token = Token.load(address)
  
  if (!token) {
    token = new Token(address)
    let contract = ERC20Contract.bind(Address.fromString(address))
    
    token.symbol = contract.symbol()
    token.name = contract.name()
    token.decimals = contract.decimals()
    token.totalSupply = contract.totalSupply().toBigDecimal()
    token.address = address
    token.save()
  }
  
  return token as Token
}

function getOrCreateAccount(address: string): Account {
  let account = Account.load(address)
  
  if (!account) {
    account = new Account(address)
    account.address = address
    account.save()
  }
  
  return account as Account
}

function getOrCreateBalance(account: Account, token: Token, block: BigInt, timestamp: BigInt): Balance {
  let id = account.id + "-" + token.id
  let balance = Balance.load(id)
  
  if (!balance) {
    balance = new Balance(id)
    balance.account = account.id
    balance.token = token.id
    balance.amount = BigDecimal.fromString("0")
    balance.blockNumber = block
    balance.timestamp = timestamp
    balance.save()
  }
  
  return balance as Balance
}

function insertBalanceUpdate(account: Account, token: Token, amount: BigDecimal, block: BigInt, timestamp: BigInt): BalanceUpdate {
    let id = account.id + "-" + token.id + "-" + block.toString()

    let balance = new BalanceUpdate(id)
    balance.account = account.address
    balance.token = token.address
    balance.amount = amount
    balance.blockNumber = block
    balance.timestamp = timestamp
    balance.save()

    return balance as BalanceUpdate
}

export function handleTransfer(event: TransferEvent): void {
  let tokenAddress = event.address.toHexString()
  
  let token = getOrCreateToken(tokenAddress)
  let decimals = BigInt.fromI32(token.decimals)
  let amount = event.params.value.toBigDecimal().div(BigInt.fromI32(10).pow(u8(decimals.toI32())).toBigDecimal())

  // Handle sender balance
  if (event.params.from.toHexString() != "0x0000000000000000000000000000000000000000") {
    let fromAccount = getOrCreateAccount(event.params.from.toHexString())
    let fromBalance = getOrCreateBalance(fromAccount, token, event.block.number, event.block.timestamp)
    fromBalance.amount = fromBalance.amount.minus(amount)
    fromBalance.blockNumber = event.block.number
    fromBalance.timestamp = event.block.timestamp
    fromBalance.save()
    insertBalanceUpdate(fromAccount, token, fromBalance.amount, event.block.number, event.block.timestamp)
  }
  
  // Handle receiver balance
  if (event.params.to.toHexString() != "0x0000000000000000000000000000000000000000") {
    let toAccount = getOrCreateAccount(event.params.to.toHexString())
    let toBalance = getOrCreateBalance(toAccount, token, event.block.number, event.block.timestamp)
    toBalance.amount = toBalance.amount.plus(amount)
    toBalance.blockNumber = event.block.number
    toBalance.timestamp = event.block.timestamp
    toBalance.save()
    insertBalanceUpdate(toAccount, token, toBalance.amount, event.block.number, event.block.timestamp)
  }

}
