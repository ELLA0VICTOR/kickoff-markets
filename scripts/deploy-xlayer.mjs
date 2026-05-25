#!/usr/bin/env node
import dns from 'node:dns'
import fs from 'node:fs'
import path from 'node:path'
import solc from 'solc'
import {
  createPublicClient,
  createWalletClient,
  defineChain,
  formatEther,
  http,
  parseAbi,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'

dns.setDefaultResultOrder('ipv4first')

const NETWORKS = {
  mainnet: {
    id: 196,
    name: 'X Layer Mainnet',
    explorer: 'https://www.okx.com/web3/explorer/xlayer',
    rpcUrls: ['https://rpc.xlayer.tech', 'https://xlayerrpc.okx.com'],
  },
  testnet: {
    id: 1952,
    name: 'X Layer Testnet',
    explorer: 'https://www.okx.com/web3/explorer/xlayer-test',
    rpcUrls: ['https://testrpc.xlayer.tech/terigon', 'https://xlayertestrpc.okx.com/terigon'],
  },
}

const MARKET_ADMIN_ABI = parseAbi([
  'function setClockOperator(address nextClockOperator)',
  'function setMatchClockHook(address nextHook)',
  'function setOracleAgent(address nextOracleAgent)',
])

const args = new Set(process.argv.slice(2))
const root = process.cwd()
const env = loadEnv(root)
const dryRun = args.has('--dry-run') || args.has('--dry')
const writeEnv = args.has('--write-env')
const deployToken = args.has('--deploy-token') || args.has('--token')
const skipHook = args.has('--skip-hook')
const skipOracle = args.has('--skip-oracle')
const networkId = env.VITE_X_LAYER_NETWORK?.trim().toLowerCase() === 'mainnet' ? 'mainnet' : 'testnet'
const network = NETWORKS[networkId]
const rpcUrl = env.X_LAYER_RPC_URL?.trim() || env.VITE_X_LAYER_RPC_URL?.trim() || network.rpcUrls[0]
const privateKey = cleanPrivateKey(env.X_LAYER_DEPLOYER_PRIVATE_KEY || env.DEPLOYER_PRIVATE_KEY)
const configuredCollateral = readArg('--collateral') || env.DEPLOY_COLLATERAL_TOKEN_ADDRESS || env.VITE_COLLATERAL_TOKEN_ADDRESS

function readArg(name) {
  const exact = process.argv.indexOf(name)
  if (exact >= 0) return process.argv[exact + 1]

  const prefix = `${name}=`
  const matched = process.argv.find((arg) => arg.startsWith(prefix))
  return matched ? matched.slice(prefix.length) : undefined
}

function loadEnv(basePath) {
  const output = { ...process.env }

  for (const fileName of ['.env', '.env.local']) {
    const filePath = path.join(basePath, fileName)
    if (!fs.existsSync(filePath)) continue

    const content = fs.readFileSync(filePath, 'utf8')
    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue

      const [key, ...rest] = trimmed.split('=')
      const rawValue = rest.join('=').trim()
      output[key.trim()] = rawValue.replace(/^["']|["']$/g, '')
    }
  }

  return output
}

function cleanPrivateKey(value) {
  if (!value) return undefined
  const trimmed = value.trim()
  const prefixed = trimmed.startsWith('0x') ? trimmed : `0x${trimmed}`
  if (!/^0x[a-fA-F0-9]{64}$/.test(prefixed)) {
    throw new Error('X_LAYER_DEPLOYER_PRIVATE_KEY must be a 32-byte hex private key.')
  }
  return prefixed
}

function isAddress(value) {
  return /^0x[a-fA-F0-9]{40}$/.test(value || '')
}

function shortHash(value) {
  return `${value.slice(0, 10)}...${value.slice(-8)}`
}

function compileContracts() {
  const files = [
    'contracts/KickoffMarkets.sol',
    'contracts/KickoffTestUSDC.sol',
    'contracts/MatchClockHook.sol',
    'contracts/MatchOracleAgent.sol',
  ]
  const input = {
    language: 'Solidity',
    sources: Object.fromEntries(files.map((file) => [file, { content: fs.readFileSync(path.join(root, file), 'utf8') }])),
    settings: {
      optimizer: { enabled: true, runs: 200 },
      viaIR: true,
      outputSelection: {
        '*': {
          '*': ['abi', 'evm.bytecode.object'],
        },
      },
    },
  }
  const output = JSON.parse(solc.compile(JSON.stringify(input)))
  const errors = output.errors?.filter((entry) => entry.severity === 'error') || []
  const warnings = output.errors?.filter((entry) => entry.severity === 'warning') || []

  for (const warning of warnings) {
    console.warn(warning.formattedMessage || warning.message)
  }

  if (errors.length > 0) {
    for (const error of errors) console.error(error.formattedMessage || error.message)
    throw new Error(`Solidity compilation failed with ${errors.length} error(s).`)
  }

  function artifact(file, contractName) {
    const contract = output.contracts?.[file]?.[contractName]
    if (!contract?.abi || !contract?.evm?.bytecode?.object) {
      throw new Error(`Missing compiled artifact for ${contractName}.`)
    }

    return {
      abi: contract.abi,
      bytecode: `0x${contract.evm.bytecode.object}`,
    }
  }

  return {
    KickoffMarkets: artifact('contracts/KickoffMarkets.sol', 'KickoffMarkets'),
    KickoffTestUSDC: artifact('contracts/KickoffTestUSDC.sol', 'KickoffTestUSDC'),
    MatchClockHook: artifact('contracts/MatchClockHook.sol', 'MatchClockHook'),
    MatchOracleAgent: artifact('contracts/MatchOracleAgent.sol', 'MatchOracleAgent'),
  }
}

function createClients() {
  if (!privateKey) {
    throw new Error('Set X_LAYER_DEPLOYER_PRIVATE_KEY in .env before deploying from the terminal.')
  }

  const account = privateKeyToAccount(privateKey)
  const chain = defineChain({
    id: network.id,
    name: network.name,
    nativeCurrency: { name: 'OKB', symbol: 'OKB', decimals: 18 },
    rpcUrls: {
      default: { http: [rpcUrl] },
    },
    blockExplorers: {
      default: { name: 'OKX Explorer', url: network.explorer },
    },
  })
  const transport = http(rpcUrl)

  return {
    account,
    publicClient: createPublicClient({ chain, transport }),
    walletClient: createWalletClient({ account, chain, transport }),
  }
}

async function deployContract({ publicClient, walletClient, account }, name, artifact, constructorArgs = []) {
  console.log(`Deploying ${name}...`)
  const hash = await walletClient.deployContract({
    abi: artifact.abi,
    bytecode: artifact.bytecode,
    args: constructorArgs,
    account,
  })
  console.log(`  tx ${shortHash(hash)}`)

  const receipt = await publicClient.waitForTransactionReceipt({ hash })
  if (receipt.status !== 'success' || !receipt.contractAddress) {
    throw new Error(`${name} deployment failed: ${hash}`)
  }

  console.log(`  address ${receipt.contractAddress}`)
  return {
    address: receipt.contractAddress,
    txHash: hash,
  }
}

async function writeMarketAdmin({ publicClient, walletClient, account }, marketsAddress, functionName, argsForCall) {
  console.log(`Calling KickoffMarkets.${functionName}...`)
  const hash = await walletClient.writeContract({
    address: marketsAddress,
    abi: MARKET_ADMIN_ABI,
    functionName,
    args: argsForCall,
    account,
  })
  console.log(`  tx ${shortHash(hash)}`)

  const receipt = await publicClient.waitForTransactionReceipt({ hash })
  if (receipt.status !== 'success') throw new Error(`${functionName} failed: ${hash}`)
  return hash
}

function upsertEnvValues(values) {
  const envPath = path.join(root, '.env')
  const existing = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : ''
  const lines = existing.split(/\r?\n/)
  const seen = new Set()
  const next = lines.map((line) => {
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=/)
    if (!match) return line

    const key = match[1]
    if (!(key in values)) return line

    seen.add(key)
    return `${key}=${values[key]}`
  })

  for (const [key, value] of Object.entries(values)) {
    if (!seen.has(key)) next.push(`${key}=${value}`)
  }

  fs.writeFileSync(envPath, `${next.join('\n').replace(/\n+$/g, '')}\n`)
}

function writeDeploymentFile(summary) {
  const outputDir = path.join(root, 'deployments')
  fs.mkdirSync(outputDir, { recursive: true })
  const outputPath = path.join(outputDir, `${networkId}-latest.json`)
  fs.writeFileSync(outputPath, `${JSON.stringify(summary, null, 2)}\n`)
  return outputPath
}

async function main() {
  console.log('Kickoff Markets X Layer deployer')
  console.log(`Network: ${network.name}`)
  console.log(`RPC: ${rpcUrl}`)
  console.log(`Mode: ${dryRun ? 'dry run' : 'deploy'}`)
  console.log('')

  const artifacts = compileContracts()
  console.log('Solidity compile OK.')

  if (dryRun) {
    console.log('Dry run complete. No transactions were sent.')
    return
  }

  const clients = createClients()
  const balance = await clients.publicClient.getBalance({ address: clients.account.address })
  const operatorAddress = readArg('--operator') || env.X_LAYER_OPERATOR_ADDRESS || env.ORACLE_OPERATOR_ADDRESS || clients.account.address

  if (!isAddress(operatorAddress)) {
    throw new Error('Set X_LAYER_OPERATOR_ADDRESS to a valid wallet address, or omit it to use the deployer wallet.')
  }

  if (!deployToken && !isAddress(configuredCollateral)) {
    throw new Error('Set VITE_COLLATERAL_TOKEN_ADDRESS/DEPLOY_COLLATERAL_TOKEN_ADDRESS, or pass --deploy-token.')
  }

  console.log(`Deployer: ${clients.account.address}`)
  console.log(`Balance: ${formatEther(balance)} OKB`)
  console.log(`Operator: ${operatorAddress}`)
  console.log('')

  const deployed = {}
  const token = deployToken
    ? await deployContract(clients, 'KickoffTestUSDC', artifacts.KickoffTestUSDC)
    : { address: configuredCollateral, txHash: undefined, reused: true }

  if (token.reused) console.log(`Reusing collateral token ${token.address}`)
  deployed.KickoffTestUSDC = token

  const markets = await deployContract(clients, 'KickoffMarkets', artifacts.KickoffMarkets, [token.address])
  deployed.KickoffMarkets = markets

  if (!skipHook) {
    const hook = await deployContract(clients, 'MatchClockHook', artifacts.MatchClockHook, [markets.address])
    deployed.MatchClockHook = hook
    hook.linkTxHash = await writeMarketAdmin(clients, markets.address, 'setMatchClockHook', [hook.address])
  }

  if (!skipOracle) {
    const oracle = await deployContract(clients, 'MatchOracleAgent', artifacts.MatchOracleAgent, [markets.address, operatorAddress])
    deployed.MatchOracleAgent = oracle
    oracle.linkTxHash = await writeMarketAdmin(clients, markets.address, 'setOracleAgent', [oracle.address])
  }

  deployed.clockOperatorTxHash = await writeMarketAdmin(clients, markets.address, 'setClockOperator', [operatorAddress])

  const summary = {
    network: network.name,
    chainId: network.id,
    rpcUrl,
    deployedAt: new Date().toISOString(),
    deployer: clients.account.address,
    operator: operatorAddress,
    contracts: deployed,
  }
  const outputPath = writeDeploymentFile(summary)

  if (writeEnv) {
    upsertEnvValues({
      VITE_X_LAYER_NETWORK: networkId,
      VITE_COLLATERAL_TOKEN_ADDRESS: token.address,
      VITE_KICKOFF_MARKETS_ADDRESS: markets.address,
      VITE_MATCH_CLOCK_HOOK_ADDRESS: deployed.MatchClockHook?.address || '',
      VITE_MATCH_ORACLE_AGENT_ADDRESS: deployed.MatchOracleAgent?.address || '',
      X_LAYER_OPERATOR_ADDRESS: operatorAddress,
    })
  }

  console.log('')
  console.log('Deployment complete')
  console.log(`KickoffTestUSDC: ${token.address}${token.reused ? ' (reused)' : ''}`)
  console.log(`KickoffMarkets: ${markets.address}`)
  if (deployed.MatchClockHook) console.log(`MatchClockHook: ${deployed.MatchClockHook.address}`)
  if (deployed.MatchOracleAgent) console.log(`MatchOracleAgent: ${deployed.MatchOracleAgent.address}`)
  console.log(`Clock operator: ${operatorAddress}`)
  console.log(`Deployment record: ${outputPath}`)
  if (writeEnv) console.log('.env updated with new public contract addresses.')
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
