// Irion chain-glue for Canton — replaces the old Soroban `lib/stellar.ts` +
// `lib/irion.ts` + `lib/prover.ts`. Every operation is a real Canton JSON
// Ledger API (v2) call. The wire formats here are exactly the ones proven by
// `irion-contracts-canton/scripts/e2e.mjs` against a live ledger.
//
// Architecture: this is the **operator-mediated backend** client (the cn-quickstart
// pattern). It is meant to run server-side (Next.js route handlers / server
// actions), where it holds the operator party and co-submits user actions —
// the Canton analogue of "the backend signs alongside the user". The browser
// never holds operator authority. There is no ZK prover anymore: a trusted
// issuer signs a `CreditAttestation`, and Canton's sub-transaction privacy keeps
// the borrower's financials off everyone else's ledger.

// ----------------------------------------------------------------- config

export interface CantonConfig {
  /** JSON Ledger API base, e.g. http://localhost:6864 */
  ledgerUrl: string;
  /** Daml package name reference, e.g. "irion-model" -> "#irion-model" */
  packageName: string;
  /** user id / application id used on submissions */
  userId: string;
  /** protocol operator party (the backend's party) */
  operator: string;
  /** trusted USDC issuer party */
  usdcIssuer: string;
  /** trusted credit-attestation issuer party */
  creditIssuer: string;
}

export function configFromEnv(env: Record<string, string | undefined>): CantonConfig {
  const need = (k: string) => {
    const v = env[k];
    if (!v) throw new Error(`missing env ${k}`);
    return v;
  };
  return {
    ledgerUrl: env.CANTON_JSON_API ?? 'http://localhost:6864',
    packageName: env.IRION_PACKAGE ?? 'irion-model',
    userId: env.CANTON_USER_ID ?? 'irion-core',
    operator: need('IRION_OPERATOR_PARTY'),
    usdcIssuer: need('IRION_USDC_ISSUER_PARTY'),
    creditIssuer: need('IRION_CREDIT_ISSUER_PARTY'),
  };
}

// ----------------------------------------------------------------- types

export type Party = string;
export type ContractId = string;

export interface ProfileView {
  contractId: ContractId;
  borrower: Party;
  creditLimit: string;
  outstanding: string;
  repaidTotal: string;
  repayments: string;
  score: string;
}

export interface PoolView {
  contractId: ContractId;
  totalShares: string;
  available: string;
  totalBorrowed: string;
}

export interface LoanView {
  contractId: ContractId;
  borrower: Party;
  merchant: Party;
  principal: string;
  principalRepaid: string;
  outstanding: string;
  collateral: string;
  status: 'Active' | 'Repaid' | 'Defaulted';
}

interface CreatedEvent {
  contractId: ContractId;
  templateId: string;
  createArgument: any;
}

// ----------------------------------------------------------------- client

export class CantonClient {
  private nonce = 0;
  constructor(private cfg: CantonConfig) {}

  private tid(module: string, entity: string) {
    return `#${this.cfg.packageName}:${module}:${entity}`;
  }
  private freshId(p: string) {
    return `${p}-${Date.now()}-${this.nonce++}`;
  }

