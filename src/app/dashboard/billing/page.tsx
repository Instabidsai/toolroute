"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  CreditCard,
  Wallet,
  Crown,
  ArrowUpRight,
  AlertTriangle,
  Zap,
  Check,
  RefreshCw,
  Key,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import {
  getStripeReference,
  getTransactionStatus,
} from "@/lib/billing-transactions";

interface UserInfo {
  credit_balance: number;
  plan_slug: string;
  auto_topup_enabled: boolean;
  auto_topup_threshold: number;
  auto_topup_amount_cents: number;
  has_payment_method: boolean;
  payment_method: {
    brand: string;
    last4: string;
    exp_month: number;
    exp_year: number;
  } | null;
}

interface Transaction {
  id: string;
  amount: number;
  type: string;
  description: string;
  balance_after: number | null;
  stripe_payment_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

const PRESET_AMOUNTS = [5, 10, 25, 50, 100];

const PLANS = [
  {
    slug: "free",
    name: "Free",
    price: "$0/mo",
    features: [
      "No included credits",
      "10 requests/min",
      "100 requests/day",
      "Community support",
    ],
  },
  {
    slug: "pro",
    name: "Pro",
    price: "$29/mo",
    features: [
      "$5 credits/month included",
      "60 requests/min",
      "10,000 requests/month",
      "All tools access",
      "BYOK support",
      "Email support",
    ],
  },
  {
    slug: "enterprise",
    name: "Enterprise",
    price: "$299/mo",
    features: [
      "$50 credits/month included",
      "300 requests/min",
      "100,000 requests/month",
      "Custom adapters",
      "Dedicated support + SLA",
    ],
  },
];

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function TypeBadge({ type }: { type: string }) {
  const colors: Record<string, string> = {
    purchase: "bg-green/10 text-green border-green/20",
    usage: "bg-accent/10 text-accent border-accent/20",
    refund: "bg-cyan/10 text-cyan border-cyan/20",
    bonus: "bg-amber/10 text-amber border-amber/20",
  };
  const cls = colors[type] || "bg-text-muted/10 text-text-dim border-border";
  return (
    <span
      className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium border ${cls}`}
    >
      {type}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    paid: "bg-green/10 text-green border-green/20",
    failed: "bg-red/10 text-red border-red/20",
    usage: "bg-accent/10 text-accent border-accent/20",
    posted: "bg-text-muted/10 text-text-dim border-border",
  };
  const cls = colors[status] || colors.posted;
  return (
    <span
      className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium border ${cls}`}
    >
      {status}
    </span>
  );
}

