# Lane 6 — Provider outreach drafts

**Purpose:** Convert the ambiguous-master-pool findings from `lane-6-resale-audit.md` into outbound emails Justin can send to unblock pricing-page claims. Each draft cites the exact clause we interpreted, describes ToolRoute's pattern in their language, and asks one binary question.

**Send order (lowest to highest revenue impact for ToolRoute):**

1. Firecrawl — already a paid customer; lowest contractual risk
2. Tavily — "integration carve-out" interpretation question
3. Deepgram — terms-not-public; ask for the API MSA itself
4. OpenAI — historical clause says "no resell or lease access to your account"; needs the strongest framing

---

## 1. Firecrawl

**To:** help@firecrawl.com
**Subject:** Resale-as-a-service authorization — ToolRoute (paid customer)
**Body:**

Hi Firecrawl team,

I'm Justin Mitchell, CEO of ToolRoute (toolroute.ai). We're a paid Firecrawl customer running scrape requests through your API.

Our product, ToolRoute, is a unified gateway that lets AI agents call multiple tool APIs (Firecrawl, OpenAI, Tavily, etc.) through one billing relationship. Customers send requests to ToolRoute, we forward to Firecrawl, and we bill the customer in pre-paid credits.

**Question:** Section 3 of your Terms of Service says "Use the Services for any commercial purposes except as expressly authorized by Firecrawl." Does our paid subscription count as that express authorization for *resale-as-a-service* (one ToolRoute account fronting many ToolRoute customers' scrape calls), or do we need an enterprise contract with explicit resale rights?

If we need an enterprise contract, I'd love a short call to scope the volume.

Either answer is fine — I just want to make sure ToolRoute's pricing page doesn't make claims your team would push back on.

Thanks,
Justin Mitchell
ToolRoute
justin@automatedaisolutions.ai

---

## 2. Tavily

**To:** sales@tavily.com (or support@tavily.com if no sales contact)
**Subject:** Tavily integration via gateway — clarification on §[resale clause]

Hi Tavily team,

I'm Justin Mitchell, CEO of ToolRoute (toolroute.ai). We're building a unified API gateway that aggregates AI infrastructure tools — Tavily included — under one developer credential.

I want to confirm interpretation of two clauses in your Terms (effective 2026-01-13):

1. "Customer will not...license, sublicense, resell, distribute, lease, rent, lend, transfer, assign or otherwise dispose of the Services."
2. The carve-out: "integration of the Services in Customer Applications in accordance with this Agreement will not constitute a violation."

**Our pattern:** ToolRoute holds one Tavily account. ToolRoute customers (developers building AI agents) call ToolRoute's gateway, which forwards search requests to Tavily and returns the results. ToolRoute marks up the per-call cost and bills the customer in credits.

**Two readings:**
- *Forbidden* — ToolRoute is reselling Tavily access; the gateway is the billed-revenue layer.
- *Permitted* — Each ToolRoute customer integrates Tavily into their *own* AI-agent application via the gateway; the gateway is just a routing tool.

Which reading does Tavily support? If the second, we'd like to launch with a "Tavily search via ToolRoute" credit-based path. If the first, we'll route customers to bring their own Tavily key (BYOK) and we won't claim Tavily coverage in our credit pool.

If enterprise terms with resale rights are available, I'd appreciate a contact in your commercial team.

Thanks,
Justin Mitchell
ToolRoute

---

## 3. Deepgram

**To:** sales@deepgram.com
**Subject:** API commercial terms — ToolRoute gateway integration

Hi Deepgram team,

I'm evaluating Deepgram as one of the speech-to-text providers in ToolRoute (toolroute.ai), an aggregator gateway for AI agents.

I checked deepgram.com/terms but the public document covers website browsing only ("solely for personal non-commercial use") — it doesn't appear to cover commercial API usage. Could you point me to:

1. The current Deepgram API Master Subscription Agreement / Commercial Terms.
2. Whether those terms permit resale-as-a-service patterns: ToolRoute holds one Deepgram account, marks up per-second STT cost, and bills end-customers via ToolRoute's pre-paid credit system. (I.e., one Deepgram account, many ToolRoute customers.)

If standard commercial terms don't cover this pattern, I'd appreciate a contact for enterprise / OEM resale rights.

Thanks,
Justin Mitchell
CEO, ToolRoute
justin@automatedaisolutions.ai

---

## 4. OpenAI

**To:** [OpenAI account dashboard "Contact sales" form, or via your enterprise rep if you have one]
**Subject:** Master-pool resale clarification — ToolRoute (existing API customer)

Hi OpenAI team,

I'm Justin Mitchell, CEO of ToolRoute (toolroute.ai). We're an existing OpenAI API customer.

ToolRoute is a unified gateway that lets AI agents call multiple AI infrastructure providers (OpenAI included) through one billing relationship. Our customers send chat / completion / embedding requests to ToolRoute, we forward to OpenAI, and we bill the customer in pre-paid credits with a markup.

The August 2023 Business Terms had a clause forbidding "resell or lease access to your account or any End User Account," and I want to confirm:

1. **Is that clause still in the current Business Terms / Services Agreement** (effective 2026-01-01)?
2. **Does ToolRoute's pattern qualify as resale-of-account-access** (forbidden) or as "End User construct" (each ToolRoute customer is an OpenAI End User of the ToolRoute application, billed via ToolRoute)?
3. If the strict interpretation applies, what's the path to an enterprise agreement with resale rights for an OpenRouter-style aggregator?

ToolRoute is in pre-launch — we want to make pricing-page claims that don't require future retraction. Either confirmation that the End User reading is correct, or an enterprise discussion, would unblock us.

Thanks,
Justin Mitchell
ToolRoute
justin@automatedaisolutions.ai

---

## What to do with the replies

| Reply pattern | Update |
|---|---|
| "Yes, your paid tier authorizes resale-as-a-service." | Update `lane-6-resale-audit.md` verdict → `master_pool_ok` for that provider. Update `project_toolroute_lane6_resale_findings.md` memory. Pricing page can claim credit-pool coverage. |
| "No — you need an enterprise contract." | Mark verdict `master_pool_ok_with_enterprise`. Track contract-needed list in a separate file. Don't claim coverage on pricing page until contract signed. |
| "No — BYOK only on standard terms." | Mark `byok_only`. Update marketing copy: "Use your X key through ToolRoute." |
| Silence > 14 days | Treat as `byok_only` for safety; re-send once with subject prefix `[Re-ping]`. |

## Cross-reference

- Audit doc: `.agent/lane-6-resale-audit.md`
- Memory: `~/.claude-jarvis/projects/C--Users-Not-John-Or-Justin/memory/project_toolroute_lane6_resale_findings.md`