  private async post(path: string, body: unknown): Promise<any> {
    const r = await fetch(this.cfg.ledgerUrl + path, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    const text = await r.text();
    const json = text ? JSON.parse(text) : {};
    if (!r.ok) throw new Error(`POST ${path} -> ${r.status}: ${text}`);
    return json;
  }
  private async get(path: string): Promise<any> {
    const r = await fetch(this.cfg.ledgerUrl + path);
    const text = await r.text();
    if (!r.ok) throw new Error(`GET ${path} -> ${r.status}: ${text}`);
    return text ? JSON.parse(text) : {};
  }

  async allocateParty(hint: string): Promise<Party> {
    const r = await this.post('/v2/parties', { partyIdHint: hint });
    return r.partyDetails.party;
  }

  /** Submit a command set; returns the transaction tree. */
  private async submit(actAs: Party[], commands: unknown[], readAs: Party[] = []): Promise<any> {
    return this.post('/v2/commands/submit-and-wait-for-transaction-tree', {
      commandId: this.freshId('cmd'),
      userId: this.cfg.userId,
      actAs,
      readAs,
      commands,
    });
  }

  private createCmd(templateId: string, createArguments: unknown) {
    return { CreateCommand: { templateId, createArguments } };
  }
  private exerciseCmd(templateId: string, contractId: ContractId, choice: string, choiceArgument: unknown = {}) {
    return { ExerciseCommand: { templateId, contractId, choice, choiceArgument } };
  }

  private createdEvents(tx: any): CreatedEvent[] {
    return Object.values(tx.transactionTree?.eventsById ?? {})
      .map((e: any) => e.CreatedTreeEvent?.value)
      .filter(Boolean) as CreatedEvent[];
  }
  private archived(tx: any): Set<ContractId> {
    return new Set(
      Object.values(tx.transactionTree?.eventsById ?? {})
        .map((e: any) => e.ExercisedTreeEvent?.value)
        .filter((v: any) => v && v.consuming)
        .map((v: any) => v.contractId),
    );
  }
  /** first still-live contract of `entity` created in `tx` matching `pred`. */
  private created(tx: any, entity: string, pred: (a: any) => boolean = () => true): CreatedEvent {
    const gone = this.archived(tx);
    const c = this.createdEvents(tx).find(
      (e) => e.templateId.endsWith(':' + entity) && !gone.has(e.contractId) && pred(e.createArgument),
    );
    if (!c) throw new Error(`expected a live created ${entity}`);
    return c;
  }

  /** snapshot a party's live contracts of a given entity. */
  async queryActive(party: Party, entity: string, pred: (a: any) => boolean = () => true): Promise<CreatedEvent[]> {
    const { offset } = await this.get('/v2/state/ledger-end');
    const res = await this.post('/v2/state/active-contracts', {
      filter: { filtersByParty: { [party]: { cumulative: [{ identifierFilter: { WildcardFilter: { value: { includeCreatedEventBlob: false } } } }] } } },
      verbose: false,
      activeAtOffset: offset,
    });
    return (res as any[])
      .map((e) => e.contractEntry?.JsActiveContract?.createdEvent)
      .filter((e: any) => e && e.templateId.endsWith(':' + entity) && pred(e.createArgument))
      .map((e: any) => ({ contractId: e.contractId, templateId: e.templateId, createArgument: e.createArgument }));
  }

  // -------- USDC token (real holdings, not balances) --------

  /** issuer mints USDC to a party (test faucet / distribution). */
  async mintUsdc(owner: Party, amount: string): Promise<ContractId> {
    const tx = await this.submit([this.cfg.usdcIssuer], [
      this.createCmd(this.tid('Irion.Token', 'Token'), { issuer: this.cfg.usdcIssuer, owner, amount }),
    ]);
    return this.created(tx, 'Token', (a) => a.owner === owner).contractId;
  }

  private async transfer(owner: Party, tokenCid: ContractId, newOwner: Party): Promise<ContractId> {
    const tx = await this.submit([owner], [this.exerciseCmd(this.tid('Irion.Token', 'Token'), tokenCid, 'Token_Transfer', { newOwner })]);
    return this.created(tx, 'Token', (a) => a.owner === newOwner).contractId;
  }

  async usdcBalance(party: Party): Promise<number> {
    const toks = await this.queryActive(party, 'Token', (a) => a.owner === party);
    return toks.reduce((s, t) => s + Number(t.createArgument.amount), 0);
  }
  /** an operator-custodied USDC holding covering `min`. */
  private async operatorToken(min: number): Promise<ContractId> {
    const toks = await this.queryActive(this.cfg.operator, 'Token', (a) => a.owner === this.cfg.operator && Number(a.amount) >= min);
    if (!toks.length) throw new Error('operator has no USDC holding large enough');
    return toks[0].contractId;
  }

  // -------- pool / profile reads --------

  async getPool(): Promise<PoolView> {
    const [p] = await this.queryActive(this.cfg.operator, 'LendingPool');
    if (!p) throw new Error('pool not initialised');
    return { contractId: p.contractId, ...p.createArgument };
  }
  async getProfile(borrower: Party): Promise<ProfileView | null> {
    const [p] = await this.queryActive(this.cfg.operator, 'CreditProfile', (a) => a.borrower === borrower);
    return p ? { contractId: p.contractId, ...p.createArgument } : null;
  }
  async getLoans(borrower: Party): Promise<LoanView[]> {
    const ls = await this.queryActive(this.cfg.operator, 'Loan', (a) => a.borrower === borrower);
    return ls.map((l) => ({ contractId: l.contractId, ...l.createArgument }));
  }

  // -------- protocol writes (operator-mediated) --------

  async initConfig(): Promise<ContractId> {
    const config = {
      usdcIssuer: this.cfg.usdcIssuer, creditIssuer: this.cfg.creditIssuer,
      borrowInterestRate: '0.05', uncollatPremiumRate: '0.05',
      starterLimit: '50.0', maxCreditLimit: '100000.0',
      repayRewardRate: '0.10', minScoreUncollat: '600', minimumLiquidity: '1.0',
    };
    const tx = await this.submit([this.cfg.operator], [this.createCmd(this.tid('Irion.Config', 'ProtocolConfig'), { operator: this.cfg.operator, config })]);
    return this.created(tx, 'ProtocolConfig').contractId;
  }

  async initPool(): Promise<ContractId> {
    const tx = await this.submit([this.cfg.operator], [
      this.createCmd(this.tid('Irion.Pool', 'LendingPool'), {
        operator: this.cfg.operator, usdcIssuer: this.cfg.usdcIssuer,
        totalShares: '0.0', available: '0.0', totalBorrowed: '0.0', minimumLiquidity: '1.0',
      }),
    ]);
    return this.created(tx, 'LendingPool').contractId;
  }

  async configCid(): Promise<ContractId> {
    const [c] = await this.queryActive(this.cfg.operator, 'ProtocolConfig');
    if (!c) throw new Error('ProtocolConfig not found');
    return c.contractId;
  }

  async openProfile(borrower: Party): Promise<ContractId> {
    const tx = await this.submit([this.cfg.operator], [
      this.createCmd(this.tid('Irion.Credit', 'CreditProfile'), {
        operator: this.cfg.operator, borrower,
        creditLimit: '50.0', outstanding: '0.0', repaidTotal: '0.0', repayments: '0', score: '0',
      }),
    ]);
    return this.created(tx, 'CreditProfile').contractId;
  }

  /** supplier deposits `amount` USDC and receives pool shares. */
  async supply(supplier: Party, amount: string, supplierTokenCid: ContractId): Promise<void> {
    const pool = await this.getPool();
    const escrowCid = await this.transfer(supplier, supplierTokenCid, this.cfg.operator);
    const reqTx = await this.submit([supplier], [
      this.createCmd(this.tid('Irion.Pool', 'SupplyRequest'), {
        operator: this.cfg.operator, supplier, usdcIssuer: this.cfg.usdcIssuer, amount, escrowCid,
      }),
    ]);
    const reqCid = this.created(reqTx, 'SupplyRequest').contractId;
    await this.submit([this.cfg.operator], [this.exerciseCmd(this.tid('Irion.Pool', 'SupplyRequest'), reqCid, 'SupplyRequest_Accept', { poolCid: pool.contractId })]);
  }

  /** borrower opens a "pay never" BNPL purchase; merchant is paid up front. */
  async openPurchase(borrower: Party, merchant: Party, amount: string, collateral: string, collateralTokenCid: ContractId, termSeconds = '86400'): Promise<ContractId> {
    const pool = await this.getPool();
    const profile = await this.getProfile(borrower);
    if (!profile) throw new Error('borrower has no credit profile');
    const collateralEscrowCid = await this.transfer(borrower, collateralTokenCid, this.cfg.operator);
    const reqTx = await this.submit([borrower], [
      this.createCmd(this.tid('Irion.Bnpl', 'BnplRequest'), { operator: this.cfg.operator, borrower, merchant, amount, collateral, collateralEscrowCid, termSeconds }),
    ]);
    const reqCid = this.created(reqTx, 'BnplRequest').contractId;
    const merchantFundTokenCid = await this.operatorToken(Number(amount));
    const tx = await this.submit([this.cfg.operator], [
      this.exerciseCmd(this.tid('Irion.Bnpl', 'BnplRequest'), reqCid, 'BnplRequest_Accept', {
        poolCid: pool.contractId, profileCid: profile.contractId, configCid: await this.configCid(), merchantFundTokenCid,
      }),
    ]);
    return this.created(tx, 'Loan').contractId;
  }

  /** borrower repays a loan (operator co-submits, mediated). */
  async repay(borrower: Party, loanCid: ContractId, amount: string, payTokenCid: ContractId): Promise<void> {
    const pool = await this.getPool();
    const profile = await this.getProfile(borrower);
    if (!profile) throw new Error('no profile');
    await this.submit([borrower, this.cfg.operator], [
      this.exerciseCmd(this.tid('Irion.Bnpl', 'Loan'), loanCid, 'Loan_Pay', {
        payer: borrower, payTokenCid, amount, poolCid: pool.contractId, profileCid: profile.contractId, configCid: await this.configCid(),
      }),
    ]);
  }

  async releaseCollateral(borrower: Party, loanCid: ContractId): Promise<ContractId> {
    const tx = await this.submit([borrower, this.cfg.operator], [this.exerciseCmd(this.tid('Irion.Bnpl', 'Loan'), loanCid, 'Loan_ReleaseCollateral')]);
    return this.created(tx, 'Token', (a) => a.owner === borrower).contractId;
  }

  /** issuer attestation — the ZK-proof replacement. The trusted credit issuer
   * signs a score/limit; the operator applies it to the profile. */
  async attestAndApply(borrower: Party, approvedLimit: string, score: string): Promise<void> {
    const profile = await this.getProfile(borrower);
    if (!profile) throw new Error('no profile');
    const attTx = await this.submit([this.cfg.creditIssuer], [
      this.createCmd(this.tid('Irion.Credit', 'CreditAttestation'), { creditIssuer: this.cfg.creditIssuer, operator: this.cfg.operator, borrower, approvedLimit, score }),
    ]);
    const attCid = this.created(attTx, 'CreditAttestation').contractId;
    await this.submit([this.cfg.operator], [
      this.exerciseCmd(this.tid('Irion.Credit', 'CreditAttestation'), attCid, 'Attestation_Apply', { configCid: await this.configCid(), profileCid: profile.contractId }),
    ]);
  }

  /** unsecured borrow against the attested credit line (gated on score >= 600). */
  async borrowUnsecured(borrower: Party, amount: string, termSeconds = '86400'): Promise<ContractId> {
    const pool = await this.getPool();
    const profile = await this.getProfile(borrower);
    if (!profile) throw new Error('no profile');
    const reqTx = await this.submit([borrower], [
      this.createCmd(this.tid('Irion.Bnpl', 'UnsecuredRequest'), { operator: this.cfg.operator, borrower, amount, termSeconds }),
    ]);
    const reqCid = this.created(reqTx, 'UnsecuredRequest').contractId;
    const disburseTokenCid = await this.operatorToken(Number(amount));
    const tx = await this.submit([this.cfg.operator], [
      this.exerciseCmd(this.tid('Irion.Bnpl', 'UnsecuredRequest'), reqCid, 'UnsecuredRequest_Accept', {
        poolCid: pool.contractId, profileCid: profile.contractId, configCid: await this.configCid(), disburseTokenCid,
      }),
    ]);
    return this.created(tx, 'Loan').contractId;
  }
}