export default function BillingPage() {
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [setupLoading, setSetupLoading] = useState(false);
  const [topupSaving, setTopupSaving] = useState(false);
  const [topupSuccess, setTopupSuccess] = useState(false);
  const [checkoutNotice, setCheckoutNotice] = useState<{
    amount: string | null;
    plan: string | null;
  } | null>(null);

  const handlePurchaseCredits = async (amount: number) => {
    setCheckoutLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const res = await fetch("/api/v1/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ type: "credits", amount: String(amount) }),
      });

      const data = await res.json();
      if (data.checkout_url) {
        window.location.href = data.checkout_url;
      } else {
        setError(data.error?.message || "Failed to start checkout");
      }
    } catch {
      setError("Failed to start checkout");
    } finally {
      setCheckoutLoading(false);
    }
  };

  const handleUpgradePlan = async (plan: string) => {
    setCheckoutLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const res = await fetch("/api/v1/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ type: "subscription", plan }),
      });

      const data = await res.json();
      if (data.checkout_url) {
        window.location.href = data.checkout_url;
      } else {
        setError(data.error?.message || "Failed to start checkout");
      }
    } catch {
      setError("Failed to start checkout");
    } finally {
      setCheckoutLoading(false);
    }
  };

  const updateAutoTopup = async (updates: Record<string, unknown>) => {
    setTopupSaving(true);
    setTopupSuccess(false);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const res = await fetch("/api/v1/settings", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(updates),
      });

      const data = await res.json();
      if (res.ok) {
        setUserInfo((prev) =>
          prev
            ? {
                ...prev,
                auto_topup_enabled: data.auto_topup_enabled,
                auto_topup_threshold: data.auto_topup_threshold,
                auto_topup_amount_cents: data.auto_topup_amount_cents,
                has_payment_method: data.has_payment_method,
                payment_method: data.payment_method ?? null,
              }
            : prev
        );
        setTopupSuccess(true);
        setTimeout(() => setTopupSuccess(false), 2000);
      } else {
        setError(data.error?.message || "Failed to update settings");
      }
    } catch {
      setError("Failed to update auto top-up settings");
    } finally {
      setTopupSaving(false);
    }
  };

  const handleSetupPayment = async () => {
    setSetupLoading(true);
    setError(null);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return;

      const res = await fetch("/api/v1/billing/setup-payment", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });
      const data = await res.json();

      if (data.checkout_url) {
        window.location.href = data.checkout_url;
      } else {
        setError(data.error?.message || "Failed to set up payment method");
      }
    } catch {
      setError("Failed to set up payment method");
    } finally {
      setSetupLoading(false);
    }
  };

  const fetchBilling = useCallback(async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return;

      const [settingsRes, txRes] = await Promise.all([
        fetch("/api/v1/settings", {
          headers: { Authorization: `Bearer ${session.access_token}` },
        }),
        supabase
          .from("credit_transactions")
          .select("id, amount, type, description, balance_after, stripe_payment_id, metadata, created_at")
          .eq("user_id", session.user.id)
          .order("created_at", { ascending: false })
          .limit(50),
      ]);

      const settingsJson = await settingsRes.json();
      if (!settingsRes.ok) {
        throw new Error(settingsJson.error?.message || "Failed to load billing settings");
      }

      setUserInfo({
        credit_balance: settingsJson.credit_balance ?? 0,
        plan_slug: settingsJson.plan_slug ?? "free",
        auto_topup_enabled: settingsJson.auto_topup_enabled ?? false,
        auto_topup_threshold: settingsJson.auto_topup_threshold ?? 1.0,
        auto_topup_amount_cents: settingsJson.auto_topup_amount_cents ?? 1000,
        has_payment_method: settingsJson.has_payment_method ?? false,
        payment_method: settingsJson.payment_method ?? null,
      });
      setTransactions(txRes.data ?? []);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load billing data"
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBilling();
  }, [fetchBilling]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("success") === "true") {
      setCheckoutNotice({
        amount: params.get("amount"),
        plan: params.get("plan"),
      });
    }
  }, []);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-32 bg-bg-card rounded animate-pulse" />
        <div className="h-32 bg-bg-card border border-border rounded-lg animate-pulse" />
      </div>
    );
  }

  const currentPlan = userInfo?.plan_slug ?? "free";
  const balance = userInfo?.credit_balance ?? 0;

  return (
    <div className="space-y-8 animate-slide-up max-w-4xl">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
          <CreditCard className="w-5 h-5 text-text-dim" />
          Billing & Credits
        </h1>
        <p className="text-xs text-text-dim mt-1">
          Manage your balance and subscription
        </p>
      </div>

      {error && (
        <div className="border border-red/20 rounded-lg bg-red/5 px-4 py-3 text-xs text-red flex items-center gap-2">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          {error}
        </div>
      )}

      {checkoutNotice && (
        <div className="border border-green/25 rounded-lg bg-green/5 px-4 py-3 text-xs text-green flex flex-wrap items-center gap-3">
          <span className="flex items-center gap-2">
            <Check className="w-3.5 h-3.5 shrink-0" />
            {checkoutNotice.amount
              ? `$${checkoutNotice.amount} credits added.`
              : checkoutNotice.plan
                ? `${checkoutNotice.plan} plan checkout completed.`
                : "Checkout completed."}
          </span>
          <Link
            href="/dashboard/keys?new=1"
            className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-green/15 text-green border border-green/30 hover:bg-green/20 transition-colors"
          >
            <Key className="w-3.5 h-3.5" />
            Create live key
          </Link>
        </div>
      )}

      {/* Balance Card */}
      <div className="border border-border rounded-lg bg-bg-card p-6 glow-accent">
        <div className="flex items-center gap-2 mb-2">
          <Wallet className="w-5 h-5 text-green" />
          <span className="text-xs text-text-muted uppercase tracking-wider">
            Credit Balance
          </span>
        </div>
        <p className="text-4xl font-bold text-text">${balance.toFixed(2)}</p>
        <p className="text-[10px] text-text-dim mt-1">
          Credits are consumed per API request. Costs vary by tool.
        </p>
      </div>

      {/* Add Credits */}
      <section>
        <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
          <Zap className="w-4 h-4 text-amber" />
          Add Credits
        </h2>
        <div className="flex flex-wrap gap-2 mb-3">
          {PRESET_AMOUNTS.map((amt) => (
            <button
              key={amt}
              onClick={() =>
                setSelectedAmount(selectedAmount === amt ? null : amt)
              }
              className={`px-4 py-2 rounded-lg border text-sm font-medium transition-all ${
                selectedAmount === amt
                  ? "border-accent bg-accent/10 text-accent"
                  : "border-border bg-bg-card text-text hover:border-accent/30 hover:bg-bg-card-hover"
              }`}
            >
              ${amt}
            </button>
          ))}
        </div>
        {selectedAmount && (
          <button
            onClick={() => handlePurchaseCredits(selectedAmount)}
            disabled={checkoutLoading}
            className="px-6 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent/90 transition-colors disabled:opacity-50"
          >
            {checkoutLoading ? "Redirecting to Stripe..." : `Purchase $${selectedAmount} Credits`}
          </button>
        )}
      </section>

      {/* Auto Top-Up */}
      <section>
        <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
          <RefreshCw className="w-4 h-4 text-cyan" />
          Auto Top-Up
        </h2>
        <div className="border border-border rounded-lg bg-bg-card p-5 space-y-4">
          {!userInfo?.has_payment_method ? (
            <div className="border border-amber/20 rounded-lg bg-amber/5 px-4 py-3 text-xs text-amber flex flex-wrap items-center gap-3">
              <span className="flex items-center gap-2">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                No reusable payment method on file.
              </span>
              <button
                onClick={handleSetupPayment}
                disabled={setupLoading}
                className="ml-auto px-3 py-1.5 rounded bg-amber/15 text-amber border border-amber/30 hover:bg-amber/20 transition-colors disabled:opacity-50"
              >
                {setupLoading ? "Redirecting..." : "Add payment method"}
              </button>
            </div>
          ) : (
            <div className="border border-green/20 rounded-lg bg-green/5 px-4 py-3 text-xs text-green flex items-center gap-2">
              <Check className="w-3.5 h-3.5 shrink-0" />
              {userInfo.payment_method
                ? `${userInfo.payment_method.brand.toUpperCase()} ending in ${userInfo.payment_method.last4} expires ${userInfo.payment_method.exp_month}/${userInfo.payment_method.exp_year}`
                : "Payment method on file"}
            </div>
          )}

          {/* Enable/Disable toggle */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Enable Auto Top-Up</p>
              <p className="text-[10px] text-text-dim mt-0.5">
                Automatically add credits when your balance drops below the threshold
              </p>
            </div>
            <button
              onClick={() =>
                updateAutoTopup({
                  auto_topup_enabled: !userInfo?.auto_topup_enabled,
                })
              }
              disabled={topupSaving || !userInfo?.has_payment_method}
              className={`relative w-11 h-6 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                userInfo?.auto_topup_enabled
                  ? "bg-green"
                  : "bg-text-muted/20"
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
                  userInfo?.auto_topup_enabled ? "translate-x-5" : ""
                }`}
              />
            </button>
          </div>

          {/* Threshold selector */}
          <div>
            <label className="text-xs text-text-muted block mb-1.5">
              When balance drops below
            </label>
            <div className="flex gap-2">
              {[1, 5, 10].map((val) => (
                <button
                  key={val}
                  onClick={() =>
                    updateAutoTopup({ auto_topup_threshold: val })
                  }
                  disabled={topupSaving}
                  className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                    (userInfo?.auto_topup_threshold ?? 1) === val
                      ? "border-cyan bg-cyan/10 text-cyan"
                      : "border-border bg-bg-card text-text hover:border-cyan/30"
                  }`}
                >
                  ${val.toFixed(2)}
                </button>
              ))}
            </div>
          </div>

          {/* Amount selector */}
          <div>
            <label className="text-xs text-text-muted block mb-1.5">
              Top up amount
            </label>
            <div className="flex gap-2">
              {[
                { cents: 1000, label: "$10" },
                { cents: 2500, label: "$25" },
                { cents: 5000, label: "$50" },
                { cents: 10000, label: "$100" },
              ].map(({ cents, label }) => (
                <button
                  key={cents}
                  onClick={() =>
                    updateAutoTopup({ auto_topup_amount_cents: cents })
                  }
                  disabled={topupSaving}
                  className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                    (userInfo?.auto_topup_amount_cents ?? 1000) === cents
                      ? "border-cyan bg-cyan/10 text-cyan"
                      : "border-border bg-bg-card text-text hover:border-cyan/30"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Status */}
          <div className="flex items-center gap-2 pt-1 border-t border-border/50">
            <span
              className={`w-2 h-2 rounded-full ${
                userInfo?.auto_topup_enabled && userInfo?.has_payment_method
                  ? "bg-green"
                  : !userInfo?.has_payment_method
                    ? "bg-amber"
                    : "bg-text-muted/30"
              }`}
            />
            <span className="text-[10px] text-text-dim">
              {userInfo?.auto_topup_enabled && userInfo?.has_payment_method
                ? `Active — will add $${((userInfo?.auto_topup_amount_cents ?? 1000) / 100).toFixed(0)} when balance drops below $${(userInfo?.auto_topup_threshold ?? 1).toFixed(2)}`
                : !userInfo?.has_payment_method
                  ? "No payment method"
                  : "Inactive"}
            </span>
            {topupSuccess && (
              <span className="text-[10px] text-green ml-auto flex items-center gap-1">
                <Check className="w-3 h-3" /> Saved
              </span>
            )}
            {topupSaving && (
              <span className="text-[10px] text-text-dim ml-auto">Saving...</span>
            )}
          </div>
        </div>
      </section>

      {/* Plans */}
      <section>
        <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
          <Crown className="w-4 h-4 text-amber" />
          Plans
        </h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {PLANS.map((plan) => {
            const isCurrent = plan.slug === currentPlan;
            return (
              <div
                key={plan.slug}
                className={`border rounded-lg p-4 transition-all ${
                  isCurrent
                    ? "border-accent bg-accent/5"
                    : "border-border bg-bg-card hover:border-accent/30"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold">{plan.name}</h3>
                  {isCurrent && (
                    <span className="text-[9px] bg-accent/15 text-accent px-1.5 py-0.5 rounded font-medium uppercase">
                      Current
                    </span>
                  )}
                </div>
                <p className="text-lg font-bold text-text mb-3">{plan.price}</p>
                <ul className="space-y-1.5">
                  {plan.features.map((f) => (
                    <li
                      key={f}
                      className="text-[10px] text-text-dim flex items-start gap-1.5"
                    >
                      <Check className="w-3 h-3 text-green shrink-0 mt-0.5" />
                      {f}
                    </li>
                  ))}
                </ul>
                {!isCurrent && plan.slug !== "enterprise" && plan.slug !== "free" && (
                  <button
                    onClick={() => handleUpgradePlan(plan.slug)}
                    disabled={checkoutLoading}
                    className="mt-3 w-full flex items-center justify-center gap-1 px-3 py-1.5 rounded text-xs border border-accent/30 text-accent hover:bg-accent/10 transition-colors disabled:opacity-50"
                  >
                    {checkoutLoading ? "..." : "Upgrade"}
                    {!checkoutLoading && <ArrowUpRight className="w-3 h-3" />}
                  </button>
                )}
                {plan.slug === "enterprise" && (
                  <a
                    href="mailto:justin@toolroute.ai"
                    className="mt-3 w-full flex items-center justify-center gap-1 px-3 py-1.5 rounded text-xs border border-border text-text-dim hover:text-text hover:border-accent/30 transition-colors"
                  >
                    Contact Us
                  </a>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Invoice History */}
      <section>
        <h2 className="text-sm font-semibold mb-3">Invoice History</h2>
        {transactions.length === 0 ? (
          <div className="border border-border rounded-lg bg-bg-card p-6 text-center">
            <CreditCard className="w-8 h-8 text-text-muted mx-auto mb-2" />
            <p className="text-xs text-text-dim">No invoices or credit transactions yet.</p>
          </div>
        ) : (
          <div className="border border-border rounded-lg bg-bg-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border text-text-muted text-[10px] uppercase tracking-wider">
                    <th className="text-left p-3 font-medium">Date</th>
                    <th className="text-left p-3 font-medium">Type</th>
                    <th className="text-left p-3 font-medium">Status</th>
                    <th className="text-right p-3 font-medium">Amount</th>
                    <th className="text-right p-3 font-medium hidden sm:table-cell">
                      Balance After
                    </th>
                    <th className="text-left p-3 font-medium hidden lg:table-cell">
                      Stripe Ref
                    </th>
                    <th className="text-left p-3 font-medium hidden md:table-cell">
                      Description
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((tx) => {
                    const status = getTransactionStatus(tx);
                    const stripeRef = getStripeReference(tx);

                    return (
                      <tr
                        key={tx.id}
                        className="border-b border-border/50 hover:bg-bg-surface/50 transition-colors"
                      >
                      <td className="p-3 text-text-dim whitespace-nowrap">
                        {formatDate(tx.created_at)}
                      </td>
                      <td className="p-3">
                        <TypeBadge type={tx.type} />
                      </td>
                      <td className="p-3">
                        <StatusBadge status={status} />
                      </td>
                      <td className="p-3 text-right">
                        <span
                          className={
                            tx.amount > 0
                              ? "text-green"
                              : tx.amount < 0
                                ? "text-red"
                                : "text-text-dim"
                          }
                        >
                          {tx.amount > 0 ? "+" : ""}
                          ${Math.abs(tx.amount).toFixed(4)}
                        </span>
                      </td>
                      <td className="p-3 text-right text-text-dim hidden sm:table-cell">
                        {tx.balance_after != null
                          ? `$${tx.balance_after.toFixed(2)}`
                          : "-"}
                      </td>
                      <td className="p-3 text-text-dim hidden lg:table-cell">
                        {stripeRef ? (
                          <code className="text-[10px]">{stripeRef}</code>
                        ) : (
                          "-"
                        )}
                      </td>
                      <td className="p-3 text-text-dim hidden md:table-cell max-w-[200px] truncate">
                        {tx.description}
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
