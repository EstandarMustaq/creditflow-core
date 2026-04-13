import { useEffect, useMemo, useState, useTransition } from 'react';
import type { ComponentType, ReactNode } from 'react';
import {
  Activity,
  BellRing,
  BrainCircuit,
  Building2,
  CircleAlert,
  Clock3,
  Command,
  Download,
  Landmark,
  LayoutDashboard,
  ReceiptText,
  Search,
  ShieldCheck,
  Sparkles,
  UserPlus,
  WalletCards,
} from 'lucide-react';
import {
  createClient,
  createLoan,
  createPayment,
  getClientStatement,
  getClients,
  getHealth,
  getLoanBalance,
  getPortfolio,
  login,
  register,
  sendReminders,
  triggerAiAnalysis,
} from './lib/api';
import { formatDate, formatMoney } from './lib/format';
import type {
  AiAnalysisResponse,
  AuthResponse,
  ClientListResponse,
  ClientStatementResponse,
  HealthResponse,
  LoanBalanceResponse,
  PortfolioOverview,
  ReminderSweepResponse,
} from './lib/types';

const tokenStorageKey = 'corebank_token';
const routes = ['overview', 'portfolio', 'collections', 'intelligence', 'ops'] as const;
type RouteKey = (typeof routes)[number];

type ClientPortfolioRecord = {
  id: string;
  name: string;
  phone: string;
  email?: string | null;
  summary: ClientStatementResponse['summary'];
  loans: LoanBalanceResponse[];
};

type CollectionItem = {
  clientId: string;
  clientName: string;
  loanId: string;
  status: string;
  outstandingBalance: number;
  longestDelayDays: number;
  installmentsOverdue: number;
  nextDueDate: string | null;
  sla: 'today' | 'urgent' | 'watch';
};

function readStoredToken() {
  return window.localStorage.getItem(tokenStorageKey) ?? '';
}

function writeStoredToken(token: string) {
  if (token) {
    window.localStorage.setItem(tokenStorageKey, token);
    return;
  }

  window.localStorage.removeItem(tokenStorageKey);
}

