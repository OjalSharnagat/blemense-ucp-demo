import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, Clock3, Landmark, ShoppingCart, Store, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { usePosStore } from "@/lib/posStore";
import { fmt } from "@/utils";

const money = (value: number) => fmt.format(Number(value || 0));

const formatDuration = (ms: number) => {
  const safeMs = Math.max(0, ms);
  const totalMinutes = Math.floor(safeMs / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours <= 0) return `${minutes}m`;
  return `${hours}h ${minutes}m`;
};

function Stat({ label, value, icon }: { label: string; value: string; icon: ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm shadow-slate-200/40">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">{label}</p>
          <p className="mt-1 text-xl font-semibold text-slate-900">{value}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-slate-500">{icon}</div>
      </div>
    </div>
  );
}

const shellBackground =
  "relative min-h-screen bg-slate-50 text-slate-900";

const shellBackdrop =
  "pointer-events-none absolute inset-0 bg-slate-100";

const sessionThemeStyles = (
  <style>{`
    .pos-session-light [class*="border-white/20"],
    .pos-session-light [class*="border-white/10"],
    .pos-session-light [class*="border-white/5"] {
      border-color: #e2e8f0 !important;
    }

    .pos-session-light [class*="shadow-black"] {
      box-shadow: 0 18px 40px rgba(148, 163, 184, 0.16) !important;
    }

    .pos-session-light [class*="focus:ring-slate-500"],
    .pos-session-light [class*="focus-visible:ring-slate-500"] {
      --tw-ring-color: rgba(100, 116, 139, 0.35) !important;
    }

    .pos-session-light [class*="rounded-[24px]"],
    .pos-session-light [class*="rounded-[22px]"],
    .pos-session-light [class*="rounded-[1.6rem]"] {
      border-radius: 1rem !important;
    }
  `}</style>
);