function normalizeRoute(hash: string): RouteKey {
  const route = hash.replace(/^#\/?/, '');
  return routes.includes(route as RouteKey) ? (route as RouteKey) : 'overview';
}

function useHashRoute() {
  const [route, setRoute] = useState<RouteKey>(() => normalizeRoute(window.location.hash));

  useEffect(() => {
    const onHashChange = () => setRoute(normalizeRoute(window.location.hash));
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  function navigate(nextRoute: RouteKey) {
    window.location.hash = `/${nextRoute}`;
  }

  return { route, navigate };
}

export default function App() {
  const { route, navigate } = useHashRoute();
  const [token, setToken] = useState(readStoredToken);
  const [authResult, setAuthResult] = useState<AuthResponse | null>(null);
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [portfolio, setPortfolio] = useState<PortfolioOverview | null>(null);
  const [clients, setClients] = useState<ClientListResponse['items']>([]);
  const [clientPortfolios, setClientPortfolios] = useState<ClientPortfolioRecord[]>([]);
  const [selectedClientId, setSelectedClientId] = useState('');
  const [selectedLoanId, setSelectedLoanId] = useState('');
  const [loanBalance, setLoanBalance] = useState<LoanBalanceResponse | null>(null);
  const [reminderResult, setReminderResult] = useState<ReminderSweepResponse | null>(null);
  const [aiResult, setAiResult] = useState<AiAnalysisResponse | null>(null);
  const [isPending, startTransition] = useTransition();

  const [portfolioFilters, setPortfolioFilters] = useState({
    search: '',
    status: 'ALL',
    minOutstanding: '',
  });
  const [collectionFilter, setCollectionFilter] = useState<'ALL' | 'today' | 'urgent' | 'watch'>(
    'ALL',
  );
  const [loginForm, setLoginForm] = useState({
    name: 'Gestor CoreBank',
    email: 'gestor@managercorebank.co.mz',
    password: 'StrongPass123!',
    role: 'MANAGER',
  });
  const [clientForm, setClientForm] = useState({
    name: 'Amina Muianga',
    nuib: '123456789012345',
    phone: '842345678',
    email: 'amina.muianga@gmail.com',
    nationalId: '100123456789A',
    address: 'Av. de Mocambique, Matola',
  });
  const [loanForm, setLoanForm] = useState({
    principal: 32000,
    annualInterestRate: 17,
    installmentCount: 10,
    startDate: new Date().toISOString().slice(0, 10),
    graceDays: 0,
    lateFeeRateDaily: 0.01,
    currency: 'MZN',
  });
  const [paymentForm, setPaymentForm] = useState({
    amount: 3200,
    paidAt: new Date().toISOString().slice(0, 10),
    reference: 'field-agent',
  });
  const [aiNotes, setAiNotes] = useState(
    'Cliente sinaliza quebra temporária de renda e quer manter relacionamento com a agência.',
  );

  useEffect(() => {
    getHealth()
      .then(setHealth)
      .catch(() => {
        setHealth({
          ok: false,
          uptime: 0,
          timestamp: new Date().toISOString(),
          api: { active: false, state: 'offline' },
          worker: { active: false, state: 'offline', lastHeartbeatAt: null, staleMs: null },
        });
      });
  }, []);

  useEffect(() => {
    if (!token) {
      setPortfolio(null);
      setClients([]);
      setClientPortfolios([]);
      setLoanBalance(null);
      return;
    }

    void refreshData(token);
  }, [token]);

  useEffect(() => {
    const selectedClient = clientPortfolios.find((item) => item.id === selectedClientId);
    if (!selectedClient) {
      return;
    }

    const firstLoanId = selectedClient.loans[0]?.loan.id ?? '';
    setSelectedLoanId((current) => current || firstLoanId);
  }, [clientPortfolios, selectedClientId]);

  useEffect(() => {
    if (!token || !selectedLoanId) {
      return;
    }

    startTransition(() => {
      getLoanBalance(token, selectedLoanId)
        .then(setLoanBalance)
        .catch((error: Error) => setFeedback(error.message));
    });
  }, [selectedLoanId, token]);

  const selectedClient = useMemo(
    () => clientPortfolios.find((item) => item.id === selectedClientId) ?? null,
    [clientPortfolios, selectedClientId],
  );

  const portfolioRows = useMemo(() => {
    return clientPortfolios.flatMap((client) =>
      client.loans.map((loan) => ({
        clientId: client.id,
        clientName: client.name,
        phone: client.phone ?? '',
        loanId: loan.loan.id,
        status: loan.summary.status,
        outstandingBalance: loan.summary.outstandingBalance,
        totalPaid: loan.summary.totalPaid,
        longestDelayDays: loan.summary.longestDelayDays,
        installmentsOverdue: loan.summary.installmentsOverdue,
      })),
    );
  }, [clientPortfolios]);

  const filteredPortfolioRows = useMemo(() => {
    return portfolioRows.filter((row) => {
      const matchesSearch =
        !portfolioFilters.search ||
        row.clientName.toLowerCase().includes(portfolioFilters.search.toLowerCase()) ||
        row.loanId.toLowerCase().includes(portfolioFilters.search.toLowerCase()) ||
        row.phone.includes(portfolioFilters.search);
      const matchesStatus =
        portfolioFilters.status === 'ALL' || row.status === portfolioFilters.status;
      const minOutstanding = Number(portfolioFilters.minOutstanding || '0');
      const matchesOutstanding = row.outstandingBalance >= minOutstanding;
      return matchesSearch && matchesStatus && matchesOutstanding;
    });
  }, [portfolioFilters, portfolioRows]);

  const collectionRows = useMemo<CollectionItem[]>(() => {
    return clientPortfolios.flatMap((client) =>
      client.loans.map((loan) => {
        const nextDue = loan.schedule.find((item) => item.status !== 'PAID');
        const status = loan.summary.status;
        const sla: CollectionItem['sla'] =
          status === 'DELINQUENT' ? 'urgent' : status === 'AT_RISK' ? 'today' : 'watch';

        return {
          clientId: client.id,
          clientName: client.name,
          loanId: loan.loan.id,
          status,
          outstandingBalance: loan.summary.outstandingBalance,
          longestDelayDays: loan.summary.longestDelayDays,
          installmentsOverdue: loan.summary.installmentsOverdue,
          nextDueDate: nextDue?.dueDate ?? null,
          sla,
        };
      }),
    );
  }, [clientPortfolios]);

  const filteredCollections = useMemo(() => {
    return collectionRows
      .filter((row) => collectionFilter === 'ALL' || row.sla === collectionFilter)
      .sort((left, right) => {
        const slaWeight = { urgent: 3, today: 2, watch: 1 };
        if (slaWeight[right.sla] !== slaWeight[left.sla]) {
          return slaWeight[right.sla] - slaWeight[left.sla];
        }
        return right.longestDelayDays - left.longestDelayDays;
      });
  }, [collectionFilter, collectionRows]);

  const riskSummary = useMemo(() => {
    return {
      atRisk: collectionRows.filter((row) => row.sla === 'today').length,
      delinquent: collectionRows.filter((row) => row.sla === 'urgent').length,
      watch: collectionRows.filter((row) => row.sla === 'watch').length,
    };
  }, [collectionRows]);

  const workerStatus = health?.worker.active ? 'ativo' : 'inativo';
  const sessionStatus = token ? 'ativo' : 'inativo';

  async function refreshData(activeToken: string) {
    try {
      const [portfolioResult, clientList] = await Promise.all([
        getPortfolio(activeToken),
        getClients(activeToken),
      ]);
      setPortfolio(portfolioResult);
      setClients(clientList.items);

      const statements = await Promise.all(
        clientList.items.map(async (client) => {
          const statement = await getClientStatement(activeToken, client.id);
          return {
            id: client.id,
            name: client.name,
            phone: client.phone ?? '',
            email: client.email ?? null,
            summary: statement.summary,
            loans: statement.loans,
          } satisfies ClientPortfolioRecord;
        }),
      );

      setClientPortfolios(statements);
      if (!selectedClientId && statements[0]?.id) {
        setSelectedClientId(statements[0].id);
      }
    } catch (error) {
      setFeedback((error as Error).message);
    }
  }

  async function handleRegister() {
    try {
      const result = await register(loginForm);
      setAuthResult(result);
      setToken(result.token);
      writeStoredToken(result.token);
      setFeedback('Perfil criado.');
    } catch (error) {
      setFeedback((error as Error).message);
    }
  }

  async function handleLogin() {
    try {
      const result = await login(loginForm.email, loginForm.password);
      setAuthResult(result);
      setToken(result.token);
      writeStoredToken(result.token);
      setFeedback('Ligado ao core.');
    } catch (error) {
      setFeedback((error as Error).message);
    }
  }

  async function handleCreateClient() {
    if (!token) return;
    try {
      await createClient(token, clientForm);
      setFeedback('Cliente criado.');
      await refreshData(token);
    } catch (error) {
      setFeedback((error as Error).message);
    }
  }

  async function handleCreateLoan() {
    if (!token || !selectedClientId) return;
    try {
      const result = (await createLoan(token, {
        clientId: selectedClientId,
        ...loanForm,
      })) as LoanBalanceResponse;
      setSelectedLoanId(result.loan.id);
      setFeedback('Contrato emitido.');
      await refreshData(token);
      setLoanBalance(result);
    } catch (error) {
      setFeedback((error as Error).message);
    }
  }

  async function handleCreatePayment() {
    if (!token || !selectedLoanId) return;
    try {
      await createPayment(token, { loanId: selectedLoanId, ...paymentForm });
      setFeedback('Pagamento lançado.');
      await refreshData(token);
      const freshLoan = await getLoanBalance(token, selectedLoanId);
      setLoanBalance(freshLoan);
    } catch (error) {
      setFeedback((error as Error).message);
    }
  }

  async function handleReminderSweep(dryRun: boolean) {
    if (!token) return;
    try {
      const result = await sendReminders(token, { overdueThresholdDays: 3, dryRun });
      setReminderResult(result);
      setFeedback(
        dryRun ? `Prévia: ${result.count} lembrete(s).` : `${result.count} lembrete(s) enviados.`,
      );
    } catch (error) {
      setFeedback((error as Error).message);
    }
  }

  async function handleAiAnalysis() {
    if (!token || !selectedLoanId) return;
    try {
      const result = await triggerAiAnalysis(token, { loanId: selectedLoanId, notes: aiNotes });
      setAiResult(result);
      setFeedback('Playbook gerado.');
    } catch (error) {
      setFeedback((error as Error).message);
    }
  }

  function handleExportReport() {
    window.print();
  }

  function logout() {
    setToken('');
    setAuthResult(null);
    setPortfolio(null);
    setClients([]);
    setClientPortfolios([]);
    setSelectedClientId('');
    setSelectedLoanId('');
    setLoanBalance(null);
    setReminderResult(null);
    setAiResult(null);
    writeStoredToken('');
    setFeedback('Sessão encerrada.');
  }

  return (
    <div className="min-h-screen bg-lattice text-ink">
      <div className="mx-auto flex min-h-screen max-w-[1680px] gap-4 px-3 py-4 lg:px-5">
        <aside className="sticky top-2 hidden h-[calc(100vh-2rem)] w-[250px] shrink-0 self-start rounded-[1.8rem] border border-white/60 bg-ink p-4 text-pearl shadow-soft lg:flex lg:flex-col">
          <div className="rounded-2xl bg-white/8 p-4">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-[11px] uppercase tracking-[0.22em] text-sand">
              <ShieldCheck className="h-3.5 w-3.5" />
              CoreBank
            </div>
            <h1 className="mt-4 text-2xl font-bold leading-tight">Painel Administrativo</h1>
            <p className="mt-2 text-sm leading-6 text-sand/85">Registro e Controle de clientes.</p>
          </div>

          <nav className="mt-0 space-y-2">
            <NavItem
              route={route}
              target="overview"
              icon={LayoutDashboard}
              label="Resumo"
              onClick={navigate}
            />
            <NavItem
              route={route}
              target="portfolio"
              icon={Landmark}
              label="Carteira"
              onClick={navigate}
            />
            <NavItem
              route={route}
              target="collections"
              icon={BellRing}
              label="Cobrança"
              onClick={navigate}
            />
            <NavItem
              route={route}
              target="intelligence"
              icon={BrainCircuit}
              label="IA"
              onClick={navigate}
            />
            <NavItem route={route} target="ops" icon={Command} label="Ops" onClick={navigate} />
          </nav>

          <div className="mt-1 pt-4 rounded-[1.6rem] border border-white/10 bg-white/6 p-2">
            <div className="rounded-2xl bg-white/8 p-4 text-sm">
              <StatusMiniStat
                label="API"
                value={health?.api.active ? 'online' : 'offline'}
                active={Boolean(health?.api.active)}
              />
              <StatusMiniStat label="Sessão" value={sessionStatus} active={Boolean(token)} />
              <StatusMiniStat
                label="Worker"
                value={workerStatus}
                active={workerStatus === 'ativo'}
              />
              {authResult?.user ? (
                <div className="mt-3 rounded-xl bg-white/10 p-3 text-xs uppercase tracking-[0.18em] text-sand">
                  {authResult.user.role}
                </div>
              ) : null}
            </div>
          </div>
        </aside>

        <main className="min-w-0 flex-1 space-y-4">
          <section className="rounded-[1.8rem] border border-ink/10 bg-white/75 p-4 shadow-soft backdrop-blur">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="text-[11px] uppercase tracking-[0.22em] text-ember">
                  CoreBank Office
                </div>
                <h2 className="mt-2 text-2xl font-bold">
                  Originação, carteira, cobrança, lembretes com AICoreBank.
                </h2>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white"
                  onClick={handleLogin}
                  type="button"
                >
                  Entrar
                </button>
                <button
                  className="rounded-full border border-ink/15 bg-white px-4 py-2 text-sm font-semibold"
                  onClick={handleRegister}
                  type="button"
                >
                  Criar gestor
                </button>
                <button
                  className="rounded-full border border-ink/15 bg-white px-4 py-2 text-sm font-semibold"
                  onClick={logout}
                  type="button"
                >
                  Sair
                </button>
              </div>
            </div>
            {feedback ? <Banner text={feedback} /> : null}
          </section>

          <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <MetricCard
              label="Principal"
              value={portfolio ? formatMoney(portfolio.totalPrincipal) : '...'}
              icon={Building2}
            />
            <MetricCard
              label="Aberto"
              value={portfolio ? formatMoney(portfolio.totalOutstanding) : '...'}
              icon={WalletCards}
            />
            <MetricCard
              label="Mora"
              value={portfolio ? formatMoney(portfolio.totalLateFees) : '...'}
              icon={Clock3}
            />
            <MetricCard label="Hoje" value={String(riskSummary.atRisk)} icon={CircleAlert} />
            <MetricCard label="Urgente" value={String(riskSummary.delinquent)} icon={ReceiptText} />
          </section>

          {route === 'overview' ? (
            <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
              <Panel title="Onboarding" subtitle="Entrar, vender, operar.">
                <div className="grid gap-3 md:grid-cols-2">
                  <Input
                    label="Nome"
                    value={loginForm.name}
                    onChange={(value) => setLoginForm((current) => ({ ...current, name: value }))}
                  />
                  <Select
                    label="Perfil"
                    value={loginForm.role}
                    onChange={(value) => setLoginForm((current) => ({ ...current, role: value }))}
                    options={['ADMIN', 'MANAGER', 'OFFICER']}
                  />
                  <Input
                    label="Email"
                    value={loginForm.email}
                    onChange={(value) => setLoginForm((current) => ({ ...current, email: value }))}
                  />
                  <Input
                    label="Password"
                    type="password"
                    value={loginForm.password}
                    onChange={(value) =>
                      setLoginForm((current) => ({ ...current, password: value }))
                    }
                  />
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white"
                    onClick={handleLogin}
                    type="button"
                  >
                    Entrar
                  </button>
                  <button
                    className="rounded-full border border-ink/15 bg-white px-4 py-2 text-sm font-semibold"
                    onClick={handleRegister}
                    type="button"
                  >
                    Criar acesso
                  </button>
                  <button
                    className="rounded-full border border-ink/15 bg-white px-4 py-2 text-sm font-semibold"
                    onClick={handleExportReport}
                    type="button"
                  >
                    <span className="inline-flex items-center gap-2">
                      <Download className="h-4 w-4" />
                      Exportar
                    </span>
                  </button>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <CompactTile
                    icon={Sparkles}
                    title="Vende melhor"
                    text="Com contratos flexíveis, carteiras criadas rapidamente e gestão centralizada."
                  />
                  <CompactTile
                    icon={Activity}
                    title="Cobra melhor"
                    text="SLA, atraso, mora e reminders agendados com desparo automático."
                  />
                  <CompactTile
                    icon={BrainCircuit}
                    title="Operando com IA"
                    text="A IA sugere ação, resume historico do cliente e analisa riscos."
                  />
                  <CompactTile
                    icon={BellRing}
                    title="Worker real"
                    text="Trabalho reduzido com Tarefas em segundo plano e alertas Inteligentes."
                  />
                </div>
              </Panel>

              <Panel title="Fila Quente" subtitle="Contas para você agir agora.">
                <div className="space-y-2">
                  {filteredCollections.slice(0, 6).map((row) => (
                    <CollectionRow
                      key={row.loanId}
                      item={row}
                      onOpen={() => {
                        setSelectedClientId(row.clientId);
                        setSelectedLoanId(row.loanId);
                        navigate('collections');
                      }}
                    />
                  ))}
                  {!filteredCollections.length ? (
                    <EmptyState text="Nenhuma carteira pra listar ainda." />
                  ) : null}
                </div>
              </Panel>
            </div>
          ) : null}

          {route === 'portfolio' ? (
            <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
              <Panel title="Carteira" subtitle="Filtrar ou buscar por contratos.">
                <div className="grid gap-3 md:grid-cols-3">
                  <Input
                    label="Busca"
                    value={portfolioFilters.search}
                    onChange={(value) =>
                      setPortfolioFilters((current) => ({ ...current, search: value }))
                    }
                    icon={Search}
                  />
                  <Select
                    label="Estado"
                    value={portfolioFilters.status}
                    onChange={(value) =>
                      setPortfolioFilters((current) => ({ ...current, status: value }))
                    }
                    options={['ALL', 'ACTIVE', 'AT_RISK', 'DELINQUENT', 'PAID']}
                  />
                  <Input
                    label="Min aberto"
                    type="number"
                    value={portfolioFilters.minOutstanding}
                    onChange={(value) =>
                      setPortfolioFilters((current) => ({ ...current, minOutstanding: value }))
                    }
                  />
                </div>

                <div className="mt-4 overflow-hidden rounded-3xl border border-ink/10 bg-white">
                  <table className="min-w-full text-sm">
                    <thead className="bg-ink text-left text-[11px] uppercase tracking-[0.18em] text-sand">
                      <tr>
                        <th className="px-3 py-3">Cliente</th>
                        <th className="px-3 py-3">Contrato</th>
                        <th className="px-3 py-3">Estado</th>
                        <th className="px-3 py-3">Aberto</th>
                        <th className="px-3 py-3">Atraso</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredPortfolioRows.map((row) => (
                        <tr
                          key={row.loanId}
                          className="cursor-pointer border-t border-ink/5 hover:bg-pearl"
                          onClick={() => {
                            setSelectedClientId(row.clientId);
                            setSelectedLoanId(row.loanId);
                          }}
                        >
                          <td className="px-3 py-3">{row.clientName}</td>
                          <td className="px-3 py-3 font-mono text-xs">{row.loanId}</td>
                          <td className="px-3 py-3">
                            <StatusBadge status={row.status} />
                          </td>
                          <td className="px-3 py-3">{formatMoney(row.outstandingBalance)}</td>
                          <td className="px-3 py-3">{row.longestDelayDays}d</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {!filteredPortfolioRows.length ? (
                    <EmptyState text="Nenhum contrato para os filtros atuais." />
                  ) : null}
                </div>
              </Panel>

              <Panel title="Cliente 360" subtitle="Vista completa do cliente.">
                {selectedClient ? (
                  <>
                    <div className="grid gap-3 md:grid-cols-3">
                      <DataChip label="Cliente" value={selectedClient.name} />
                      <DataChip
                        label="Aberto"
                        value={formatMoney(selectedClient.summary.totalOutstanding)}
                      />
                      <DataChip
                        label="Vencidos"
                        value={String(selectedClient.summary.overdueContracts)}
                      />
                    </div>

                    <div className="mt-4 overflow-hidden rounded-3xl border border-ink/10 bg-white">
                      <table className="min-w-full text-sm">
                        <thead className="bg-ink text-left text-[11px] uppercase tracking-[0.18em] text-sand">
                          <tr>
                            <th className="px-3 py-3">Contrato</th>
                            <th className="px-3 py-3">Estado</th>
                            <th className="px-3 py-3">Aberto</th>
                            <th className="px-3 py-3">Atraso</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedClient.loans.map((loan) => (
                            <tr
                              key={loan.loan.id}
                              className="cursor-pointer border-t border-ink/5 hover:bg-pearl"
                              onClick={() => {
                                setSelectedLoanId(loan.loan.id);
                                navigate('collections');
                              }}
                            >
                              <td className="px-3 py-3 font-mono text-xs">{loan.loan.id}</td>
                              <td className="px-3 py-3">
                                <StatusBadge status={loan.summary.status} />
                              </td>
                              <td className="px-3 py-3">
                                {formatMoney(loan.summary.outstandingBalance)}
                              </td>
                              <td className="px-3 py-3">{loan.summary.longestDelayDays}d</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                ) : (
                  <EmptyState text="Nenhum cliente selecionado ainda." />
                )}
              </Panel>
            </div>
          ) : null}

          {route === 'collections' ? (
            <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
              <Panel title="Cobrança por SLA" subtitle="Prioridade calculada automaticamente.">
                <div className="flex flex-wrap gap-2">
                  {(['ALL', 'today', 'urgent', 'watch'] as const).map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => setCollectionFilter(item)}
                      className={`rounded-full px-3 py-2 text-sm font-medium ${
                        collectionFilter === item
                          ? 'bg-ink text-white'
                          : 'border border-ink/10 bg-white'
                      }`}
                    >
                      {item}
                    </button>
                  ))}
                </div>

                <div className="mt-4 space-y-2">
                  {filteredCollections.map((item) => (
                    <CollectionRow
                      key={item.loanId}
                      item={item}
                      onOpen={() => {
                        setSelectedClientId(item.clientId);
                        setSelectedLoanId(item.loanId);
                      }}
                    />
                  ))}
                  {!filteredCollections.length ? <EmptyState text="Sem itens nesta fila." /> : null}
                </div>
              </Panel>

              <Panel title="Contrato ativo" subtitle="Parcela, pagamento e passos posterior.">
                {loanBalance ? (
                  <>
                    <div className="grid gap-3 md:grid-cols-3">
                      <DataChip label="Estado" value={loanBalance.summary.status} />
                      <DataChip
                        label="Aberto"
                        value={formatMoney(loanBalance.summary.outstandingBalance)}
                      />
                      <DataChip label="Atraso" value={`${loanBalance.summary.longestDelayDays}d`} />
                    </div>

                    <div className="mt-4 overflow-hidden rounded-3xl border border-ink/10 bg-white">
                      <table className="min-w-full text-sm">
                        <thead className="bg-ink text-left text-[11px] uppercase tracking-[0.18em] text-sand">
                          <tr>
                            <th className="px-3 py-3">Parcela</th>
                            <th className="px-3 py-3">Vence</th>
                            <th className="px-3 py-3">Estado</th>
                            <th className="px-3 py-3">Aberto</th>
                          </tr>
                        </thead>
                        <tbody>
                          {loanBalance.schedule.slice(0, 8).map((row) => (
                            <tr key={row.installmentNumber} className="border-t border-ink/5">
                              <td className="px-3 py-3">#{row.installmentNumber}</td>
                              <td className="px-3 py-3">{formatDate(row.dueDate)}</td>
                              <td className="px-3 py-3">
                                <StatusBadge status={row.status} />
                              </td>
                              <td className="px-3 py-3">{formatMoney(row.remainingToPay)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="mt-4 grid gap-3 md:grid-cols-3">
                      <Input
                        label="Valor"
                        type="number"
                        value={String(paymentForm.amount)}
                        onChange={(value) =>
                          setPaymentForm((current) => ({ ...current, amount: Number(value) }))
                        }
                      />
                      <Input
                        label="Data"
                        type="date"
                        value={paymentForm.paidAt}
                        onChange={(value) =>
                          setPaymentForm((current) => ({ ...current, paidAt: value }))
                        }
                      />
                      <Input
                        label="Ref"
                        value={paymentForm.reference}
                        onChange={(value) =>
                          setPaymentForm((current) => ({ ...current, reference: value }))
                        }
                      />
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white"
                        onClick={handleCreatePayment}
                        type="button"
                        disabled={!token}
                      >
                        Lançar pagamento
                      </button>
                      <button
                        className="rounded-full border border-ink/10 bg-white px-4 py-2 text-sm font-semibold"
                        onClick={() => void handleReminderSweep(true)}
                        type="button"
                        disabled={!token}
                      >
                        Prévia reminders
                      </button>
                      <button
                        className="rounded-full border border-ink/10 bg-white px-4 py-2 text-sm font-semibold"
                        onClick={() => void handleReminderSweep(false)}
                        type="button"
                        disabled={!token}
                      >
                        Enviar reminders
                      </button>
                    </div>
                  </>
                ) : (
                  <EmptyState text="Selecione um contrato." />
                )}
              </Panel>
            </div>
          ) : null}

          {route === 'intelligence' ? (
            <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
              <Panel
                title="Análise com AICoreBank"
                subtitle="Gere análises rápidas com Assistente do CoreBank"
              >
                <textarea
                  className="h-36 w-full rounded-3xl border border-ink/10 bg-white px-4 py-3 text-sm outline-none transition focus:border-ember"
                  value={aiNotes}
                  onChange={(event) => setAiNotes(event.target.value)}
                />
                <button
                  className="mt-4 rounded-full bg-ember px-4 py-2 text-sm font-semibold text-white"
                  onClick={handleAiAnalysis}
                  type="button"
                  disabled={!token || !selectedLoanId}
                >
                  Gerar playbook
                </button>
                <div className="mt-4 rounded-3xl bg-ink p-4 text-sand">
                  <div className="text-[11px] uppercase tracking-[0.18em] text-sand/70">Saída</div>
                  <pre className="mt-3 whitespace-pre-wrap font-sans text-sm leading-6">
                    {aiResult?.analysis ?? 'Selecione um contrato e gere a análise.'}
                  </pre>
                </div>
              </Panel>

              <Panel
                title="CoreBank operação e crédito"
                subtitle="Da originação à cobrança, com IA aplicada."
              >
                <div className="grid gap-3 md:grid-cols-2">
                  <CompactTile
                    icon={Sparkles}
                    title="Venda"
                    text="Registro, criação de carteiras, validação de contrato e creditação auditável."
                  />
                  <CompactTile
                    icon={Landmark}
                    title="Carteira"
                    text="Controlo de contratos, saldos, atraso e auditoria diária."
                  />
                  <CompactTile
                    icon={BellRing}
                    title="Worker"
                    text="Fecham o ciclo diário de cobrança e reminders."
                  />
                  <CompactTile
                    icon={BrainCircuit}
                    title="IA"
                    text="Apoio operacional e análise de dados para tomanda de dicisões."
                  />
                </div>
              </Panel>
            </div>
          ) : null}

          {route === 'ops' ? (
            <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
              <Panel title="Originação" subtitle="Criar cliente e contrato.">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-3xl border border-ink/10 bg-pearl p-4">
                    <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
                      <UserPlus className="h-4 w-4 text-ember" />
                      Cliente
                    </div>
                    <div className="grid gap-3">
                      <Input
                        label="Nome"
                        value={clientForm.name}
                        onChange={(value) =>
                          setClientForm((current) => ({ ...current, name: value }))
                        }
                      />
                      <Input
                        label="Telefone"
                        value={clientForm.phone}
                        onChange={(value) =>
                          setClientForm((current) => ({ ...current, phone: value }))
                        }
                      />
                      <Input
                        label="NUIB"
                        value={clientForm.nuib}
                        onChange={(value) =>
                          setClientForm((current) => ({ ...current, nuib: value }))
                        }
                      />
                      <Input
                        label="Email"
                        value={clientForm.email}
                        onChange={(value) =>
                          setClientForm((current) => ({ ...current, email: value }))
                        }
                      />
                      <Input
                        label="BI"
                        value={clientForm.nationalId}
                        onChange={(value) =>
                          setClientForm((current) => ({ ...current, nationalId: value }))
                        }
                      />
                      <Input
                        label="Morada"
                        value={clientForm.address}
                        onChange={(value) =>
                          setClientForm((current) => ({ ...current, address: value }))
                        }
                      />
                    </div>
                    <button
                      className="mt-4 rounded-full bg-moss px-4 py-2 text-sm font-semibold text-white"
                      onClick={handleCreateClient}
                      type="button"
                      disabled={!token}
                    >
                      Criar cliente
                    </button>
                  </div>

                  <div className="rounded-3xl border border-ink/10 bg-pearl p-4">
                    <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
                      <WalletCards className="h-4 w-4 text-ember" />
                      Contrato
                    </div>
                    <div className="grid gap-3">
                      <Select
                        label="Cliente"
                        value={selectedClientId}
                        onChange={setSelectedClientId}
                        options={clients.map((client) => ({
                          label: client.name,
                          value: client.id,
                        }))}
                      />
                      <Input
                        label="Principal"
                        type="number"
                        value={String(loanForm.principal)}
                        onChange={(value) =>
                          setLoanForm((current) => ({ ...current, principal: Number(value) }))
                        }
                      />
                      <Input
                        label="Juro anual"
                        type="number"
                        value={String(loanForm.annualInterestRate)}
                        onChange={(value) =>
                          setLoanForm((current) => ({
                            ...current,
                            annualInterestRate: Number(value),
                          }))
                        }
                      />
                    </div>
                    <button
                      className="mt-4 rounded-full bg-ember px-4 py-2 text-sm font-semibold text-white"
                      onClick={handleCreateLoan}
                      type="button"
                      disabled={!token || !selectedClientId}
                    >
                      Emitir contrato
                    </button>
                  </div>
                </div>
              </Panel>

              <Panel title="Worker e operação" subtitle="Estado real da stack.">
                <div className="grid gap-3 md:grid-cols-2">
                  <StateChip
                    label="API"
                    value={health?.api.active ? 'ativo' : 'inativo'}
                    active={Boolean(health?.api.active)}
                  />
                  <StateChip
                    label="Worker"
                    value={workerStatus}
                    active={workerStatus === 'ativo'}
                  />
                  <DataChip
                    label="Sweep"
                    value={reminderResult ? `${reminderResult.count} itens` : 'não executado'}
                  />
                  <DataChip label="Modo" value={isPending ? 'syncing' : 'ready'} />
                </div>
                <div className="mt-4 rounded-3xl border border-ink/10 bg-pearl p-4 text-sm leading-6 text-ink/70">
                  O worker diário do `creditflow-core` é a peça certa para vencimentos, atraso e
                  reminders em segundo plano. Esta tela usa a mesma API para prévia e execução
                  manual, sem duplicar regra financeira.
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white"
                    onClick={handleExportReport}
                    type="button"
                  >
                    <span className="inline-flex items-center gap-2">
                      <Download className="h-4 w-4" />
                      Exportar relatório
                    </span>
                  </button>
                  <button
                    className="rounded-full border border-ink/10 bg-white px-4 py-2 text-sm font-semibold"
                    onClick={() => void handleReminderSweep(true)}
                    type="button"
                    disabled={!token}
                  >
                    Prévia
                  </button>
                  <button
                    className="rounded-full border border-ink/10 bg-white px-4 py-2 text-sm font-semibold"
                    onClick={() => void handleReminderSweep(false)}
                    type="button"
                    disabled={!token}
                  >
                    Atualizar
                  </button>
                </div>
              </Panel>
            </div>
          ) : null}
        </main>
      </div>
    </div>
  );
}

function NavItem(props: {
  route: RouteKey;
  target: RouteKey;
  icon: ComponentType<{ className?: string }>;
  label: string;
  onClick: (route: RouteKey) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => props.onClick(props.target)}
      className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition ${
        props.route === props.target
          ? 'bg-white text-ink'
          : 'bg-white/5 text-sand hover:bg-white/10'
      }`}
    >
      <props.icon className="h-4 w-4" />
      {props.label}
    </button>
  );
}

function Banner(props: { text: string }) {
  return (
    <div className="mt-4 rounded-2xl border border-ember/20 bg-blush px-4 py-3 text-sm text-ember">
      {props.text}
    </div>
  );
}

function StatusMiniStat(props: { label: string; value: string; active: boolean }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-white/75">{props.label}</span>
      <span className="inline-flex items-center gap-2 font-mono text-xs text-sand">
        <span
          className={`h-2.5 w-2.5 rounded-full ${props.active ? 'bg-emerald-400' : 'bg-red-400'} animate-pulse`}
        />
        {props.value}
      </span>
    </div>
  );
}

function Panel(props: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <section className="rounded-[1.8rem] border border-ink/10 bg-white/75 p-4 shadow-soft backdrop-blur">
      <div>
        <h3 className="text-lg font-bold">{props.title}</h3>
        <p className="mt-1 text-sm text-ink/60">{props.subtitle}</p>
      </div>
      <div className="mt-4">{props.children}</div>
    </section>
  );
}

function MetricCard(props: {
  label: string;
  value: string;
  icon: ComponentType<{ className?: string }>;
}) {
  return (
    <div className="rounded-[1.4rem] border border-ink/10 bg-white/75 p-4 shadow-soft backdrop-blur">
      <div className="flex items-center justify-between">
        <span className="text-[11px] uppercase tracking-[0.18em] text-ink/45">{props.label}</span>
        <props.icon className="h-4.5 w-4.5 text-ember" />
      </div>
      <div className="mt-4 text-2xl font-bold">{props.value}</div>
    </div>
  );
}

function CompactTile(props: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  text: string;
}) {
  return (
    <div className="rounded-3xl border border-ink/10 bg-pearl p-4">
      <div className="inline-flex rounded-full bg-white p-2 text-ember">
        <props.icon className="h-4 w-4" />
      </div>
      <div className="mt-3 font-semibold">{props.title}</div>
      <div className="mt-1 text-sm text-ink/65">{props.text}</div>
    </div>
  );
}

function StatusBadge(props: { status: string }) {
  const styles: Record<string, string> = {
    ACTIVE: 'bg-mint text-moss',
    AT_RISK: 'bg-blush text-ember',
    DELINQUENT: 'bg-ink text-white',
    OVERDUE: 'bg-ink text-white',
    PARTIAL: 'border border-ink/10 bg-white text-ink',
    PAID: 'bg-mint text-moss',
    PENDING: 'border border-ink/10 bg-white text-ink',
  };
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] ${styles[props.status] ?? 'bg-white text-ink'}`}
    >
      {props.status}
    </span>
  );
}

function CollectionRow(props: { item: CollectionItem; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={props.onOpen}
      className="flex w-full items-center justify-between rounded-2xl border border-ink/10 bg-white px-4 py-3 text-left hover:border-ink/20"
    >
      <div>
        <div className="font-medium">{props.item.clientName}</div>
        <div className="mt-1 text-[11px] uppercase tracking-[0.16em] text-ink/45">
          {props.item.loanId}
        </div>
      </div>
      <div className="text-right">
        <div className="flex justify-end">
          <StatusBadge status={props.item.status} />
        </div>
        <div className="mt-2 text-sm font-semibold">
          {formatMoney(props.item.outstandingBalance)}
        </div>
        <div className="mt-1 text-xs text-ink/50">
          {props.item.sla} · {props.item.longestDelayDays}d
        </div>
      </div>
    </button>
  );
}

function DataChip(props: { label: string; value: string }) {
  return (
    <div className="rounded-3xl border border-ink/10 bg-pearl px-4 py-3">
      <div className="text-[11px] uppercase tracking-[0.18em] text-ink/45">{props.label}</div>
      <div className="mt-2 text-sm font-semibold">{props.value}</div>
    </div>
  );
}

function StateChip(props: { label: string; value: string; active: boolean }) {
  return (
    <div className="rounded-3xl border border-ink/10 bg-pearl p-4">
      <div className="text-[11px] uppercase tracking-[0.18em] text-ink/45">{props.label}</div>
      <div className="mt-3 inline-flex items-center gap-2 text-sm font-semibold">
        <span
          className={`h-2.5 w-2.5 rounded-full ${props.active ? 'bg-emerald-500' : 'bg-red-500'} animate-pulse`}
        />
        {props.value}
      </div>
    </div>
  );
}

function Input(props: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  icon?: ComponentType<{ className?: string }>;
}) {
  return (
    <label className="block text-sm font-medium text-ink/80">
      {props.label}
      <div className="relative mt-2">
        {props.icon ? (
          <props.icon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/35" />
        ) : null}
        <input
          className={`w-full rounded-3xl border border-ink/10 bg-white py-3 outline-none transition focus:border-ember ${
            props.icon ? 'pl-10 pr-4' : 'px-4'
          }`}
          value={props.value}
          type={props.type ?? 'text'}
          onChange={(event) => props.onChange(event.target.value)}
        />
      </div>
    </label>
  );
}

function Select(props: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<string | { label: string; value: string }>;
}) {
  return (
    <label className="block text-sm font-medium text-ink/80">
      {props.label}
      <select
        className="mt-2 w-full rounded-3xl border border-ink/10 bg-white px-4 py-3 outline-none transition focus:border-ember"
        value={props.value}
        onChange={(event) => props.onChange(event.target.value)}
      >
        <option value="">Selecionar</option>
        {props.options.map((option) =>
          typeof option === 'string' ? (
            <option key={option} value={option}>
              {option}
            </option>
          ) : (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ),
        )}
      </select>
    </label>
  );
}

function EmptyState(props: { text: string }) {
  return (
    <div className="rounded-3xl border border-dashed border-ink/15 bg-white/70 px-4 py-8 text-center text-sm text-ink/55">
      {props.text}
    </div>
  );
}