export default function POSSession() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const mode = searchParams.get("mode") === "close" ? "close" : "open";
  const {
    currentSession,
    sessions,
    openSession,
    closeSession,
  } = usePosStore();

  const recentOperators = useMemo(() => {
    const unique = new Set<string>();
    const list: string[] = [];

    for (const session of sessions) {
      const name = session.operatorName.trim();
      if (!name || unique.has(name)) continue;
      unique.add(name);
      list.push(name);
    }

    return list.slice(0, 6);
  }, [sessions]);

  const [operatorName, setOperatorName] = useState("Cashier");
  const [openingCash, setOpeningCash] = useState("0");
  const [closingCash, setClosingCash] = useState("0");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (mode === "open") {
      setOperatorName(recentOperators[0] || currentSession?.operatorName || "Cashier");
      setOpeningCash("0");
      setNotes("");
    } else if (currentSession) {
      setClosingCash(String(currentSession.expectedCash ?? currentSession.openingCash ?? 0));
      setNotes(currentSession.notes || "");
    }
  }, [mode, recentOperators, currentSession]);

  if (mode === "close" && !currentSession) {
    return <Navigate to="/pos/session?mode=open" replace />;
  }

  if (mode === "open" && currentSession) {
    return <Navigate to="/pos" replace />;
  }

  const now = new Date();

  const sessionStartedAt = currentSession ? new Date(currentSession.openedAt) : null;
  const sessionDuration = sessionStartedAt ? formatDuration(now.getTime() - sessionStartedAt.getTime()) : "0m";

  const expectedCash = currentSession?.expectedCash ?? currentSession?.openingCash ?? 0;
  const closingCashValue = Number(closingCash || 0);
  const cashDifference = Number((closingCashValue - expectedCash).toFixed(2));
  const discrepancyAmount = Math.abs(cashDifference);

  const handleOpenSession = () => {
    const session = openSession(Number(openingCash || 0), operatorName.trim() || "Cashier", notes.trim());
    if (session) {
      navigate("/pos", { replace: true });
    }
  };

  const handleCloseSession = () => {
    const session = closeSession(Number(closingCash || 0), notes.trim());
    if (session) {
      navigate("/pos/session?mode=open", { replace: true });
    }
  };

  const renderOpenFlow = () => (
    <div className={`pos-session-light ${shellBackground}`}>
      {sessionThemeStyles}
      <div className={shellBackdrop} />
      <div className="pointer-events-none absolute inset-0 opacity-[0.07] [background-image:linear-gradient(rgba(255,255,255,0.12)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.12)_1px,transparent_1px)] [background-size:64px_64px]" />

      <Button
        variant="outline"
        className="absolute right-4 top-4 z-20 h-12 rounded-xl border-slate-200 bg-white px-4 text-slate-900 shadow-sm hover:bg-slate-50"
        onClick={() => navigate("/admin/dashboard")}
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Exit POS
      </Button>

      <div className="relative z-10 flex min-h-screen items-center justify-center p-3 sm:p-4 md:p-6 lg:p-8">
        <Card className="w-full max-w-[1140px] overflow-hidden rounded-[28px] border border-slate-200 bg-white text-slate-900 shadow-2xl shadow-slate-200/70">
          <CardHeader className="space-y-4 border-b border-slate-200 bg-gradient-to-br from-white to-slate-50 px-5 py-5 sm:px-6 sm:py-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-4">
                <div className="rounded-2xl border border-slate-200 bg-slate-900 p-4 text-white shadow-sm shadow-slate-200/70">
                  <Store className="h-7 w-7" />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">Register console</p>
                  <CardTitle className="mt-2 text-4xl font-semibold tracking-tight text-slate-950">Open register</CardTitle>
                </div>
              </div>
              <div className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.28em] text-slate-500 shadow-sm">
                Start of day
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <p className="max-w-2xl text-base leading-7 text-slate-600">
                Tablet-friendly register setup for the cashier or shop owner.
              </p>
              <div className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-600">
                Pick the operator, count the drawer, then open the lane.
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-6 px-5 py-6 sm:px-6">
            <div className="grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
              <div className="space-y-4 rounded-[24px] border border-slate-200 bg-slate-50 p-4 sm:p-5">
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-xs uppercase tracking-wide text-slate-500">Operator name</label>
                    <Input
                      value={operatorName}
                      onChange={(event) => setOperatorName(event.target.value)}
                      className="h-14 rounded-xl border-slate-200 bg-white px-4 text-base text-slate-900 shadow-sm placeholder:text-slate-400"
                      placeholder="Cashier"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-xs uppercase tracking-wide text-slate-500">Opening cash</label>
                    <Input
                      type="number"
                      step="0.01"
                      value={openingCash}
                      onChange={(event) => setOpeningCash(event.target.value)}
                      className="h-14 rounded-xl border-slate-200 bg-white px-4 text-base text-slate-900 shadow-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-xs uppercase tracking-wide text-slate-500">Notes</label>
                  <textarea
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                    rows={5}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-4 text-base text-slate-900 shadow-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400"
                    placeholder="Optional note for the session"
                  />
                </div>

                <div className="flex flex-col gap-3 sm:flex-row">
                  <Button
                    variant="outline"
                    className="h-14 flex-1 rounded-xl border-slate-200 bg-white text-slate-800 shadow-sm hover:bg-slate-50"
                    onClick={() => navigate("/admin/dashboard")}
                  >
                    Cancel
                  </Button>
                  <Button
                    className="h-14 flex-[1.35] rounded-xl bg-slate-950 text-white shadow-lg shadow-slate-300/60 hover:bg-slate-800"
                    onClick={handleOpenSession}
                  >
                    Open Register
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="space-y-4 rounded-[24px] border border-slate-200 bg-white p-4 sm:p-5 shadow-sm">
                <div>
                  <label className="mb-3 block text-xs uppercase tracking-wide text-slate-500">Recent operator</label>
                  <div className="grid grid-cols-2 gap-2">
                    {recentOperators.length > 0 ? (
                      recentOperators.map((name) => (
                        <button
                          key={name}
                          type="button"
                          onClick={() => setOperatorName(name)}
                          className={cn(
                            "min-h-14 rounded-xl border px-3 py-3 text-left text-sm font-medium transition",
                            operatorName === name
                              ? "border-slate-900 bg-slate-900 text-white shadow-sm shadow-slate-200/70"
                              : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50",
                          )}
                        >
                          {name}
                        </button>
                      ))
                    ) : (
                      <div className="col-span-2 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-500">
                        No recent operator yet. Type the name above.
                      </div>
                    )}
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Register steps</p>
                  <div className="mt-4 grid gap-3 text-sm text-slate-700">
                    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                      1. Choose the operator or type a new name.
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                      2. Count the drawer and enter the opening cash.
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                      3. Open the register and start billing immediately.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );

  const renderCloseFlow = () => {
    if (!currentSession) {
      return null;
    }

    const payment = currentSession.paymentBreakdown;

    return (
      <div className={`pos-session-light ${shellBackground}`}>
        {sessionThemeStyles}
        <div className={shellBackdrop} />
        <div className="pointer-events-none absolute inset-0 opacity-[0.07] [background-image:linear-gradient(rgba(255,255,255,0.12)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.12)_1px,transparent_1px)] [background-size:64px_64px]" />

        <Button
          variant="outline"
          className="absolute right-4 top-4 z-20 h-12 rounded-xl border-slate-200 bg-white px-4 text-slate-900 shadow-sm hover:bg-slate-50"
          onClick={() => navigate("/pos")}
        >
          Return to register
        </Button>

        <div className="relative z-10 flex min-h-screen items-center justify-center p-3 sm:p-4 md:p-6 lg:p-8">
          <Card className="w-full max-w-[1080px] overflow-hidden rounded-[28px] border border-slate-200 bg-white text-slate-900 shadow-2xl shadow-slate-200/70">
            <CardHeader className="space-y-4 border-b border-slate-200 bg-gradient-to-br from-white to-slate-50 px-5 py-5 sm:px-6 sm:py-6">
              <div className="flex items-center gap-4">
                <div className="rounded-2xl border border-slate-200 bg-slate-900 p-4 text-white shadow-sm shadow-slate-200/70">
                  <Landmark className="h-7 w-7" />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">Register console</p>
                  <CardTitle className="mt-2 text-4xl font-semibold tracking-tight text-slate-950">Close register</CardTitle>
                </div>
              </div>
              <p className="max-w-2xl text-base leading-7 text-slate-600">
                Check the drawer, confirm cash, and close out the day cleanly.
              </p>
            </CardHeader>

            <CardContent className="space-y-6 px-5 py-6 sm:px-6">
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <Stat label="Duration" value={sessionDuration} icon={<Clock3 className="h-5 w-5" />} />
                <Stat label="Orders" value={String(currentSession.totalOrders)} icon={<ShoppingCart className="h-5 w-5" />} />
                <Stat label="Sales" value={money(currentSession.totalSales)} icon={<Landmark className="h-5 w-5" />} />
                <Stat label="Operator" value={currentSession.operatorName} icon={<Users className="h-5 w-5" />} />
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 shadow-sm">
                  <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">Cash</p>
                  <p className="mt-1 text-xl font-semibold text-slate-950">{money(payment.cash)}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 shadow-sm">
                  <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">UPI</p>
                  <p className="mt-1 text-xl font-semibold text-slate-950">{money(payment.upi)}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 shadow-sm">
                  <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">Card</p>
                  <p className="mt-1 text-xl font-semibold text-slate-950">{money(payment.card)}</p>
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.95fr)]">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-sm">
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="rounded-xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
                      <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">Opening cash</p>
                      <p className="mt-1 text-xl font-semibold text-slate-950">{money(currentSession.openingCash)}</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
                      <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">Expected cash</p>
                      <p className="mt-1 text-xl font-semibold text-slate-950">{money(expectedCash)}</p>
                    </div>
                  </div>

                  <div className="mt-4">
                    <label className="mb-2 block text-xs uppercase tracking-wide text-slate-500">Closing cash count</label>
                    <Input
                      type="number"
                      step="0.01"
                      value={closingCash}
                      onChange={(event) => setClosingCash(event.target.value)}
                      className="h-14 rounded-xl border-slate-200 bg-white px-4 text-base text-slate-900 shadow-sm"
                    />
                  </div>

                  <div className="mt-4 rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
                    <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">Drawer variance</p>
                    <p
                      className={cn(
                        "mt-2 text-2xl font-semibold leading-none",
                        cashDifference > 0 ? "text-emerald-700" : cashDifference < 0 ? "text-rose-700" : "text-slate-950",
                      )}
                    >
                      {cashDifference > 0
                        ? `Surplus: ${money(discrepancyAmount)}`
                        : cashDifference < 0
                          ? `Shortage: ${money(discrepancyAmount)}`
                          : "Balanced"}
                    </p>
                    <p className="mt-2 text-sm text-slate-500">Physical cash counted against expected drawer cash.</p>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <label className="mb-2 block text-xs uppercase tracking-wide text-slate-500">Notes</label>
                  <textarea
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                    rows={8}
                    className="h-full min-h-[280px] w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 text-base text-slate-900 shadow-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400"
                    placeholder="Explain any discrepancy or add handover notes"
                  />
                </div>
              </div>

              <div className="sticky bottom-0 -mx-5 border-t border-slate-200 bg-white/95 px-5 py-4 backdrop-blur sm:-mx-6 sm:px-6">
                <Button
                  className="h-14 w-full rounded-xl bg-slate-950 text-base font-semibold text-white shadow-lg shadow-slate-300/60 hover:bg-slate-800"
                  onClick={handleCloseSession}
                >
                  Close Register
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  };

  return mode === "close" ? renderCloseFlow() : renderOpenFlow();
}
